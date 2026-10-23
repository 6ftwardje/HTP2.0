-- Synthetic fixtures only. Applied through scripts/release/seed.mjs, never a migration.
do $$ begin
  if not exists(select 1 from supabase_migrations.htp_release_environment where environment='staging' and project_ref='pxxpciwnvfkxnkpttajp') then
    raise exception 'Dummy data requires the explicit staging database marker';
  end if;
  if length(current_setting('htp.fixture_password',true)) < 20 then raise exception 'A private fixture password is required'; end if;
  if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and t.tgenabled<>'D'
    and p.pronamespace='public'::regnamespace and pg_get_functiondef(p.oid) ~* 'net\.http|http_post|dblink') then
    raise exception 'Outbound database automation must be disabled before seeding';
  end if;
end $$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
  email,extensions.crypt(current_setting('htp.fixture_password'),extensions.gen_salt('bf')),now(),'','','','',
  '{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('name',name,'full_name',name,'phone','+32470000000','staging_fixture',true),now(),now()
from (values (1,'admin@staging.htp.test','Testbeheerder Alex'),(2,'mentor@staging.htp.test','Testmentor Robin'),
  (3,'member@staging.htp.test','Testlid Noor'),(4,'free@staging.htp.test','Gratis testlid Sam'),(5,'member2@staging.htp.test','Testlid Mila')) a(n,email,name)
on conflict (id) do nothing;

insert into auth.identities(id,user_id,provider_id,provider,identity_data,last_sign_in_at,created_at,updated_at)
select u.id,u.id,u.id::text,'email',jsonb_build_object('sub',u.id,'email',u.email,'email_verified',true,'phone_verified',false),now(),now(),now()
from auth.users u where u.id::text like '10000000-0000-4000-8000-%' and u.email like '%@staging.htp.test'
on conflict (provider_id,provider) do nothing;

update public.students s set access_level=case s.email when 'admin@staging.htp.test' then 3 when 'member@staging.htp.test' then 2 when 'member2@staging.htp.test' then 2 else 1 end,
  phone='+32470000000',tags=array['staging-fixture']
where s.auth_user_id::text like '10000000-0000-4000-8000-%' and s.email like '%@staging.htp.test';

insert into public.user_roles(student_id,role)
select id,case email when 'admin@staging.htp.test' then 'admin' when 'mentor@staging.htp.test' then 'mentor' else 'student' end
from public.students where email like '%@staging.htp.test' and auth_user_id::text like '10000000-0000-4000-8000-%'
on conflict do nothing;

insert into public.student_onboarding_responses(student_id,experience_level,primary_market,main_challenge,goal_90_days,weekly_time_commitment,mentorship_interest,confidence_score,completed_at,intake_version)
select id,'beginner','crypto','Een consequent oefenplan volgen','In een fictieve omgeving drie scenario’s leren uitwerken','3-5 uur','ja',5,now(),'staging-v1'
from public.students where email like '%@staging.htp.test' on conflict (student_id) do nothing;

insert into public.modules(id,title,slug,description,short_description,order_index,"order",is_published,is_free)
values (900001,'1. Basis van marktanalyse — demo','staging-basis','Fictieve opleidingsinhoud voor regressietests.','Dummy-inhoud voor staging.',1,1,true,true),
  (900002,'2. Risicobeheer — demo','staging-risicobeheer','Fictieve vervolgmodule voor toegangstests.','Test sequentiële toegang.',2,2,true,false),
  (900003,'Conceptmodule — demo','staging-concept','Dit concept hoort alleen in beheer zichtbaar te zijn.','Ongepubliceerde testinhoud.',3,3,false,false)
on conflict (id) do nothing;

insert into public.lessons(id,module_id,title,slug,description,order_index,"order",is_published,type,takeaway,action_items)
select 900000+n,case when n<=3 then 900001 else 900002 end,'Demoles '||n, 'staging-les-'||n,
 'Dit is fictieve testinhoud. Er is bewust geen productievideo of externe videodienst aan gekoppeld.',((n-1)%3)+1,((n-1)%3)+1,true,
 case when n%3=0 then 'praktijk'::public.lesson_type else 'theorie'::public.lesson_type end,
 'Schrijf een fictief scenario uit en benoem vooraf het risico.','["Beschrijf je oefenscenario","Controleer de voorwaarden"]'::jsonb
from generate_series(1,6)n on conflict (id) do nothing;

insert into public.exams(id,module_id,title,description,passing_score,is_published)
values (900001,900001,'Demo-examen marktanalyse','Uitsluitend voor de stagingproef.',70,true) on conflict (id) do nothing;
insert into public.exam_questions(id,exam_id,module_id,question,question_text,options,correct_answer,explanation,order_index,is_active)
select 900000+n,900001,900001,'Wat doe je vóór een oefentrade? Vraag '||n,'Wat doe je vóór een oefentrade? Vraag '||n,
 '["Een plan en risico vastleggen","Willekeurig handelen","Alleen de laatste koers bekijken"]'::jsonb,'Een plan en risico vastleggen',
 'Een vooraf vastgelegd plan maakt de oefening controleerbaar.',n,true from generate_series(1,12)n on conflict (id) do nothing;
