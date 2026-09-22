-- Keep the exam-start gate aligned with lib/module-gate.ts.
-- Paid Academy students (access_level >= 2) can access every published module.

create or replace function public.start_module_exam(p_module_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_student_access_level smallint;
  v_exam_id bigint;
  v_attempt_id uuid;
  v_active_count integer;
  v_valid_count integer;
  v_module_order integer;
  v_can_access boolean := false;
begin
  select id, access_level
  into v_student_id, v_student_access_level
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

  -- This must mirror buildModuleAccessMap(): full-course accounts can open
  -- every published Academy module, regardless of the previous exam result.
  v_can_access := v_student_access_level >= 2 or v_module_order = 1;

  if not v_can_access and v_module_order <= 3 then
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

grant execute on function public.start_module_exam(bigint) to authenticated;
