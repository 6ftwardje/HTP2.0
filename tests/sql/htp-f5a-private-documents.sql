\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'F5a: %',msg;end if;end$$;
create function pg_temp.rejects(stmt text) returns boolean language plpgsql as $$begin execute stmt;return false;exception when insufficient_privilege or invalid_parameter_value or check_violation then return true;end$$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('f5a00000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','f5a-sql-'||i||'@example.invalid','',now(),now(),now() from generate_series(11,14)i;
insert into public.students(id,auth_user_id,email,name,access_level)values
('f5a00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000011','f5a-a@example.invalid','F5a A',2),
('f5a00000-0000-4000-8000-000000000002','f5a00000-0000-4000-8000-000000000012','f5a-b@example.invalid','F5a B',2),
('f5a00000-0000-4000-8000-000000000003','f5a00000-0000-4000-8000-000000000013','f5a-free@example.invalid','F5a Free',1),
('f5a00000-0000-4000-8000-000000000004','f5a00000-0000-4000-8000-000000000014','f5a-admin@example.invalid','F5a Admin',3);
insert into public.modules(id,title,slug,order_index,is_published,is_free) values
(950001,'F5a paid','f5a-sql-paid',-950001,true,false),(950002,'F5a free','f5a-sql-free',-950002,true,true);
insert into public.lessons(id,module_id,title,slug,order_index,is_published)values(950101,950002,'F5a preview','f5a-sql-preview',1,true);
insert into public.weekly_updates(id,title,slug,week_start_date,type,market,markets,content_format,access_tier,is_published,body)values
(950201,'F5a free','f5a-sql-update','2026-10-12','market_update','crypto',array['crypto'],'text','free',true,'Synthetische artikelinhoud voor de PDF-proef.');
insert into public.pdf_documents(id,module_id,weekly_update_id,title,object_path,byte_size,page_count,sha256,version,state,storage_ready,accessible_html,accessible_verified)values
('f5b00000-0000-4000-8000-000000000001',950001,null,'F5a module','documents/f5b00000-0000-4000-8000-000000000001/source.pdf',100,1,repeat('a',64),'f5c00000-0000-4000-8000-000000000001','ready',true,'<p>Volledige synthetische leesinhoud voor deze proef.</p>',true),
('f5b00000-0000-4000-8000-000000000002',950002,null,'F5a free module','documents/f5b00000-0000-4000-8000-000000000002/source.pdf',100,1,repeat('a',64),'f5c00000-0000-4000-8000-000000000002','ready',true,'<p>Volledige synthetische leesinhoud voor deze proef.</p>',true),
('f5b00000-0000-4000-8000-000000000003',null,950201,'F5a update','documents/f5b00000-0000-4000-8000-000000000003/source.pdf',100,1,repeat('a',64),'f5c00000-0000-4000-8000-000000000003','ready',true,'<p>Volledige synthetische leesinhoud voor deze proef.</p>',true),
('f5b00000-0000-4000-8000-000000000004',null,950201,'F5a draft','documents/f5b00000-0000-4000-8000-000000000004/source.pdf',100,1,repeat('a',64),'f5c00000-0000-4000-8000-000000000004','draft',true,'',false);
insert into storage.objects(bucket_id,name)values('protected-pdfs','documents/f5b00000-0000-4000-8000-000000000003/source.pdf');
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(public.can_read_academy_lesson(950101),'first lesson preview exists');
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000002'),'preview does not grant a full PDF');
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000001'),'free denied paid module');
select pg_temp.assert_true(public.can_read_pdf('f5b00000-0000-4000-8000-000000000003'),'free inherits free update');
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000004'),'draft denied');
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000099'),'unknown denied');
select pg_temp.assert_true(pg_temp.rejects('select * from public.pdf_documents'),'direct metadata/source paths denied');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='protected-pdfs'),'broad old storage read policy cannot expose PDF');
select pg_temp.assert_true(pg_temp.rejects($q$insert into storage.objects(bucket_id,name) values('protected-pdfs','tampered.pdf')$q$),'direct storage write denied');
select pg_temp.assert_true(pg_temp.rejects($q$select public.record_pdf_open('f5b00000-0000-4000-8000-000000000003','f5c00000-0000-4000-8000-000000000003','f5d00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000003')$q$),'client cannot forge a successful openlog');
select pg_temp.assert_true((select count(*)=0 from public.pdf_open_logs),'members cannot read logs');
reset role;
insert into public.student_onboarding_responses(student_id,completed_at,experience_level,primary_market,main_challenge,goal_90_days,weekly_time_commitment,mentorship_interest,confidence_score)values('f5a00000-0000-4000-8000-000000000003',now(),'synthetic','synthetic','synthetic','synthetic','synthetic','synthetic',3);
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(public.can_read_pdf('f5b00000-0000-4000-8000-000000000002'),'completed intake grants explicitly free module');
reset role;
insert into public.legacy_academy_module_access(student_id,module_id,grant_source)values('f5a00000-0000-4000-8000-000000000003',950001,'existing_progress');
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(public.can_read_pdf('f5b00000-0000-4000-8000-000000000001'),'legacy module right preserved');
set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true(public.can_read_pdf('f5b00000-0000-4000-8000-000000000001'),'Academy inherits full module');
reset role;set local role service_role;
select public.record_pdf_open('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5d00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001');
select public.record_pdf_open('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5d00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select count(*)=1 from public.pdf_open_logs where student_id='f5a00000-0000-4000-8000-000000000001'),'idempotent retry one log');
select pg_temp.assert_true(current_setting('request.jwt.claim.sub')='f5a00000-0000-4000-8000-000000000011','trusted log call restores caller claims');
select pg_temp.assert_true(pg_temp.rejects($q$select public.record_pdf_open('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000099','f5d00000-0000-4000-8000-000000000002','f5a00000-0000-4000-8000-000000000001')$q$),'version changed denied');
reset role;set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000014';
select pg_temp.assert_true(public.can_read_pdf('f5b00000-0000-4000-8000-000000000004'),'admin can preview draft');
select pg_temp.assert_true((select count(*)=1 from public.pdf_open_logs where student_id='f5a00000-0000-4000-8000-000000000001'),'admin can inspect log');
reset role;
update public.pdf_open_logs set opened_at=now()-interval '31 days' where student_id='f5a00000-0000-4000-8000-000000000001';
select pg_temp.assert_true(public.purge_pdf_open_logs()>=1,'retention actually deletes old rows');
select pg_temp.assert_true((select count(*)=0 from public.pdf_open_logs where student_id='f5a00000-0000-4000-8000-000000000001'),'old row removed');
update public.weekly_updates set is_published=false where id=950201;
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000003'),'withdrawn parent revokes PDF');
reset role;set local role service_role;
select pg_temp.assert_true(pg_temp.rejects($q$select public.record_pdf_open('f5b00000-0000-4000-8000-000000000003','f5c00000-0000-4000-8000-000000000003','f5d00000-0000-4000-8000-000000000002','f5a00000-0000-4000-8000-000000000003')$q$),'denied open cannot be logged');
reset role;delete from auth.users where id='f5a00000-0000-4000-8000-000000000014';
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000014';
select pg_temp.assert_true(not public.can_read_pdf('f5b00000-0000-4000-8000-000000000001'),'deleted auth JWT denied PDF');
select pg_temp.assert_true((select count(*)=0 from public.pdf_open_logs),'deleted admin cannot inspect logs');
reset role;set local role anon;
select pg_temp.assert_true(pg_temp.rejects($q$select public.can_read_pdf('f5b00000-0000-4000-8000-000000000001')$q$),'anonymous RPC denied');
reset role;
select pg_temp.assert_true((select count(*)=1 from cron.job where jobname='htp-pdf-open-log-retention' and active),'one active retention job');
rollback;
