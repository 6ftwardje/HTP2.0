-- Private, validated screenshot attachments. Sources never enter Storage;
-- only the trusted image route registers and uploads re-encoded WebP bytes.
begin;

create table public.conversation_attachments (
  id uuid primary key default gen_random_uuid(),
  uploader_student_id uuid references public.students(id) on delete set null,
  upload_intent uuid not null,
  thread_id uuid references public.conversation_threads(id) on delete set null,
  message_id uuid references public.conversation_messages(id) on delete set null,
  object_path text not null unique,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  file_name text not null check (char_length(file_name) between 1 and 120),
  media_type text not null default 'image/webp' check (media_type = 'image/webp'),
  size_bytes integer not null check (size_bytes between 1 and 4194304),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  state text not null default 'pending' check (state in ('pending', 'ready', 'attached', 'garbage', 'deleted')),
  position smallint check (position between 0 and 2),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_attachment_pixels check (width::bigint * height <= 25000000),
  constraint chat_attachment_path check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  constraint chat_attachment_pending_unlinked check (state not in ('pending', 'ready') or message_id is null),
  unique (message_id, position)
);
create index conversation_attachments_message on public.conversation_attachments(message_id, position)
  where message_id is not null;
create index conversation_attachments_uploader on public.conversation_attachments(uploader_student_id, created_at desc);
create unique index conversation_attachments_upload_deduplication
  on public.conversation_attachments(uploader_student_id, upload_intent, content_sha256)
  where state in ('pending', 'ready', 'attached');
alter table public.conversation_attachments enable row level security;
revoke all on public.conversation_attachments from public, anon, authenticated;
grant select (id, message_id, file_name, media_type, size_bytes, width, height, created_at)
  on public.conversation_attachments to authenticated;
grant all on public.conversation_attachments to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('mentor-chat-attachments', 'mentor-chat-attachments', false, 4194304, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Existing broad Storage policies must not authorize this bucket, including
-- direct downloads and signed-URL creation by unrelated platform admins.
create policy mentor_chat_attachments_no_direct_storage
  on storage.objects as restrictive for all to public
  using (bucket_id <> 'mentor-chat-attachments')
  with check (bucket_id <> 'mentor-chat-attachments');

create function public.chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select cp.role from public.conversation_participants cp
  join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
  join public.conversation_threads t on t.id = cp.thread_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and t.source_type = 'mentor_chat' and p.student_id = p_student_id
    and public.current_chat_mentor_id() is not null
    and ((cp.role = 'student' and t.student_id = p_student_id
          and p_student_id <> public.current_chat_mentor_id())
      or (cp.role = 'mentor' and p_student_id = public.current_chat_mentor_id()))
  limit 1;
$$;

create function public.chat_attachment_readable_by_student(p_attachment_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select case when a.message_id is null then
    a.uploader_student_id = p_student_id and a.state in ('pending', 'ready')
      and public.current_chat_mentor_id() is not null
      and (a.thread_id is null or public.chat_attachment_role_for_student(a.thread_id, p_student_id) is not null)
    else a.state = 'attached' and exists (
      select 1 from public.conversation_messages m
      where m.id = a.message_id and m.thread_id = a.thread_id and m.deleted_at is null
        and public.chat_attachment_role_for_student(m.thread_id, p_student_id) is not null
        and (not m.is_internal or public.chat_attachment_role_for_student(m.thread_id, p_student_id) = 'mentor')
    ) end from public.conversation_attachments a where a.id = p_attachment_id), false);
$$;

