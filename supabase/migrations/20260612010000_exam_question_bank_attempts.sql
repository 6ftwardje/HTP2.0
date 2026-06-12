-- Exam question banks, safe attempts, and server-side scoring.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where auth_user_id = auth.uid()
      and access_level = 3
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

alter table public.exam_questions
  add column if not exists module_id bigint references public.modules (id) on delete cascade,
  add column if not exists question_text text,
  add column if not exists explanation text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.students (id) on delete set null,
  add column if not exists updated_by uuid references public.students (id) on delete set null,
  add column if not exists deleted_at timestamptz;

update public.exam_questions q
set
  module_id = coalesce(q.module_id, e.module_id),
  question_text = coalesce(q.question_text, q.question)
from public.exams e
where q.exam_id = e.id
  and (q.module_id is null or q.question_text is null);

alter table public.exam_questions
  alter column module_id set not null,
  alter column question_text set not null;

alter table public.exam_questions drop constraint if exists exam_questions_question_text_not_blank;
alter table public.exam_questions
  add constraint exam_questions_question_text_not_blank
  check (length(trim(question_text)) > 0);

create index if not exists idx_exam_questions_module_id
  on public.exam_questions (module_id);
create index if not exists idx_exam_questions_module_active
  on public.exam_questions (module_id, is_active)
  where is_active = true and deleted_at is null;

