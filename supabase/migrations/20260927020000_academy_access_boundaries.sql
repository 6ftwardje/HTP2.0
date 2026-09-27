-- The app's Academy route checks are not an authorization boundary: students
-- also have direct PostgREST/RPC access. Keep the paid/intake rules in the DB.
-- This migration does not touch subscription billing or existing progress.

-- HTP 2.0 still has permissive legacy policies created outside the migration
-- history. PostgreSQL ORs permissive policies, so leaving any one of these in
-- place would nullify the newer scoped policies below.
drop policy if exists "Allow public select" on public.students;
drop policy if exists "Allow public insert" on public.students;
drop policy if exists "Allow public read" on public.modules;
drop policy if exists "Enable read access for all users" on public.lessons;
drop policy if exists "Allow public read exams" on public.exams;
drop policy if exists "Enable read access for all users" on public.exams;
drop policy if exists "Enable read access for all users" on public.exam_questions;
drop policy if exists "Students can insert own exam results" on public.exam_results;
drop policy if exists "exam_results_insert_own" on public.exam_results;
drop policy if exists "Students can insert own progress" on public.progress;
drop policy if exists "Students can update own progress" on public.progress;

-- Bootstrap may create a free student, never a self-assigned admin account.
drop policy if exists "students_insert_own" on public.students;
create policy "students_insert_own"
  on public.students for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and access_level = 1
    and mentor_status = 'active'
    and cardinality(tags) = 0
  );

-- Column-level grants are shared by all authenticated users (including admins),
-- so use a trigger to preserve the admin's ability to manage students while
-- stopping a student from promoting themselves or changing mentor metadata.
create or replace function public.protect_student_privileged_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to update a student'
      using errcode = '42501';
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  if (to_jsonb(new) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at']) then
    raise exception 'Only profile fields can be changed by a student'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_student_privileged_fields on public.students;
create trigger protect_student_privileged_fields
  before update on public.students
  for each row execute function public.protect_student_privileged_fields();

revoke all on function public.protect_student_privileged_fields() from public, anon, authenticated;

create or replace function public.current_student_completed_intake()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    join public.student_onboarding_responses r on r.student_id = s.id
    where s.auth_user_id = auth.uid()
      and nullif(trim(coalesce(r.experience_level, '')), '') is not null
      and nullif(trim(coalesce(r.primary_market, '')), '') is not null
      and nullif(trim(coalesce(r.main_challenge, '')), '') is not null
      and nullif(trim(coalesce(r.goal_90_days, '')), '') is not null
      and nullif(trim(coalesce(r.weekly_time_commitment, '')), '') is not null
      and nullif(trim(coalesce(r.mentorship_interest, '')), '') is not null
      and r.confidence_score between 1 and 5
  );
$$;

revoke all on function public.current_student_completed_intake() from public, anon;
grant execute on function public.current_student_completed_intake() to authenticated;

-- Preserve only paid modules that a free account could already open before
-- this cutover. This is a one-time snapshot, not a new unlock mechanism.
-- Historical exam_results were directly writable by students, so a passed
-- result alone is not proof. We nevertheless preserve the old visible access
-- once to avoid locking out existing learners, and mark its weaker provenance
-- for later reconciliation. New results after this transaction grant nothing.
create table if not exists public.legacy_academy_module_access (
  student_id uuid not null references public.students (id) on delete cascade,
  module_id bigint not null references public.modules (id) on delete cascade,
  grant_source text not null check (grant_source in (
    'existing_progress', 'verified_exam_attempt', 'legacy_exam_result'
  )),
  captured_at timestamptz not null default now(),
  primary key (student_id, module_id)
);

alter table public.legacy_academy_module_access enable row level security;
drop policy if exists "legacy_academy_access_select_own"
  on public.legacy_academy_module_access;
create policy "legacy_academy_access_select_own"
  on public.legacy_academy_module_access for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = legacy_academy_module_access.student_id
        and s.auth_user_id = auth.uid()
    )
  );

revoke all on table public.legacy_academy_module_access from public, anon, authenticated;
grant select on table public.legacy_academy_module_access to authenticated;

with ranked_modules as (
  select
    m.id,
    m.order_index,
    row_number() over (order by m.order_index, m.id) as published_position
  from public.modules m
  where m.is_published
)
insert into public.legacy_academy_module_access (student_id, module_id, grant_source)
select s.id, m.id,
  case
    when evidence.had_progress then 'existing_progress'
    when evidence.had_verified_attempt then 'verified_exam_attempt'
    else 'legacy_exam_result'
  end
