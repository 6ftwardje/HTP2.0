-- Run against a LOCAL database after applying the mentor-chat privacy migration.
-- psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--   -v ON_ERROR_STOP=1 -f tests/sql/mentor-chat-privacy-routing.sql
-- Every fixture and configuration change is rolled back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.expect_chat_denied(p_statement text)
returns void language plpgsql as $$
begin
  begin
    execute p_statement;
  exception when insufficient_privilege or sqlstate '55000' then
    return;
  end;
  raise exception 'Expected chat permission denial: %', p_statement;
end;
$$;

-- Compare the optimized SECURITY DEFINER shell to independently authorized raw
-- rows under the current authenticated role, including exact preview contents.
create function pg_temp.assert_chat_notification_shell()
returns void language plpgsql as $$
declare
  v_shell jsonb := public.get_my_notification_shell();
  v_count bigint;
  v_preview jsonb;
begin
  select count(*) into v_count from public.notification_recipients nr
  where nr.student_id = public.current_chat_student_id()
    and nr.read_at is null and nr.archived_at is null
    and nr.created_at >= now() - interval '720 hours';
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'created_at', r.created_at, 'read_at', r.read_at,
      'event', jsonb_build_object('type', r.type, 'title', r.title, 'body', r.body, 'href', r.href)
    ) order by r.created_at desc, r.id desc), '[]'::jsonb)
    into v_preview
  from (
    select nr.id, nr.created_at, nr.read_at, ne.type, ne.title, ne.body, ne.href
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    where nr.student_id = public.current_chat_student_id() and nr.archived_at is null
    order by nr.created_at desc, nr.id desc limit 5
  ) r;
  if v_shell->>'studentId' <> public.current_chat_student_id()::text
     or (v_shell->>'unreadCount')::bigint <> v_count
     or v_shell->'notifications' is distinct from v_preview then
    raise exception 'Optimized notification shell differs from raw RLS for current identity';
  end if;
end;
$$;

-- Live-account checks intentionally join auth.users, rather than trusting a
-- profile with an arbitrary auth UUID. SQL fixtures therefore include accounts.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('14120000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-free-a@example.invalid', '', now(), now(), now()),
  ('14120000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-free-b@example.invalid', '', now(), now(), now()),
  ('14120000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-rouss@example.invalid', '', now(), now(), now()),
  ('14120000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-other-admin@example.invalid', '', now(), now(), now());

insert into public.students (id, auth_user_id, email, name, access_level)
values
  ('14120000-0000-4000-8000-000000000001', '14120000-0000-4000-8000-000000000011', 'chat-free-a@example.invalid', 'Free student A', 1),
  ('14120000-0000-4000-8000-000000000002', '14120000-0000-4000-8000-000000000012', 'chat-free-b@example.invalid', 'Free student B', 1),
  ('14120000-0000-4000-8000-000000000003', '14120000-0000-4000-8000-000000000013', 'chat-rouss@example.invalid', 'Rousso', 1),
  ('14120000-0000-4000-8000-000000000004', '14120000-0000-4000-8000-000000000014', 'chat-other-admin@example.invalid', 'Other admin', 3);

set request.jwt.claim.role = 'service_role';
select public.configure_chat_mentor('14120000-0000-4000-8000-000000000003');

set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000011';
do $$
declare
  v_first jsonb;
  v_retry jsonb;
begin
  if not (public.get_my_chat_access()->>'available')::boolean then
    raise exception 'Free member cannot reach configured mentor';
  end if;
  v_first := public.send_chat_message('Free member question', '14120000-0000-4000-8000-000000000021');
  v_retry := public.send_chat_message('Free member question', '14120000-0000-4000-8000-000000000021');
  if v_first->'message'->>'id' <> v_retry->'message'->>'id' then
    raise exception 'Retry returned a second message identity';
  end if;
  perform set_config('test.mentor_chat_thread_id', v_first->>'threadId', true);
  if (select count(*) from public.conversation_messages where thread_id = (v_first->>'threadId')::uuid) <> 1 then
    raise exception 'Retry duplicated message';
  end if;
  perform pg_temp.assert_chat_notification_shell();
end;
$$;