create table if not exists public.exam_answer_options (
  id bigserial primary key,
  question_id bigint not null references public.exam_questions (id) on delete cascade,
  option_text text not null check (length(trim(option_text)) > 0),
  is_correct boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_exam_answer_options_updated_at
  on public.exam_answer_options;
create trigger set_exam_answer_options_updated_at
  before update on public.exam_answer_options
  for each row
  execute function public.set_updated_at();

insert into public.exam_answer_options (question_id, option_text, is_correct, order_index)
select
  q.id,
  option_value.value #>> '{}',
  (option_value.value #>> '{}') = q.correct_answer,
  option_value.ordinality::integer
from public.exam_questions q
cross join lateral jsonb_array_elements(q.options) with ordinality as option_value(value, ordinality)
where not exists (
  select 1
  from public.exam_answer_options existing
  where existing.question_id = q.id
);

create index if not exists idx_exam_answer_options_question_id
  on public.exam_answer_options (question_id, order_index);

drop index if exists public.idx_exam_answer_options_one_correct;

with correct_option_keeper as (
  select
    question_id,
    min(id) as keep_id
  from public.exam_answer_options
  where is_correct = true
  group by question_id
),
ranked_correct_options as (
  select
    option_row.id,
    keeper.keep_id
  from public.exam_answer_options as option_row
  join correct_option_keeper keeper
    on keeper.question_id = option_row.question_id
  where option_row.is_correct = true
)
update public.exam_answer_options option_row
set is_correct = false
from ranked_correct_options ranked
where option_row.id = ranked.id
  and ranked.id <> ranked.keep_id;

create unique index idx_exam_answer_options_one_correct
  on public.exam_answer_options (question_id)
  where is_correct = true;

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  exam_id bigint not null references public.exams (id) on delete cascade,
  module_id bigint not null references public.modules (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  score integer check (score is null or score between 0 and 100),
  correct_count integer check (correct_count is null or correct_count >= 0),
  total_questions integer not null default 10 check (total_questions > 0),
  passed boolean,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_exam_attempts_updated_at
  on public.exam_attempts;
create trigger set_exam_attempts_updated_at
  before update on public.exam_attempts
  for each row
  execute function public.set_updated_at();

create index if not exists idx_exam_attempts_student_id
  on public.exam_attempts (student_id, created_at desc);
create index if not exists idx_exam_attempts_module_id
  on public.exam_attempts (module_id, created_at desc);
create index if not exists idx_exam_attempts_exam_id
  on public.exam_attempts (exam_id, created_at desc);
create index if not exists idx_exam_attempts_submitted_at
  on public.exam_attempts (submitted_at desc)
  where submitted_at is not null;
create index if not exists idx_exam_attempts_in_progress
  on public.exam_attempts (student_id, module_id, created_at desc)
  where status = 'in_progress';

create table if not exists public.exam_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id bigint not null references public.exam_questions (id) on delete restrict,
  order_index integer not null,
  question_snapshot text not null,
  explanation_snapshot text,
  options_snapshot jsonb not null check (jsonb_typeof(options_snapshot) = 'array'),
  correct_option_id bigint not null references public.exam_answer_options (id) on delete restrict,
  correct_option_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, order_index)
);

create index if not exists idx_exam_attempt_questions_attempt_id
  on public.exam_attempt_questions (attempt_id, order_index);
create index if not exists idx_exam_attempt_questions_question_id
  on public.exam_attempt_questions (question_id);

create table if not exists public.exam_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id bigint not null references public.exam_questions (id) on delete restrict,
  selected_option_id bigint not null references public.exam_answer_options (id) on delete restrict,
  is_correct boolean not null,
  question_snapshot text not null,
  selected_option_snapshot text not null,
  correct_option_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_exam_attempt_answers_attempt_id
  on public.exam_attempt_answers (attempt_id);
create index if not exists idx_exam_attempt_answers_question_id
  on public.exam_attempt_answers (question_id);

alter table public.exam_answer_options enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_questions enable row level security;
alter table public.exam_attempt_answers enable row level security;

drop policy if exists "exam_questions_select_published_exams" on public.exam_questions;
drop policy if exists "exam_results_insert_own" on public.exam_results;

drop policy if exists "exams_select_admin" on public.exams;
create policy "exams_select_admin"
  on public.exams for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exams_insert_admin" on public.exams;
create policy "exams_insert_admin"
  on public.exams for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "exams_update_admin" on public.exams;
create policy "exams_update_admin"
  on public.exams for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "exam_questions_select_admin" on public.exam_questions;
create policy "exam_questions_select_admin"
  on public.exam_questions for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_questions_insert_admin" on public.exam_questions;
create policy "exam_questions_insert_admin"
  on public.exam_questions for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "exam_questions_update_admin" on public.exam_questions;
create policy "exam_questions_update_admin"
  on public.exam_questions for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "exam_questions_delete_admin" on public.exam_questions;
create policy "exam_questions_delete_admin"
  on public.exam_questions for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_answer_options_select_admin" on public.exam_answer_options;
create policy "exam_answer_options_select_admin"
  on public.exam_answer_options for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_answer_options_insert_admin" on public.exam_answer_options;
create policy "exam_answer_options_insert_admin"
  on public.exam_answer_options for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "exam_answer_options_update_admin" on public.exam_answer_options;
create policy "exam_answer_options_update_admin"
  on public.exam_answer_options for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "exam_answer_options_delete_admin" on public.exam_answer_options;
create policy "exam_answer_options_delete_admin"
  on public.exam_answer_options for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_attempts_select_own" on public.exam_attempts;
create policy "exam_attempts_select_own"
  on public.exam_attempts for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = exam_attempts.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "exam_attempts_select_admin" on public.exam_attempts;
create policy "exam_attempts_select_admin"
  on public.exam_attempts for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_attempt_questions_select_admin" on public.exam_attempt_questions;
create policy "exam_attempt_questions_select_admin"
  on public.exam_attempt_questions for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "exam_attempt_answers_select_own_submitted" on public.exam_attempt_answers;
create policy "exam_attempt_answers_select_own_submitted"
  on public.exam_attempt_answers for select
  to authenticated
  using (
    exists (
      select 1
      from public.exam_attempts a
      join public.students s on s.id = a.student_id
      where a.id = exam_attempt_answers.attempt_id
        and a.status = 'submitted'
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "exam_attempt_answers_select_admin" on public.exam_attempt_answers;
create policy "exam_attempt_answers_select_admin"
  on public.exam_attempt_answers for select
  to authenticated
  using (public.is_platform_admin());

create or replace function public.serialize_exam_attempt(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attemptId', a.id,
    'examId', a.exam_id,
    'moduleId', a.module_id,
    'status', a.status,
    'score', a.score,
    'passed', a.passed,
    'totalQuestions', a.total_questions,
    'questions', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', aq.question_id,
          'questionText', aq.question_snapshot,
          'explanation', aq.explanation_snapshot,
          'options', aq.options_snapshot
        )
        order by aq.order_index
      ) filter (where aq.id is not null),
      '[]'::jsonb
    )
  )
  from public.exam_attempts a
  left join public.exam_attempt_questions aq on aq.attempt_id = a.id
  where a.id = p_attempt_id
    and (
      public.is_platform_admin()
      or exists (
        select 1
        from public.students s
        where s.id = a.student_id
          and s.auth_user_id = auth.uid()
      )
    )
  group by a.id;
$$;

