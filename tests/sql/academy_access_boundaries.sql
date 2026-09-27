-- Run only against local Supabase, in one rollback-only transaction:
-- PGPASSWORD=postgres psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 \
--   -U supabase_admin -d postgres -c 'BEGIN' -c 'SET ROLE postgres' \
--   -f tests/sql/academy_access_legacy_fixture.sql \
--   -f supabase/migrations/20260927005000_urgent_legacy_rls_hotfix.sql \
--   -f supabase/migrations/20260927020000_academy_access_boundaries.sql \
--   -f tests/sql/academy_access_boundaries.sql -c 'ROLLBACK'

-- New students and future exam results are deliberately inserted after the
-- one-time snapshot. Neither must inherit an old paid-module unlock.
insert into public.students (id, auth_user_id, email, name, access_level) values
  ('92000000-0000-0000-0000-000000000008', '91000000-0000-0000-0000-000000000008', 'access-future-pass@example.invalid', 'Free future pass', 1);
insert into public.student_onboarding_responses (
  student_id, experience_level, primary_market, main_challenge,
  goal_90_days, weekly_time_commitment, mentorship_interest, confidence_score,
  completed_at
) values (
  '92000000-0000-0000-0000-000000000008', 'beginner', 'crypto', 'structuur',
  'plan volgen', '3_5', 'self_paced', 3, now()
);
insert into public.exam_attempts (
  student_id, exam_id, module_id, status, score, total_questions, passed, submitted_at
) values (
  '92000000-0000-0000-0000-000000000008', 920000003, 920000003,
  'submitted', 100, 1, true, now()
), (
  '92000000-0000-0000-0000-000000000001', 920000003, 920000003,
  'submitted', 100, 1, true, now()
);
insert into public.exam_results (student_id, exam_id, score, passed) values
  ('92000000-0000-0000-0000-000000000008', 920000003, 100, true),
  ('92000000-0000-0000-0000-000000000001', 920000003, 100, true);

reset role;
set session authorization authenticator;
set role anon;

do $$
begin
  if (select count(*) from public.students where id::text like '92000000-%') <> 0
     or (select count(*) from public.modules where slug like 'access-test-%') <> 0
     or (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 0
     or (select count(*) from public.exams where id in (920000003, 920000004)) <> 0
     or (select count(*) from public.exam_questions where id = 920000000051) <> 0
     or (select count(*) from public.practical_lessons where id in (920001, 920004, 920005)) <> 0 then
    raise exception 'Anonymous role can still read private Academy or student rows';
  end if;
end;
$$;

set role authenticated;
set local request.jwt.claim.role = 'authenticated';

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in (
        'Allow public select', 'Allow public insert', 'Allow public read',
        'Enable read access for all users', 'Allow public read exams',
        'Allow public select practical_lessons',
        'Students can insert own exam results',
        'Students can insert own progress',
        'Students can update own progress'
      )
  ) then
    raise exception 'A legacy broad access policy survived the migration';
  end if;
  if has_function_privilege('authenticated', 'public.start_module_exam_unchecked(bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.submit_module_exam_unchecked(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.serialize_exam_attempt(uuid)', 'EXECUTE') then
    raise exception 'Unchecked exam RPC is still executable by students';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'exam_attempt_answers'
      and policyname = 'exam_attempt_answers_select_own_submitted'
      and qual like '%can_open_academy_module%'
  ) then
    raise exception 'Submitted answer snapshots lack the paid-module gate';
  end if;
  if public.can_read_academy_lesson(920000000011) then
    raise exception 'Missing JWT unexpectedly grants lesson access';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 1 then
    raise exception 'Incomplete-intake free account must see only the preview lesson';
  end if;
  if (select count(*) from public.students where id::text like '92000000-%') <> 1 then
    raise exception 'Free account can see other student profiles';
  end if;
  if (select count(*) from public.exam_questions where id = 920000000051) <> 0 then
    raise exception 'Free account can read correct exam answers';
  end if;
  if (select count(*) from public.practical_lessons where id in (920001, 920004)) <> 0 then
    raise exception 'Incomplete-intake free account reached practice content';
  end if;
  if exists (select 1 from public.legacy_academy_module_access) then
    raise exception 'Later exam pass created a grant or exposed another student grant';
  end if;
  if has_table_privilege('authenticated', 'public.legacy_academy_module_access', 'INSERT')
     or has_table_privilege('authenticated', 'public.legacy_academy_module_access', 'UPDATE')
     or has_table_privilege('authenticated', 'public.legacy_academy_module_access', 'DELETE') then
    raise exception 'Students can mutate frozen legacy grants';
  end if;
  if public.can_start_academy_exam(920000001)
     or public.start_module_exam(920000004)->>'success' <> 'false' then
    raise exception 'Incomplete-intake free account reached an exam';
  end if;
end;
$$;

