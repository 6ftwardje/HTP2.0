-- Local regression test. Run with:
-- psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--   -v ON_ERROR_STOP=1 -f tests/sql/notification-visibility.sql
-- The migration and fixtures are rolled back even when all assertions pass.
\set ON_ERROR_STOP on
begin;
\ir ../../supabase/migrations/20260927010000_notification_visibility_by_role.sql

insert into public.students (id, auth_user_id, email, name, access_level)
values
  ('27010000-0000-4000-8000-000000000001', '27010000-0000-4000-8000-000000000011', 'former-admin-notification-test@example.invalid', 'Former admin', 3),
  ('27010000-0000-4000-8000-000000000002', '27010000-0000-4000-8000-000000000012', 'current-admin-notification-test@example.invalid', 'Current admin', 3),
  ('27010000-0000-4000-8000-000000000003', '27010000-0000-4000-8000-000000000013', 'student-notification-test@example.invalid', 'Student', 1);

insert into public.notification_events (id, type, title, body)
values
  ('27010000-0000-4000-8000-000000000021', 'mentor_new_message', 'Staff only', 'Private student message'),
  ('27010000-0000-4000-8000-000000000022', 'student_intake.completed', 'Staff only', 'Private intake details'),
  ('27010000-0000-4000-8000-000000000023', 'mentor_reply', 'Student reply', 'Your mentor replied'),
  ('27010000-0000-4000-8000-000000000024', 'future.staff_event', 'Unknown', 'Fail closed');

insert into public.notification_recipients (id, event_id, student_id)
values
  ('27010000-0000-4000-8000-000000000031', '27010000-0000-4000-8000-000000000021', '27010000-0000-4000-8000-000000000001'),
  ('27010000-0000-4000-8000-000000000032', '27010000-0000-4000-8000-000000000022', '27010000-0000-4000-8000-000000000001'),
  ('27010000-0000-4000-8000-000000000033', '27010000-0000-4000-8000-000000000023', '27010000-0000-4000-8000-000000000001'),
  ('27010000-0000-4000-8000-000000000034', '27010000-0000-4000-8000-000000000024', '27010000-0000-4000-8000-000000000001'),
  ('27010000-0000-4000-8000-000000000035', '27010000-0000-4000-8000-000000000021', '27010000-0000-4000-8000-000000000002'),
  ('27010000-0000-4000-8000-000000000036', '27010000-0000-4000-8000-000000000022', '27010000-0000-4000-8000-000000000002'),
  ('27010000-0000-4000-8000-000000000037', '27010000-0000-4000-8000-000000000023', '27010000-0000-4000-8000-000000000003');

set role authenticated;
set request.jwt.claim.sub = '27010000-0000-4000-8000-000000000011';
do $$
begin
  if (select count(*) from public.notification_recipients where id::text like '27010000-%') <> 7 then
    raise exception 'Current admin should read all recipients';
  end if;
  if (public.get_my_notification_shell()->>'unreadCount')::integer <> 4 then
    raise exception 'Current admin should read all four assigned notifications';
  end if;
end;
$$;

reset role;
update public.students
   set access_level = 1
 where id = '27010000-0000-4000-8000-000000000001';

set role authenticated;
set request.jwt.claim.sub = '27010000-0000-4000-8000-000000000011';
do $$
declare
  v_shell jsonb := public.get_my_notification_shell();
  v_updated integer;
begin
  if (select count(*) from public.notification_events where id::text like '27010000-%') <> 1
     or (select count(*) from public.notification_recipients where id::text like '27010000-%') <> 1 then
    raise exception 'Demoted admin still sees staff-only or unknown events';
  end if;
  if (v_shell->>'unreadCount')::integer <> 1
     or jsonb_array_length(v_shell->'notifications') <> 1
     or v_shell::text like '%Private student message%'
     or v_shell::text like '%Private intake details%'
     or v_shell::text like '%Fail closed%' then
    raise exception 'Notification shell leaks historical staff notifications';
  end if;
  update public.notification_recipients
     set read_at = now()
   where id = '27010000-0000-4000-8000-000000000031';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Demoted admin can update historical staff notification';
  end if;
  update public.notification_recipients
     set read_at = now()
   where id = '27010000-0000-4000-8000-000000000033';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Student cannot mark own visible notification read';
  end if;
end;
$$;

set request.jwt.claim.sub = '27010000-0000-4000-8000-000000000013';
do $$
declare
  v_updated integer;
begin
  if (select count(*) from public.notification_events where id::text like '27010000-%') <> 1
     or (select count(*) from public.notification_recipients where id::text like '27010000-%') <> 1
     or (public.get_my_notification_shell()->>'unreadCount')::integer <> 1 then
    raise exception 'Ordinary student cannot read own notification';
  end if;
  update public.notification_recipients
     set read_at = now()
   where id = '27010000-0000-4000-8000-000000000033';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Student can update someone else''s notification';
  end if;
end;
$$;

set request.jwt.claim.sub = '27010000-0000-4000-8000-000000000012';
do $$
begin
  if (select count(*) from public.notification_events where id::text like '27010000-%') <> 4
     or (select count(*) from public.notification_recipients where id::text like '27010000-%') <> 7
     or (public.get_my_notification_shell()->>'unreadCount')::integer <> 2 then
    raise exception 'Current admin lost staff notification access';
  end if;
end;
$$;

reset role;
rollback;
