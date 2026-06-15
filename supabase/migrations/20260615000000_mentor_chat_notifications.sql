-- Mentor chat + in-app notifications foundation.
-- Additief only: new tables, indexes, policies, and triggers.

-- =========================================================================
-- Conversation threads
-- =========================================================================
create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assigned_to_student_id uuid references public.students (id) on delete set null,
  status text not null default 'open',
  priority text not null default 'normal',
  category text,
  source_type text not null default 'mentor_chat',
  source_id text,
  subject text,
  last_message_at timestamptz,
  last_student_message_at timestamptz,
  last_mentor_message_at timestamptz,
  unread_for_student_count integer not null default 0,
  unread_for_mentor_count integer not null default 0,
  first_response_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_threads_status_check
    check (status in ('open', 'pending_mentor', 'pending_student', 'snoozed', 'closed')),
  constraint conversation_threads_priority_check
    check (priority in ('normal', 'high', 'urgent')),
  constraint conversation_threads_unread_student_nonnegative
    check (unread_for_student_count >= 0),
  constraint conversation_threads_unread_mentor_nonnegative
    check (unread_for_mentor_count >= 0)
);

drop trigger if exists set_conversation_threads_updated_at on public.conversation_threads;
create trigger set_conversation_threads_updated_at
  before update on public.conversation_threads
  for each row
  execute function public.set_updated_at();

create unique index if not exists conversation_threads_default_student_unique
  on public.conversation_threads (student_id)
  where source_type = 'mentor_chat' and source_id is null;

create index if not exists idx_conversation_threads_inbox
  on public.conversation_threads (status, last_message_at desc nulls last);
create index if not exists idx_conversation_threads_student
  on public.conversation_threads (student_id, last_message_at desc nulls last);
create index if not exists idx_conversation_threads_assigned
  on public.conversation_threads (assigned_to_student_id, last_message_at desc nulls last)
  where assigned_to_student_id is not null;
create index if not exists idx_conversation_threads_unread_mentor
  on public.conversation_threads (unread_for_mentor_count, last_message_at desc nulls last)
  where unread_for_mentor_count > 0;

-- =========================================================================
-- Conversation messages
-- =========================================================================
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  sender_student_id uuid references public.students (id) on delete set null,
  sender_role text not null,
  body text not null,
  body_format text not null default 'plain',
  client_message_id uuid,
  status text not null default 'sent',
  is_internal boolean not null default false,
  parent_message_id uuid references public.conversation_messages (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint conversation_messages_sender_role_check
    check (sender_role in ('student', 'mentor', 'admin', 'ai', 'system')),
  constraint conversation_messages_body_not_empty
    check (length(trim(body)) > 0),
  constraint conversation_messages_body_length
    check (char_length(body) <= 5000),
  constraint conversation_messages_body_format_check
    check (body_format in ('plain', 'markdown')),
  constraint conversation_messages_status_check
    check (status in ('sent', 'delivered', 'read', 'failed', 'deleted'))
);

create unique index if not exists conversation_messages_client_unique
  on public.conversation_messages (thread_id, sender_student_id, client_message_id)
  where client_message_id is not null;

create index if not exists idx_conversation_messages_thread
  on public.conversation_messages (thread_id, created_at asc);
create index if not exists idx_conversation_messages_sender
  on public.conversation_messages (sender_student_id, created_at desc)
  where sender_student_id is not null;
create index if not exists idx_conversation_messages_thread_public
  on public.conversation_messages (thread_id, created_at asc)
  where is_internal = false and deleted_at is null;

-- =========================================================================
-- Message reactions and audit events (reserved for next iterations)
-- =========================================================================
create table if not exists public.conversation_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.conversation_messages (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, student_id, reaction),
  constraint conversation_message_reactions_reaction_length
    check (char_length(reaction) between 1 and 32)
);

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  actor_student_id uuid references public.students (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_events_thread
  on public.conversation_events (thread_id, created_at desc);

-- =========================================================================
-- Generic notification center
-- =========================================================================
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  actor_student_id uuid references public.students (id) on delete set null,
  target_table text,
  target_id text,
  title text not null,
  body text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_type_created
  on public.notification_events (type, created_at desc);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

create index if not exists idx_notification_recipients_student_unread
  on public.notification_recipients (student_id, created_at desc)
  where read_at is null and archived_at is null;
create index if not exists idx_notification_recipients_student_all
  on public.notification_recipients (student_id, created_at desc);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, notification_type)
);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_updated_at();