insert into public.exam_answer_options(question_id,option_text,is_correct,order_index)
select q.id,o.text,o.correct,o.n from public.exam_questions q cross join
 (values ('Een plan en risico vastleggen',true,1),('Willekeurig handelen',false,2),('Alleen de laatste koers bekijken',false,3))o(text,correct,n)
where q.id between 900001 and 900012 and not exists(select 1 from public.exam_answer_options x where x.question_id=q.id);

insert into public.progress(student_id,lesson_id,watched,watched_at)
select id,900001,true,now()-interval '1 day' from public.students where email='member@staging.htp.test' on conflict (student_id,lesson_id) do nothing;

insert into public.weekly_updates(id,title,slug,summary,body,intro,article_html,author_name,week_start_date,type,market,markets,content_format,content_kind,access_tier,is_published,published_at,mentor_student_id,created_by_student_id,published_by_student_id,published_by_display_name)
select 900000+n,case n when 1 then 'Crypto: fictief marktscenario' when 2 then 'Forex: oefening in risicobeheer' when 3 then 'Aandelen: demo-analyse' when 4 then 'Macro: demo-weekoverzicht' when 5 then 'Conceptanalyse voor beheer' else 'Gearchiveerde oefenanalyse' end,
 'staging-update-'||n,'Fictieve analyse om filters, details en toegang te testen.',
 'Dit is uitsluitend dummy-inhoud voor staging. Er worden geen echte marktverwachtingen of handelsaanbevelingen gedaan. Gebruik deze pagina om weergave, rechten en bewerken te testen.',
 'Fictieve oefeninhoud voor de stagingomgeving.',
 '<p>Dit is een fictief oefenscenario voor staging. Controleer de inhoudsweergave, toegang en redactionele bediening.</p><h2>Oefenopdracht</h2><p>Beschrijf een mogelijk scenario en leg het risico vast.</p>',
 'Testmentor Robin',date_trunc('week',now())::date,'market_update',
 (array['crypto','forex','stocks',null,'crypto','forex'])[n],array[(array['crypto','forex','stocks','macro','crypto','forex'])[n]],
 'text','article','subscription',n<>5,case when n<>5 then now()-n*interval '1 hour' else null end,
 s.id,s.id,s.id,s.name
from generate_series(1,6)n cross join public.students s where s.email='mentor@staging.htp.test' on conflict (id) do nothing;
update public.weekly_updates set actuality_status='archive' where id=900006;

insert into public.live_sessions(id,title,slug,description,starts_at,ends_at,mentor_student_id,created_by_student_id,provider,status,is_published,published_at,markets)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 case n when 1 then 'Geplande demo-marktsessie' when 2 then 'Afgelopen demo-marktsessie' else 'Concept livesessie' end,
 'staging-sessie-'||n,'Fictieve sessie; er is geen echte livestream of providerdeelname gekoppeld.',
 case when n=2 then now()-interval '7 days' else now()+n*interval '2 days' end,
 case when n=2 then now()-interval '7 days'+interval '1 hour' else now()+n*interval '2 days'+interval '1 hour' end,
 s.id,s.id,'external',case n when 1 then 'scheduled' when 2 then 'completed' else 'draft' end,n<>3,case when n<>3 then now() else null end,array['crypto','forex']
from generate_series(1,3)n cross join public.students s where s.email='mentor@staging.htp.test' on conflict (id) do nothing;

insert into public.chat_mentor_config(singleton,enabled) values(true,false) on conflict(singleton) do nothing;
select public.configure_chat_mentor((select id from public.students where email='mentor@staging.htp.test'));

insert into public.notification_events(id,type,title,body,href,target_table,target_id)
values ('30000000-0000-4000-8000-000000000001','live_session.scheduled','Welkom in staging','Dit is een fictieve melding.','/live-sessions','live_sessions','20000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.notification_recipients(event_id,student_id)
select '30000000-0000-4000-8000-000000000001',id from public.students where email like '%@staging.htp.test' on conflict (event_id,student_id) do nothing;

-- Bring imported sequence starts above the explicitly reserved synthetic IDs.
do $$ declare t text; s text; n bigint; begin
  foreach t in array array['modules','lessons','exams','exam_questions','weekly_updates'] loop
    s:=pg_get_serial_sequence('public.'||quote_ident(t),'id');
    if s is not null then execute format('select greatest(coalesce(max(id),0)+1,1) from public.%I',t) into n;perform setval(s,n,false);end if;
  end loop;
end $$;
