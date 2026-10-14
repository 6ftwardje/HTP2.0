-- Private mentor chat: the student and one explicitly configured human mentor.
-- No account is inferred from a name, email or platform-admin access level.
-- Run this additive cutover before the matching application deployment. It
-- fails closed until configure_chat_mentor(stable students.id) is called by a
-- trusted service connection. Existing threads, messages and authors are kept.

begin;

lock table public.conversation_threads, public.conversation_messages,
  public.conversation_events, public.conversation_message_reactions
  in access exclusive mode;

create table public.chat_principals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('human', 'ai', 'system')),
  student_id uuid references public.students(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint chat_principals_nonhuman_account_check
    check (kind = 'human' or student_id is null)
);
create unique index chat_principals_human_student_unique
  on public.chat_principals(student_id) where kind = 'human';

create table if not exists public.chat_mentor_config (
  singleton boolean primary key default true check (singleton),
  mentor_student_id uuid references public.students(id) on delete set null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.chat_mentor_config(singleton) values (true) on conflict (singleton) do nothing;

-- The preceding privacy-only deployment keeps the old UI working. Its write
-- guards are replaced here by participant-authorized RPC writes.
drop trigger if exists guard_legacy_chat_thread_write on public.conversation_threads;
drop trigger if exists guard_legacy_chat_message_write on public.conversation_messages;
drop trigger if exists guard_chat_notification_recipient_identity on public.notification_recipients;

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  principal_id uuid not null references public.chat_principals(id) on delete cascade,
  role text not null check (role in ('student', 'mentor', 'ai', 'system')),
  active boolean not null default false,
  last_read_public_seq bigint not null default 0 check (last_read_public_seq >= 0),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (thread_id, principal_id, role),
  unique (id, principal_id, thread_id)
);
create index conversation_participants_active_principal
  on public.conversation_participants(principal_id, thread_id) where active;
create unique index conversation_participants_single_active_mentor
  on public.conversation_participants(thread_id) where active and role = 'mentor';
create unique index conversation_participants_single_active_student
  on public.conversation_participants(thread_id) where active and role = 'student';

alter table public.conversation_threads
  add column chat_mode text not null default 'human' check (chat_mode in ('human', 'ai', 'paused')),
  add column chat_version bigint not null default 1,
  add column last_public_message_seq bigint not null default 0 check (last_public_message_seq >= 0),
  add column last_public_message_id uuid references public.conversation_messages(id) on delete set null;
alter table public.conversation_messages
  add column sender_principal_id uuid references public.chat_principals(id) on delete set null,
  add column sender_participant_id uuid,
  add column public_seq bigint check (public_seq is null or public_seq > 0),
  add column message_kind text not null default 'text' check (message_kind in ('text', 'internal_note')),
  add constraint conversation_messages_participant_identity_fk
    foreign key (sender_participant_id, sender_principal_id, thread_id)
    references public.conversation_participants(id, principal_id, thread_id);

-- Historical identity is preserved without giving previous staff membership.
insert into public.chat_principals(kind, student_id, display_name)
select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
from public.students s
where exists (select 1 from public.conversation_threads t
              where t.source_type = 'mentor_chat' and t.student_id = s.id)
   or exists (select 1 from public.conversation_messages m
              join public.conversation_threads t on t.id = m.thread_id
              where t.source_type = 'mentor_chat' and m.sender_student_id = s.id);

insert into public.conversation_participants(thread_id, principal_id, role, active)
select t.id, p.id, 'student', true
from public.conversation_threads t
join public.chat_principals p on p.student_id = t.student_id and p.kind = 'human'
where t.source_type = 'mentor_chat';

insert into public.conversation_participants(thread_id, principal_id, role, active, revoked_at)
select distinct m.thread_id, p.id, 'mentor', false, now()
from public.conversation_messages m
join public.conversation_threads t on t.id = m.thread_id
join public.chat_principals p on p.student_id = m.sender_student_id and p.kind = 'human'
where t.source_type = 'mentor_chat' and m.sender_role in ('mentor', 'admin')
on conflict (thread_id, principal_id, role) do nothing;

update public.conversation_messages m
set sender_principal_id = p.id,
    sender_participant_id = cp.id,
    message_kind = case when m.is_internal then 'internal_note' else 'text' end
from public.conversation_threads t, public.chat_principals p,
     public.conversation_participants cp
where t.id = m.thread_id and t.source_type = 'mentor_chat'
  and p.kind = 'human' and p.student_id = m.sender_student_id
  and cp.thread_id = m.thread_id and cp.principal_id = p.id
  and cp.role = case when m.sender_role = 'student' then 'student' else 'mentor' end;
