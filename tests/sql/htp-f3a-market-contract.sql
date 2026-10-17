\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'F3a: %',message; end if;
end$$;
create function pg_temp.constraint_rejects(statement text) returns boolean language plpgsql as $$begin
 execute statement; return false;
exception when check_violation then return true;
end$$;
insert into public.students(id,auth_user_id,email,name,access_level) values
('f3a00000-0000-4000-8000-000000000001','f3a00000-0000-4000-8000-000000000011','f3a-free@example.invalid','F3a Free',1),
('f3a00000-0000-4000-8000-000000000002','f3a00000-0000-4000-8000-000000000012','f3a-paid@example.invalid','F3a Student',2),
('f3a00000-0000-4000-8000-000000000003','f3a00000-0000-4000-8000-000000000013','f3a-admin@example.invalid','F3a Admin',3);
do $$declare tag text; n int:=0; fmt text; begin
 foreach tag in array array['crypto','forex','stocks','gold','commodities','trading','macro','indices','general'] loop
  foreach fmt in array array['video','text','chart'] loop
   n:=n+1;
   insert into public.weekly_updates(id,title,slug,week_start_date,type,market,markets,content_format,body,image_paths,access_tier,is_published,published_at,chapters,video_duration_seconds)
   values(-83000-n,'Synthetic F3a','synthetic-f3a-'||n,'2026-10-12','market_update',
    case when tag in ('crypto','forex','stocks','gold','commodities','trading') then tag else null end,
    array[tag,'forex'],'text'::text,'Een voldoende lange synthetische toelichting.',
    case when fmt='chart' then array['synthetic/fixture.png'] else '{}'::text[] end,'free',true,'2026-10-12T09:00:00Z',
    jsonb_build_array(jsonb_build_object('title','Intro','seconds',0),jsonb_build_object('title','Markt','seconds',20,'market',tag)),60);
   update public.weekly_updates set content_format=fmt where id=-83000-n;
  end loop;
 end loop;
end$$;
insert into public.weekly_updates(id,title,slug,week_start_date,type,market,markets,access_tier,is_published) values
(-83100,'Private F3a','synthetic-f3a-private','2026-10-12','market_update','gold',array['gold','trading'],'subscription',true),
(-83101,'Draft F3a','synthetic-f3a-draft','2026-10-12','market_update','crypto',array['crypto'],'free',false),
(-83102,'Week F3a','synthetic-f3a-week','2099-01-05','weekly_outlook',null,array['forex','gold'],'free',true);
select pg_temp.assert_true((select count(*)=27 from public.weekly_updates where id between -83027 and -83001),'all markets/formats');
select pg_temp.assert_true(public.valid_market_chapters('[{"title":"Old","seconds":0}]',null,'{}'),'legacy untagged chapter');
select pg_temp.assert_true(public.valid_market_chapters('[{"title":"Gold","seconds":0,"market":"gold"}]',60,array['gold']),'tagged chapter');
do $$declare bad jsonb; begin
 for bad in select value from jsonb_array_elements('[null,{},[null],[{"title":"x","seconds":-1}],[{"title":"x","seconds":0.5}],[{"title":"","seconds":0}],[{"title":"x","seconds":0,"market":null}],[{"title":"x","seconds":0,"market":"gold"}],[{"title":"x","seconds":60}],[{"title":"x","seconds":20},{"title":"y","seconds":10}],[{"title":"x","seconds":0,"extra":1}]]'::jsonb) loop
  perform pg_temp.assert_true(not public.valid_market_chapters(bad,60,array['crypto']),'invalid chapter accepted: '||bad::text);
 end loop;
end$$;
select pg_temp.assert_true(pg_temp.constraint_rejects($q$update public.weekly_updates set markets=array['unknown'] where id=-83001$q$),'unsupported tag');
select pg_temp.assert_true(pg_temp.constraint_rejects($q$update public.weekly_updates set markets=array[null]::text[] where id=-83001$q$),'null tag');
select pg_temp.assert_true(pg_temp.constraint_rejects($q$update public.weekly_updates set chapters='[{"title":"x","seconds":60}]' where id=-83001$q$),'duration boundary');
select pg_temp.assert_true(pg_temp.constraint_rejects($q$update public.weekly_updates set market=null,markets='{}',update_structure=null where id=-83001$q$),'unclassified market update');
select pg_temp.assert_true(pg_temp.constraint_rejects($q$update public.weekly_updates set market='gold' where id=-83102$q$),'outlook scalar market remains null');

set local role authenticated;
set local request.jwt.claim.sub='f3a00000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select count(*)=28 from public.weekly_updates where id between -83102 and -83001),'free RLS: released free only');
do $$begin
 begin
  update public.weekly_updates set title='Forbidden' where id=-83001;
  if found then raise exception 'non-admin wrote content'; end if;
 exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claim.sub='f3a00000-0000-4000-8000-000000000012';
select pg_temp.assert_true((select count(*)=29 from public.weekly_updates where id between -83102 and -83001),'level2 RLS: published subscription');
set local request.jwt.claim.sub='f3a00000-0000-4000-8000-000000000013';
select pg_temp.assert_true((select count(*)=30 from public.weekly_updates where id between -83102 and -83001),'admin RLS: drafts visible');
update public.weekly_updates set period_label='Week 42',chapters='[{"title":"Forex","seconds":0,"market":"forex"},{"title":"Goud","seconds":20,"market":"gold"}]' where id=-83102;
select pg_temp.assert_true((select week_start_date='2099-01-05' and market is null and markets=array['forex','gold'] and period_label='Week 42' from public.weekly_updates where id=-83102),'existing week/period/chapter contract');
reset role;
rollback;