do $$
begin
  begin
    update public.students set access_level = 3
    where id = '92000000-0000-0000-0000-000000000001';
    raise exception 'Self-promotion unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.progress (student_id, lesson_id, watched)
    values ('92000000-0000-0000-0000-000000000001', 920000000041, true);
    raise exception 'Paid lesson progress unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

update public.students set name = 'Free profile edit'
where id = '92000000-0000-0000-0000-000000000001';

do $$
begin
  if (select name from public.students
      where id = '92000000-0000-0000-0000-000000000001') <> 'Free profile edit' then
    raise exception 'Ordinary profile update was blocked';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000005';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 0
     or (select count(*) from public.exams where id in (920000003, 920000004)) <> 0
     or (select count(*) from public.practical_lessons where id in (920001, 920004)) <> 0
     or (select count(*) from public.legacy_academy_module_access) <> 0 then
    raise exception 'Authenticated account without a student row can read Academy content';
  end if;
  begin
    insert into public.students (id, auth_user_id, email, access_level)
    values (
      '92000000-0000-0000-0000-000000000005',
      '91000000-0000-0000-0000-000000000005',
      'access-self-admin@example.invalid', 3
    );
    raise exception 'Self-assigned admin INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000008';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 4
     or (select count(*) from public.legacy_academy_module_access) <> 0
     or public.can_open_academy_module(920000004)
     or public.can_read_academy_lesson(920000000041) then
    raise exception 'Future passing attempt created a new paid-module entitlement';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000006';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 2
     or (select count(*) from public.practical_lessons where id in (920001, 920004)) <> 1
     or (select grant_source from public.legacy_academy_module_access
         where module_id = 920000004) <> 'existing_progress'
     or not public.can_read_academy_lesson(920000000041) then
    raise exception 'Existing paid-module progress was not preserved before intake';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000007';

do $$
begin
  if (select grant_source from public.legacy_academy_module_access
      where module_id = 920000004) <> 'legacy_exam_result'
     or not public.can_open_academy_module(920000004) then
    raise exception 'Previously unlocked, unverified exam-result access was not frozen';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000002';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 5 then
    raise exception 'Previously unlocked fourth module was not preserved';
  end if;
  if (select count(*) from public.practical_lessons where id in (920001, 920004)) <> 2 then
    raise exception 'Completed-intake free account practice access is wrong';
  end if;
  if (select grant_source from public.legacy_academy_module_access
      where module_id = 920000004) <> 'verified_exam_attempt'
     or (select count(*) from public.legacy_academy_module_access) <> 1
     or public.can_open_academy_module(920000006)
     or not public.can_read_academy_lesson(920000000041)
     or public.can_start_academy_exam(920000004)
     or public.start_module_exam(920000004)->>'success' <> 'false' then
    raise exception 'Verified legacy unlock or exam lesson gate is wrong';
  end if;
  if public.can_start_academy_exam(920000003) then
    raise exception 'Exam opened before its lesson was completed';
  end if;
end;
$$;

insert into public.progress (student_id, lesson_id, watched, watched_at)
values ('92000000-0000-0000-0000-000000000002', 920000000031, true, now());

do $$
begin
  if not public.can_start_academy_exam(920000003) then
    raise exception 'Free third-module exam stayed locked after the lesson';
  end if;
  begin
    insert into public.exam_results (student_id, exam_id, score, passed)
    values ('92000000-0000-0000-0000-000000000002', 920000003, 100, true);
    raise exception 'Student forged a passed exam result through direct INSERT';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000003';

do $$
begin
  if (select count(*) from public.lessons where slug like 'access-test-lesson-%') <> 5 then
    raise exception 'Paid account cannot see all published lessons without intake';
  end if;
  if (select count(*) from public.practical_lessons where id in (920001, 920004)) <> 2 then
    raise exception 'Paid account cannot read practice content';
  end if;
  if (select count(*) from public.practical_lessons where id = 920005) <> 0 then
    raise exception 'Paid student can see a draft practical lesson';
  end if;
  if public.can_start_academy_exam(920000004) then
    raise exception 'Paid exam opened before its lesson was completed';
  end if;
end;
$$;

insert into public.progress (student_id, lesson_id, watched, watched_at)
values ('92000000-0000-0000-0000-000000000003', 920000000041, true, now());

do $$
begin
  if not public.can_start_academy_exam(920000004) then
    raise exception 'Paid exam stayed locked after lesson completion';
  end if;
  if public.start_module_exam(920000004)->>'error' like 'Rond eerst%' then
    raise exception 'Entitled paid exam was rejected by the access wrapper';
  end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000004';

do $$
begin
  if (select count(*) from public.practical_lessons where id = 920005) <> 1 then
    raise exception 'Admin cannot manage a practical lesson in a draft module';
  end if;
end;
$$;

update public.students set access_level = 2
where id = '92000000-0000-0000-0000-000000000001';

do $$
begin
  if (select access_level from public.students
      where id = '92000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'Admin could not change another student access level';
  end if;
end;
$$;