update public.conversation_messages m
set message_kind = 'internal_note'
from public.conversation_threads t
where t.id = m.thread_id and t.source_type = 'mentor_chat' and m.is_internal;

with historical_sequence as (
  select m.id, row_number() over (partition by m.thread_id order by m.created_at, m.id) seq
  from public.conversation_messages m
  join public.conversation_threads t on t.id = m.thread_id
  where t.source_type = 'mentor_chat' and not m.is_internal
)
update public.conversation_messages m set public_seq = h.seq
from historical_sequence h where h.id = m.id;

update public.conversation_threads t
set last_public_message_seq = coalesce((
      select max(m.public_seq) from public.conversation_messages m where m.thread_id = t.id
    ), 0),
    last_public_message_id = (
      select m.id from public.conversation_messages m
      where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
      order by m.public_seq desc limit 1
    ),
    last_message_at = (
      select max(m.created_at) from public.conversation_messages m
      where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
    )
where t.source_type = 'mentor_chat';

-- Counters cannot establish an exact historical seen boundary. Only preserve
-- a zero-unread boundary when the old counter says all messages were read;
-- otherwise start conservatively at zero and never hide an old unread message.
update public.conversation_participants cp
set last_read_public_seq = case when t.unread_for_student_count = 0
                               then t.last_public_message_seq else 0 end
from public.conversation_threads t
where t.id = cp.thread_id and cp.role = 'student';

create unique index conversation_messages_public_sequence_unique
  on public.conversation_messages(thread_id, public_seq) where public_seq is not null;
create unique index conversation_messages_principal_intent_unique
  on public.conversation_messages(thread_id, sender_principal_id, client_message_id)
  where sender_principal_id is not null and client_message_id is not null;
create index conversation_messages_public_page
  on public.conversation_messages(thread_id, public_seq desc)
  where not is_internal and deleted_at is null;
create index conversation_threads_mentor_inbox_page
  on public.conversation_threads((coalesce(last_message_at, created_at)) desc, id desc)
  where source_type = 'mentor_chat';

alter table public.chat_principals enable row level security;
alter table public.chat_mentor_config enable row level security;
alter table public.conversation_participants enable row level security;
revoke all on public.chat_principals, public.chat_mentor_config,
  public.conversation_participants from public, anon, authenticated;
grant select on public.chat_principals, public.conversation_participants to authenticated;
grant all on public.chat_principals, public.chat_mentor_config,
  public.conversation_participants to service_role;

-- These helpers resolve auth.uid() themselves; a caller cannot supply another
-- identity. Live auth accounts are checked independently of profile RLS.
create function public.current_chat_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  join auth.users u on u.id = s.auth_user_id
  where s.auth_user_id = auth.uid() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
  limit 1;
$$;

create function public.current_chat_mentor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.mentor_student_id from public.chat_mentor_config c
  join public.students s on s.id = c.mentor_student_id
  join auth.users u on u.id = s.auth_user_id
  where c.singleton and c.enabled and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
$$;

