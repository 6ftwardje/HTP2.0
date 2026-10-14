-- Local-only, rollback-only integration test, on a database with the existing
-- Academy migrations applied. Also works after the new migration is applied:
-- its column is recreated inside this transaction to verify the one-time seed.
-- PGPASSWORD=postgres psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 \
--   -U postgres -d postgres -f tests/sql/configurable-free-modules.sql
\set ON_ERROR_STOP on
begin;

-- Isolate the rollout seed from local development content; rollback restores
-- the original publication flags, configuration, functions and fixture rows.
update public.modules set is_published = false;
alter table public.modules drop column if exists is_free;

insert into public.students (id, auth_user_id, email, name, access_level) values
  ('97000000-0000-0000-0000-000000000001', '97100000-0000-0000-0000-000000000001', 'config-free-ready@example.invalid', 'Free ready', 1),
  ('97000000-0000-0000-0000-000000000002', '97100000-0000-0000-0000-000000000002', 'config-free-intake@example.invalid', 'Free incomplete', 1),
  ('97000000-0000-0000-0000-000000000003', '97100000-0000-0000-0000-000000000003', 'config-paid@example.invalid', 'Paid', 2),
  ('97000000-0000-0000-0000-000000000004', '97100000-0000-0000-0000-000000000004', 'config-admin@example.invalid', 'Admin', 3),
  ('97000000-0000-0000-0000-000000000005', '97100000-0000-0000-0000-000000000005', 'config-legacy@example.invalid', 'Legacy without intake', 1);

insert into public.student_onboarding_responses (
  student_id, experience_level, primary_market, main_challenge,
  goal_90_days, weekly_time_commitment, mentorship_interest, confidence_score
) values (
  '97000000-0000-0000-0000-000000000001', 'beginner', 'crypto', 'structuur',
  'plan volgen', '3_5', 'self_paced', 3
);

insert into public.modules (id, title, slug, order_index, is_published) values
  (970000000, 'Configuration draft first', 'config-free-draft-first', 970000000, false),
  (970000001, 'Configuration 1', 'config-free-1', 970000001, true),
  (970000002, 'Configuration 2', 'config-free-2', 970000002, true),
  (970000003, 'Configuration 3', 'config-free-3', 970000003, true),
  (970000004, 'Configuration 4', 'config-free-4', 970000004, true),
  (970000005, 'Configuration 5', 'config-free-5', 970000005, true),
  (970000006, 'Configuration 6', 'config-free-6', 970000006, true),
  (970000007, 'Configuration 7', 'config-free-7', 970000007, true),
  (970000008, 'Configuration draft last', 'config-free-draft-last', 970000008, false);

insert into public.lessons (id, module_id, title, slug, order_index, is_published)
select 970000000000 + m.id, m.id, m.title, 'config-free-lesson-' || m.id, 1, true
from public.modules m where m.id between 970000000 and 970000008;
insert into public.lessons (id, module_id, title, slug, order_index, is_published)
values (970970000011, 970000001, 'Beyond preview', 'config-free-beyond-preview', 2, true);

insert into public.exams (id, module_id, title, is_published) values
  (970000002, 970000002, 'Configuration exam 2', true),
  (970000007, 970000007, 'Configuration exam 7', true);

-- Ten valid questions allow an actual start in a module beyond the old gate.
insert into public.exam_questions (
  id, exam_id, module_id, question, question_text, options, correct_answer, order_index
)
select 970700000 + n, 970000007, 970000007, 'Question ' || n, 'Question ' || n,
  '["A", "B"]'::jsonb, 'A', n
from generate_series(1, 10) n;
insert into public.exam_answer_options (id, question_id, option_text, is_correct, order_index)
select 970710000 + n * 2, 970700000 + n, 'A', true, 1 from generate_series(1, 10) n
union all
select 970710001 + n * 2, 970700000 + n, 'B', false, 2 from generate_series(1, 10) n;

insert into public.legacy_academy_module_access (student_id, module_id, grant_source)
values ('97000000-0000-0000-0000-000000000005', 970000005, 'existing_progress');