from public.students s
cross join ranked_modules m
cross join lateral (
  select
    exists (
      select 1 from public.progress p
      join public.lessons l on l.id = p.lesson_id
      where p.student_id = s.id and l.module_id = m.id
    ) or exists (
      select 1 from public.lesson_action_progress p
      join public.lessons l on l.id = p.lesson_id
      where p.student_id = s.id and l.module_id = m.id
    ) as had_progress,
    exists (
      select 1 from public.exam_attempts a
      join public.exams e on e.id = a.exam_id and e.module_id = a.module_id
      join public.modules previous_module on previous_module.id = a.module_id
      where a.student_id = s.id
        and previous_module.order_index = m.order_index - 1
        and previous_module.is_published
        and a.status = 'submitted'
        and a.passed = true
        and a.submitted_at is not null
    ) as had_verified_attempt,
    exists (
      select 1 from public.exam_results r
      join public.exams e on e.id = r.exam_id
      join public.modules previous_module on previous_module.id = e.module_id
      where r.student_id = s.id
        and r.passed = true
        and previous_module.order_index = m.order_index - 1
        and previous_module.is_published
    ) as had_legacy_result
) evidence
where s.access_level = 1
  and m.published_position > 3
  and (evidence.had_progress or evidence.had_verified_attempt or evidence.had_legacy_result)
on conflict (student_id, module_id) do nothing;

