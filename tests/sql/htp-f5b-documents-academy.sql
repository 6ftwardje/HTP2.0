\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'F5b: %',msg;end if;end$$;
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

update public.pdf_documents set page_count=4 where id='f5b00000-0000-4000-8000-000000000001';
insert into public.toolbox_resources(id,module_id,title,kind,url,state) values
('f5e00000-0000-4000-8000-000000000001',950001,'Synthetic link','link','https://example.com/','ready'),
('f5e00000-0000-4000-8000-000000000002',950001,'Synthetic draft','link','https://example.com/draft','draft');
insert into storage.objects(bucket_id,name) values('protected-learning-assets','resources/f5e00000-0000-4000-8000-000000000001/source.bin');
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((select count(*)=1 from public.list_visible_pdf_documents('update',array[950201]::bigint[])),'safe free attachment metadata only');
select pg_temp.assert_true((select count(*)=0 from public.list_visible_pdf_documents('module',array[950001,950002]::bigint[])),'preview grants no PDFs without full module access');
select pg_temp.assert_true(not public.can_read_toolbox_resource('f5e00000-0000-4000-8000-000000000001'),'toolbox inherits full module gate');
select pg_temp.assert_true((select count(*)=0 from public.list_visible_toolbox_resources(array[950001]::bigint[])),'no gated toolbox metadata leak');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='protected-learning-assets'),'private cover and file storage cannot bypass legacy policies');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_academy_rubric(null,0,'Bad','bad-rubric','',0,false,array[950001]::bigint[])$q$),'members cannot change rubric/module mapping');
set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000014';
select public.save_academy_rubric('f5f00000-0000-4000-8000-000000000001',0,'Bad','bad','',0,false,array[950001]::bigint[]) where false;
select public.save_academy_rubric(null,0,'Synthetic rubric','f5b-sql-rubric','Synthetic only',1,true,array[950001,950002]::bigint[]) as rubric_id \gset
select pg_temp.assert_true((select count(*)=2 from public.academy_rubric_modules where rubric_id=:'rubric_id'),'explicit additive mapping saved');
select public.save_academy_rubric(:'rubric_id',1,'Synthetic rubric','f5b-sql-rubric','New description',2,true,array[950001,950002]::bigint[]);
reset role;
select pg_temp.assert_true((select version=2 from public.academy_rubrics where id=:'rubric_id'),'atomic rubric version increments');
do $$begin
 perform set_config('request.jwt.claim.sub','f5a00000-0000-4000-8000-000000000014',true);
 begin perform public.save_academy_rubric((select id from public.academy_rubrics where slug='f5b-sql-rubric'),1,'Stale','f5b-sql-rubric','',0,true,array[950001]::bigint[]);raise exception 'stale rubric overwrote';exception when serialization_failure then null;end;
end;$$;
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true((public.read_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001')->>'page')::int=1,'first open starts at 1');
select pg_temp.assert_true((public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',3,0,'f5d00000-0000-4000-8000-000000000001',1)->>'revision')::int=1,'own position saved');
select pg_temp.assert_true((public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',2,0,'f5d00000-0000-4000-8000-000000000001',1)->>'page')::int=3,'same sequence retry cannot overwrite');
select pg_temp.assert_true((public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',4,0,'f5d00000-0000-4000-8000-000000000002',1)->>'conflict')::boolean,'second device receives conflict');
select pg_temp.assert_true((public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',4,1,'f5d00000-0000-4000-8000-000000000002',2)->>'revision')::int=2,'explicit revision takeover succeeds');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',5,2,'f5d00000-0000-4000-8000-000000000002',3)$q$),'page exceeds real document count');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000002',2,2,'f5d00000-0000-4000-8000-000000000002',3)$q$),'cannot forge another viewer');
select pg_temp.assert_true((select count(*)=1 from public.pdf_positions),'own position readable through restricted projection');
select pg_temp.assert_true(pg_temp.rejects($q$update public.pdf_positions set page=1$q$),'direct position writes denied');
select pg_temp.assert_true(public.can_read_toolbox_resource('f5e00000-0000-4000-8000-000000000001'),'full Academy grants toolbox');
select pg_temp.assert_true(not public.can_read_toolbox_resource('f5e00000-0000-4000-8000-000000000002'),'draft toolbox hidden');
select pg_temp.assert_true((select count(*)=1 from public.list_visible_toolbox_resources(array[950001]::bigint[])),'safe toolbox list excludes draft');
set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000012';
select pg_temp.assert_true((select count(*)=0 from public.pdf_positions),'other student cannot see saved page');
select pg_temp.assert_true((public.read_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001')->>'page')::int=1,'other student starts independently');
reset role;
update public.pdf_documents set version='f5c00000-0000-4000-8000-000000000099',page_count=2 where id='f5b00000-0000-4000-8000-000000000001';
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select count(*)=0 from public.pdf_positions),'old version positions hidden');
select pg_temp.assert_true((public.read_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000099')->>'page')::int=1,'replacement starts safely at page 1');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000001','f5a00000-0000-4000-8000-000000000001',1,2,'f5d00000-0000-4000-8000-000000000001',3)$q$),'stale version cannot write');
select public.save_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000099','f5a00000-0000-4000-8000-000000000001',2,0,'f5d00000-0000-4000-8000-000000000001',4);
reset role;
insert into public.legacy_academy_module_access(student_id,module_id,grant_source)values('f5a00000-0000-4000-8000-000000000003',950001,'existing_progress');
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(public.can_read_toolbox_resource('f5e00000-0000-4000-8000-000000000001'),'legacy rights grant exactly their module');
reset role;
update public.modules set is_published=false where id=950001;
set local role authenticated;set local request.jwt.claim.sub='f5a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true(not public.can_read_toolbox_resource('f5e00000-0000-4000-8000-000000000001'),'withdrawn module revokes toolbox');
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_pdf_position('f5b00000-0000-4000-8000-000000000001','f5c00000-0000-4000-8000-000000000099')$q$),'withdrawn module revokes saved position access');
reset role;delete from auth.users where id='f5a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select count(*)=0 from public.pdf_positions where student_id='f5a00000-0000-4000-8000-000000000001'),'auth deletion cleans new positions');
set local role authenticated;
select pg_temp.assert_true(not public.has_live_learning_account(),'deleted JWT no learning account');
reset role;
rollback;