create or replace function public.start_module_exam(p_module_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_exam_id bigint;
  v_attempt_id uuid;
  v_active_count integer;
  v_valid_count integer;
  v_module_order integer;
  v_can_access boolean := false;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    return jsonb_build_object('success', false, 'error', 'Je bent niet aangemeld.');
  end if;

  select order_index into v_module_order
  from public.modules
  where id = p_module_id
    and is_published = true;

  if v_module_order is null then
    return jsonb_build_object('success', false, 'error', 'Deze module is niet beschikbaar.');
  end if;

  v_can_access := v_module_order = 1;

  if not v_can_access and v_module_order <= 6 then
    select exists (
      select 1
      from public.student_onboarding_responses r
      where r.student_id = v_student_id
        and (
          r.completed_at is not null
          or (
            nullif(trim(coalesce(r.experience_level, '')), '') is not null
            and nullif(trim(coalesce(r.primary_market, '')), '') is not null
            and nullif(trim(coalesce(r.main_challenge, '')), '') is not null
            and nullif(trim(coalesce(r.goal_90_days, '')), '') is not null
            and nullif(trim(coalesce(r.weekly_time_commitment, '')), '') is not null
            and nullif(trim(coalesce(r.mentorship_interest, '')), '') is not null
          )
        )
    ) into v_can_access;
  end if;

  if not v_can_access then
    select exists (
      select 1
      from public.modules previous_module
      join public.exams previous_exam on previous_exam.module_id = previous_module.id
      join public.exam_results result on result.exam_id = previous_exam.id
      where previous_module.order_index = v_module_order - 1
        and previous_module.is_published = true
        and result.student_id = v_student_id
        and result.passed = true
    ) into v_can_access;
  end if;

  if not v_can_access then
    return jsonb_build_object('success', false, 'error', 'Deze module is nog vergrendeld.');
  end if;

  select id into v_exam_id
  from public.exams
  where module_id = p_module_id
    and is_published = true;

  if v_exam_id is null then
    return jsonb_build_object('success', false, 'error', 'Voor deze module is nog geen toets beschikbaar.');
  end if;

  select id into v_attempt_id
  from public.exam_attempts
  where student_id = v_student_id
    and module_id = p_module_id
    and exam_id = v_exam_id
    and status = 'in_progress'
  order by created_at desc
  limit 1;

  if v_attempt_id is not null then
    return jsonb_build_object('success', true, 'attempt', public.serialize_exam_attempt(v_attempt_id));
  end if;

  select count(*) into v_active_count
  from public.exam_questions
  where module_id = p_module_id
    and exam_id = v_exam_id
    and is_active = true
    and deleted_at is null;

  with valid_questions as (
    select q.id
    from public.exam_questions q
    join public.exam_answer_options o on o.question_id = q.id
    where q.module_id = p_module_id
      and q.exam_id = v_exam_id
      and q.is_active = true
      and q.deleted_at is null
    group by q.id
    having count(o.id) >= 2
       and count(o.id) filter (where o.is_correct) = 1
  )
  select count(*) into v_valid_count
  from valid_questions;

  if v_valid_count < 10 then
    return jsonb_build_object(
      'success', false,
      'error', 'Deze toets heeft nog niet genoeg geldige actieve vragen. Er zijn minimaal 10 vragen nodig.',
      'activeQuestionCount', v_active_count,
      'validQuestionCount', v_valid_count
    );
  end if;

  insert into public.exam_attempts (student_id, exam_id, module_id, total_questions)
  values (v_student_id, v_exam_id, p_module_id, 10)
  returning id into v_attempt_id;

  with selected_questions as (
    select q.id, q.question_text, q.explanation, row_number() over (order by random()) as order_index
    from public.exam_questions q
    where q.module_id = p_module_id
      and q.exam_id = v_exam_id
      and q.is_active = true
      and q.deleted_at is null
      and (
        select count(*)
        from public.exam_answer_options o
        where o.question_id = q.id
      ) >= 2
      and (
        select count(*)
        from public.exam_answer_options o
        where o.question_id = q.id
          and o.is_correct
      ) = 1
    order by random()
    limit 10
  ),
  question_payload as (
    select
      sq.id as question_id,
      sq.order_index,
      sq.question_text,
      sq.explanation,
      correct.id as correct_option_id,
      correct.option_text as correct_option_snapshot,
      (
        select jsonb_agg(
          jsonb_build_object('id', shuffled.id, 'optionText', shuffled.option_text)
          order by shuffled.random_order
        )
        from (
          select o.id, o.option_text, random() as random_order
          from public.exam_answer_options o
          where o.question_id = sq.id
        ) shuffled
      ) as options_snapshot
    from selected_questions sq
    join public.exam_answer_options correct
      on correct.question_id = sq.id
     and correct.is_correct = true
  )
  insert into public.exam_attempt_questions (
    attempt_id,
    question_id,
    order_index,
    question_snapshot,
    explanation_snapshot,
    options_snapshot,
    correct_option_id,
    correct_option_snapshot
  )
  select
    v_attempt_id,
    question_id,
    order_index,
    question_text,
    explanation,
    options_snapshot,
    correct_option_id,
    correct_option_snapshot
  from question_payload;

  return jsonb_build_object('success', true, 'attempt', public.serialize_exam_attempt(v_attempt_id));
end;
$$;

create or replace function public.submit_module_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_attempt_id uuid;
  v_attempt_exam_id bigint;
  v_attempt_status text;
  v_attempt_score integer;
  v_attempt_total_questions integer;
  v_attempt_passed boolean;
  v_answer_count integer;
  v_correct_count integer;
  v_score integer;
  v_passing_score integer;
  v_passed boolean;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    return jsonb_build_object('success', false, 'error', 'Je bent niet aangemeld.');
  end if;

  select
    id,
    exam_id,
    status,
    score,
    total_questions,
    passed
  into
    v_attempt_id,
    v_attempt_exam_id,
    v_attempt_status,
    v_attempt_score,
    v_attempt_total_questions,
    v_attempt_passed
  from public.exam_attempts
  where id = p_attempt_id
    and student_id = v_student_id;

  if v_attempt_id is null then
    return jsonb_build_object('success', false, 'error', 'Deze poging bestaat niet.');
  end if;

  if v_attempt_status = 'submitted' then
    return jsonb_build_object(
      'success', true,
      'score', v_attempt_score,
      'passed', v_attempt_passed,
      'alreadySubmitted', true
    );
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Ongeldige antwoorden.');
  end if;

  create temporary table tmp_exam_submission_answers (
    question_id bigint not null,
    selected_option_id bigint not null
  ) on commit drop;

  insert into tmp_exam_submission_answers (question_id, selected_option_id)
  select
    (value->>'questionId')::bigint,
    (value->>'selectedOptionId')::bigint
  from jsonb_array_elements(p_answers)
  where value ? 'questionId'
    and value ? 'selectedOptionId';

  select count(*) into v_answer_count
  from tmp_exam_submission_answers;

  if v_answer_count <> v_attempt_total_questions then
    return jsonb_build_object('success', false, 'error', 'Beantwoord alle vragen voordat je de toets indient.');
  end if;

  if (
    select count(distinct question_id)
    from tmp_exam_submission_answers
  ) <> v_answer_count then
    return jsonb_build_object('success', false, 'error', 'Een vraag is meerdere keren beantwoord.');
  end if;

  if exists (
    select 1
    from tmp_exam_submission_answers submitted
    left join public.exam_attempt_questions aq
      on aq.attempt_id = v_attempt_id
     and aq.question_id = submitted.question_id
    where aq.id is null
  ) then
    return jsonb_build_object('success', false, 'error', 'Een of meer antwoorden horen niet bij deze poging.');
  end if;

  if exists (
    select 1
    from tmp_exam_submission_answers submitted
    join public.exam_attempt_questions aq
      on aq.attempt_id = v_attempt_id
     and aq.question_id = submitted.question_id
    where not exists (
      select 1
      from jsonb_array_elements(aq.options_snapshot) option_row
      where (option_row->>'id')::bigint = submitted.selected_option_id
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Een of meer antwoorden zijn ongeldig.');
  end if;

  insert into public.exam_attempt_answers (
    attempt_id,
    question_id,
    selected_option_id,
    is_correct,
    question_snapshot,
    selected_option_snapshot,
    correct_option_snapshot
  )
  select
    v_attempt_id,
    aq.question_id,
    submitted.selected_option_id,
    submitted.selected_option_id = aq.correct_option_id,
    aq.question_snapshot,
    selected_snapshot.option_text,
    aq.correct_option_snapshot
  from tmp_exam_submission_answers submitted
  join public.exam_attempt_questions aq
    on aq.attempt_id = v_attempt_id
   and aq.question_id = submitted.question_id
  join lateral (
    select option_row->>'optionText' as option_text
    from jsonb_array_elements(aq.options_snapshot) option_row
    where (option_row->>'id')::bigint = submitted.selected_option_id
    limit 1
  ) selected_snapshot on true
  order by aq.order_index;

  select count(*) into v_correct_count
  from public.exam_attempt_answers
  where attempt_id = v_attempt_id
    and is_correct = true;

  v_score := round((v_correct_count::numeric / v_attempt_total_questions::numeric) * 100)::integer;

  select passing_score into v_passing_score
  from public.exams
  where id = v_attempt_exam_id;

  v_passed := v_score >= coalesce(v_passing_score, 70);

  update public.exam_attempts
  set
    status = 'submitted',
    score = v_score,
    correct_count = v_correct_count,
    passed = v_passed,
    submitted_at = now()
  where id = v_attempt_id;

  insert into public.exam_results (student_id, exam_id, score, passed)
  values (v_student_id, v_attempt_exam_id, v_score, v_passed);

  return jsonb_build_object(
    'success', true,
    'score', v_score,
    'passed', v_passed,
    'correctCount', v_correct_count,
    'totalQuestions', v_attempt_total_questions
  );
end;
$$;

grant execute on function public.start_module_exam(bigint) to authenticated;
grant execute on function public.submit_module_exam(uuid, jsonb) to authenticated;