-- =========================================================================
-- Trigger: maintain thread counters and create in-app notifications.
-- =========================================================================
create or replace function public.handle_conversation_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.conversation_threads%rowtype;
  v_event_id uuid;
  v_sender_name text;
begin
  select *
    into v_thread
    from public.conversation_threads
    where id = new.thread_id;

  if not found then
    return new;
  end if;

  if new.sender_role = 'student' then
    update public.conversation_threads
       set last_message_at = new.created_at,
           last_student_message_at = new.created_at,
           unread_for_mentor_count = unread_for_mentor_count + 1,
           status = case when status = 'closed' then 'open' else 'pending_mentor' end,
           closed_at = null
     where id = new.thread_id;

    select coalesce(name, email, 'Student')
      into v_sender_name
      from public.students
      where id = new.sender_student_id;

    insert into public.notification_events (
      type,
      actor_student_id,
      target_table,
      target_id,
      title,
      body,
      href,
      metadata
    )
    values (
      'mentor_new_message',
      new.sender_student_id,
      'conversation_threads',
      new.thread_id::text,
      'Nieuwe mentorvraag',
      left(coalesce(v_sender_name, 'Student') || ': ' || new.body, 240),
      '/admin/mentor-inbox?thread=' || new.thread_id::text,
      jsonb_build_object('thread_id', new.thread_id)
    )
    returning id into v_event_id;

    insert into public.notification_recipients (event_id, student_id)
    select v_event_id, s.id
      from public.students s
      where s.access_level = 3
    on conflict do nothing;
  elsif new.sender_role in ('mentor', 'admin', 'ai') and new.is_internal = false then
    update public.conversation_threads
       set last_message_at = new.created_at,
           last_mentor_message_at = new.created_at,
           unread_for_student_count = unread_for_student_count + 1,
           status = 'pending_student',
           first_response_at = coalesce(first_response_at, new.created_at),
           closed_at = null
     where id = new.thread_id;

    insert into public.notification_events (
      type,
      actor_student_id,
      target_table,
      target_id,
      title,
      body,
      href,
      metadata
    )
    values (
      'mentor_reply',
      new.sender_student_id,
      'conversation_threads',
      new.thread_id::text,
      'Rousso heeft geantwoord',
      left(new.body, 240),
      '/mentor',
      jsonb_build_object('thread_id', new.thread_id)
    )
    returning id into v_event_id;

    insert into public.notification_recipients (event_id, student_id)
    values (v_event_id, v_thread.student_id)
    on conflict do nothing;
  else
    update public.conversation_threads
       set last_message_at = new.created_at
     where id = new.thread_id;
  end if;

  insert into public.conversation_events (
    thread_id,
    actor_student_id,
    event_type,
    metadata
  )
  values (
    new.thread_id,
    new.sender_student_id,
    'message_created',
    jsonb_build_object(
      'message_id', new.id,
      'sender_role', new.sender_role,
      'is_internal', new.is_internal
    )
  );

  return new;
end;
$$;

drop trigger if exists handle_conversation_message_insert on public.conversation_messages;
create trigger handle_conversation_message_insert
  after insert on public.conversation_messages
  for each row
  execute function public.handle_conversation_message_insert();

create or replace function public.mark_student_conversation_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.conversation_threads t
    join public.students s on s.id = t.student_id
    where t.id = p_thread_id
      and s.auth_user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  update public.conversation_threads
     set unread_for_student_count = 0
   where id = p_thread_id;
end;
$$;

create or replace function public.mark_mentor_conversation_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed';
  end if;

  update public.conversation_threads
     set unread_for_mentor_count = 0
   where id = p_thread_id;
end;
$$;

grant execute on function public.mark_student_conversation_read(uuid) to authenticated;
grant execute on function public.mark_mentor_conversation_read(uuid) to authenticated;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_message_reactions enable row level security;
alter table public.conversation_events enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_preferences enable row level security;

-- conversation_threads
drop policy if exists "conversation_threads_select_own" on public.conversation_threads;
create policy "conversation_threads_select_own"
  on public.conversation_threads for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = conversation_threads.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "conversation_threads_insert_own" on public.conversation_threads;
