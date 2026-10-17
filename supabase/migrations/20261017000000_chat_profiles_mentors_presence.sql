-- Extend existing private mentor chat. Keep every thread/message identity and
-- the explicit service-configured default; additional mentors come only from
-- the existing trusted user_roles table. Admin access alone grants no chats.
begin;
lock table public.conversation_threads in share row exclusive mode;

-- The default was already explicitly chosen by a trusted service. Record that
-- capability in the role model, so changing the fallback never hides its old
-- conversations. Explicit role/participant revocation remains effective.
insert into public.user_roles(student_id, role)
select c.mentor_student_id, 'mentor' from public.chat_mentor_config c
join public.students s on s.id = c.mentor_student_id
where c.singleton on conflict(student_id, role) do nothing;

-- A student's mentor conversations are distinct. The former default-only
-- uniqueness must go; old IDs and message/read boundaries remain untouched.
drop index public.conversation_threads_default_student_unique;
create unique index conversation_threads_student_mentor_unique
  on public.conversation_threads(student_id, assigned_to_student_id)
  where source_type = 'mentor_chat' and source_id is null;

create function public.is_available_chat_mentor(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_mentor_config c
    join public.students s on s.id = p_student_id
    join auth.users u on u.id = s.auth_user_id
    where c.singleton and c.enabled and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and (c.mentor_student_id = s.id or exists (
        select 1 from public.user_roles r where r.student_id = s.id and r.role = 'mentor'
      ))
  );
$$;

-- Compatibility default used only when an older client omits mentor selection.
create or replace function public.current_chat_mentor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  cross join public.chat_mentor_config c
  where public.is_available_chat_mentor(s.id)
  order by (s.id = c.mentor_student_id) desc, s.name nulls last, s.id limit 1;
$$;

