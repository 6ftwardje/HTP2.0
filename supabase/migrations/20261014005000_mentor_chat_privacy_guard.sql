-- Deployable privacy-only boundary for the existing direct-write chat UI.
-- The subsequent RPC/participant migration must wait for its matching UI.
-- Existing free members keep their chat flow; only the explicit mentor receives
-- student messages or gains staff chat access. Configuration starts unset.

begin;

lock table public.conversation_threads, public.conversation_messages in access exclusive mode;

create table public.chat_mentor_config (
  singleton boolean primary key default true check (singleton),
  mentor_student_id uuid references public.students(id) on delete set null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.chat_mentor_config(singleton) values (true);
alter table public.chat_mentor_config enable row level security;
revoke all on public.chat_mentor_config from public, anon, authenticated;
grant all on public.chat_mentor_config to service_role;

create function public.legacy_chat_current_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.students s join auth.users u on u.id = s.auth_user_id
  where s.auth_user_id = auth.uid() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now()) limit 1;
$$;
create function public.legacy_chat_mentor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.mentor_student_id from public.chat_mentor_config c
  join public.students s on s.id = c.mentor_student_id
  join auth.users u on u.id = s.auth_user_id
  where c.singleton and c.enabled and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
$$;
create function public.legacy_chat_thread_role(p_thread_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when public.legacy_chat_current_student_id() = public.legacy_chat_mentor_id()
                then 'mentor' else 'student' end
  from public.conversation_threads t
  where t.id = p_thread_id and t.source_type = 'mentor_chat'
    and public.legacy_chat_mentor_id() is not null
    and t.student_id <> public.legacy_chat_mentor_id()
    and (t.student_id = public.legacy_chat_current_student_id()
      or public.legacy_chat_current_student_id() = public.legacy_chat_mentor_id());
$$;

create function public.configure_chat_mentor(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'trusted service required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.students s join auth.users u on u.id = s.auth_user_id
    where s.id = p_student_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'mentor must be a live platform account' using errcode = '22023';
  end if;
  perform 1 from public.chat_mentor_config where singleton for update;
  update public.chat_mentor_config
  set mentor_student_id = p_student_id, enabled = true, updated_at = now() where singleton;
  update public.conversation_threads set assigned_to_student_id = p_student_id
  where source_type = 'mentor_chat';
  update public.notification_recipients nr set archived_at = coalesce(nr.archived_at, now())
  from public.notification_events ne
  where ne.id = nr.event_id and ne.type = 'mentor_new_message' and nr.student_id <> p_student_id;
  return jsonb_build_object('configured', true, 'mentorStudentId', p_student_id);
end;
$$;

-- Before-write guards make direct legacy requests safe without trusting their
-- supplied identity, assignment, staff role or internal-note flag.
create function public.guard_legacy_chat_thread_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_student uuid := public.legacy_chat_current_student_id(); v_mentor uuid;
begin
  if new.source_type <> 'mentor_chat' and (tg_op = 'INSERT' or old.source_type <> 'mentor_chat') then
    return new;
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.legacy_chat_mentor_id();
  -- Trusted service maintenance is separately protected by connection grants.
  if auth.uid() is null then return new; end if;
  if v_student is null or v_mentor is null then
    raise exception 'chat mentor unavailable' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.student_id <> v_student or v_student = v_mentor or new.source_id is not null
       or new.status <> 'open' or new.priority <> 'normal'
       or new.unread_for_student_count <> 0 or new.unread_for_mentor_count <> 0 then
      raise exception 'chat access denied' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id or new.student_id is distinct from old.student_id
      or new.source_type is distinct from old.source_type or new.source_id is distinct from old.source_id then
      raise exception 'conversation identity is immutable' using errcode = '42501';
    end if;
    -- Trigger-generated counters run under the original actor's JWT; permit
    -- them only from a nested trigger. Direct student thread updates stay denied
    -- by RLS. The configured mentor retains the current status UI.
    if v_student <> v_mentor and pg_trigger_depth() < 2 and (
      new.unread_for_student_count <> 0
      or (to_jsonb(new) - array['unread_for_student_count', 'updated_at'])
        is distinct from (to_jsonb(old) - array['unread_for_student_count', 'updated_at'])
    ) then
      raise exception 'mentor chat access required' using errcode = '42501';
    end if;
  end if;
  new.assigned_to_student_id := v_mentor;
  return new;
end;
$$;
create trigger guard_legacy_chat_thread_write
  before insert or update on public.conversation_threads for each row
  execute function public.guard_legacy_chat_thread_write();

create function public.guard_legacy_chat_message_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_thread public.conversation_threads%rowtype; v_role text;
begin
  perform 1 from public.chat_mentor_config where singleton for share;
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if v_thread.source_type <> 'mentor_chat' then return new; end if;
  v_role := public.legacy_chat_thread_role(new.thread_id);
  if v_role is null or new.sender_student_id is distinct from public.legacy_chat_current_student_id()
     or (v_role = 'student' and (new.sender_role <> 'student' or new.is_internal))
     or (v_role = 'mentor' and new.sender_role not in ('mentor', 'admin')) then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  new.body := regexp_replace(replace(coalesce(new.body, ''), E'\r\n', E'\n'),
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(new.body) not between 1 and 5000 then
    raise exception 'message must contain between 1 and 5000 characters' using errcode = '22023';
  end if;
  new.created_at := now();
  new.status := 'sent';
  new.body_format := 'plain';
  new.deleted_at := null;
  new.edited_at := null;
  new.parent_message_id := null;
  new.metadata := '{}'::jsonb;
  return new;
end;
$$;
create trigger guard_legacy_chat_message_write
  before insert on public.conversation_messages for each row
  execute function public.guard_legacy_chat_message_write();

-- Replace every known blanket chat policy, then add restrictive guards for any
-- older permissive deployment policy. Admin status grants no mentor_chat rights.
drop policy if exists conversation_threads_select_own on public.conversation_threads;
create policy conversation_threads_select_own
  on public.conversation_threads for select to authenticated
  using ((source_type = 'mentor_chat' and public.legacy_chat_mentor_id() is not null
    and student_id <> public.legacy_chat_mentor_id()
    and (student_id = public.legacy_chat_current_student_id()
      or public.legacy_chat_current_student_id() = public.legacy_chat_mentor_id())) or (
    source_type <> 'mentor_chat' and (public.is_platform_admin() or exists (
      select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid()
    ))));
drop policy if exists conversation_threads_insert_own on public.conversation_threads;
create policy conversation_threads_insert_own
  on public.conversation_threads for insert to authenticated
  with check (source_type = 'mentor_chat' and source_id is null
    and student_id = public.legacy_chat_current_student_id()
    and student_id <> public.legacy_chat_mentor_id()
    and assigned_to_student_id = public.legacy_chat_mentor_id());
drop policy if exists conversation_threads_update_admin on public.conversation_threads;
create policy conversation_threads_update_admin
  on public.conversation_threads for update to authenticated
  using (public.legacy_chat_thread_role(id) = 'mentor'
    or (source_type <> 'mentor_chat' and public.is_platform_admin()))
  with check (public.legacy_chat_thread_role(id) = 'mentor'
    or (source_type <> 'mentor_chat' and public.is_platform_admin()));
create policy legacy_mentor_chat_thread_read_guard
  on public.conversation_threads as restrictive for select to authenticated
  using (source_type <> 'mentor_chat' or (public.legacy_chat_mentor_id() is not null
    and student_id <> public.legacy_chat_mentor_id()
    and (student_id = public.legacy_chat_current_student_id()
      or public.legacy_chat_current_student_id() = public.legacy_chat_mentor_id())));
create policy legacy_mentor_chat_thread_insert_guard
  on public.conversation_threads as restrictive for insert to authenticated
  with check (source_type <> 'mentor_chat' or (
    source_id is null and student_id = public.legacy_chat_current_student_id()
    and student_id <> public.legacy_chat_mentor_id()
    and assigned_to_student_id = public.legacy_chat_mentor_id()));
create policy legacy_mentor_chat_thread_update_guard
  on public.conversation_threads as restrictive for update to authenticated
  using (source_type <> 'mentor_chat' or public.legacy_chat_thread_role(id) = 'mentor')
  with check (source_type <> 'mentor_chat' or public.legacy_chat_thread_role(id) = 'mentor');
create policy legacy_mentor_chat_thread_delete_guard
  on public.conversation_threads as restrictive for delete to authenticated
  using (source_type <> 'mentor_chat');

drop policy if exists conversation_messages_select_visible on public.conversation_messages;
create policy conversation_messages_select_visible
  on public.conversation_messages for select to authenticated
  using ((public.legacy_chat_thread_role(thread_id) is not null and deleted_at is null
    and (not is_internal or public.legacy_chat_thread_role(thread_id) = 'mentor'))
    or exists (select 1 from public.conversation_threads t where t.id = thread_id
      and t.source_type <> 'mentor_chat' and (public.is_platform_admin()
        or (not is_internal and deleted_at is null and exists (
          select 1 from public.students s where s.id = t.student_id and s.auth_user_id = auth.uid())))));
drop policy if exists conversation_messages_insert_student on public.conversation_messages;
create policy conversation_messages_insert_student
  on public.conversation_messages for insert to authenticated
  with check ((public.legacy_chat_thread_role(thread_id) = 'student'
    and sender_student_id = public.legacy_chat_current_student_id()
    and sender_role = 'student' and not is_internal) or (
      sender_role = 'student' and not is_internal and exists (
        select 1 from public.conversation_threads t join public.students s on s.id = t.student_id
        where t.id = thread_id and t.source_type <> 'mentor_chat'
          and s.id = sender_student_id and s.auth_user_id = auth.uid()
      )));
drop policy if exists conversation_messages_insert_admin on public.conversation_messages;
create policy conversation_messages_insert_admin
  on public.conversation_messages for insert to authenticated
  with check ((public.legacy_chat_thread_role(thread_id) = 'mentor'
    and sender_student_id = public.legacy_chat_current_student_id()
    and sender_role in ('mentor', 'admin')) or exists (
      select 1 from public.conversation_threads t where t.id = thread_id
        and t.source_type <> 'mentor_chat' and public.is_platform_admin()
    ));
drop policy if exists conversation_messages_update_admin on public.conversation_messages;
create policy conversation_messages_update_admin
  on public.conversation_messages for update to authenticated
  using (public.is_platform_admin() and exists (
    select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'))
  with check (public.is_platform_admin() and exists (
    select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'));
create policy legacy_mentor_chat_message_read_guard
  on public.conversation_messages as restrictive for select to authenticated
  using (exists (select 1 from public.conversation_threads t where t.id = thread_id
    and (t.source_type <> 'mentor_chat' or (public.legacy_chat_thread_role(t.id) is not null
      and deleted_at is null and (not is_internal or public.legacy_chat_thread_role(t.id) = 'mentor')))));
create policy legacy_mentor_chat_message_insert_guard
  on public.conversation_messages as restrictive for insert to authenticated
  with check (exists (select 1 from public.conversation_threads t where t.id = thread_id
    and (t.source_type <> 'mentor_chat' or (
      sender_student_id = public.legacy_chat_current_student_id()
      and ((public.legacy_chat_thread_role(t.id) = 'student' and sender_role = 'student' and not is_internal)
        or (public.legacy_chat_thread_role(t.id) = 'mentor' and sender_role in ('mentor', 'admin')))))));
create policy legacy_mentor_chat_message_update_guard
  on public.conversation_messages as restrictive for update to authenticated
  using (exists (select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'))
  with check (exists (select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'));
create policy legacy_mentor_chat_message_delete_guard
  on public.conversation_messages as restrictive for delete to authenticated
  using (exists (select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'));

drop policy if exists conversation_events_select_admin on public.conversation_events;
create policy conversation_events_select_admin
  on public.conversation_events for select to authenticated
  using (public.legacy_chat_thread_role(thread_id) = 'mentor' or exists (
    select 1 from public.conversation_threads t where t.id = thread_id
      and t.source_type <> 'mentor_chat' and public.is_platform_admin()));
drop policy if exists conversation_events_insert_admin on public.conversation_events;
create policy conversation_events_insert_admin
  on public.conversation_events for insert to authenticated
  with check (public.is_platform_admin() and exists (
    select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'));
create policy legacy_mentor_chat_event_read_guard
  on public.conversation_events as restrictive for select to authenticated
  using (exists (select 1 from public.conversation_threads t where t.id = thread_id
    and (t.source_type <> 'mentor_chat' or public.legacy_chat_thread_role(t.id) = 'mentor')));
create policy legacy_mentor_chat_event_write_guard
  on public.conversation_events as restrictive for all to authenticated
  using (exists (select 1 from public.conversation_threads t where t.id = thread_id
    and (t.source_type <> 'mentor_chat' or public.legacy_chat_thread_role(t.id) = 'mentor')))
  with check (exists (select 1 from public.conversation_threads t where t.id = thread_id and t.source_type <> 'mentor_chat'));
drop policy if exists conversation_message_reactions_insert_own on public.conversation_message_reactions;
drop policy if exists conversation_message_reactions_delete_own on public.conversation_message_reactions;
create policy conversation_message_reactions_insert_own
  on public.conversation_message_reactions for insert to authenticated
  with check ((public.is_platform_admin() or exists (
      select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid()
    )) and exists (
      select 1 from public.conversation_messages m join public.conversation_threads t on t.id = m.thread_id
      where m.id = message_id and t.source_type <> 'mentor_chat'));
create policy conversation_message_reactions_delete_own
  on public.conversation_message_reactions for delete to authenticated
  using ((public.is_platform_admin() or exists (
      select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid()
    )) and exists (
      select 1 from public.conversation_messages m join public.conversation_threads t on t.id = m.thread_id
      where m.id = message_id and t.source_type <> 'mentor_chat'));
drop policy if exists conversation_message_reactions_select_visible on public.conversation_message_reactions;
create policy conversation_message_reactions_select_visible
  on public.conversation_message_reactions for select to authenticated
  using (exists (select 1 from public.conversation_messages m where m.id = message_id));
create policy legacy_mentor_chat_reaction_read_guard
  on public.conversation_message_reactions as restrictive for select to authenticated
  using (exists (select 1 from public.conversation_messages m where m.id = message_id));
create policy legacy_mentor_chat_reaction_insert_guard
  on public.conversation_message_reactions as restrictive for insert to authenticated
  with check (exists (select 1 from public.conversation_messages m
    join public.conversation_threads t on t.id = m.thread_id
    where m.id = message_id and t.source_type <> 'mentor_chat'));
create policy legacy_mentor_chat_reaction_update_guard
  on public.conversation_message_reactions as restrictive for update to authenticated
  using (exists (select 1 from public.conversation_messages m
    join public.conversation_threads t on t.id = m.thread_id
    where m.id = message_id and t.source_type <> 'mentor_chat'))
  with check (exists (select 1 from public.conversation_messages m
    join public.conversation_threads t on t.id = m.thread_id
    where m.id = message_id and t.source_type <> 'mentor_chat'));
create policy legacy_mentor_chat_reaction_delete_guard
  on public.conversation_message_reactions as restrictive for delete to authenticated
  using (exists (select 1 from public.conversation_messages m
    join public.conversation_threads t on t.id = m.thread_id
    where m.id = message_id and t.source_type <> 'mentor_chat'));

create function public.legacy_chat_notification_thread_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case
    when ne.target_table = 'conversation_threads'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ne.target_id::uuid
    when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (ne.metadata ->> 'thread_id')::uuid
    when ne.target_table = 'conversation_messages'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
    else null end from public.notification_events ne where ne.id = p_event_id;
$$;
create function public.legacy_is_chat_notification(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select case when exists (
    select 1 from public.conversation_threads t
    where t.id = public.legacy_chat_notification_thread_id(ne.id) and t.source_type <> 'mentor_chat'
  ) then false else ne.type in ('mentor_new_message', 'mentor_reply')
    or ne.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
    or ne.metadata ? 'thread_id' end from public.notification_events ne where ne.id = p_event_id), false);
$$;
create or replace function public.can_read_notification_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when public.legacy_is_chat_notification(p_event_id) then exists (
    select 1 from public.notification_events ne
    join public.notification_recipients nr on nr.event_id = ne.id
    where ne.id = p_event_id and nr.student_id = public.legacy_chat_current_student_id()
      and public.legacy_chat_thread_role(public.legacy_chat_notification_thread_id(ne.id)) is not null
      and (ne.type <> 'mentor_new_message' or public.legacy_chat_thread_role(public.legacy_chat_notification_thread_id(ne.id)) = 'mentor')
      and (ne.type <> 'mentor_reply' or public.legacy_chat_thread_role(public.legacy_chat_notification_thread_id(ne.id)) = 'student')
  ) else public.is_platform_admin() or exists (
    select 1 from public.notification_events ne
    join public.notification_recipients nr on nr.event_id = ne.id
    join public.students s on s.id = nr.student_id
    where ne.id = p_event_id and s.auth_user_id = auth.uid()
      and ne.type in ('mentor_reply', 'weekly_update.published', 'live_session.scheduled', 'live_session.cancelled',
        'subscription.bonus_expired', 'subscription.payment_failed')
  ) end;
$$;
create function public.legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when public.legacy_is_chat_notification(p_event_id) then
    p_student_id = public.legacy_chat_current_student_id() and public.can_read_notification_event(p_event_id)
  else public.is_platform_admin() or (exists (select 1 from public.students s
    where s.id = p_student_id and s.auth_user_id = auth.uid()) and public.can_read_notification_event(p_event_id)) end;
$$;
drop policy if exists notification_recipients_select_own on public.notification_recipients;
create policy notification_recipients_select_own
  on public.notification_recipients for select to authenticated
  using (public.legacy_can_access_chat_notification_recipient(event_id, student_id));
drop policy if exists notification_recipients_update_own on public.notification_recipients;
create policy notification_recipients_update_own
  on public.notification_recipients for update to authenticated
  using (public.legacy_can_access_chat_notification_recipient(event_id, student_id))
  with check (public.legacy_can_access_chat_notification_recipient(event_id, student_id));
create policy legacy_mentor_chat_notification_event_read_guard
  on public.notification_events as restrictive for select to authenticated
  using (not public.legacy_is_chat_notification(id) or public.can_read_notification_event(id));
create policy legacy_mentor_chat_notification_event_insert_guard
  on public.notification_events as restrictive for insert to authenticated
  with check (type not in ('mentor_new_message', 'mentor_reply')
    and coalesce(target_table, '') not in ('conversation_threads', 'conversation_messages', 'conversation_events')
    and not (metadata ? 'thread_id'));
create policy legacy_mentor_chat_notification_event_update_guard
  on public.notification_events as restrictive for update to authenticated
  using (not public.legacy_is_chat_notification(id))
  with check (type not in ('mentor_new_message', 'mentor_reply')
    and coalesce(target_table, '') not in ('conversation_threads', 'conversation_messages', 'conversation_events')
    and not (metadata ? 'thread_id'));
create policy legacy_mentor_chat_notification_event_delete_guard
  on public.notification_events as restrictive for delete to authenticated
  using (not public.legacy_is_chat_notification(id));
create policy legacy_mentor_chat_notification_recipient_read_guard
  on public.notification_recipients as restrictive for select to authenticated
  using (not public.legacy_is_chat_notification(event_id)
    or public.legacy_can_access_chat_notification_recipient(event_id, student_id));
create policy legacy_mentor_chat_notification_recipient_update_guard
  on public.notification_recipients as restrictive for update to authenticated
  using (not public.legacy_is_chat_notification(event_id)
    or public.legacy_can_access_chat_notification_recipient(event_id, student_id))
  with check (not public.legacy_is_chat_notification(event_id)
    or public.legacy_can_access_chat_notification_recipient(event_id, student_id));
create policy legacy_mentor_chat_notification_recipient_insert_guard
  on public.notification_recipients as restrictive for insert to authenticated
  with check (not public.legacy_is_chat_notification(event_id));
create policy legacy_mentor_chat_notification_recipient_delete_guard
  on public.notification_recipients as restrictive for delete to authenticated
  using (not public.legacy_is_chat_notification(event_id));

create function public.guard_chat_notification_recipient_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (public.legacy_is_chat_notification(old.event_id)
      or public.legacy_is_chat_notification(new.event_id))
    and (new.id is distinct from old.id or new.event_id is distinct from old.event_id
      or new.student_id is distinct from old.student_id or new.created_at is distinct from old.created_at) then
    raise exception 'notification identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_chat_notification_recipient_identity
  before update on public.notification_recipients for each row
  execute function public.guard_chat_notification_recipient_identity();

update public.notification_events ne
set title = case when ne.type = 'mentor_new_message' then 'Nieuw chatbericht' else 'Je hebt een nieuw bericht' end,
    body = 'Open je gesprek om het bericht te lezen.',
    metadata = jsonb_build_object('thread_id', public.legacy_chat_notification_thread_id(ne.id))
where public.legacy_is_chat_notification(ne.id);

create or replace function public.handle_conversation_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_thread public.conversation_threads%rowtype; v_event_id uuid; v_recipient uuid; v_sender_name text;
begin
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if not found then return new; end if;
  if v_thread.source_type <> 'mentor_chat' then
    -- Retain the original behavior for any separately authorized source.
    if new.sender_role = 'student' then
      update public.conversation_threads
      set last_message_at = new.created_at, last_student_message_at = new.created_at,
          unread_for_mentor_count = unread_for_mentor_count + 1,
          status = case when status = 'closed' then 'open' else 'pending_mentor' end,
          closed_at = null where id = new.thread_id;
      select coalesce(name, email, 'Student') into v_sender_name
      from public.students where id = new.sender_student_id;
      insert into public.notification_events(type, actor_student_id, target_table, target_id, title, body, href, metadata)
      values ('mentor_new_message', new.sender_student_id, 'conversation_threads', new.thread_id::text,
        'Nieuwe mentorvraag', left(coalesce(v_sender_name, 'Student') || ': ' || new.body, 240),
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
      insert into public.notification_events(type, actor_student_id, target_table, target_id, title, body, href, metadata)
      values ('mentor_reply', new.sender_student_id, 'conversation_threads', new.thread_id::text,
        v_sender_name || ' heeft geantwoord', left(new.body, 240), '/mentor',
        jsonb_build_object('thread_id', new.thread_id)) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      values (v_event_id, v_thread.student_id) on conflict do nothing;
    else
      update public.conversation_threads set last_message_at = new.created_at where id = new.thread_id;
    end if;
    insert into public.conversation_events(thread_id, actor_student_id, event_type, metadata)
    values (new.thread_id, new.sender_student_id, 'message_created',
      jsonb_build_object('message_id', new.id, 'sender_role', new.sender_role, 'is_internal', new.is_internal));
    return new;
  end if;
  if new.is_internal then
    -- Internal staff activity never appears in student previews or counters.
    insert into public.conversation_events(thread_id, actor_student_id, event_type, metadata)
    values (new.thread_id, new.sender_student_id, 'message_created',
      jsonb_build_object('message_id', new.id, 'sender_role', new.sender_role, 'is_internal', true));
    return new;
  end if;
  if new.sender_role = 'student' then
    update public.conversation_threads
    set last_message_at = new.created_at, last_student_message_at = new.created_at,
        unread_for_mentor_count = unread_for_mentor_count + 1, status = 'pending_mentor', closed_at = null
    where id = new.thread_id;
    v_recipient := public.legacy_chat_mentor_id();
  else
    update public.conversation_threads
    set last_message_at = new.created_at, last_mentor_message_at = new.created_at,
        unread_for_student_count = unread_for_student_count + 1, status = 'pending_student',
        first_response_at = coalesce(first_response_at, new.created_at), closed_at = null
    where id = new.thread_id;
    v_recipient := v_thread.student_id;
  end if;
  if v_recipient is null then raise exception 'chat recipient unavailable' using errcode = '42501'; end if;
  insert into public.notification_events(type, actor_student_id, target_table, target_id, title, body, href, metadata)
  values (case when new.sender_role = 'student' then 'mentor_new_message' else 'mentor_reply' end,
    new.sender_student_id, 'conversation_threads', new.thread_id::text,
    case when new.sender_role = 'student' then 'Nieuw chatbericht' else 'Je hebt een nieuw bericht' end,
    'Open je gesprek om het bericht te lezen.',
    case when new.sender_role = 'student' then '/admin/mentor-inbox?thread=' || new.thread_id::text else '/mentor' end,
    jsonb_build_object('thread_id', new.thread_id, 'message_id', new.id)) returning id into v_event_id;
  insert into public.notification_recipients(event_id, student_id) values (v_event_id, v_recipient);
  insert into public.conversation_events(thread_id, actor_student_id, event_type, metadata)
  values (new.thread_id, new.sender_student_id, 'message_created',
    jsonb_build_object('message_id', new.id, 'sender_role', new.sender_role, 'is_internal', false));
  return new;
end;
$$;

create or replace function public.mark_student_conversation_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chat_mentor_config where singleton for share;
  perform 1 from public.conversation_threads where id = p_thread_id for update;
  if public.legacy_chat_thread_role(p_thread_id) is distinct from 'student' then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  update public.conversation_threads set unread_for_student_count = 0 where id = p_thread_id;
end;
$$;
create or replace function public.mark_mentor_conversation_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chat_mentor_config where singleton for share;
  perform 1 from public.conversation_threads where id = p_thread_id for update;
  if public.legacy_chat_thread_role(p_thread_id) is distinct from 'mentor' then
    raise exception 'mentor chat access required' using errcode = '42501';
  end if;
  update public.conversation_threads set unread_for_mentor_count = 0 where id = p_thread_id;
end;
$$;

revoke all on function public.legacy_chat_current_student_id(), public.legacy_chat_mentor_id(),
  public.legacy_chat_thread_role(uuid), public.configure_chat_mentor(uuid),
  public.guard_legacy_chat_thread_write(), public.guard_legacy_chat_message_write(),
  public.legacy_chat_notification_thread_id(uuid), public.legacy_is_chat_notification(uuid),
  public.can_read_notification_event(uuid), public.legacy_can_access_chat_notification_recipient(uuid, uuid),
  public.guard_chat_notification_recipient_identity(), public.handle_conversation_message_insert(),
  public.mark_student_conversation_read(uuid), public.mark_mentor_conversation_read(uuid)
  from public, anon, authenticated;
grant execute on function public.legacy_chat_current_student_id(), public.legacy_chat_mentor_id(),
  public.legacy_chat_thread_role(uuid), public.legacy_is_chat_notification(uuid),
  public.can_read_notification_event(uuid), public.legacy_can_access_chat_notification_recipient(uuid, uuid),
  public.mark_student_conversation_read(uuid), public.mark_mentor_conversation_read(uuid) to authenticated;
grant execute on function public.configure_chat_mentor(uuid) to service_role;
grant execute on function public.can_read_notification_event(uuid) to service_role;

commit;