create policy "conversation_threads_insert_own"
  on public.conversation_threads for insert
  to authenticated
  with check (
    source_type = 'mentor_chat'
    and source_id is null
    and assigned_to_student_id is null
    and status = 'open'
    and priority = 'normal'
    and exists (
      select 1 from public.students s
      where s.id = conversation_threads.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "conversation_threads_update_admin" on public.conversation_threads;
create policy "conversation_threads_update_admin"
  on public.conversation_threads for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- conversation_messages
drop policy if exists "conversation_messages_select_visible" on public.conversation_messages;
create policy "conversation_messages_select_visible"
  on public.conversation_messages for select
  to authenticated
  using (
    public.is_platform_admin()
    or (
      is_internal = false
      and deleted_at is null
      and exists (
        select 1
        from public.conversation_threads t
        join public.students s on s.id = t.student_id
        where t.id = conversation_messages.thread_id
          and s.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "conversation_messages_insert_student" on public.conversation_messages;
create policy "conversation_messages_insert_student"
  on public.conversation_messages for insert
  to authenticated
  with check (
    sender_role = 'student'
    and is_internal = false
    and exists (
      select 1
      from public.students s
      join public.conversation_threads t on t.student_id = s.id
      where t.id = conversation_messages.thread_id
        and s.id = conversation_messages.sender_student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "conversation_messages_insert_admin" on public.conversation_messages;
create policy "conversation_messages_insert_admin"
  on public.conversation_messages for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "conversation_messages_update_admin" on public.conversation_messages;
create policy "conversation_messages_update_admin"
  on public.conversation_messages for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- reactions
drop policy if exists "conversation_message_reactions_select_visible" on public.conversation_message_reactions;
create policy "conversation_message_reactions_select_visible"
  on public.conversation_message_reactions for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.conversation_messages m
      join public.conversation_threads t on t.id = m.thread_id
      join public.students s on s.id = t.student_id
      where m.id = conversation_message_reactions.message_id
        and m.is_internal = false
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "conversation_message_reactions_insert_own" on public.conversation_message_reactions;
create policy "conversation_message_reactions_insert_own"
  on public.conversation_message_reactions for insert
  to authenticated
  with check (
    public.is_platform_admin()
    or exists (
      select 1
      from public.students s
      where s.id = conversation_message_reactions.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "conversation_message_reactions_delete_own" on public.conversation_message_reactions;
create policy "conversation_message_reactions_delete_own"
  on public.conversation_message_reactions for delete
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.students s
      where s.id = conversation_message_reactions.student_id
        and s.auth_user_id = auth.uid()
    )
  );

-- conversation_events are admin-only audit.
drop policy if exists "conversation_events_select_admin" on public.conversation_events;
create policy "conversation_events_select_admin"
  on public.conversation_events for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "conversation_events_insert_admin" on public.conversation_events;
create policy "conversation_events_insert_admin"
  on public.conversation_events for insert
  to authenticated
  with check (public.is_platform_admin());

-- notification_events
drop policy if exists "notification_events_select_recipients" on public.notification_events;
create policy "notification_events_select_recipients"
  on public.notification_events for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.notification_recipients nr
      join public.students s on s.id = nr.student_id
      where nr.event_id = notification_events.id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "notification_events_insert_admin" on public.notification_events;
create policy "notification_events_insert_admin"
  on public.notification_events for insert
  to authenticated
  with check (public.is_platform_admin());

-- notification_recipients
drop policy if exists "notification_recipients_select_own" on public.notification_recipients;
create policy "notification_recipients_select_own"
  on public.notification_recipients for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_recipients.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "notification_recipients_insert_admin" on public.notification_recipients;
create policy "notification_recipients_insert_admin"
  on public.notification_recipients for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "notification_recipients_update_own" on public.notification_recipients;
create policy "notification_recipients_update_own"
  on public.notification_recipients for update
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_recipients.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_recipients.student_id
        and s.auth_user_id = auth.uid()
    )
  );

-- notification_preferences
drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_preferences.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences for insert
  to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = notification_preferences.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences for update
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_preferences.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.students s
      where s.id = notification_preferences.student_id
        and s.auth_user_id = auth.uid()
    )
  );