create function public.chat_participant_role(p_thread_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select cp.role
  from public.conversation_participants cp
  join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
  join public.conversation_threads t on t.id = cp.thread_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and t.source_type = 'mentor_chat'
    and p.student_id = public.current_chat_student_id()
    and public.current_chat_mentor_id() is not null
    and (
      (cp.role = 'student' and p.student_id = t.student_id
       and p.student_id <> public.current_chat_mentor_id())
      or (cp.role = 'mentor' and p.student_id = public.current_chat_mentor_id())
    )
  limit 1;
$$;

-- Earlier restrictive policies retain this compatibility signature. Its
-- authorization now follows live participation too, so even directly calling
-- the old boolean/role helper cannot reveal a revoked thread's existence.
create or replace function public.legacy_chat_thread_role(p_thread_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select public.chat_participant_role(p_thread_id);
$$;

create function public.get_my_chat_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid := public.current_chat_mentor_id();
begin
  if v_student_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'available', v_mentor_id is not null,
    'isMentor', coalesce(v_student_id = v_mentor_id, false),
    'unreadCount', coalesce((
      select sum(case when v_student_id = v_mentor_id then t.unread_for_mentor_count
                      else t.unread_for_student_count end)
      from public.conversation_threads t
      where t.source_type = 'mentor_chat' and public.chat_participant_role(t.id) is not null
    ), 0),
    'mentor', case when v_mentor_id is null then null else (
      select jsonb_build_object('studentId', s.id,
        'displayName', coalesce(nullif(btrim(s.name), ''), 'Rousso'))
      from public.students s where s.id = v_mentor_id
    ) end
  );
end;
$$;

create or replace function public.configure_chat_mentor(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal_id uuid;
  v_thread public.conversation_threads%rowtype;
begin
  -- EXECUTE is service-only. This additional check also rejects accidentally
  -- granted client execution; SQL maintenance connections remain possible.
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
  -- Every writer locks config before the thread. Rotation therefore cannot race
  -- a send, membership change or read operation.
  perform 1 from public.chat_mentor_config where singleton for update;
  insert into public.chat_principals(kind, student_id, display_name)
  select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Rousso')
  from public.students s where s.id = p_student_id
  on conflict (student_id) where kind = 'human'
  do update set display_name = excluded.display_name
  returning id into v_principal_id;

  for v_thread in select * from public.conversation_threads
    where source_type = 'mentor_chat' order by id for update
  loop
    update public.conversation_participants
    set active = false, revoked_at = now()
    where thread_id = v_thread.id and role = 'mentor' and active;
    -- A historical self-chat of the new mentor is retained but is not an inbox
    -- work item, and cannot become a student-to-self message channel.
    if v_thread.student_id <> p_student_id then
      insert into public.conversation_participants(thread_id, principal_id, role, active,
        revoked_at, last_read_public_seq)
      values (v_thread.id, v_principal_id, 'mentor', true, null,
        case when v_thread.unread_for_mentor_count = 0
             then v_thread.last_public_message_seq else 0 end)
      on conflict (thread_id, principal_id, role)
      do update set active = true, revoked_at = null;
    end if;
    update public.conversation_threads
    set assigned_to_student_id = p_student_id,
        chat_version = chat_version + 1,
        unread_for_student_count = (
          select count(*) from public.conversation_messages m
          where m.thread_id = v_thread.id and not m.is_internal and m.deleted_at is null
            and m.sender_role <> 'student' and m.public_seq > coalesce((
              select cp.last_read_public_seq from public.conversation_participants cp
              where cp.thread_id = v_thread.id and cp.role = 'student' and cp.active
            ), 0)
        ),
        unread_for_mentor_count = (
          select count(*) from public.conversation_messages m
          where m.thread_id = v_thread.id and not m.is_internal and m.deleted_at is null
            and m.sender_role = 'student' and m.public_seq > coalesce((
              select cp.last_read_public_seq from public.conversation_participants cp
              where cp.thread_id = v_thread.id and cp.role = 'mentor' and cp.active
            ), 0)
        )
    where id = v_thread.id;
  end loop;
  update public.chat_mentor_config
  set mentor_student_id = p_student_id, enabled = true, updated_at = now()
  where singleton;
  -- Retain historical delivery rows while hiding obsolete staff deliveries.
  update public.notification_recipients nr set archived_at = coalesce(nr.archived_at, now())
  from public.notification_events ne
  where ne.id = nr.event_id and ne.type = 'mentor_new_message'
    and nr.student_id <> p_student_id;
  return jsonb_build_object('configured', true, 'mentorStudentId', p_student_id);
end;
$$;

-- Direct authenticated mutations are closed. Every write must use the narrow
-- RPCs below. Existing non-mentor conversation reads retain their old rules.
revoke insert, update, delete, truncate, references, trigger
  on public.conversation_threads, public.conversation_messages,
     public.conversation_participants, public.chat_principals,
     public.conversation_message_reactions, public.conversation_events
  from public, anon, authenticated;
grant select on public.conversation_threads, public.conversation_messages,
  public.conversation_message_reactions, public.conversation_events to authenticated;

-- Restrictive guards are intentional: an unknown permissive legacy policy is
-- OR-combined by PostgreSQL and otherwise could reopen blanket admin access.
create policy mentor_chat_thread_privacy_guard
  on public.conversation_threads as restrictive for select to authenticated
  using (source_type <> 'mentor_chat' or public.chat_participant_role(id) is not null);
create policy mentor_chat_message_privacy_guard
  on public.conversation_messages as restrictive for select to authenticated
  using (exists (
    select 1 from public.conversation_threads t where t.id = thread_id
      and (t.source_type <> 'mentor_chat' or (
        public.chat_participant_role(t.id) is not null
        and (not is_internal or public.chat_participant_role(t.id) = 'mentor')
        and deleted_at is null
      ))
  ));
create policy mentor_chat_event_privacy_guard
  on public.conversation_events as restrictive for select to authenticated
  using (exists (
    select 1 from public.conversation_threads t where t.id = thread_id
      and (t.source_type <> 'mentor_chat' or public.chat_participant_role(t.id) = 'mentor')
  ));
create policy mentor_chat_reaction_privacy_guard
  on public.conversation_message_reactions as restrictive for select to authenticated
  using (exists (
    select 1 from public.conversation_messages m
    join public.conversation_threads t on t.id = m.thread_id
    where m.id = message_id and (t.source_type <> 'mentor_chat' or (
      public.chat_participant_role(t.id) is not null and m.deleted_at is null
      and (not m.is_internal or public.chat_participant_role(t.id) = 'mentor')
    ))
  ));

drop policy if exists conversation_threads_select_own on public.conversation_threads;
create policy conversation_threads_select_own
  on public.conversation_threads for select to authenticated
  using (public.chat_participant_role(id) is not null or (
    source_type <> 'mentor_chat' and (public.is_platform_admin() or exists (
      select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid()
    ))
  ));
drop policy if exists conversation_threads_insert_own on public.conversation_threads;
drop policy if exists conversation_threads_update_admin on public.conversation_threads;
drop policy if exists conversation_messages_insert_student on public.conversation_messages;
drop policy if exists conversation_messages_insert_admin on public.conversation_messages;
drop policy if exists conversation_messages_update_admin on public.conversation_messages;
drop policy if exists conversation_messages_select_visible on public.conversation_messages;
create policy conversation_messages_select_visible
  on public.conversation_messages for select to authenticated
  using ((public.chat_participant_role(thread_id) is not null
    and (not is_internal or public.chat_participant_role(thread_id) = 'mentor')
    and deleted_at is null) or exists (
    select 1 from public.conversation_threads t where t.id = thread_id
      and t.source_type <> 'mentor_chat' and (public.is_platform_admin()
        or (not is_internal and deleted_at is null and exists (
          select 1 from public.students s where s.id = t.student_id and s.auth_user_id = auth.uid()
        )))
  ));
drop policy if exists conversation_events_select_admin on public.conversation_events;
drop policy if exists conversation_events_insert_admin on public.conversation_events;
create policy conversation_events_select_participating_mentor
  on public.conversation_events for select to authenticated
  using (public.chat_participant_role(thread_id) = 'mentor' or exists (
    select 1 from public.conversation_threads t where t.id = thread_id
      and t.source_type <> 'mentor_chat' and public.is_platform_admin()
  ));
drop policy if exists conversation_message_reactions_insert_own on public.conversation_message_reactions;
drop policy if exists conversation_message_reactions_delete_own on public.conversation_message_reactions;
drop policy if exists conversation_message_reactions_select_visible on public.conversation_message_reactions;
create policy conversation_message_reactions_select_visible
  on public.conversation_message_reactions for select to authenticated
  using (exists (select 1 from public.conversation_messages m where m.id = message_id));

create policy conversation_participants_select_visible
  on public.conversation_participants for select to authenticated
  using (public.chat_participant_role(thread_id) is not null and active
    and role in ('student', 'mentor'));
create policy chat_principals_select_visible
  on public.chat_principals for select to authenticated
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.principal_id = chat_principals.id and cp.active
      and public.chat_participant_role(cp.thread_id) is not null
  ));

