-- Local integration regression; apply migration and test data in one rollback-only transaction.
-- psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--   -v ON_ERROR_STOP=1 -f tests/sql/mentor-reply-author.sql
\set ON_ERROR_STOP on
begin;
\ir ../../supabase/migrations/20260927040000_mentor_reply_author.sql

insert into public.students (id, auth_user_id, email, name, access_level)
values
  ('27040000-0000-4000-8000-000000000001', '27040000-0000-4000-8000-000000000011', 'mentee-reply-test@example.invalid', 'Mentee', 1),
  ('27040000-0000-4000-8000-000000000002', '27040000-0000-4000-8000-000000000012', 'named-mentor-reply-test@example.invalid', 'Alex Mentor', 3),
  ('27040000-0000-4000-8000-000000000003', '27040000-0000-4000-8000-000000000013', 'unnamed-mentor-reply-test@example.invalid', null, 3);

insert into public.conversation_threads (id, student_id)
values ('27040000-0000-4000-8000-000000000021', '27040000-0000-4000-8000-000000000001');

insert into public.conversation_messages (thread_id, sender_student_id, sender_role, body, is_internal)
values
  ('27040000-0000-4000-8000-000000000021', '27040000-0000-4000-8000-000000000002', 'mentor', 'Antwoord van Alex.', false),
  ('27040000-0000-4000-8000-000000000021', '27040000-0000-4000-8000-000000000003', 'admin', 'Antwoord zonder profielnaam.', false),
  ('27040000-0000-4000-8000-000000000021', null, 'ai', 'Antwoord van AI.', false),
  ('27040000-0000-4000-8000-000000000021', '27040000-0000-4000-8000-000000000002', 'admin', 'Interne notitie.', true);

do $$
declare
  v_thread_id text := '27040000-0000-4000-8000-000000000021';
begin
  if (select count(*) from public.notification_events where type = 'mentor_reply' and target_id = v_thread_id) <> 3 then
    raise exception 'Internal staff note created a reply notification, or public reply was missed';
  end if;
  if not exists (select 1 from public.notification_events where type = 'mentor_reply' and target_id = v_thread_id and title = 'Alex Mentor heeft geantwoord') then
    raise exception 'Named mentor did not appear in notification';
  end if;
  if not exists (select 1 from public.notification_events where type = 'mentor_reply' and target_id = v_thread_id and title = 'Je mentor heeft geantwoord') then
    raise exception 'Missing profile name did not use neutral mentor fallback';
  end if;
  if not exists (select 1 from public.notification_events where type = 'mentor_reply' and target_id = v_thread_id and title = 'AI-assistent heeft geantwoord') then
    raise exception 'AI reply did not identify AI';
  end if;
  if (select count(*)
        from public.notification_recipients nr
        join public.notification_events ne on ne.id = nr.event_id
       where ne.type = 'mentor_reply'
         and ne.target_id = v_thread_id
         and nr.student_id = '27040000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'Reply recipients changed';
  end if;
end;
$$;

rollback;