create function public.chat_thread_mentor_id(p_thread_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.assigned_to_student_id from public.conversation_threads t
  where t.id = p_thread_id and t.source_type = 'mentor_chat'
    and t.student_id <> t.assigned_to_student_id
    and public.is_available_chat_mentor(t.assigned_to_student_id);
$$;

-- Internal service routes also use this helper with their verified account ID.
create or replace function public.chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select cp.role from public.conversation_participants cp
  join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
  join public.students s on s.id = p.student_id
  join auth.users u on u.id = s.auth_user_id
  join public.conversation_threads t on t.id = cp.thread_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and p.student_id = p_student_id and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and public.chat_thread_mentor_id(t.id) is not null
    and ((cp.role = 'student' and t.student_id = p_student_id)
      or (cp.role = 'mentor' and t.assigned_to_student_id = p_student_id))
  limit 1;
$$;

create or replace function public.chat_participant_role(p_thread_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select public.chat_attachment_role_for_student(p_thread_id, public.current_chat_student_id());
$$;

-- Configuration changes the fallback mentor for new conversations. It cannot
-- move or merge existing conversations with another mentor. Legacy unassigned
-- threads may be adopted once, with their original history and authors intact.
create or replace function public.configure_chat_mentor(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_principal uuid; v_thread public.conversation_threads%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'trusted service required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s join auth.users u on u.id = s.auth_user_id
    where s.id = p_student_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())) then
    raise exception 'mentor must be a live platform account' using errcode = '22023';
  end if;
  perform 1 from public.chat_mentor_config where singleton for update;
  insert into public.user_roles(student_id, role) values(p_student_id, 'mentor')
    on conflict(student_id, role) do nothing;
  insert into public.chat_principals(kind, student_id, display_name)
  select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
  from public.students s where s.id = p_student_id
  on conflict (student_id) where kind = 'human'
  do update set display_name = excluded.display_name returning id into v_principal;
  for v_thread in select * from public.conversation_threads
    where source_type = 'mentor_chat' and source_id is null
      and assigned_to_student_id is null and student_id <> p_student_id
    order by id for update
  loop
    update public.conversation_participants set active = false, revoked_at = now()
      where thread_id = v_thread.id and role = 'mentor' and active;
    insert into public.conversation_participants(thread_id, principal_id, role, active, last_read_public_seq)
    values(v_thread.id, v_principal, 'mentor', true,
      case when v_thread.unread_for_mentor_count = 0 then v_thread.last_public_message_seq else 0 end)
    on conflict(thread_id, principal_id, role) do nothing;
    update public.conversation_threads set assigned_to_student_id = p_student_id,
      chat_version = chat_version + 1 where id = v_thread.id;
  end loop;
  update public.chat_mentor_config set mentor_student_id = p_student_id, enabled = true,
    updated_at = now() where singleton;
  return jsonb_build_object('configured', true, 'mentorStudentId', p_student_id);
end;
$$;

create function public.open_chat_thread(p_mentor_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id();
  v_thread public.conversation_threads%rowtype; v_created boolean := false;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  if v_student = p_mentor_student_id or not public.is_available_chat_mentor(p_mentor_student_id) then
    raise exception 'chat mentor unavailable' using errcode = '42501';
  end if;
  insert into public.conversation_threads(student_id, assigned_to_student_id, source_type, subject)
  select v_student, s.id, 'mentor_chat', 'Gesprek met ' || coalesce(nullif(btrim(s.name), ''), 'je mentor')
  from public.students s where s.id = p_mentor_student_id
  on conflict(student_id, assigned_to_student_id) where source_type = 'mentor_chat' and source_id is null do nothing
  returning * into v_thread;
  v_created := found;
  if not v_created then
    select * into v_thread from public.conversation_threads
    where student_id = v_student and assigned_to_student_id = p_mentor_student_id
      and source_type = 'mentor_chat' and source_id is null for update;
  else
    insert into public.chat_principals(kind, student_id, display_name)
    select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
    from public.students s where s.id in (v_student, p_mentor_student_id)
    on conflict(student_id) where kind = 'human' do nothing;
    insert into public.conversation_participants(thread_id, principal_id, role, active)
    select v_thread.id, p.id, case when p.student_id = v_student then 'student' else 'mentor' end, true
    from public.chat_principals p where p.kind = 'human' and p.student_id in (v_student, p_mentor_student_id);
  end if;
  -- A revoked participant never regains access through an open/retry request.
  if public.chat_participant_role(v_thread.id) is distinct from 'student' then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  return jsonb_build_object('threadId', v_thread.id);
end;
$$;

create function public.can_read_chat_profile(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_chat_student_id() is not null and exists (
    select 1 from public.students s join auth.users u on u.id = s.auth_user_id
    where s.id = p_student_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) and (
        s.id = public.current_chat_student_id() or public.is_available_chat_mentor(s.id)
        or exists (
          select 1 from public.conversation_threads t
          where public.chat_participant_role(t.id) is not null and (
            t.student_id = s.id or t.assigned_to_student_id = s.id or exists (
              select 1 from public.conversation_messages m where m.thread_id = t.id
                and m.sender_student_id = s.id and m.deleted_at is null
                and (not m.is_internal or public.chat_participant_role(t.id) = 'mentor')
            )
          )
        )
      )
  );
$$;

-- Deliberately omit email, phone, billing, notes and directory/admin fields.
create function public.get_chat_profiles(p_student_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.current_chat_student_id() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_student_ids), 0) > 200 then raise exception 'too many profile IDs' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId', s.id,
    'displayName', coalesce(nullif(btrim(s.name), ''), 'Platformlid'),
    'role', case when s.access_level = 3 or exists (select 1 from public.user_roles r where r.student_id=s.id and r.role='admin') then 'admin'
      when public.is_available_chat_mentor(s.id) or exists (select 1 from public.user_roles r where r.student_id=s.id and r.role='mentor') then 'mentor' else 'student' end,
    'avatarPath', a.object_path) order by s.name, s.id), '[]'::jsonb) into v_result
  from public.students s left join public.student_avatars a on a.student_id = s.id
  where s.id = any(coalesce(p_student_ids, '{}'::uuid[])) and public.can_read_chat_profile(s.id);
  return v_result;
end;
$$;
create policy avatars_read_chat on public.student_avatars for select to authenticated
  using(public.can_read_chat_profile(student_id));

create function public.get_chat_mentors()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id(); v_result jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId', s.id,
    'displayName', coalesce(nullif(btrim(s.name), ''), 'Mentor'),
    'role', case when s.access_level = 3 or exists(select 1 from public.user_roles r where r.student_id=s.id and r.role='admin') then 'admin' else 'mentor' end,
    'avatarPath', a.object_path, 'threadId', t.id,
    'unreadCount', coalesce(t.unread_for_student_count, 0))
    order by (s.id = c.mentor_student_id) desc, s.name, s.id), '[]'::jsonb) into v_result
  from public.students s cross join public.chat_mentor_config c
  left join public.student_avatars a on a.student_id = s.id
  left join public.conversation_threads t on t.student_id = v_student and t.assigned_to_student_id = s.id
    and t.source_type='mentor_chat' and t.source_id is null and public.chat_participant_role(t.id)='student'
  where s.id <> v_student and public.is_available_chat_mentor(s.id)
    and not exists (
      select 1 from public.conversation_threads existing
      where existing.student_id = v_student and existing.assigned_to_student_id = s.id
        and existing.source_type = 'mentor_chat' and existing.source_id is null
        and public.chat_participant_role(existing.id) is distinct from 'student'
    );
  return v_result;