-- Resolve a notification's thread without unsafe casts or trusting an arbitrary
-- recipient row. All legacy chat types fail closed if their thread is missing.
create function public.chat_notification_thread_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case
    when ne.target_table = 'conversation_threads'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ne.target_id::uuid
    when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (ne.metadata ->> 'thread_id')::uuid
    when ne.target_table = 'conversation_messages'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
    else null end
  from public.notification_events ne where ne.id = p_event_id;
$$;

create function public.is_chat_notification_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when exists (
      select 1 from public.conversation_threads t
      where t.id = public.chat_notification_thread_id(ne.id) and t.source_type <> 'mentor_chat'
    ) then false else ne.type in ('mentor_new_message', 'mentor_reply')
      or ne.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
      or ne.metadata ? 'thread_id' end
    from public.notification_events ne where ne.id = p_event_id
  ), false);
$$;

create or replace function public.can_read_notification_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when public.is_chat_notification_event(p_event_id) then
    exists (
      select 1 from public.notification_events ne
      join public.notification_recipients nr on nr.event_id = ne.id
      where ne.id = p_event_id and nr.student_id = public.current_chat_student_id()
        and public.chat_participant_role(public.chat_notification_thread_id(ne.id)) is not null
        and (ne.type <> 'mentor_new_message'
             or public.chat_participant_role(public.chat_notification_thread_id(ne.id)) = 'mentor')
        and (ne.type <> 'mentor_reply'
             or public.chat_participant_role(public.chat_notification_thread_id(ne.id)) = 'student')
    )
  else public.is_platform_admin() or exists (
    select 1 from public.notification_events ne
    join public.notification_recipients nr on nr.event_id = ne.id
    join public.students s on s.id = nr.student_id
    where ne.id = p_event_id and s.auth_user_id = auth.uid()
      and ne.type in ('mentor_reply', 'weekly_update.published', 'live_session.scheduled',
        'live_session.cancelled', 'subscription.bonus_expired', 'subscription.payment_failed')
  ) end;