\ir ../../supabase/migrations/20261014000000_configurable_free_modules.sql

do $$
begin
  if (select array_agg(id order by order_index, id) from public.modules where is_free)
     is distinct from array[970000001,970000002,970000003,970000004,970000005,970000006]::bigint[] then
    raise exception 'Rollout must mark exactly the first six published modules free';
  end if;
  if exists (select 1 from public.modules where not is_published and is_free) then
    raise exception 'Drafts must stay paid by default';
  end if;
  if has_function_privilege('anon', 'public.can_open_academy_module(bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_dashboard_read_model()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.start_module_exam_unchecked(bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.submit_module_exam_unchecked(uuid,jsonb)', 'EXECUTE') then
    raise exception 'Migration exposed an anonymous or unchecked Academy RPC';
  end if;
end;
$$;

-- Change session_user as well as current_user: privileged maintenance branches
-- must not make these authenticated role tests accidentally bypass protection.
set session authorization authenticator;
set role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '';

do $$
begin
  if public.can_open_academy_module(970000001) then
    raise exception 'Missing JWT must not grant module access';
  end if;
  begin
    perform public.get_my_dashboard_read_model();
    raise exception 'Dashboard accepted a missing JWT';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000001';
do $$
begin
  if not public.can_open_academy_module(970000006)
     or public.can_open_academy_module(970000007) then
    raise exception 'Level 1 initial access must follow the six-module seed';
  end if;
  if public.can_start_academy_exam(970000007) then
    raise exception 'Unentitled exam must remain locked';
  end if;
end;
$$;

-- Admins can select a non-contiguous set, including modules after position six.
set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000004';
update public.modules set is_free = (id in (970000002, 970000007))
where id between 970000000 and 970000008;
insert into public.modules (id, title, slug, order_index, is_published)
values (970000009, 'New paid module', 'config-free-new-paid', 970000009, true);

do $$
begin
  if (select array_agg(id order by id) from public.modules where is_free)
     is distinct from array[970000002,970000007]::bigint[] then
    raise exception 'Admin could not choose arbitrary free modules';
  end if;
  if (select is_free from public.modules where id = 970000009) then
    raise exception 'New modules must default to paid';
  end if;
end;
$$;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000001';
do $$
declare
  v_modules jsonb := public.get_my_dashboard_read_model()->'modules';
begin
  if public.can_open_academy_module(970000001)
     or not public.can_open_academy_module(970000002)
     or public.can_open_academy_module(970000006)
     or not public.can_open_academy_module(970000007) then
    raise exception 'Free access still depends on contiguous module positions';
  end if;
  if (select count(*) from public.lessons where slug like 'config-free-%') <> 3
     or (select count(*) from public.exams where id in (970000002,970000007)) <> 2 then
    raise exception 'Lesson/exam RLS does not follow the configured module set plus preview';
  end if;
  if exists (select 1 from jsonb_array_elements(v_modules) m where not (m ? 'is_free'))
     or (select (m->>'is_free')::boolean from jsonb_array_elements(v_modules) m
         where m->>'id' = '970000007') is distinct from true
     or (select (m->>'is_free')::boolean from jsonb_array_elements(v_modules) m
         where m->>'id' = '970000001') is distinct from false then
    raise exception 'Dashboard RPC omits configured free-module flags';
  end if;
  if public.can_start_academy_exam(970000007) then
    raise exception 'Free exam must still require its lessons to be watched';
  end if;

  -- UPDATE can silently affect zero rows under RLS; verify the persisted flags.
  update public.modules set is_free = true where id = 970000006;
  update public.modules set is_free = false where id = 970000007;
  if (select is_free from public.modules where id = 970000006)
     or not (select is_free from public.modules where id = 970000007) then
    raise exception 'Non-admin changed module access settings';
  end if;
  begin
    insert into public.modules (id, title, slug, order_index, is_free)
    values (970000010, 'Forged free module', 'config-free-forged', 970000010, true);
    raise exception 'Non-admin inserted a free module';
  exception when insufficient_privilege then null;
  end;