reset role;
update public.conversation_threads set chat_mode = 'paused'
where id = current_setting('test.mentor_chat_thread_id')::uuid;
set role authenticated;
do $$
declare v_retry jsonb;
begin
  v_retry := public.send_chat_message('Free member question', '14120000-0000-4000-8000-000000000021');
  if v_retry->'message'->>'body' <> 'Free member question' then
    raise exception 'Paused conversation does not acknowledge an already committed retry';
  end if;
  perform pg_temp.expect_chat_denied(format('select public.send_chat_message(%L, %L, %L)', 'New send while paused', gen_random_uuid(), current_setting('test.mentor_chat_thread_id')));
end;
$$;
reset role;
update public.conversation_threads set chat_mode = 'human'
where id = current_setting('test.mentor_chat_thread_id')::uuid;

do $$
declare
  v_event uuid;
begin
  select id into v_event from public.notification_events
   where target_table = 'conversation_threads'
     and target_id = current_setting('test.mentor_chat_thread_id');
  if (select count(*) from public.notification_recipients where event_id = v_event) <> 1
     or not exists (select 1 from public.notification_recipients where event_id = v_event and student_id = '14120000-0000-4000-8000-000000000003') then
    raise exception 'Free question was not routed only to Rousso';
  end if;
  -- Simulate an over-delivered recipient row from the old all-admin routing.
  insert into public.notification_recipients (event_id, student_id)
  values (v_event, '14120000-0000-4000-8000-000000000004');
  perform set_config('test.mentor_chat_event_id', v_event::text, true);
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000014';
do $$
declare
  v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
  v_event uuid := current_setting('test.mentor_chat_event_id')::uuid;
  v_rows integer;
begin
  if (public.get_my_chat_access()->>'isMentor')::boolean then
    raise exception 'Admin access level grants mentor identity';
  end if;
  if exists (select 1 from public.conversation_threads where id = v_thread)
     or exists (select 1 from public.conversation_messages where thread_id = v_thread)
     or exists (select 1 from public.conversation_events where thread_id = v_thread)
     or exists (select 1 from public.conversation_participants where thread_id = v_thread)
     or exists (select 1 from public.notification_events where id = v_event)
     or exists (select 1 from public.notification_recipients where event_id = v_event) then
    raise exception 'Other admin can read private chat surfaces or stale recipients';
  end if;
  if public.get_my_notification_shell()::text like '%Free member question%'
     or (public.get_my_notification_shell()->>'unreadCount')::integer <> 0 then
    raise exception 'Notification shell leaks private chat';
  end if;
  perform pg_temp.assert_chat_notification_shell();
  perform pg_temp.expect_chat_denied(format('select public.send_chat_message(%L, %L, %L)', 'Forged admin reply', gen_random_uuid(), v_thread));
  perform pg_temp.expect_chat_denied(format('select public.mark_chat_read(%L, 1)', v_thread));
  perform pg_temp.expect_chat_denied(format('select public.update_chat_thread(%L, %L)', v_thread, 'closed'));
  perform pg_temp.expect_chat_denied(format('insert into public.conversation_messages (thread_id, sender_student_id, sender_role, body) values (%L, %L, %L, %L)', v_thread, '14120000-0000-4000-8000-000000000003', 'mentor', 'Forged direct author'));
  begin
    update public.conversation_threads set assigned_to_student_id = '14120000-0000-4000-8000-000000000004' where id = v_thread;
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then
    v_rows := 0;
  end;
  if v_rows <> 0 then raise exception 'Other admin can reroute chat'; end if;
end;
$$;

set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000012';
do $$
declare v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
begin
  if exists (select 1 from public.conversation_threads where id = v_thread)
     or exists (select 1 from public.conversation_messages where thread_id = v_thread) then
    raise exception 'Student B sees Student A conversation';
  end if;
  perform pg_temp.expect_chat_denied(format('select public.send_chat_message(%L, %L, %L)', 'Cross-student forgery', gen_random_uuid(), v_thread));
  perform pg_temp.assert_chat_notification_shell();
end;
$$;

set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000013';
do $$
declare
  v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
  v_before public.conversation_threads%rowtype;
  v_after public.conversation_threads%rowtype;
  v_note jsonb;
  v_reply jsonb;