$$;

create function public.can_access_notification_recipient(p_event_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when public.is_chat_notification_event(p_event_id) then
    p_student_id = public.current_chat_student_id()
      and public.can_read_notification_event(p_event_id)
  else public.is_platform_admin() or (
    exists (select 1 from public.students s
            where s.id = p_student_id and s.auth_user_id = auth.uid())
    and public.can_read_notification_event(p_event_id)
  ) end;
$$;

drop policy if exists notification_events_select_recipients on public.notification_events;
create policy notification_events_select_recipients
  on public.notification_events for select to authenticated
  using (public.can_read_notification_event(id));
create policy mentor_chat_notification_event_privacy_guard
  on public.notification_events as restrictive for select to authenticated
  using (not public.is_chat_notification_event(id) or public.can_read_notification_event(id));
-- Keep unrelated platform notification publishing rights unchanged.
create policy mentor_chat_notification_event_insert_guard
  on public.notification_events as restrictive for insert to authenticated
  with check (type not in ('mentor_new_message', 'mentor_reply')
    and coalesce(target_table, '') not in ('conversation_threads', 'conversation_messages', 'conversation_events')
    and not (metadata ? 'thread_id'));
create policy mentor_chat_notification_event_update_guard
  on public.notification_events as restrictive for update to authenticated
  using (not public.is_chat_notification_event(id))
  with check (type not in ('mentor_new_message', 'mentor_reply')
    and coalesce(target_table, '') not in ('conversation_threads', 'conversation_messages', 'conversation_events')
    and not (metadata ? 'thread_id'));
create policy mentor_chat_notification_event_delete_guard
  on public.notification_events as restrictive for delete to authenticated
  using (not public.is_chat_notification_event(id));

drop policy if exists notification_recipients_select_own on public.notification_recipients;
create policy notification_recipients_select_own
  on public.notification_recipients for select to authenticated
  using (public.can_access_notification_recipient(event_id, student_id));
drop policy if exists notification_recipients_update_own on public.notification_recipients;
create policy notification_recipients_update_own
  on public.notification_recipients for update to authenticated
  using (public.can_access_notification_recipient(event_id, student_id))
  with check (public.can_access_notification_recipient(event_id, student_id));
create policy mentor_chat_notification_recipient_privacy_guard
  on public.notification_recipients as restrictive for select to authenticated
  using (not public.is_chat_notification_event(event_id)
    or public.can_access_notification_recipient(event_id, student_id));
create policy mentor_chat_notification_recipient_update_guard
  on public.notification_recipients as restrictive for update to authenticated
  using (not public.is_chat_notification_event(event_id)
    or public.can_access_notification_recipient(event_id, student_id))
  with check (not public.is_chat_notification_event(event_id)
    or public.can_access_notification_recipient(event_id, student_id));
create policy mentor_chat_notification_recipient_insert_guard
  on public.notification_recipients as restrictive for insert to authenticated
  with check (not public.is_chat_notification_event(event_id));
create policy mentor_chat_notification_recipient_delete_guard
  on public.notification_recipients as restrictive for delete to authenticated
  using (not public.is_chat_notification_event(event_id));

-- A recipient may mark delivery history read but cannot retarget a private
-- notification to a different event, account or identity.
create or replace function public.guard_chat_notification_recipient_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (public.is_chat_notification_event(old.event_id)
      or public.is_chat_notification_event(new.event_id))
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

-- Remove private text copies from historic chat notification payloads. No new
-- events or recipients are generated while backfilling existing messages.
update public.notification_events ne
set title = case when ne.type = 'mentor_new_message' then 'Nieuw chatbericht'
                 else 'Je hebt een nieuw bericht' end,
    body = 'Open je gesprek om het bericht te lezen.',
    href = case when ne.type = 'mentor_new_message'
                then '/mentor-inbox?thread=' || public.chat_notification_thread_id(ne.id)::text
                else '/mentor' end,
    metadata = jsonb_build_object('thread_id', public.chat_notification_thread_id(ne.id))
where public.is_chat_notification_event(ne.id);

-- Legacy deliveries have no trustworthy public sequence. Retire this stale
-- notification projection; conservative thread unread state remains intact.
-- New deliveries below carry public_seq and follow the participant cursor.
update public.notification_recipients nr
set archived_at = coalesce(nr.archived_at, now())
where public.is_chat_notification_event(nr.event_id);

-- Before-insert enforcement serializes sequence allocation under the thread
-- lock. The application cannot supply authorship, routing or public ordering.
create function public.prepare_private_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_thread public.conversation_threads%rowtype;
  v_role text;
  v_principal uuid;
  v_participant uuid;
begin
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if v_thread.source_type <> 'mentor_chat' then return new; end if;
  v_role := public.chat_participant_role(new.thread_id);
  if v_role is null or (new.is_internal and v_role <> 'mentor') then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  if new.client_message_id is null then
    raise exception 'client message ID required' using errcode = '22023';
  end if;
  select p.id, cp.id into v_principal, v_participant
  from public.chat_principals p
  join public.conversation_participants cp on cp.principal_id = p.id
  where p.kind = 'human' and p.student_id = public.current_chat_student_id()
    and cp.thread_id = new.thread_id and cp.role = v_role and cp.active and cp.revoked_at is null;
  new.sender_student_id := public.current_chat_student_id();
  new.sender_role := v_role;
  new.sender_principal_id := v_principal;
  new.sender_participant_id := v_participant;
  new.message_kind := case when new.is_internal then 'internal_note' else 'text' end;
  new.created_at := now();
  new.body_format := 'plain';
  new.status := 'sent';
  if new.is_internal then
    new.public_seq := null;
  else
    new.public_seq := v_thread.last_public_message_seq + 1;
    update public.conversation_threads
    set last_public_message_seq = new.public_seq where id = new.thread_id;
  end if;
  return new;
end;
$$;
create trigger prepare_private_chat_message
  before insert on public.conversation_messages for each row
  execute function public.prepare_private_chat_message();

-- The original trigger still serves non-mentor sources. The mentor_chat branch
-- routes exclusively via the configured, active participant and uses generic
-- notification text. Internal notes never update public activity or counters.
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
        and (cp.role <> 'mentor' or p.student_id = public.current_chat_mentor_id());
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
        case when new.sender_role = 'student' then '/mentor-inbox?thread=' || new.thread_id::text else '/mentor' end,
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

create function public.send_chat_message(
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
    -- ON CONFLICT waits for a concurrent first-send transaction, preserving one
    -- default thread and both independent messages without an empty-view write.
    insert into public.conversation_threads(student_id, assigned_to_student_id, source_type, subject)
    values (v_student_id, v_mentor_id, 'mentor_chat', 'Gesprek met Rousso')
    on conflict (student_id) where source_type = 'mentor_chat' and source_id is null do nothing;
    select * into v_thread from public.conversation_threads
    where student_id = v_student_id and source_type = 'mentor_chat' and source_id is null for update;

    insert into public.chat_principals(kind, student_id, display_name)
    select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
    from public.students s where s.id in (v_student_id, v_mentor_id)
    on conflict (student_id) where kind = 'human' do nothing;
    select id into v_principal from public.chat_principals where student_id = v_student_id and kind = 'human';
    select id into v_mentor_principal from public.chat_principals where student_id = v_mentor_id and kind = 'human';
    -- This is creation-only; an explicitly revoked participant is never revived
    -- by sending another message to an existing thread.
    insert into public.conversation_participants(thread_id, principal_id, role, active)
    values (v_thread.id, v_principal, 'student', true),
           (v_thread.id, v_mentor_principal, 'mentor', true)
    on conflict (thread_id, principal_id, role) do nothing;
  else
    select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  end if;
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

create function public.mark_chat_read(p_thread_id uuid, p_seen_seq bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_thread public.conversation_threads%rowtype;
  v_read_seq bigint;
begin
  if public.current_chat_student_id() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  v_role := public.chat_participant_role(p_thread_id);
  if v_role is null then raise exception 'chat access denied' using errcode = '42501'; end if;
  if p_seen_seq is null or p_seen_seq < 0 or p_seen_seq > v_thread.last_public_message_seq
     or (p_seen_seq > 0 and not exists (
       select 1 from public.conversation_messages m where m.thread_id = p_thread_id
         and m.public_seq = p_seen_seq and not m.is_internal and m.deleted_at is null
     )) then
    raise exception 'invalid public read boundary' using errcode = '22023';
  end if;
  update public.conversation_participants cp
  set last_read_public_seq = greatest(cp.last_read_public_seq, p_seen_seq)
  from public.chat_principals p
  where p.id = cp.principal_id and p.student_id = public.current_chat_student_id()
    and cp.thread_id = p_thread_id and cp.active and cp.role = v_role
  returning cp.last_read_public_seq into v_read_seq;
  if v_role = 'student' then
    update public.conversation_threads t
    set unread_for_student_count = (
      select count(*) from public.conversation_messages m
      where m.thread_id = t.id and m.public_seq > v_read_seq
        and m.sender_role <> 'student' and not m.is_internal and m.deleted_at is null
    ) where t.id = p_thread_id;
  else
    update public.conversation_threads t
    set unread_for_mentor_count = (
      select count(*) from public.conversation_messages m
      where m.thread_id = t.id and m.public_seq > v_read_seq
        and m.sender_role = 'student' and not m.is_internal and m.deleted_at is null
    ) where t.id = p_thread_id;
  end if;
  -- Mark only corresponding delivered events; clearing notification history
  -- elsewhere never moves the conversation's cursor.
  update public.notification_recipients nr set read_at = coalesce(nr.read_at, now())
  from public.notification_events ne
  where ne.id = nr.event_id and nr.student_id = public.current_chat_student_id()
    and public.chat_notification_thread_id(ne.id) = p_thread_id
    and (ne.metadata ->> 'public_seq') ~ '^[0-9]+$'
    and (ne.metadata ->> 'public_seq')::numeric <= v_read_seq
    and public.can_read_notification_event(ne.id);
  return jsonb_build_object('success', true);
end;
$$;

create function public.get_chat_read_state(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.chat_participant_role(p_thread_id);
  v_read_seq bigint;
begin
  if v_role is null then raise exception 'chat access denied' using errcode = '42501'; end if;
  select cp.last_read_public_seq into v_read_seq
  from public.conversation_participants cp join public.chat_principals p on p.id = cp.principal_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and cp.role = v_role and p.student_id = public.current_chat_student_id();
  return jsonb_build_object('lastReadSeq', coalesce(v_read_seq, 0));
end;
$$;

-- Obsolete broad-admin read RPCs are retained only as denied signatures, so old
-- clients cannot clear unseen messages or mutate someone else's unread state.
create or replace function public.mark_student_conversation_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'use mark_chat_read with a visible public sequence' using errcode = '42501';
end;
$$;
create or replace function public.mark_mentor_conversation_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'use mark_chat_read with a visible public sequence' using errcode = '42501';
end;
$$;

create function public.update_chat_thread(
  p_thread_id uuid, p_status text default null, p_priority text default null,
  p_category text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if public.current_chat_student_id() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  perform 1 from public.conversation_threads where id = p_thread_id for update;
  if public.chat_participant_role(p_thread_id) is distinct from 'mentor' then
    raise exception 'mentor chat access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('open', 'pending_mentor', 'pending_student', 'snoozed', 'closed') then
    raise exception 'invalid chat status' using errcode = '22023';
  end if;
  if p_priority is not null and p_priority not in ('normal', 'high', 'urgent') then
    raise exception 'invalid chat priority' using errcode = '22023';
  end if;
  if p_category is not null and char_length(p_category) > 100 then
    raise exception 'chat category too long' using errcode = '22023';
  end if;
  update public.conversation_threads
  set status = coalesce(p_status, status), priority = coalesce(p_priority, priority),
      category = case when p_category is null then category else nullif(btrim(p_category), '') end,
      closed_at = case when p_status = 'closed' then now()
                      when p_status is not null then null else closed_at end
  where id = p_thread_id;
  return jsonb_build_object('success', true);
end;
$$;

-- A narrow projection gives the chat mentor a student's display identity,
-- without granting access to the students directory or private profile fields.
create function public.mentor_chat_thread_projection(p_thread_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(t) || jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'name', s.name),
    'lastMessage', (
      select to_jsonb(m) from public.conversation_messages m
      where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
      order by m.public_seq desc limit 1
    )
  )
  from public.conversation_threads t join public.students s on s.id = t.student_id
  where t.id = p_thread_id and public.chat_participant_role(t.id) = 'mentor';
$$;

create function public.get_mentor_inbox(
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
     or public.current_chat_student_id() is distinct from public.current_chat_mentor_id() then
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

-- Authorize a notification batch once rather than recursively evaluating
-- several table policies and definer helpers for every delivered event. This
-- returns only auth.uid()'s delivery rows, with exactly the same current chat
-- participation and non-chat event visibility rules as the direct-table RLS.
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
      and v_mentor_id is not null and (
        (cp.role = 'student' and t.student_id = v_student_id and v_student_id <> v_mentor_id)
        or (cp.role = 'mentor' and v_student_id = v_mentor_id)
      )
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

-- PUBLIC has EXECUTE on newly created functions by default. Revoke it for every
-- new helper/RPC and the replaced legacy signatures before granting explicitly.
revoke all on function public.current_chat_student_id(), public.current_chat_mentor_id(),
  public.chat_participant_role(uuid), public.legacy_chat_thread_role(uuid), public.get_my_chat_access(),
  public.configure_chat_mentor(uuid), public.chat_notification_thread_id(uuid),
  public.is_chat_notification_event(uuid), public.can_read_notification_event(uuid),
  public.can_access_notification_recipient(uuid, uuid),
  public.guard_chat_notification_recipient_identity(), public.prepare_private_chat_message(),
  public.handle_conversation_message_insert(), public.send_chat_message(text, uuid, uuid, boolean),
  public.mark_chat_read(uuid, bigint), public.get_chat_read_state(uuid), public.mark_student_conversation_read(uuid),
  public.mark_mentor_conversation_read(uuid), public.update_chat_thread(uuid, text, text, text),
  public.mentor_chat_thread_projection(uuid), public.get_mentor_inbox(text, text, integer, text, uuid),
  public.get_my_notification_shell()
  from public, anon, authenticated;

grant execute on function public.current_chat_student_id(), public.current_chat_mentor_id(),
  public.chat_participant_role(uuid), public.legacy_chat_thread_role(uuid), public.get_my_chat_access(),
  public.is_chat_notification_event(uuid),
  public.can_read_notification_event(uuid), public.can_access_notification_recipient(uuid, uuid),
  public.send_chat_message(text, uuid, uuid, boolean), public.mark_chat_read(uuid, bigint),
  public.get_chat_read_state(uuid),
  public.update_chat_thread(uuid, text, text, text), public.get_mentor_inbox(text, text, integer, text, uuid),
  public.get_my_notification_shell()
  to authenticated;
grant execute on function public.configure_chat_mentor(uuid) to service_role;
grant execute on function public.can_read_notification_event(uuid),
  public.chat_notification_thread_id(uuid), public.is_chat_notification_event(uuid),
  public.can_access_notification_recipient(uuid, uuid), public.get_my_notification_shell() to service_role;

comment on table public.chat_mentor_config is
  'Explicit private-chat mentor configuration; no name/email/admin-role lookup. Service-only configuration.';
comment on function public.send_chat_message(text, uuid, uuid, boolean) is
  'Authenticated, membership-authorized, serialized, idempotent human chat send. All content-access levels are eligible.';
comment on function public.can_read_notification_event(uuid) is
  'Chat events require current active participation and own delivery. Unrelated platform notifications retain their previous policy.';
comment on function public.get_my_notification_shell() is
  'Own delivery count and latest eight notifications, explicitly authorized against live identity and current chat participation once per batch.';

-- The privacy-only deployment remains independently safe, but after this
-- cutover its equivalent restrictive guards must not run a second time for
-- every row. Especially on recipient counts, duplicated SECURITY DEFINER
-- authorization chains multiply the work. Drop only guards whose matching
-- core guards were created above, within this same atomic transaction.
-- Legacy write guards without a core counterpart remain in force.
drop policy if exists legacy_mentor_chat_thread_read_guard on public.conversation_threads;
drop policy if exists legacy_mentor_chat_message_read_guard on public.conversation_messages;
drop policy if exists legacy_mentor_chat_event_read_guard on public.conversation_events;
drop policy if exists legacy_mentor_chat_reaction_read_guard on public.conversation_message_reactions;
drop policy if exists legacy_mentor_chat_notification_event_read_guard on public.notification_events;
drop policy if exists legacy_mentor_chat_notification_event_insert_guard on public.notification_events;
drop policy if exists legacy_mentor_chat_notification_event_update_guard on public.notification_events;
drop policy if exists legacy_mentor_chat_notification_event_delete_guard on public.notification_events;
drop policy if exists legacy_mentor_chat_notification_recipient_read_guard on public.notification_recipients;
drop policy if exists legacy_mentor_chat_notification_recipient_insert_guard on public.notification_recipients;
drop policy if exists legacy_mentor_chat_notification_recipient_update_guard on public.notification_recipients;
drop policy if exists legacy_mentor_chat_notification_recipient_delete_guard on public.notification_recipients;

-- Reuse only an already explicit, valid service configuration from the first
-- privacy deployment. An unset configuration remains unset and unavailable.
do $$
declare v_mentor_id uuid;
begin
  v_mentor_id := public.current_chat_mentor_id();
  if v_mentor_id is not null then perform public.configure_chat_mentor(v_mentor_id); end if;
end;
$$;

commit;