create or replace function public.can_open_academy_module(p_module_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_access_level smallint;
begin
  if auth.uid() is null then return false; end if;

  select s.id, s.access_level into v_student_id, v_access_level
  from public.students s where s.auth_user_id = auth.uid();
  if v_student_id is null then return false; end if;

  if not exists (
    select 1 from public.modules m
    where m.id = p_module_id and m.is_published
  ) then return false; end if;

  if v_access_level >= 2 then return true; end if;
  if exists (
    select 1 from public.legacy_academy_module_access legacy
    where legacy.student_id = v_student_id
      and legacy.module_id = p_module_id
  ) then return true; end if;
  if not public.current_student_completed_intake() then return false; end if;

  return exists (
    select 1 from (
      select m.id from public.modules m
      where m.is_published order by m.order_index, m.id limit 3
    ) free_modules where free_modules.id = p_module_id
  );
end;
$$;

revoke all on function public.can_open_academy_module(bigint) from public, anon;
grant execute on function public.can_open_academy_module(bigint) to authenticated;

-- SECURITY DEFINER deliberately bypasses lesson RLS during the lookup; the
-- only input is a lesson id and all branches are scoped to auth.uid().
create or replace function public.can_read_academy_lesson(p_lesson_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access_level smallint;
  v_module_id bigint;
  v_first_module_id bigint;
  v_first_lesson_id bigint;
begin
  if auth.uid() is null then return false; end if;

  select s.access_level into v_access_level
  from public.students s
  where s.auth_user_id = auth.uid();
  if v_access_level is null then return false; end if;

  select l.module_id into v_module_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = p_lesson_id and l.is_published and m.is_published;
  if v_module_id is null then return false; end if;

  if public.can_open_academy_module(v_module_id) then return true; end if;
  if v_access_level >= 2 then return false; end if;

  select m.id into v_first_module_id
  from public.modules m where m.is_published
  order by m.order_index, m.id limit 1;
  if v_module_id is distinct from v_first_module_id then return false; end if;

  select l.id into v_first_lesson_id
  from public.lessons l
  where l.module_id = v_first_module_id and l.is_published
  order by l.order_index, l.id limit 1;
  return p_lesson_id = v_first_lesson_id;
end;
$$;

revoke all on function public.can_read_academy_lesson(bigint) from public, anon;
grant execute on function public.can_read_academy_lesson(bigint) to authenticated;

drop policy if exists "lessons_select_published" on public.lessons;
drop policy if exists "lessons_select_published_entitled" on public.lessons;
create policy "lessons_select_published_entitled"
  on public.lessons for select to authenticated
  using (is_published and public.can_read_academy_lesson(id));

drop policy if exists "exams_select_published" on public.exams;
drop policy if exists "exams_select_entitled" on public.exams;
create policy "exams_select_entitled"
  on public.exams for select to authenticated
  using (is_published and public.can_open_academy_module(module_id));

-- Legacy practice lessons have no video URL and no publication flag. Preserve
-- them for entitled students, while removing their anonymous/public read path.
do $$
begin
  if to_regclass('public.practical_lessons') is not null then
    execute 'alter table public.practical_lessons enable row level security';
    execute 'drop policy if exists "Allow public select practical_lessons" on public.practical_lessons';
    execute 'drop policy if exists "practical_lessons_select_entitled" on public.practical_lessons';
    execute 'create policy "practical_lessons_select_entitled" on public.practical_lessons for select to authenticated using (public.is_platform_admin() or public.can_open_academy_module(module_id::bigint))';
  end if;
end;
$$;

-- Direct progress/action writes must obey the same entitlement boundary.
drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own"
  on public.progress for insert to authenticated
  with check (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
  on public.progress for update to authenticated
  using (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  )
  with check (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "lesson_action_progress_insert_own" on public.lesson_action_progress;
create policy "lesson_action_progress_insert_own"
  on public.lesson_action_progress for insert to authenticated
  with check (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = lesson_action_progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "lesson_action_progress_update_own" on public.lesson_action_progress;
create policy "lesson_action_progress_update_own"
  on public.lesson_action_progress for update to authenticated
  using (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = lesson_action_progress.student_id and s.auth_user_id = auth.uid()
    )
  )
  with check (
    public.can_read_academy_lesson(lesson_id)
    and exists (
      select 1 from public.students s
      where s.id = lesson_action_progress.student_id and s.auth_user_id = auth.uid()
    )
  );

-- The public exam RPC previously accepted a passed previous exam as an
-- alternative to payment, and did not require the lessons to be completed.
create or replace function public.can_start_academy_exam(p_module_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select s.id into v_student_id
  from public.students s where s.auth_user_id = auth.uid();
  if v_student_id is null then return false; end if;
  if not public.can_open_academy_module(p_module_id) then return false; end if;

  if not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id and l.is_published
  ) then return false; end if;

  return not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id
      and l.is_published
      and not exists (
        select 1 from public.progress p
        where p.student_id = v_student_id
          and p.lesson_id = l.id
          and p.watched = true
      )
  );
end;
$$;

revoke all on function public.can_start_academy_exam(bigint) from public, anon;
grant execute on function public.can_start_academy_exam(bigint) to authenticated;

alter function public.start_module_exam(bigint) rename to start_module_exam_unchecked;
revoke all on function public.start_module_exam_unchecked(bigint) from public, anon, authenticated;

create function public.start_module_exam(p_module_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_start_academy_exam(p_module_id) then
    return jsonb_build_object('success', false, 'error', 'Rond eerst de toegankelijke lessen en je intake af, of activeer volledige Academy-toegang.');
  end if;
  return public.start_module_exam_unchecked(p_module_id);
end;
$$;

revoke all on function public.start_module_exam(bigint) from public, anon;
grant execute on function public.start_module_exam(bigint) to authenticated;

-- Re-check at submission: an old open attempt must not survive loss of access.
alter function public.submit_module_exam(uuid, jsonb) rename to submit_module_exam_unchecked;
revoke all on function public.submit_module_exam_unchecked(uuid, jsonb) from public, anon, authenticated;

create function public.submit_module_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module_id bigint;
begin
  select a.module_id into v_module_id
  from public.exam_attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt_id and s.auth_user_id = auth.uid();

  if v_module_id is null or not public.can_start_academy_exam(v_module_id) then
    return jsonb_build_object('success', false, 'error', 'Deze toets is niet meer toegankelijk.');
  end if;

  return public.submit_module_exam_unchecked(p_attempt_id, p_answers);
end;
$$;

revoke all on function public.submit_module_exam(uuid, jsonb) from public, anon;
grant execute on function public.submit_module_exam(uuid, jsonb) to authenticated;

-- The legacy serializer returns saved question and answer snapshots. It is
-- only needed from inside the privileged exam RPC; direct student calls could
-- otherwise retrieve a historical paid attempt after access was revoked.
revoke all on function public.serialize_exam_attempt(uuid) from public, anon, authenticated;

-- Submitted answer rows contain question/correct-option snapshots. Keep their
-- existing own-attempt rule, but also require the current module entitlement.
drop policy if exists "exam_attempt_answers_select_own_submitted"
  on public.exam_attempt_answers;
create policy "exam_attempt_answers_select_own_submitted"
  on public.exam_attempt_answers for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      join public.students s on s.id = a.student_id
      where a.id = exam_attempt_answers.attempt_id
        and a.status = 'submitted'
        and s.auth_user_id = auth.uid()
        and public.can_open_academy_module(a.module_id)
    )
  );

-- Block direct exam_results INSERT too; privileged maintenance/service writes
-- retain their existing behavior. Missing JWT never implies privilege.
create or replace function public.protect_exam_result_entitlement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_module_id bigint;
  v_student_id uuid;
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to record an exam result'
      using errcode = '42501';
  end if;

  if public.is_platform_admin() then return new; end if;

  select s.id into v_student_id
  from public.students s where s.auth_user_id = auth.uid();
  select e.module_id into v_module_id
  from public.exams e where e.id = new.exam_id;
  if v_student_id is distinct from new.student_id
     or v_module_id is null
     or not public.can_start_academy_exam(v_module_id) then
    raise exception 'Exam result is outside the current Academy access'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_exam_result_entitlement on public.exam_results;
create trigger protect_exam_result_entitlement
  before insert on public.exam_results
  for each row execute function public.protect_exam_result_entitlement();

revoke all on function public.protect_exam_result_entitlement() from public, anon, authenticated;