end;
$$;

create or replace function public.get_my_chat_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id(); v_mentor uuid := public.current_chat_mentor_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  return jsonb_build_object('available', v_mentor is not null,
    'isMentor', public.is_available_chat_mentor(v_student),
    'unreadCount', coalesce((select sum(case when public.chat_participant_role(t.id)='mentor'
      then t.unread_for_mentor_count else t.unread_for_student_count end)
      from public.conversation_threads t where t.source_type='mentor_chat' and public.chat_participant_role(t.id) is not null),0),
    'mentor', case when v_mentor is null then null else (
      select jsonb_build_object('studentId',s.id,'displayName',coalesce(nullif(btrim(s.name),''),'Mentor'),
        'avatarPath',a.object_path) from public.students s left join public.student_avatars a on a.student_id=s.id where s.id=v_mentor) end);
end;
$$;


-- Existing atomic message and attachment validation, now selecting a pair.
create or replace function public._send_chat_message_core(
  p_body text, p_client_message_id uuid, p_thread_id uuid default null,
  p_is_internal boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid;
  v_thread public.conversation_threads%rowtype;
  v_message public.conversation_messages%rowtype;
  v_principal uuid;
  v_mentor_principal uuid;
  v_role text;
  v_body text := regexp_replace(replace(coalesce(p_body, ''), E'\r\n', E'\n'),
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if v_student_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor_id := public.current_chat_mentor_id();
  if v_mentor_id is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  if p_client_message_id is null then raise exception 'client message ID required' using errcode = '22023'; end if;
  if p_thread_id is null then
    if v_student_id = v_mentor_id or coalesce(p_is_internal, false) then
      raise exception 'choose a student conversation' using errcode = '42501';
    end if;
    p_thread_id := (public.open_chat_thread(v_mentor_id)->>'threadId')::uuid;
  end if;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  if v_thread.id is null or v_thread.source_type <> 'mentor_chat' then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  v_role := public.chat_participant_role(v_thread.id);
  if v_role is null or (coalesce(p_is_internal, false) and v_role <> 'mentor') then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  select id into v_principal from public.chat_principals where student_id = v_student_id and kind = 'human';
  select * into v_message from public.conversation_messages
  where thread_id = v_thread.id and sender_principal_id = v_principal
    and client_message_id = p_client_message_id;
  if found then
    if v_message.body is distinct from v_body
       or v_message.is_internal is distinct from coalesce(p_is_internal, false) then
      raise exception 'client message ID conflicts with a different message' using errcode = '22023';
    end if;
    return jsonb_build_object('threadId', v_thread.id, 'message', to_jsonb(v_message));
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'message must contain between 1 and 5000 characters' using errcode = '22023';
  end if;
  if v_thread.chat_mode = 'paused' then
    raise exception 'chat temporarily read-only' using errcode = '55000';
  end if;
  -- Retries above never consume a new quota. The thread lock serializes this
  -- per-sender rolling limit for the one-conversation product model.
  if (select count(*) from public.conversation_messages m
      where m.thread_id = v_thread.id and m.sender_principal_id = v_principal
        and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'message rate limit reached; retry shortly' using errcode = 'P0001';
  end if;
  insert into public.conversation_messages(thread_id, sender_student_id, sender_role,
    body, client_message_id, is_internal)
  values (v_thread.id, v_student_id, v_role, v_body, p_client_message_id, coalesce(p_is_internal, false))
  returning * into v_message;
  return jsonb_build_object('threadId', v_thread.id, 'message', to_jsonb(v_message));
end;
$$;

create or replace function public.send_chat_message_with_attachments(
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
    p_thread_id := (public.open_chat_thread(v_mentor)->>'threadId')::uuid;
  end if;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  if public.chat_participant_role(p_thread_id) is null then
    raise exception 'chat access denied' using errcode = '42501';
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

-- Route message notifications to the active mentor of this exact thread.
create or replace function public.handle_conversation_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_thread public.conversation_threads%rowtype;
  v_event_id uuid;
  v_recipient_id uuid;
  v_sender_name text;
begin
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if not found then return new; end if;
  if v_thread.source_type = 'mentor_chat' then
    if not new.is_internal then
      update public.conversation_threads
      set last_message_at = new.created_at,
          last_public_message_id = new.id,
          last_student_message_at = case when new.sender_role = 'student'
            then new.created_at else last_student_message_at end,
          last_mentor_message_at = case when new.sender_role = 'mentor'
            then new.created_at else last_mentor_message_at end,
          unread_for_mentor_count = unread_for_mentor_count + case when new.sender_role = 'student' then 1 else 0 end,
          unread_for_student_count = unread_for_student_count + case when new.sender_role = 'mentor' then 1 else 0 end,
          status = case when new.sender_role = 'student' then 'pending_mentor' else 'pending_student' end,
          first_response_at = case when new.sender_role = 'mentor'
            then coalesce(first_response_at, new.created_at) else first_response_at end,
          closed_at = null
      where id = new.thread_id;

      select p.student_id into v_recipient_id
      from public.conversation_participants cp
      join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
      where cp.thread_id = new.thread_id and cp.active and cp.revoked_at is null
        and cp.role = case when new.sender_role = 'student' then 'mentor' else 'student' end
        and (cp.role <> 'mentor' or p.student_id = v_thread.assigned_to_student_id);
      if v_recipient_id is null then
        raise exception 'chat recipient unavailable' using errcode = '42501';
      end if;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values (
        case when new.sender_role = 'student' then 'mentor_new_message' else 'mentor_reply' end,
        new.sender_student_id, 'conversation_threads', new.thread_id::text,
        case when new.sender_role = 'student' then 'Nieuw chatbericht' else 'Je hebt een nieuw bericht' end,
        'Open je gesprek om het bericht te lezen.',
        case when new.sender_role = 'student' then '/mentor-inbox?thread=' || new.thread_id::text else '/mentor?mentor=' || v_thread.assigned_to_student_id::text end,
        jsonb_build_object('thread_id', new.thread_id, 'message_id', new.id, 'public_seq', new.public_seq)
      ) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      values (v_event_id, v_recipient_id);
    end if;
  else
    -- Preserve the pre-existing notification behavior for unrelated sources.
    if new.sender_role = 'student' then
      update public.conversation_threads
      set last_message_at = new.created_at, last_student_message_at = new.created_at,
          unread_for_mentor_count = unread_for_mentor_count + 1,
          status = case when status = 'closed' then 'open' else 'pending_mentor' end,
          closed_at = null where id = new.thread_id;
      select coalesce(name, email, 'Student') into v_sender_name
      from public.students where id = new.sender_student_id;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values ('mentor_new_message', new.sender_student_id, 'conversation_threads',
        new.thread_id::text, 'Nieuwe mentorvraag',
        left(coalesce(v_sender_name, 'Student') || ': ' || new.body, 240),
        '/admin/mentor-inbox?thread=' || new.thread_id::text,
        jsonb_build_object('thread_id', new.thread_id)) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      select v_event_id, s.id from public.students s where s.access_level = 3 on conflict do nothing;
    elsif new.sender_role in ('mentor', 'admin', 'ai') and not new.is_internal then
      update public.conversation_threads
      set last_message_at = new.created_at, last_mentor_message_at = new.created_at,
          unread_for_student_count = unread_for_student_count + 1,
          status = 'pending_student', first_response_at = coalesce(first_response_at, new.created_at),
          closed_at = null where id = new.thread_id;
      select nullif(btrim(name), '') into v_sender_name from public.students where id = new.sender_student_id;
      v_sender_name := case when new.sender_role = 'ai' then 'AI-assistent' else coalesce(v_sender_name, 'Je mentor') end;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values ('mentor_reply', new.sender_student_id, 'conversation_threads', new.thread_id::text,
        v_sender_name || ' heeft geantwoord', left(new.body, 240), '/mentor',
        jsonb_build_object('thread_id', new.thread_id)) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      values (v_event_id, v_thread.student_id) on conflict do nothing;
    else
      update public.conversation_threads set last_message_at = new.created_at where id = new.thread_id;
    end if;
  end if;
  insert into public.conversation_events(thread_id, actor_student_id, event_type, metadata)
  values (new.thread_id, new.sender_student_id, 'message_created',
    jsonb_build_object('message_id', new.id, 'sender_role', new.sender_role, 'is_internal', new.is_internal));
  return new;
end;
$$;

create or replace function public.get_chat_message_attachments(p_message_ids uuid[])
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
      and public.chat_participant_role(t.id) = cp.role
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

create or replace function public.get_mentor_inbox(
  p_status text default 'active', p_query text default '', p_limit integer default 40,
  p_cursor text default null, p_selected_thread_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_query text := btrim(coalesce(p_query, ''));
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
  v_count integer := 0;
  v_has_more boolean := false;
  v_next_cursor text;
  v_selected jsonb;
begin
  if public.current_chat_student_id() is null
     or not public.is_available_chat_mentor(public.current_chat_student_id()) then
    raise exception 'mentor chat access required' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      v_cursor_at := (p_cursor::jsonb ->> 'at')::timestamptz;
      v_cursor_id := (p_cursor::jsonb ->> 'id')::uuid;
      if v_cursor_at is null or v_cursor_id is null then raise invalid_text_representation; end if;
    exception when others then
      raise exception 'invalid inbox cursor' using errcode = '22023';
    end;
  end if;
  for v_row in
    select t.id, coalesce(t.last_message_at, t.created_at) sort_at
    from public.conversation_threads t join public.students s on s.id = t.student_id
    where t.source_type = 'mentor_chat' and public.chat_participant_role(t.id) = 'mentor'
      and case
        when p_status = 'all' then true
        when p_status = 'unread' then t.unread_for_mentor_count > 0
        when p_status in ('open', 'pending_mentor', 'pending_student', 'snoozed', 'closed') then t.status = p_status
        else t.status <> 'closed' end
      and (v_query = '' or position(lower(v_query) in lower(coalesce(s.name, ''))) > 0
        or position(lower(v_query) in lower(coalesce(t.subject, ''))) > 0
        or exists (select 1 from public.conversation_messages m
          where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
            and position(lower(v_query) in lower(m.body)) > 0))
      and (v_cursor_at is null or (coalesce(t.last_message_at, t.created_at), t.id) < (v_cursor_at, v_cursor_id))
    order by coalesce(t.last_message_at, t.created_at) desc, t.id desc limit v_limit + 1
  loop
    v_count := v_count + 1;
    if v_count > v_limit then v_has_more := true; exit; end if;
    v_rows := v_rows || jsonb_build_array(public.mentor_chat_thread_projection(v_row.id));
    v_next_cursor := jsonb_build_object('at', v_row.sort_at, 'id', v_row.id)::text;
  end loop;
  if p_selected_thread_id is not null then
    v_selected := public.mentor_chat_thread_projection(p_selected_thread_id);
  end if;
  return jsonb_build_object('rows', v_rows, 'selectedThread', v_selected,
    'hasMore', v_has_more, 'nextCursor', case when v_has_more then v_next_cursor else null end);
end;
$$;

create or replace function public.get_my_notification_shell()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid := public.current_chat_mentor_id();
  v_is_admin boolean;
  v_result jsonb;
begin
  if v_student_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select s.access_level = 3 into v_is_admin from public.students s where s.id = v_student_id;
  with my_threads as materialized (
    select cp.thread_id, cp.role
    from public.conversation_participants cp
    join public.chat_principals p on p.id = cp.principal_id
    join public.conversation_threads t on t.id = cp.thread_id
    where p.kind = 'human' and p.student_id = v_student_id
      and cp.active and cp.revoked_at is null and t.source_type = 'mentor_chat'
      and public.chat_participant_role(t.id) = cp.role
  ), own_events as materialized (
    select nr.id, nr.created_at, nr.read_at, ne.type, ne.title, ne.body, ne.href,
      ne.target_table, ne.metadata,
      case
        when ne.target_table = 'conversation_threads'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ne.target_id::uuid
        when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (ne.metadata ->> 'thread_id')::uuid
        when ne.target_table = 'conversation_messages'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
        else null
      end thread_id
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    where nr.student_id = v_student_id and nr.archived_at is null
  ), classified as materialized (
    select e.*, case when t.id is not null and t.source_type <> 'mentor_chat' then false
      else e.type in ('mentor_new_message', 'mentor_reply')
        or e.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
        or e.metadata ? 'thread_id' end is_chat
    from own_events e left join public.conversation_threads t on t.id = e.thread_id
  ), visible as materialized (
    select e.id, e.created_at, e.read_at, e.title, e.body, e.href
    from classified e left join my_threads mt on mt.thread_id = e.thread_id
    where case when e.is_chat then mt.thread_id is not null
      and (e.type <> 'mentor_new_message' or mt.role = 'mentor')
      and (e.type <> 'mentor_reply' or mt.role = 'student')
    else v_is_admin or e.type in ('mentor_reply', 'weekly_update.published',
      'live_session.scheduled', 'live_session.cancelled',
      'subscription.bonus_expired', 'subscription.payment_failed') end
  )
  select jsonb_build_object(
    'studentId', v_student_id,
    'unreadCount', (select count(*) from visible where read_at is null),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'created_at', r.created_at, 'read_at', r.read_at,
        'event', jsonb_build_object('title', r.title, 'body', r.body, 'href', r.href)
      ) order by r.created_at desc, r.id desc)
      from (select * from visible order by created_at desc, id desc limit 8) r
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Email delivery keeps its existing privacy, preference and retry checks,
-- but the immutable job belongs to its own thread mentor, never the default.
create or replace function public.enqueue_chat_email_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient record; v_existing uuid; v_mentor uuid;
begin
  if new.is_internal or new.deleted_at is not null or new.public_seq is null
    or new.sender_role not in ('student','mentor') then return new; end if;
  v_mentor:=public.chat_thread_mentor_id(new.thread_id);
  if v_mentor is null then return new; end if;
  select cp.id as participant_id,p.student_id,cp.role into v_recipient
  from public.conversation_threads t
  join public.conversation_participants cp on cp.thread_id=t.id and cp.active and cp.revoked_at is null
  join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
  where t.id=new.thread_id and t.source_type='mentor_chat' and t.student_id<>v_mentor
    and cp.role=case when new.sender_role='student' then 'mentor' else 'student' end
    and ((cp.role='mentor' and p.student_id=v_mentor) or (cp.role='student' and p.student_id=t.student_id));
  if not found then return new; end if;
  if not coalesce((select enabled from public.chat_email_preferences where student_id=v_recipient.student_id),true)
    or public.chat_email_is_suppressed(v_recipient.student_id) then return new; end if;
  -- send_chat_message already serializes inserts on the thread. The first event
  -- starts the window; later messages extend the range without delaying delivery.
  select id into v_existing from public.chat_email_outbox
  where thread_id=new.thread_id and recipient_participant_id=v_recipient.participant_id
    and status in ('queued','retry') and first_attempt_at is null and due_at>now()
  order by created_at desc limit 1 for update;
  if v_existing is not null then
    update public.chat_email_outbox set last_public_seq=new.public_seq,last_message_id=new.id where id=v_existing;
  else
    insert into public.chat_email_outbox(thread_id,recipient_participant_id,recipient_student_id,recipient_role,
      mentor_student_id,first_public_seq,last_public_seq,last_message_id,due_at)
    values(new.thread_id,v_recipient.participant_id,v_recipient.student_id,v_recipient.role,
      v_mentor,new.public_seq,new.public_seq,new.id,now()+interval '2 minutes');
  end if;
  return new;
end;
$$;

create or replace function public.chat_email_recipient_snapshot(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_job public.chat_email_outbox; v_thread public.conversation_threads; v_recipient record; v_mentor uuid;
begin
  select * into v_job from public.chat_email_outbox where id=p_id;
  if not found then return jsonb_build_object('allowed',false,'reason','job_unavailable'); end if;
  -- Starting delivery after a disabled pilot must not replay an old backlog.
  -- Already-attempted jobs retain their separate provider idempotency deadline.
  if v_job.first_attempt_at is null and v_job.created_at<now()-interval '24 hours' then
    return jsonb_build_object('allowed',false,'reason','notification_expired'); end if;
  v_mentor:=public.chat_thread_mentor_id(v_job.thread_id);
  if v_mentor is null or v_job.mentor_student_id<>v_mentor then return jsonb_build_object('allowed',false,'reason','mentor_changed'); end if;
  select * into v_thread from public.conversation_threads where id=v_job.thread_id and source_type='mentor_chat';
  if not found or v_thread.student_id=v_mentor then return jsonb_build_object('allowed',false,'reason','thread_unavailable'); end if;
  select cp.role,cp.last_read_public_seq,p.student_id,u.email,u.email_confirmed_at,u.deleted_at,u.banned_until into v_recipient
  from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
  join public.students s on s.id=p.student_id join auth.users u on u.id=s.auth_user_id
  where cp.id=v_job.recipient_participant_id and cp.thread_id=v_job.thread_id and cp.active and cp.revoked_at is null
    and p.student_id=v_job.recipient_student_id and cp.role=v_job.recipient_role
    and ((cp.role='mentor' and p.student_id=v_mentor) or (cp.role='student' and p.student_id=v_thread.student_id));
  if not found then return jsonb_build_object('allowed',false,'reason','recipient_revoked'); end if;
  if v_recipient.deleted_at is not null or (v_recipient.banned_until is not null and v_recipient.banned_until>now())
    or v_recipient.email is null or v_recipient.email_confirmed_at is null then
    return jsonb_build_object('allowed',false,'reason','account_unavailable'); end if;
  if not exists (select 1 from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
    where cp.thread_id=v_thread.id and cp.active and cp.revoked_at is null and cp.role='student' and p.student_id=v_thread.student_id)
    or not exists (select 1 from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
    where cp.thread_id=v_thread.id and cp.active and cp.revoked_at is null and cp.role='mentor' and p.student_id=v_mentor) then
    return jsonb_build_object('allowed',false,'reason','participation_changed'); end if;
  if not coalesce((select enabled from public.chat_email_preferences where student_id=v_recipient.student_id),true) then
    return jsonb_build_object('allowed',false,'reason','preference_disabled'); end if;
  if public.chat_email_is_suppressed(v_recipient.student_id) then return jsonb_build_object('allowed',false,'reason','email_suppressed'); end if;
  if v_recipient.last_read_public_seq>=v_job.last_public_seq or not exists (
    select 1 from public.conversation_messages m where m.thread_id=v_job.thread_id and not m.is_internal and m.deleted_at is null
      and m.public_seq>v_recipient.last_read_public_seq and m.public_seq<=v_job.last_public_seq
      and m.sender_role=case when v_job.recipient_role='student' then 'mentor' else 'student' end
  ) then return jsonb_build_object('allowed',false,'reason','already_read'); end if;
  return jsonb_build_object('allowed',true,'email',lower(btrim(v_recipient.email)),
    'recipientStudentId',v_recipient.student_id,'recipientRole',v_recipient.role,'mentorStudentId',v_mentor,
    'threadId',v_thread.id,'lastReadSeq',v_recipient.last_read_public_seq,'lastPublicSeq',v_thread.last_public_message_seq);
end;
$$;

-- Campaign email is optional. Update its existing helper only when installed;
-- chat deployment must not create campaign RPCs or require its tables.
do $optional_email$
begin
  if to_regprocedure('public.email_mentor_unread(uuid,text)') is not null then
    execute $definition$
create or replace function public.email_mentor_unread(p_contact_id uuid,p_message_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_result boolean; v_preference boolean;
begin
  -- This phase requires the private-participant chat cutover. Legacy counters
  -- cannot prove authorization/read state, so absence of that cutover is closed.
  if to_regclass('public.conversation_participants') is null or to_regclass('public.chat_mentor_config') is null then return false; end if;
  -- Honor the chat UI preference when the separate immediate-notification phase
  -- is installed. A user disabling chat email must also stop delayed reminders.
  if to_regclass('public.chat_email_preferences') is not null then
    execute 'select coalesce(p.enabled,true) from public.email_contacts c join public.students s on s.auth_user_id=c.auth_user_id left join public.chat_email_preferences p on p.student_id=s.id where c.id=$1'
      into v_preference using p_contact_id;
    if not coalesce(v_preference,false) then return false; end if;
  end if;
  execute $query$
    select exists(
      select 1 from public.conversation_messages m
      join public.conversation_threads t on t.id=m.thread_id
      join public.students s on s.id=t.student_id
      join public.email_contacts c on c.auth_user_id=s.auth_user_id
      join public.chat_principals recipient on recipient.student_id=s.id and recipient.kind='human'
      join public.conversation_participants cp on cp.thread_id=t.id and cp.principal_id=recipient.id and cp.role='student' and cp.active and cp.revoked_at is null
      join public.conversation_participants sender on sender.id=m.sender_participant_id and sender.thread_id=t.id and sender.role='mentor' and sender.active and sender.revoked_at is null
      join public.chat_principals mentor on mentor.id=sender.principal_id and mentor.kind='human'
      -- Authorize this thread's actual mentor, including former defaults.
      join public.chat_mentor_config cfg on cfg.singleton and cfg.enabled
      join public.students ms on ms.id=mentor.student_id
      join auth.users mu on mu.id=ms.auth_user_id and mu.deleted_at is null and (mu.banned_until is null or mu.banned_until<=now())
      where public.chat_thread_mentor_id(t.id)=mentor.student_id
        and c.id=$1 and m.id::text=$2 and t.source_type='mentor_chat' and t.chat_mode='human'
        and m.sender_role in ('mentor','admin') and m.sender_principal_id=sender.principal_id
        and not m.is_internal and m.deleted_at is null and m.public_seq>cp.last_read_public_seq
    )
  $query$ into v_result using p_contact_id,p_message_id;
  return v_result;
end;
$$;
    $definition$;
    revoke all on function public.email_mentor_unread(uuid,text) from public,anon,authenticated;
    grant execute on function public.email_mentor_unread(uuid,text) to service_role;
  end if;
end;
$optional_email$;

-- Presence is authenticated per browser tab. A closed tab removes only its
-- session; a dropped connection expires in 65 seconds. Rows are private and
-- polling returns only identities whose minimal profiles the caller may see.
create table public.chat_presence_sessions (
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key(student_id, session_id)
);
alter table public.chat_presence_sessions enable row level security;
revoke all on public.chat_presence_sessions from public, anon, authenticated;
grant all on public.chat_presence_sessions to service_role;

create function public.chat_presence_heartbeat(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_session_id is null then raise exception 'session ID required' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-presence:' || v_student::text, 0));
  delete from public.chat_presence_sessions where student_id=v_student and last_seen_at < now()-interval '65 seconds';
  if not exists(select 1 from public.chat_presence_sessions where student_id=v_student and session_id=p_session_id)
    and (select count(*) from public.chat_presence_sessions where student_id=v_student)>=12 then
    raise exception 'presence session limit reached' using errcode='53300';
  end if;
  insert into public.chat_presence_sessions(student_id,session_id,last_seen_at)
  values(v_student,p_session_id,statement_timestamp())
  on conflict(student_id,session_id) do update set last_seen_at=excluded.last_seen_at;
end;
$$;
create function public.chat_presence_leave(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  delete from public.chat_presence_sessions where student_id=v_student and session_id=p_session_id;
end;
$$;
create function public.list_chat_presence(p_student_ids uuid[])
returns table(student_id uuid,last_seen_at timestamptz,server_now timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_chat_student_id() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if coalesce(cardinality(p_student_ids),0)>200 then raise exception 'too many presence IDs' using errcode='22023'; end if;
  return query select ps.student_id,max(ps.last_seen_at),statement_timestamp()
  from public.chat_presence_sessions ps where ps.student_id=any(coalesce(p_student_ids,'{}'::uuid[]))
    and ps.last_seen_at>statement_timestamp()-interval '65 seconds'
    and public.can_read_chat_profile(ps.student_id)
  group by ps.student_id;
end;
$$;

-- Replacements retain their existing grants. Narrow newly added helpers are
-- service-internal unless explicitly needed by RLS or the authenticated UI.
revoke all on function public.is_available_chat_mentor(uuid), public.chat_thread_mentor_id(uuid),
  public.open_chat_thread(uuid), public.can_read_chat_profile(uuid), public.get_chat_profiles(uuid[]),
  public.get_chat_mentors(), public.chat_presence_heartbeat(uuid), public.chat_presence_leave(uuid),
  public.list_chat_presence(uuid[]) from public, anon, authenticated;
grant execute on function public.open_chat_thread(uuid), public.can_read_chat_profile(uuid),
  public.get_chat_profiles(uuid[]), public.get_chat_mentors(), public.chat_presence_heartbeat(uuid),
  public.chat_presence_leave(uuid), public.list_chat_presence(uuid[]) to authenticated;

comment on function public.configure_chat_mentor(uuid) is
  'Service-only default mentor selection; existing pair conversations are never rotated or merged.';
comment on function public.get_chat_profiles(uuid[]) is
  'Authenticated minimal profile projection: self, available mentors, and authors/participants in currently authorized chats.';
comment on table public.chat_presence_sessions is
  'Private per-tab authenticated heartbeat leases. Query online users only through scoped list_chat_presence; no activity timestamps in public profile data.';
-- Preserve existing realtime chat delivery on fresh/local installs as well.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_threads'
  ) then
    alter publication supabase_realtime add table public.conversation_threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_recipients'
  ) then
    alter publication supabase_realtime add table public.notification_recipients;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