create function public.can_read_chat_attachment(p_attachment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_chat_student_id() is not null
    and public.chat_attachment_readable_by_student(p_attachment_id, public.current_chat_student_id());
$$;
create policy conversation_attachments_select_visible
  on public.conversation_attachments for select to authenticated
  using (public.can_read_chat_attachment(id));

create function public.chat_attachment_projection(p_attachment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'fileName', a.file_name, 'width', a.width,
    'height', a.height, 'mediaType', a.media_type, 'sizeBytes', a.size_bytes)
  from public.conversation_attachments a where a.id = p_attachment_id;
$$;

-- Only the trusted route can provide validated dimensions/hash/size. It passes
-- the verified auth.getUser() ID, never an actor ID supplied by the browser.
create function public.register_chat_attachment(
  p_auth_uid uuid, p_upload_intent uuid, p_thread_id uuid, p_object_path text,
  p_content_sha256 text, p_file_name text, p_width integer, p_height integer, p_size_bytes integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_mentor uuid; v_attachment public.conversation_attachments%rowtype;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.current_chat_mentor_id();
  if v_mentor is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  if p_upload_intent is null or p_object_path not like p_auth_uid::text || '/%'
     or p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid upload intent' using errcode = '22023';
  end if;
  if p_thread_id is null then
    if v_student = v_mentor then raise exception 'choose a student conversation' using errcode = '42501'; end if;
  else
    perform 1 from public.conversation_threads where id = p_thread_id for share;
    if public.chat_attachment_role_for_student(p_thread_id, v_student) is null then
      raise exception 'chat access denied' using errcode = '42501';
    end if;
  end if;
  -- Serialize all upload quotas for this actor, across tabs and draft intents.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-upload:' || v_student::text, 0));
  select * into v_attachment from public.conversation_attachments
  where uploader_student_id = v_student and upload_intent = p_upload_intent
    and content_sha256 = p_content_sha256 and state in ('pending', 'ready', 'attached') for update;
  if found then
    if v_attachment.thread_id is distinct from p_thread_id and v_attachment.state <> 'attached' then
      raise exception 'upload intent belongs to another conversation' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_attachment.id, 'objectPath', v_attachment.object_path,
      'state', v_attachment.state, 'attachment', public.chat_attachment_projection(v_attachment.id));
  end if;
  if (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and upload_intent = p_upload_intent and state in ('pending', 'ready')) >= 3
    or (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and state in ('pending', 'ready')) >= 12
    or (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'attachment upload limit reached' using errcode = '53300';
  end if;
  insert into public.conversation_attachments(uploader_student_id, upload_intent, thread_id,
    object_path, content_sha256, file_name, width, height, size_bytes)
  values (v_student, p_upload_intent, p_thread_id, p_object_path, p_content_sha256,
    p_file_name, p_width, p_height, p_size_bytes) returning * into v_attachment;
  return jsonb_build_object('id', v_attachment.id, 'objectPath', v_attachment.object_path,
    'state', v_attachment.state, 'attachment', public.chat_attachment_projection(v_attachment.id));
end;
$$;

create function public.complete_chat_attachment_upload(p_auth_uid uuid, p_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attachment public.conversation_attachments%rowtype; v_student uuid;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  select * into v_attachment from public.conversation_attachments where id = p_attachment_id for update;
  if v_student is null or v_attachment.uploader_student_id is distinct from v_student
    or v_attachment.state not in ('pending', 'ready', 'attached') then
    raise exception 'upload unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'mentor-chat-attachments'
      and name = v_attachment.object_path) then
    raise exception 'validated image object missing' using errcode = '55000';
  end if;
  update public.conversation_attachments set state = 'ready' where id = p_attachment_id and state = 'pending';
  return public.chat_attachment_projection(p_attachment_id);
end;
$$;

create function public.get_chat_attachment_download(p_auth_uid uuid, p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  if v_student is null or not public.chat_attachment_readable_by_student(p_attachment_id, v_student) then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  return (select jsonb_build_object('objectPath', object_path, 'mediaType', media_type, 'fileName', file_name)
    from public.conversation_attachments where id = p_attachment_id);
end;
$$;

create function public.discard_chat_attachment(p_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id(); v_attachment public.conversation_attachments%rowtype;
begin
  select * into v_attachment from public.conversation_attachments where id = p_attachment_id for update;
  if v_student is null or v_attachment.uploader_student_id is distinct from v_student
    or v_attachment.message_id is not null or v_attachment.state = 'attached' then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  update public.conversation_attachments set state = 'garbage'
  where id = p_attachment_id and state <> 'deleted';
  return jsonb_build_object('success', true);
end;
$$;

create function public.get_chat_message_attachments(p_message_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id(); v_mentor uuid := public.current_chat_mentor_id(); v_result jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_message_ids), 0) > 100 then
    raise exception 'too many message IDs' using errcode = '22023';
  end if;
  with my_threads as materialized (
    select cp.thread_id, cp.role from public.conversation_participants cp
    join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
    join public.conversation_threads t on t.id = cp.thread_id
    where p.student_id = v_student and cp.active and cp.revoked_at is null
      and t.source_type = 'mentor_chat' and v_mentor is not null
      and ((cp.role = 'student' and t.student_id = v_student and v_student <> v_mentor)
        or (cp.role = 'mentor' and v_student = v_mentor))
  )
  select coalesce(jsonb_agg(jsonb_build_object('messageId', m.id, 'attachments', coalesce((
    select jsonb_agg(public.chat_attachment_projection(a.id) order by a.position, a.id)
    from public.conversation_attachments a where a.message_id = m.id and a.thread_id = m.thread_id and a.state = 'attached'
  ), '[]'::jsonb))), '[]'::jsonb) into v_result
  from public.conversation_messages m join my_threads mt on mt.thread_id = m.thread_id
  where m.id = any(coalesce(p_message_ids, '{}'::uuid[])) and m.deleted_at is null
    and (not m.is_internal or mt.role = 'mentor');
  return v_result;
end;
$$;

-- Keep the proven send implementation intact, but make it an internal entry
-- point. Both public send signatures must check the immutable attachment set;
-- otherwise a bare retry could silently acknowledge a different payload.
alter function public.send_chat_message(text, uuid, uuid, boolean) rename to _send_chat_message_core;

create function public.send_chat_message_with_attachments(
  p_body text, p_client_message_id uuid, p_thread_id uuid default null,
  p_is_internal boolean default false, p_attachment_ids uuid[] default '{}',
  p_upload_intent uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := public.current_chat_student_id(); v_mentor uuid;
  v_thread public.conversation_threads%rowtype; v_existing_id uuid; v_result jsonb;
  v_message_id uuid; v_attachment public.conversation_attachments%rowtype;
  v_expected uuid[]; v_actual uuid[]; v_seen integer := 0; v_dto jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.current_chat_mentor_id();
  if v_mentor is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  p_attachment_ids := coalesce(p_attachment_ids, '{}'::uuid[]);
  if cardinality(p_attachment_ids) > 3 or array_position(p_attachment_ids, null) is not null
    or (select count(distinct x) from unnest(p_attachment_ids) x) <> cardinality(p_attachment_ids)
    or (cardinality(p_attachment_ids) > 0 and p_upload_intent is null) then
    raise exception 'invalid attachment selection' using errcode = '22023';
  end if;
  if p_thread_id is null then
    if v_student = v_mentor or coalesce(p_is_internal, false) then
      raise exception 'choose a student conversation' using errcode = '42501';
    end if;
    -- Acquire the same thread lock before checking whether this send existed.
    -- Bare core sends also take this lock, so retries cannot add attachments to
    -- a previously committed text-only message, even during concurrent sends.
    insert into public.conversation_threads(student_id, assigned_to_student_id, source_type, subject)
    values (v_student, v_mentor, 'mentor_chat', 'Gesprek met Rousso')
    on conflict (student_id) where source_type = 'mentor_chat' and source_id is null do nothing;
    select * into v_thread from public.conversation_threads
    where student_id = v_student and source_type = 'mentor_chat' and source_id is null for update;
  else
    select * into v_thread from public.conversation_threads where id = p_thread_id for update;
    if public.chat_participant_role(p_thread_id) is null then
      raise exception 'chat access denied' using errcode = '42501';
    end if;
  end if;
  select m.id into v_existing_id from public.conversation_messages m
  where m.thread_id = v_thread.id and m.sender_student_id = v_student and m.client_message_id = p_client_message_id;
  v_result := public._send_chat_message_core(p_body, p_client_message_id, p_thread_id, p_is_internal);
  v_message_id := (v_result -> 'message' ->> 'id')::uuid;
  select coalesce(array_agg(x order by x), '{}'::uuid[]) into v_expected from unnest(p_attachment_ids) x;
  if v_existing_id is not null then
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_actual
    from public.conversation_attachments where message_id = v_message_id and state = 'attached';
    if v_actual is distinct from v_expected or exists (
      select 1 from public.conversation_attachments where id = any(p_attachment_ids)
        and upload_intent is distinct from p_upload_intent
    ) then
      raise exception 'client message ID conflicts with attachment payload' using errcode = '22023';
    end if;
  else
    for v_attachment in select * from public.conversation_attachments
      where id = any(p_attachment_ids) order by id for update
    loop
      v_seen := v_seen + 1;
      if v_attachment.uploader_student_id is distinct from v_student
        or v_attachment.state <> 'ready' or v_attachment.message_id is not null
        or v_attachment.upload_intent is distinct from p_upload_intent
        or (v_attachment.thread_id is not null and v_attachment.thread_id <> v_thread.id)
        or (v_attachment.thread_id is null and (v_thread.student_id <> v_student or v_thread.source_id is not null)) then
        raise exception 'attachment unavailable for this message' using errcode = '42501';
      end if;
    end loop;
    if v_seen <> cardinality(p_attachment_ids) then
      raise exception 'attachment unavailable for this message' using errcode = '42501';
    end if;
    update public.conversation_attachments a
    set message_id = v_message_id, thread_id = v_thread.id, state = 'attached',
        position = array_position(p_attachment_ids, a.id) - 1
    where a.id = any(p_attachment_ids);
  end if;
  select coalesce(jsonb_agg(public.chat_attachment_projection(id) order by position, id), '[]'::jsonb)
    into v_dto from public.conversation_attachments where message_id = v_message_id and state = 'attached';
  return jsonb_set(v_result, '{message,attachments}', v_dto, true);
end;
$$;

create function public.send_chat_message(
  p_body text, p_client_message_id uuid, p_thread_id uuid default null,
  p_is_internal boolean default false
)
returns jsonb language sql security definer set search_path = '' as $$
  select public.send_chat_message_with_attachments(p_body, p_client_message_id,
    p_thread_id, p_is_internal, '{}'::uuid[], null::uuid);
$$;

create function public.claim_chat_attachment_garbage(p_limit integer default 100)
returns table(id uuid, object_path text) language plpgsql security definer set search_path = '' as $$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  -- Tombstones retain the hourly quota and catch a late upload after a failed
  -- request. A second cleanup safely removes the same immutable path again.
  return query with candidates as (
    select a.id from public.conversation_attachments a
    where a.message_id is null and (
      a.state = 'garbage' or a.state = 'attached' or a.uploader_student_id is null
      or (a.state in ('pending', 'ready') and a.created_at < now() - interval '24 hours')
      or (a.state = 'deleted' and exists (select 1 from storage.objects o
          where o.bucket_id = 'mentor-chat-attachments' and o.name = a.object_path))
    ) order by a.created_at limit v_limit for update skip locked
  ), claimed as (
    update public.conversation_attachments a set state = 'garbage'
    from candidates c where a.id = c.id returning a.id, a.object_path
  ) select c.id, c.object_path from claimed c;
  return query select null::uuid, o.name from storage.objects o
  where o.bucket_id = 'mentor-chat-attachments' and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.conversation_attachments a where a.object_path = o.name)
  order by o.created_at limit v_limit;
  delete from public.conversation_attachments a
  where a.state = 'deleted' and a.message_id is null and a.deleted_at < now() - interval '24 hours'
    and not exists (select 1 from storage.objects o
      where o.bucket_id = 'mentor-chat-attachments' and o.name = a.object_path);
end;
$$;
create function public.complete_chat_attachment_cleanup(p_attachment_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.conversation_attachments set state = 'deleted', deleted_at = now()
  where id = any(p_attachment_ids) and state = 'garbage' and message_id is null;
$$;

revoke all on function public.chat_attachment_role_for_student(uuid, uuid),
  public.chat_attachment_readable_by_student(uuid, uuid), public.can_read_chat_attachment(uuid),
  public.chat_attachment_projection(uuid),
  public.register_chat_attachment(uuid, uuid, uuid, text, text, text, integer, integer, integer),
  public.complete_chat_attachment_upload(uuid, uuid), public.get_chat_attachment_download(uuid, uuid),
  public.discard_chat_attachment(uuid), public.get_chat_message_attachments(uuid[]),
  public._send_chat_message_core(text, uuid, uuid, boolean), public.send_chat_message(text, uuid, uuid, boolean),
  public.send_chat_message_with_attachments(text, uuid, uuid, boolean, uuid[], uuid),
  public.claim_chat_attachment_garbage(integer), public.complete_chat_attachment_cleanup(uuid[])
  from public, anon, authenticated;
grant execute on function public.can_read_chat_attachment(uuid), public.discard_chat_attachment(uuid),
  public.get_chat_message_attachments(uuid[]), public.send_chat_message_with_attachments(text, uuid, uuid, boolean, uuid[], uuid)
  to authenticated;
grant execute on function public.send_chat_message(text, uuid, uuid, boolean) to authenticated;
grant execute on function public.register_chat_attachment(uuid, uuid, uuid, text, text, text, integer, integer, integer),
  public.complete_chat_attachment_upload(uuid, uuid), public.get_chat_attachment_download(uuid, uuid),
  public.claim_chat_attachment_garbage(integer), public.complete_chat_attachment_cleanup(uuid[])
  to service_role;

comment on table public.conversation_attachments is
  'Private processed screenshots; authenticated metadata reads omit uploader, intent, hash and Storage path. Sources are never stored.';
comment on function public.send_chat_message_with_attachments(text, uuid, uuid, boolean, uuid[], uuid) is
  'Caption-required atomic send/link with same-actor draft intent, ready-state checks and exact idempotent attachment set.';
commit;
