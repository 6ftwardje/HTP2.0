\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Q2.2: %',msg;end if;end$$;
create function pg_temp.rejects(stmt text) returns boolean language plpgsql as $$begin execute stmt;return false;exception when insufficient_privilege or invalid_parameter_value or check_violation then return true;end$$;
-- Exercise the observed production trigger without adding it to other environments.
create trigger q22_production_auth_fixture after insert on auth.users for each row execute function public.handle_new_user();
insert into auth.users(id,instance_id,aud,role,email,raw_user_meta_data,created_at,updated_at)values
('a2200000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','q22-owner@example.invalid','{"full_name":"Élodie Test","phone":"+32470123456","access_level":3}',now(),now()),
('a2200000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','q22-other@example.invalid','{"name":"Other Test"}',now(),now());
select pg_temp.assert_true((select name='Élodie Test' and phone='+32470123456' and access_level=1 from public.students where auth_user_id='a2200000-0000-4000-8000-000000000001'),'full_name and phone mapped; client access ignored');
select pg_temp.assert_true((select name='Other Test' from public.students where auth_user_id='a2200000-0000-4000-8000-000000000002'),'legacy name fallback');
update public.students set name='Onbekend',phone=null where auth_user_id='a2200000-0000-4000-8000-000000000001';
set local role authenticated;select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select name='Élodie Test' and phone='+32470123456' from public.repair_own_student_profile()),'repairs own placeholder from metadata');
select pg_temp.assert_true((select count(*)=1 from public.complete_own_student_profile('Chosen Name','+31612345678')),'saves only own profile');
select pg_temp.assert_true((select name='Chosen Name' and phone='+31612345678' and access_level=1 from public.repair_own_student_profile()),'repair preserves chosen identity and access');
select pg_temp.assert_true(pg_temp.rejects($q$select public.complete_own_student_profile('Onbekend','+32470123456')$q$),'rejects placeholder');
select pg_temp.assert_true(pg_temp.rejects($q$select public.complete_own_student_profile('Valid Name','0470123456')$q$),'requires canonical phone');
select pg_temp.assert_true(pg_temp.rejects($q$update public.students set access_level=3 where auth_user_id=auth.uid()$q$),'cannot elevate access');
reset role;
select pg_temp.assert_true((select name='Other Test' and phone is null from public.students where auth_user_id='a2200000-0000-4000-8000-000000000002'),'other student untouched');
set local role anon;select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true(pg_temp.rejects($q$select public.complete_own_student_profile('Fake','+32470123456')$q$),'anon cannot save');
select pg_temp.assert_true(pg_temp.rejects($q$select public.repair_own_student_profile()$q$),'anon cannot repair');
rollback;
