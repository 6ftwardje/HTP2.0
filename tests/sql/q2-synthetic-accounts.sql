\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Q2.3: %',msg;end if;end$$;
create function pg_temp.rejects(stmt text) returns boolean language plpgsql as $$begin execute stmt;return false;exception when insufficient_privilege or check_violation then return true;end$$;
-- A transaction-scoped stub proves that no external lead effect fires.
create temporary table q23_leads(student_id uuid);
create or replace function public.notify_clickup_on_lead() returns trigger language plpgsql security definer set search_path='' as $$begin insert into pg_temp.q23_leads values(new.id);return new;end$$;
drop trigger if exists on_new_htp_lead on public.students;
create trigger on_new_htp_lead after insert on public.students for each row execute function public.notify_clickup_on_lead();
\ir ../../supabase/migrations/20261019020000_synthetic_student_accounts.sql
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select ('a2300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 case when i=2 then 'password-recovery-check-12345678-1234-4234-8234-123456789abc@example.invalid' else 'q23-sql-'||i||'@example.invalid' end,
 case when i in(1,5) then '{"synthetic_test_run_id":"12345678-1234-4234-8234-123456789abc"}'::jsonb else '{}'::jsonb end,
 '{"synthetic_test_run_id":"12345678-1234-4234-8234-123456789abc"}'::jsonb,now(),now(),now() from generate_series(1,5)i;
insert into public.students(id,auth_user_id,email,name,phone,access_level)
select ('b2300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,id,email,'Q23 Fixture '||i,'+32470123456',case when i=4 then 3 else 1 end
from generate_series(1,5)i join auth.users on id=('a2300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
select pg_temp.assert_true((select count(*)=2 from public.student_test_accounts where student_id::text like 'b2300000-%'),'only trusted app metadata classifies');
select pg_temp.assert_true((select count(*)=3 from pg_temp.q23_leads),'only ordinary and spoofed accounts reach the stub lead integration');
select pg_temp.assert_true((select count(*)=3 from public.student_directory where id::text like 'b2300000-%'),'filter precedes directory count');
select pg_temp.assert_true(public.automation_email_allowed('a2300000-0000-4000-8000-000000000002'),'similar real address/user_metadata stays eligible');
select pg_temp.assert_true(not public.automation_email_allowed('a2300000-0000-4000-8000-000000000001'),'synthetic account cannot receive automation');
set local role authenticated;select set_config('request.jwt.claim.sub','a2300000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=0 from public.student_test_accounts),'student cannot read private classification');
select pg_temp.assert_true(pg_temp.rejects($q$insert into public.student_test_accounts(student_id,run_id) values('b2300000-0000-4000-8000-000000000002','12345678-1234-4234-8234-123456789abc')$q$),'student cannot hide another account');
reset role;
set local request.jwt.claim.sub='';set local request.jwt.claim.role='service_role';
select public.configure_chat_mentor('b2300000-0000-4000-8000-000000000003');
set local role authenticated;set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='a2300000-0000-4000-8000-000000000002';
select set_config('test.q23.normal_thread',(public.send_chat_message('Synthetic local notification test','c2300000-0000-4000-8000-000000000001')->>'threadId'),true);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.chat_email_outbox where thread_id=current_setting('test.q23.normal_thread')::uuid),'ordinary account still queues one generic notification');
select set_config('test.q23.job',(select id::text from public.chat_email_outbox where thread_id=current_setting('test.q23.normal_thread')::uuid),true);
select pg_temp.assert_true(public.test_account_chat_email_allowed(current_setting('test.q23.job')::uuid),'normal job eligible');
insert into public.student_test_accounts(student_id,run_id)values('b2300000-0000-4000-8000-000000000002','12345678-1234-4234-8234-123456789abc');
select pg_temp.assert_true((select status='cancelled' from public.chat_email_outbox where id=current_setting('test.q23.job')::uuid),'new classification cancels already queued job');
select pg_temp.assert_true(not public.test_account_chat_email_allowed(current_setting('test.q23.job')::uuid),'recheck blocks previously queued thread');
set local role authenticated;set local request.jwt.claim.sub='a2300000-0000-4000-8000-000000000001';
select set_config('test.q23.synthetic_thread',(public.send_chat_message('Synthetic test must not notify a real mentor','c2300000-0000-4000-8000-000000000002')->>'threadId'),true);
reset role;
select pg_temp.assert_true((select count(*)=0 from public.chat_email_outbox where thread_id=current_setting('test.q23.synthetic_thread')::uuid),'synthetic sender produces no outgoing job even for ordinary mentor');
delete from auth.users where id='a2300000-0000-4000-8000-000000000005';
select pg_temp.assert_true(exists(select 1 from public.students where id='b2300000-0000-4000-8000-000000000005'),'reproduces orphan profile after Auth removal');
select pg_temp.assert_true(not exists(select 1 from public.student_directory where id='b2300000-0000-4000-8000-000000000005'),'orphan synthetic remains excluded');
-- Exercise the single-statement production Auth -> student -> lead-trigger chain.
set local request.jwt.claim.sub='';set local request.jwt.claim.role='service_role';
create trigger q23_production_auth after insert on auth.users for each row execute function public.handle_new_user();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2300000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','q23-production-chain@example.invalid','{"synthetic_test_run_id":"12345678-1234-4234-8234-123456789abc"}','{"full_name":"Production-shaped synthetic","phone":"+32470123456"}',now(),now());
select pg_temp.assert_true(exists(select 1 from public.students s join public.student_test_accounts t on t.student_id=s.id where s.auth_user_id='a2300000-0000-4000-8000-000000000006'),'nested Auth trigger classifies before commit');
select pg_temp.assert_true(not exists(select 1 from pg_temp.q23_leads l join public.students s on s.id=l.student_id where s.auth_user_id='a2300000-0000-4000-8000-000000000006'),'nested Auth trigger never fires external lead effect');
set local role authenticated;set local request.jwt.claim.sub='a2300000-0000-4000-8000-000000000004';
select pg_temp.assert_true((select count(*)=2 from public.student_directory where id::text like 'b2300000-%'),'admin count excludes both kinds of synthetic records');
reset role;
rollback;