end;
$$;

insert into public.progress (student_id, lesson_id, watched, watched_at)
values ('97000000-0000-0000-0000-000000000001', 970970000007, true, now());

do $$
begin
  if not public.can_start_academy_exam(970000007)
     or (public.start_module_exam(970000007)->>'success') is distinct from 'true' then
    raise exception 'Configured free module 7 cannot start its exam without a previous module pass';
  end if;
end;
$$;

-- Reorder through the existing admin RPC; the selected module IDs stay free.
set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000004';
select public.reorder_modules_admin(array(
  select id from public.modules
  order by case id when 970000001 then 0 when 970000007 then 1 when 970000002 then 2 else 3 end,
    order_index, id
));

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000001';
do $$
begin
  if public.can_open_academy_module(970000001)
     or not public.can_open_academy_module(970000002)
     or not public.can_open_academy_module(970000007)
     or public.can_open_academy_module(970000006) then
    raise exception 'Reordering changed the configured access selection';
  end if;
end;
$$;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000002';
do $$
begin
  if public.can_open_academy_module(970000002)
     or public.can_open_academy_module(970000007)
     or not public.can_read_academy_lesson(970970000001)
     or public.can_read_academy_lesson(970970000011)
     or (select count(*) from public.lessons where slug like 'config-free-%') <> 1 then
    raise exception 'Incomplete intake must retain only the existing first-lesson preview';
  end if;
end;
$$;

-- Paid students and admins retain access to all published modules without intake.
set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000003';
do $$
begin
  if not public.can_open_academy_module(970000001)
     or not public.can_open_academy_module(970000009)
     or public.can_open_academy_module(970000000) then
    raise exception 'Paid access changed or a draft module became accessible';
  end if;
  update public.modules set is_free = true where id = 970000006;
  if (select is_free from public.modules where id = 970000006) then
    raise exception 'Paid non-admin changed module access settings';
  end if;
end;
$$;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000004';
do $$
begin
  if not public.can_open_academy_module(970000009)
     or public.can_open_academy_module(970000000) then
    raise exception 'Admin published-module entitlement changed';
  end if;
end;
$$;
update public.modules set is_free = true where id = 970000000;
update public.modules set is_free = false where id = 970000007;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000001';
do $$
declare
  v_attempt_id uuid;
begin
  select id into v_attempt_id from public.exam_attempts
  where student_id = '97000000-0000-0000-0000-000000000001' and module_id = 970000007;
  if public.can_open_academy_module(970000007)
     or public.can_read_academy_lesson(970970000007)
     or public.can_start_academy_exam(970000007)
     or exists (select 1 from public.exams where id = 970000007)
     or (public.start_module_exam(970000007)->>'success') is distinct from 'false'
     or (public.submit_module_exam(v_attempt_id, '[]'::jsonb)->>'success') is distinct from 'false' then
    raise exception 'Disabling is_free did not revoke lesson/exam/open-attempt access';
  end if;
  if public.can_open_academy_module(970000000) then
    raise exception 'is_free must never expose unpublished modules';
  end if;
  update public.progress set watched = false
  where student_id = '97000000-0000-0000-0000-000000000001' and lesson_id = 970970000007;
  if not (select watched from public.progress
          where student_id = '97000000-0000-0000-0000-000000000001' and lesson_id = 970970000007) then
    raise exception 'Revoked module still allows progress updates';
  end if;
  begin
    insert into public.progress (student_id, lesson_id, watched)
    values ('97000000-0000-0000-0000-000000000001', 970970000006, true);
    raise exception 'Paid-module progress insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '97100000-0000-0000-0000-000000000005';
do $$
begin
  if not public.can_open_academy_module(970000005)
     or not public.can_read_academy_lesson(970970000005)
     or public.can_open_academy_module(970000002)
     or (select count(*) from public.legacy_academy_module_access) <> 1 then
    raise exception 'Frozen legacy access must survive configuration changes without intake';
  end if;
end;
$$;

reset role;
reset session authorization;
rollback;
