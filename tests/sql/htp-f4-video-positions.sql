\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'F4: %',msg;end if;end$$;
create function pg_temp.rejects(stmt text) returns boolean language plpgsql as $$begin execute stmt;return false;exception when insufficient_privilege or invalid_parameter_value or check_violation then return true;end$$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('f4a00000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','f4-sql-'||i||'@example.invalid','',now(),now(),now() from generate_series(11,13)i;
insert into public.students(id,auth_user_id,email,name,access_level)values
('f4a00000-0000-4000-8000-000000000001','f4a00000-0000-4000-8000-000000000011','f4-a@example.invalid','F4 Academy A',2),
('f4a00000-0000-4000-8000-000000000002','f4a00000-0000-4000-8000-000000000012','f4-b@example.invalid','F4 Academy B',2),
('f4a00000-0000-4000-8000-000000000003','f4a00000-0000-4000-8000-000000000013','f4-free@example.invalid','F4 Free',1);
insert into public.modules(id,title,slug,order_index,is_published,is_free)values(940001,'F4 test','f4-sql-module',-940001,true,true);
insert into public.lessons(id,module_id,title,slug,order_index,is_published,video_provider,mux_playback_id,video_duration_seconds)values
(940101,940001,'F4 one','f4-sql-one',1,true,'mux','SyntheticF4LessonOne',100),
(940102,940001,'F4 two','f4-sql-two',2,true,'mux','SyntheticF4LessonTwo',100);
insert into public.weekly_updates(id,title,slug,week_start_date,type,market,markets,content_format,access_tier,is_published,video_provider,mux_playback_id,video_duration_seconds)values
(940201,'F4 free','f4-sql-free','2026-10-12','market_update','crypto',array['crypto'],'video','free',true,'mux','SyntheticF4UpdateOne',100),
(940202,'F4 paid','f4-sql-paid','2026-10-12','market_update','crypto',array['crypto'],'video','subscription',true,'mux','SyntheticF4UpdateTwo',100),
(940203,'F4 draft','f4-sql-draft','2026-10-12','market_update','crypto',array['crypto'],'video','free',false,'mux','SyntheticF4Draft',100);
set local role authenticated;
set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((public.read_video_position('update',940201)->>'revision')::int=0,'initial empty position');
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_video_position('update',940202)$q$),'free cannot read paid');
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_video_position('update',940203)$q$),'draft denied');
select pg_temp.assert_true(not public.htp_video_access(null,940201),'null kind denied');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000002','mux:SyntheticF4UpdateOne',20,100,0,'f4a00000-0000-4000-8000-000000000021',10)$q$),'foreign owner denied');
do $$declare r jsonb;begin
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',20,100,0,'f4a00000-0000-4000-8000-000000000021',10);
 perform pg_temp.assert_true((r->>'accepted')::boolean and (r->>'revision')::int=1,'first save');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',20,100,0,'f4a00000-0000-4000-8000-000000000021',10);
 perform pg_temp.assert_true((r->>'accepted')::boolean and (r->>'revision')::int=1,'idempotent retry');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',10,100,0,'f4a00000-0000-4000-8000-000000000021',9);
 perform pg_temp.assert_true((r->>'stale')::boolean and (r->>'positionSeconds')::int=20,'out-of-order retry');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',94.9,100,1,'f4a00000-0000-4000-8000-000000000021',11);
 perform pg_temp.assert_true(not(r->>'completed')::boolean,'below 95');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',95,100,2,'f4a00000-0000-4000-8000-000000000021',12);
 perform pg_temp.assert_true((r->>'completed')::boolean,'95 presentation completed');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',10,100,3,'f4a00000-0000-4000-8000-000000000021',13);
 perform pg_temp.assert_true((r->>'completed')::boolean and(r->>'maxPositionSeconds')::int=95,'rewind preserves peak');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',40,100,2,'f4a00000-0000-4000-8000-000000000022',1);
 perform pg_temp.assert_true((r->>'conflict')::boolean and(r->>'revision')::int=4,'stale device cannot overwrite');
 r:=public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',40,100,4,'f4a00000-0000-4000-8000-000000000022',1);
 perform pg_temp.assert_true((r->>'accepted')::boolean and(r->>'revision')::int=5,'explicit takeover current revision');
end$$;
select pg_temp.assert_true(pg_temp.rejects($q$update public.video_positions set position_seconds=99$q$),'direct update denied');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',1,1,5,'f4a00000-0000-4000-8000-000000000021',14)$q$),'false duration denied');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne','NaN',100,5,'f4a00000-0000-4000-8000-000000000021',14)$q$),'NaN denied');
set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000012';
select pg_temp.assert_true((select count(*)=0 from public.video_positions),'other owner hidden');
set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000011';
do $$declare r jsonb;begin
 r:=public.save_video_position('lesson',940101,'f4a00000-0000-4000-8000-000000000001','mux:SyntheticF4LessonOne',95,100,0,'f4a00000-0000-4000-8000-000000000031',1);
 perform pg_temp.assert_true((r->>'completed')::boolean,'lesson visual 95');
 perform pg_temp.assert_true(not public.htp_video_access('lesson',940102),'95 never unlocks next lesson');
 perform pg_temp.assert_true(not exists(select 1 from public.progress where student_id='f4a00000-0000-4000-8000-000000000001'),'no automatic course completion');
end$$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.weekly_update_views where student_id::text like 'f4a00000%'),'no watched update mutation');
insert into public.progress(student_id,lesson_id,watched,watched_at)values('f4a00000-0000-4000-8000-000000000001',940101,true,'2026-01-01T00:00Z');
update public.weekly_updates set mux_playback_id='SyntheticF4Replacement' where id=940201;
set local role authenticated;set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((public.read_video_position('update',940201)->>'positionSeconds')::int=0,'replacement never resumes old position');
select pg_temp.assert_true((select count(*)=0 from public.video_positions),'old version hidden');
select pg_temp.assert_true(pg_temp.rejects($q$select public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4UpdateOne',60,100,5,'f4a00000-0000-4000-8000-000000000021',15)$q$),'old video write rejected');
select pg_temp.assert_true((public.save_video_position('update',940201,'f4a00000-0000-4000-8000-000000000003','mux:SyntheticF4Replacement',5,100,5,'f4a00000-0000-4000-8000-000000000021',15)->>'maxPositionSeconds')::int=5,'replacement resets peak');
set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true(public.htp_video_access('lesson',940102),'existing completion unlock retained');
select public.save_video_position('lesson',940101,'f4a00000-0000-4000-8000-000000000001','mux:SyntheticF4LessonOne',20,100,1,'f4a00000-0000-4000-8000-000000000031',2) is not null as resumed;
reset role;
select pg_temp.assert_true((select watched and watched_at='2026-01-01T00:00Z' from public.progress where student_id='f4a00000-0000-4000-8000-000000000001' and lesson_id=940101),'watched history preserved');
update public.weekly_updates set is_published=false where id=940201;
set local role authenticated;set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((select count(*)=0 from public.video_positions),'withdrawn post hides state');
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_video_position('update',940201)$q$),'withdrawn read denied');
reset role;set local role anon;
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_video_position('update',940201)$q$),'anonymous RPC denied');
reset role;
delete from auth.users where id='f4a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((select count(*)=0 from public.video_positions where student_id='f4a00000-0000-4000-8000-000000000003'),'deleted account positions removed');
set local role authenticated;set local request.jwt.claim.sub='f4a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true(pg_temp.rejects($q$select public.read_video_position('update',940202)$q$),'deleted auth JWT cannot access progress');
reset role;
rollback;
