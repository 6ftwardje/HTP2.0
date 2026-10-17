-- LOCAL ONLY. All accounts, messages, avatars, leases and settings roll back.
-- psql LOCAL_DB_URL -v ON_ERROR_STOP=1 -f tests/sql/mentor-chat-profiles-presence.sql
\set ON_ERROR_STOP on
begin;

create function pg_temp.expect_feature_denied(p_statement text)
returns void language plpgsql as $$
begin
  begin execute p_statement;
  exception when insufficient_privilege or sqlstate '55000' then return; end;
  raise exception 'Expected permission denial: %', p_statement;
end;
$$;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('17100000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'chat-feature-' || i || '@example.invalid','',now(),now(),now()
from generate_series(11,15) i;
insert into public.students(id,auth_user_id,email,name,access_level)
values
 ('17100000-0000-4000-8000-000000000001','17100000-0000-4000-8000-000000000011','chat-feature-11@example.invalid','Student A',1),
 ('17100000-0000-4000-8000-000000000002','17100000-0000-4000-8000-000000000012','chat-feature-12@example.invalid','Student B',1),
 ('17100000-0000-4000-8000-000000000003','17100000-0000-4000-8000-000000000013','chat-feature-13@example.invalid','Default mentor',1),
 ('17100000-0000-4000-8000-000000000004','17100000-0000-4000-8000-000000000014','chat-feature-14@example.invalid','Second mentor',1),
 ('17100000-0000-4000-8000-000000000005','17100000-0000-4000-8000-000000000015','chat-feature-15@example.invalid','Unrelated admin',3);
insert into public.user_roles(student_id,role) values('17100000-0000-4000-8000-000000000004','mentor');
insert into public.avatar_objects(object_path,student_id,state) values
 ('17100000-0000-4000-8000-000000000014/17100000-0000-4000-8000-000000000099.webp','17100000-0000-4000-8000-000000000004','active');
insert into public.student_avatars(student_id,object_path) values
 ('17100000-0000-4000-8000-000000000004','17100000-0000-4000-8000-000000000014/17100000-0000-4000-8000-000000000099.webp');
set request.jwt.claim.role='service_role';
select public.configure_chat_mentor('17100000-0000-4000-8000-000000000003');
set role authenticated;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='17100000-0000-4000-8000-000000000011';

do $$
declare v_mentors jsonb := public.get_chat_mentors(); v_a uuid; v_b uuid; v_send jsonb; v_retry jsonb;
begin
  if not exists(select 1 from jsonb_array_elements(v_mentors) m where m->>'studentId'='17100000-0000-4000-8000-000000000003')
    or not exists(select 1 from jsonb_array_elements(v_mentors) m where m->>'studentId'='17100000-0000-4000-8000-000000000004'
      and m->>'avatarPath' like '%000000000099.webp')
    or exists(select 1 from jsonb_array_elements(v_mentors) m where m->>'studentId'='17100000-0000-4000-8000-000000000005') then
    raise exception 'Mentor choices do not follow trusted configuration/roles/avatar records';
  end if;
  v_a := (public.open_chat_thread('17100000-0000-4000-8000-000000000003')->>'threadId')::uuid;
  v_b := (public.open_chat_thread('17100000-0000-4000-8000-000000000004')->>'threadId')::uuid;
  if v_a=v_b or (public.open_chat_thread('17100000-0000-4000-8000-000000000004')->>'threadId')::uuid<>v_b then
    raise exception 'Mentor pairs are merged or opening is not idempotent';
  end if;
  perform set_config('test.feature_thread_a',v_a::text,true);
  perform set_config('test.feature_thread_b',v_b::text,true);
  v_send := public.send_chat_message('Only default mentor', '17100000-0000-4000-8000-000000000021',v_a);
  v_retry := public.send_chat_message('Only default mentor','17100000-0000-4000-8000-000000000021',v_a);
  if v_send->'message'->>'id'<>v_retry->'message'->>'id' then raise exception 'Retry duplicated message'; end if;
  perform public.send_chat_message('Only second mentor','17100000-0000-4000-8000-000000000021',v_b);
  if (select count(*) from public.conversation_messages where thread_id=v_a)<>1
    or (select count(*) from public.conversation_messages where thread_id=v_b)<>1 then raise exception 'Pair messages mixed'; end if;
  perform pg_temp.expect_feature_denied('select public.open_chat_thread(''17100000-0000-4000-8000-000000000005'')');
  perform pg_temp.expect_feature_denied('select public.configure_chat_mentor(''17100000-0000-4000-8000-000000000005'')');
end;
$$;

-- The second mentor sees only their own inbox, receives their own notification
-- and can write public replies/private notes with the same existing send RPC.
set request.jwt.claim.sub='17100000-0000-4000-8000-000000000014';
do $$
declare v_thread uuid := current_setting('test.feature_thread_b')::uuid; v_reply jsonb;
begin
  if not (public.get_my_chat_access()->>'isMentor')::boolean then raise exception 'Role mentor cannot enter inbox'; end if;
  if exists(select 1 from public.conversation_threads where id=current_setting('test.feature_thread_a')::uuid)
    or jsonb_array_length(public.get_mentor_inbox()->'rows')<>1 then raise exception 'Second mentor sees another mentor chat'; end if;
  if not exists(select 1 from public.notification_recipients nr join public.notification_events ne on ne.id=nr.event_id
    where ne.target_id=v_thread::text and nr.student_id=public.current_chat_student_id()) then
    raise exception 'Second mentor notification was routed to default mentor'; end if;
  perform public.send_chat_message('Second mentor private note',gen_random_uuid(),v_thread,true);
  v_reply := public.send_chat_message('Second mentor public reply',gen_random_uuid(),v_thread);
  perform set_config('test.feature_reply_seq',v_reply->'message'->>'public_seq',true);
  if public.get_chat_profiles(array['17100000-0000-4000-8000-000000000001'::uuid])->0->>'displayName'<>'Student A' then
    raise exception 'Mentor cannot load the profile of own chat student'; end if;
  perform public.chat_presence_heartbeat('17100000-0000-4000-8000-000000000031');
  perform public.chat_presence_heartbeat('17100000-0000-4000-8000-000000000032');
  perform public.chat_presence_leave('17100000-0000-4000-8000-000000000031');
end;
$$;

-- A service default change keeps both already established conversations and
-- allows their existing mentor to continue receiving only their own thread.
reset role;
do $$
declare v_contact uuid; v_reply_id text; v_job uuid;
begin
  select id::text into v_reply_id from public.conversation_messages
    where thread_id=current_setting('test.feature_thread_b')::uuid and sender_role='mentor' and not is_internal;
  if to_regprocedure('public.ensure_email_service_contact(uuid)') is not null
    and to_regprocedure('public.email_mentor_unread(uuid,text)') is not null then
    v_contact := public.ensure_email_service_contact('17100000-0000-4000-8000-000000000011');
    if not public.email_mentor_unread(v_contact,v_reply_id) then
      raise exception 'Delayed unread reminder rejects a second mentor reply'; end if;
    if has_function_privilege('authenticated','public.email_mentor_unread(uuid,text)','EXECUTE')
      or has_function_privilege('anon','public.email_mentor_unread(uuid,text)','EXECUTE') then
      raise exception 'Campaign email helper became client-accessible'; end if;
  end if;
  select id into v_job from public.chat_email_outbox
    where thread_id=current_setting('test.feature_thread_b')::uuid and recipient_role='student';
  if not coalesce((public.chat_email_recipient_snapshot(v_job)->>'allowed')::boolean,false) then
    raise exception 'Immediate email snapshot rejects a second mentor reply'; end if;
  perform public.configure_chat_mentor('17100000-0000-4000-8000-000000000004');
end;
$$;
set role authenticated;
set request.jwt.claim.sub='17100000-0000-4000-8000-000000000013';
do $$
begin
  if not (public.get_my_chat_access()->>'isMentor')::boolean
    or not exists(select 1 from public.conversation_threads where id=current_setting('test.feature_thread_a')::uuid)
    or exists(select 1 from public.conversation_threads where id=current_setting('test.feature_thread_b')::uuid) then
    raise exception 'Default change revoked former mentor or transferred its private history'; end if;
end;
$$;

set request.jwt.claim.sub='17100000-0000-4000-8000-000000000011';
do $$
declare v_profiles jsonb; v_mentor jsonb;
begin
  v_profiles := public.get_chat_profiles(array[
    '17100000-0000-4000-8000-000000000001'::uuid,
    '17100000-0000-4000-8000-000000000002'::uuid,
    '17100000-0000-4000-8000-000000000004'::uuid]);
  if jsonb_array_length(v_profiles)<>2 or exists(select 1 from jsonb_array_elements(v_profiles) p where p?'email' or p?'phone' or p?'access_level') then
    raise exception 'Profile RPC leaks another student or private directory fields'; end if;
  select p into v_mentor from jsonb_array_elements(v_profiles) p where p->>'studentId'='17100000-0000-4000-8000-000000000004';
  if v_mentor->>'role'<>'mentor' or v_mentor->>'avatarPath' is null then raise exception 'Profile lost role or real avatar'; end if;
  if not exists(select 1 from public.student_avatars where student_id='17100000-0000-4000-8000-000000000004') then
    raise exception 'Private avatar RLS prevents allowed chat avatar'; end if;
  if exists(select 1 from public.conversation_messages where thread_id=current_setting('test.feature_thread_b')::uuid and is_internal) then
    raise exception 'Student sees second mentor private note'; end if;
  perform public.mark_chat_read(current_setting('test.feature_thread_b')::uuid,current_setting('test.feature_reply_seq')::bigint);
  if (select unread_for_student_count from public.conversation_threads where id=current_setting('test.feature_thread_b')::uuid)<>0 then
    raise exception 'Read cursor does not follow selected mentor'; end if;
  if (select count(*) from public.list_chat_presence(array['17100000-0000-4000-8000-000000000004'::uuid]))<>1 then
    raise exception 'Leaving one tab marked another active mentor tab offline'; end if;
  -- A client cannot leave another account's lease with the same session UUID.
  perform public.chat_presence_leave('17100000-0000-4000-8000-000000000032');
  if (select count(*) from public.list_chat_presence(array['17100000-0000-4000-8000-000000000004'::uuid]))<>1 then
    raise exception 'Student can spoof mentor offline status'; end if;
  perform pg_temp.expect_feature_denied('select * from public.chat_presence_sessions');
end;
$$;

-- No admin-only bypass into chat profiles, private messages or presence.
set request.jwt.claim.sub='17100000-0000-4000-8000-000000000015';
do $$
begin
  if jsonb_array_length(public.get_chat_profiles(array['17100000-0000-4000-8000-000000000001'::uuid]))<>0
    or exists(select 1 from public.conversation_threads where id=current_setting('test.feature_thread_b')::uuid) then
    raise exception 'Unrelated admin inherits private chat access'; end if;
  perform pg_temp.expect_feature_denied(format('select public.send_chat_message(%L,%L,%L)','forged',gen_random_uuid(),current_setting('test.feature_thread_b')));
end;
$$;

-- Presence expiry uses server time and still applies profile visibility.
reset role;
update public.chat_presence_sessions set last_seen_at=statement_timestamp()-interval '66 seconds'
where student_id='17100000-0000-4000-8000-000000000004';
set role authenticated;
set request.jwt.claim.sub='17100000-0000-4000-8000-000000000011';
do $$
begin
  if exists(select 1 from public.list_chat_presence(array['17100000-0000-4000-8000-000000000004'::uuid])) then
    raise exception 'Lost connection did not expire mentor online status'; end if;
end;
$$;

-- Revoking a student's participant cannot be undone by selecting that mentor.
reset role;
update public.conversation_participants set active=false,revoked_at=now()
where thread_id=current_setting('test.feature_thread_b')::uuid and role='student';
set role authenticated;
do $$
begin
  perform pg_temp.expect_feature_denied('select public.open_chat_thread(''17100000-0000-4000-8000-000000000004'')');
  if exists(select 1 from public.conversation_messages where thread_id=current_setting('test.feature_thread_b')::uuid) then
    raise exception 'Revoked student retains second mentor message access'; end if;
  if exists(select 1 from jsonb_array_elements(public.get_chat_mentors()) m
    where m->>'studentId'='17100000-0000-4000-8000-000000000004') then
    raise exception 'Revoked conversation is advertised as a usable mentor selection'; end if;
end;
$$;
reset role;
rollback;
\echo 'PASS: mentor pairs, profile/avatar visibility, role inboxes, notification routing, idempotency, notes/read state, per-tab presence/expiry and membership revocation.'
