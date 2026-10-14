-- LOCAL-only rollback integration for migration310; never sends external email.
-- psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/sql/mentor-chat-email.sql
\set ON_ERROR_STOP on
begin;
-- Keep the global claim test independent of other local fixture jobs.
-- ROLLBACK restores every pre-existing due time.
update public.chat_email_outbox set due_at=now()+interval '7 days';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('14631000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-email-free@example.invalid','',now(),now(),now()),
('14631000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-email-mentor@example.invalid','',now(),now(),now()),
('14631000-0000-4000-8000-000000000013','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-email-other@example.invalid','',now(),now(),now());
insert into public.students(id,auth_user_id,email,name,access_level) values
('14631000-0000-4000-8000-000000000001','14631000-0000-4000-8000-000000000011','chat-email-free@example.invalid','Free mail fixture',1),
('14631000-0000-4000-8000-000000000002','14631000-0000-4000-8000-000000000012','chat-email-mentor@example.invalid','Rousso mail fixture',1),
('14631000-0000-4000-8000-000000000003','14631000-0000-4000-8000-000000000013','chat-email-other@example.invalid','Other mail fixture',3);
set request.jwt.claim.role='service_role';
select public.configure_chat_mentor('14631000-0000-4000-8000-000000000002');
set role authenticated;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000011';
do $$ declare first_message jsonb; begin
  if public.get_my_chat_email_preferences()<>jsonb_build_object('enabled',true,'suppressed',false) then raise exception 'Default preferences or optional foundation lookup incorrect'; end if;
  first_message:=public.send_chat_message('PRIVATE CONTENT MUST NOT BE COPIED','14631000-0000-4000-8000-000000000021');
  perform set_config('test.chat_mail_thread',first_message->>'threadId',true);
  perform public.send_chat_message('PRIVATE CONTENT MUST NOT BE COPIED','14631000-0000-4000-8000-000000000021');
  perform public.send_chat_message('ANOTHER PRIVATE QUESTION','14631000-0000-4000-8000-000000000022');
end $$;
reset role;
do $$ declare j public.chat_email_outbox; begin
  select * into j from public.chat_email_outbox where thread_id=current_setting('test.chat_mail_thread')::uuid;
  if not found or (select count(*) from public.chat_email_outbox where thread_id=j.thread_id)<>1 then raise exception 'Two-minute bundle or retry dedupe failed'; end if;
  if j.recipient_student_id<>'14631000-0000-4000-8000-000000000002' or j.recipient_role<>'mentor' or j.first_public_seq<>1 or j.last_public_seq<>2 or j.due_at<>j.created_at+interval '2 minutes' then raise exception 'Bundle recipient/range/window incorrect'; end if;
  if to_jsonb(j)::text like '%PRIVATE%' then raise exception 'Outbox copied private message content'; end if;
  perform set_config('test.chat_mail_mentor_job',j.id::text,true);
  if has_table_privilege('authenticated','public.chat_email_outbox','SELECT') or has_function_privilege('authenticated','public.claim_chat_email_notification()','EXECUTE') or has_function_privilege('anon','public.get_my_chat_email_preferences()','EXECUTE') then raise exception 'Outbox service grants incorrect'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000012';
select public.send_chat_message('PRIVATE INTERNAL NOTE','14631000-0000-4000-8000-000000000023',current_setting('test.chat_mail_thread')::uuid,true);
select public.send_chat_message('PRIVATE MENTOR REPLY','14631000-0000-4000-8000-000000000024',current_setting('test.chat_mail_thread')::uuid,false);
reset role;
do $$ begin
  if (select count(*) from public.chat_email_outbox where thread_id=current_setting('test.chat_mail_thread')::uuid)<>2 then raise exception 'Internal note queued email or public reply missing'; end if;
  perform set_config('test.chat_mail_student_job',(select id::text from public.chat_email_outbox where thread_id=current_setting('test.chat_mail_thread')::uuid and recipient_role='student'),true);