begin
  if not (public.get_my_chat_access()->>'isMentor')::boolean then
    raise exception 'Configured Rousso requires admin access';
  end if;
  perform pg_temp.assert_chat_notification_shell();
  select * into v_before from public.conversation_threads where id = v_thread;
  v_note := public.send_chat_message('Private Rousso note', gen_random_uuid(), v_thread, true);
  select * into v_after from public.conversation_threads where id = v_thread;
  if v_after.last_message_at is distinct from v_before.last_message_at
     or v_after.last_public_message_seq <> v_before.last_public_message_seq
     or v_after.unread_for_student_count <> v_before.unread_for_student_count
     or v_after.status <> v_before.status
     or v_note->'message'->>'public_seq' is not null then
    raise exception 'Internal note changes public student activity';
  end if;
  perform set_config('test.mentor_chat_note_id', v_note->'message'->>'id', true);
  v_reply := public.send_chat_message('Public Rousso reply', gen_random_uuid(), v_thread);
  perform set_config('test.mentor_chat_reply_seq', v_reply->'message'->>'public_seq', true);
end;
$$;

set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000011';
do $$
declare v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
begin
  if exists (select 1 from public.conversation_messages where id = current_setting('test.mentor_chat_note_id')::uuid) then
    raise exception 'Student can read private note';
  end if;
  perform public.mark_chat_read(v_thread, current_setting('test.mentor_chat_reply_seq')::bigint);
  if (select unread_for_student_count from public.conversation_threads where id = v_thread) <> 0 then
    raise exception 'Seen reply remains unread';
  end if;
  perform pg_temp.assert_chat_notification_shell();
end;
$$;

reset role;
update public.conversation_participants set active = false, revoked_at = now()
where thread_id = current_setting('test.mentor_chat_thread_id')::uuid and role = 'student';
set role authenticated;
do $$
declare v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
begin
  if public.chat_participant_role(v_thread) is not null
     or public.legacy_chat_thread_role(v_thread) is not null
     or exists (select 1 from public.conversation_threads where id = v_thread)
     or exists (select 1 from public.conversation_messages where thread_id = v_thread)
     or exists (select 1 from public.notification_events where target_id = v_thread::text) then
    raise exception 'Revoked membership retains a current or legacy chat authorization path';
  end if;
  perform pg_temp.expect_chat_denied(format('select public.send_chat_message(%L, %L, %L)', 'After membership revocation', gen_random_uuid(), v_thread));
  perform pg_temp.expect_chat_denied(format('select public.mark_chat_read(%L, 1)', v_thread));
  perform pg_temp.assert_chat_notification_shell();
end;
$$;
reset role;
update public.conversation_participants set active = true, revoked_at = null
where thread_id = current_setting('test.mentor_chat_thread_id')::uuid and role = 'student';
update public.chat_mentor_config set enabled = false where singleton;
set role authenticated;
set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000013';
do $$
declare v_thread uuid := current_setting('test.mentor_chat_thread_id')::uuid;
begin
  if (public.get_my_chat_access()->>'available')::boolean
     or exists (select 1 from public.conversation_threads where id = v_thread)
     or exists (select 1 from public.conversation_messages where thread_id = v_thread)
     or exists (select 1 from public.notification_events where target_id = v_thread::text) then
    raise exception 'Revoked mentor retains chat access';
  end if;
  perform pg_temp.expect_chat_denied(format('select public.send_chat_message(%L, %L, %L)', 'After revocation', gen_random_uuid(), v_thread));
  perform pg_temp.assert_chat_notification_shell();
end;
$$;

set request.jwt.claim.sub = '14120000-0000-4000-8000-000000000011';
do $$
begin
  if exists (select 1 from public.conversation_messages where thread_id = current_setting('test.mentor_chat_thread_id')::uuid) then
    raise exception 'Chat fails open for student when mentor configuration is disabled';
  end if;
  perform pg_temp.assert_chat_notification_shell();
end;
$$;

reset role;
rollback;
\echo 'PASS: rollback-only mentor privacy, Rousso routing, free access, idempotency, private notes and revocation.'