end $$;
-- Only synthetic jobs are made due. Parallel claims must never return an active lease twice.
update public.chat_email_outbox set due_at=now()-case when recipient_role='mentor' then interval '2 minutes' else interval '1 minute' end where thread_id=current_setting('test.chat_mail_thread')::uuid;
do $$ declare first_job public.chat_email_outbox; second_job public.chat_email_outbox; payload jsonb; prepared jsonb; begin
  select * into first_job from public.claim_chat_email_notification();
  select * into second_job from public.claim_chat_email_notification();
  if first_job.id<>current_setting('test.chat_mail_mentor_job')::uuid or second_job.id<>current_setting('test.chat_mail_student_job')::uuid or exists(select 1 from public.claim_chat_email_notification()) then raise exception 'Claim lease isolation failed'; end if;
  if not (public.chat_email_recipient_snapshot(first_job.id)->>'allowed')::boolean then raise exception 'Valid free member notification was denied'; end if;
  update public.chat_email_outbox set created_at=now()-interval '25 hours' where id=first_job.id;
  if public.chat_email_recipient_snapshot(first_job.id)->>'reason'<>'notification_expired' then raise exception 'Old never-attempted pilot backlog was allowed'; end if;
  update public.chat_email_outbox set first_attempt_at=now()-interval '22 hours' where id=first_job.id;
  if not (public.chat_email_recipient_snapshot(first_job.id)->>'allowed')::boolean then raise exception 'Attempted delivery lost its separate idempotency window'; end if;
  update public.chat_email_outbox set created_at=now(),first_attempt_at=null where id=first_job.id;
  payload:=jsonb_build_object('from','chat@example.invalid','to','chat-email-mentor@example.invalid','replyTo','support@example.invalid','subject','Je hebt een ongelezen chatbericht','html','Generic notice','text','Generic notice','tags','[]'::jsonb);
  prepared:=public.prepare_chat_email_send(first_job.id,first_job.lease_token,payload);
  if prepared is distinct from payload then raise exception 'Prepare did not capture payload'; end if;
  if public.finish_chat_email_notification(first_job.id,gen_random_uuid(),'sent',null,now(),'fake-provider-id') then raise exception 'Stale lease acknowledged send'; end if;
  if not public.finish_chat_email_notification(first_job.id,first_job.lease_token,'retry','delivery_outcome_unknown',now()-interval '1 second') then raise exception 'Retry acknowledgement failed'; end if;
  select * into first_job from public.claim_chat_email_notification();
  prepared:=public.prepare_chat_email_send(first_job.id,first_job.lease_token,payload||jsonb_build_object('html','Changed rendering after lost response'));
  if prepared is distinct from payload then raise exception 'Retry mutated the immutable provider payload'; end if;
  if not public.finish_chat_email_notification(first_job.id,first_job.lease_token,'sent',null,now(),'fake-provider-id') then raise exception 'Canonical send acknowledgement failed'; end if;
end $$;
-- A foreground read between claim and prepare must suppress the student's email.
set role authenticated;
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000011';
select public.mark_chat_read(current_setting('test.chat_mail_thread')::uuid,3);
reset role;
do $$ declare j public.chat_email_outbox; begin
  select * into j from public.chat_email_outbox where id=current_setting('test.chat_mail_student_job')::uuid;
  if public.chat_email_recipient_snapshot(j.id)->>'reason'<>'already_read' then raise exception 'Read state ignored'; end if;
  if public.prepare_chat_email_send(j.id,j.lease_token,jsonb_build_object('to','chat-email-free@example.invalid')) is not null then raise exception 'Read race passed final gate'; end if;
  if (select status from public.chat_email_outbox where id=j.id)<>'cancelled' then raise exception 'Read job not cancelled'; end if;
end $$;
-- Disabled preferences prevent enqueueing and never create replay on opt-in.
set role authenticated;
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000012';
select public.set_my_chat_email_preference(false);
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000011';
select public.send_chat_message('IGNORED WHILE PREFERENCE OFF','14631000-0000-4000-8000-000000000025');
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000012';
select public.set_my_chat_email_preference(true);
reset role;
do $$ begin
  if (select count(*) from public.chat_email_outbox where thread_id=current_setting('test.chat_mail_thread')::uuid)<>2 then raise exception 'Preference-off message created an email replay'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='14631000-0000-4000-8000-000000000011';
select public.send_chat_message('NEW QUESTION AFTER OPT IN','14631000-0000-4000-8000-000000000026');
reset role;
do $$ declare j public.chat_email_outbox; recipient uuid; begin
  select * into j from public.chat_email_outbox where thread_id=current_setting('test.chat_mail_thread')::uuid and status='queued';
  if not found then raise exception 'New event after opt-in not queued'; end if;
  update public.conversation_participants set active=false,revoked_at=now() where id=j.recipient_participant_id;
  if public.chat_email_recipient_snapshot(j.id)->>'reason'<>'recipient_revoked' then raise exception 'Revoked recipient was allowed'; end if;
  update public.conversation_participants set active=true,revoked_at=null where id=j.recipient_participant_id;
  recipient:=j.recipient_student_id;
  update public.chat_email_outbox set recipient_student_id='14631000-0000-4000-8000-000000000003' where id=j.id;
  if public.chat_email_recipient_snapshot(j.id)->>'reason'<>'recipient_revoked' then raise exception 'Wrong recipient was allowed'; end if;
  update public.chat_email_outbox set recipient_student_id=recipient where id=j.id;
  -- Optional separate email foundation: global/mentor unsubscribe is authoritative.
  if to_regclass('public.email_suppressions') is not null and to_regprocedure('public.email_identity_key(text)') is not null then
    execute 'insert into public.email_suppressions(identity_key,scope,reason) values(public.email_identity_key($1),''mentor'',''test_chat_unsubscribe'') on conflict do nothing' using 'chat-email-mentor@example.invalid';
    if public.chat_email_recipient_snapshot(j.id)->>'reason'<>'email_suppressed' then raise exception 'Shared unsubscribe ignored'; end if;
    execute 'delete from public.email_suppressions where identity_key=public.email_identity_key($1) and reason=''test_chat_unsubscribe''' using 'chat-email-mentor@example.invalid';
  end if;
  update auth.users set banned_until=now()+interval '1 hour' where id='14631000-0000-4000-8000-000000000012';
  if public.chat_email_recipient_snapshot(j.id)->>'reason'<>'mentor_changed' then raise exception 'Banned mentor allowed email'; end if;
end $$;
rollback;
