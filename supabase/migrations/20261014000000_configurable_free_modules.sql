-- Free Academy access is an explicit module setting, independent of order.
-- Existing modules_insert_admin/modules_update_admin policies also cover this
-- column; no new table grants or mutation policies are needed.
alter table public.modules
  add column is_free boolean not null default false;

comment on column public.modules.is_free is
  'Free level-1 access after intake; managed by platform admins. Reordering does not change access.';

-- One-time rollout: the first six published modules become free. Drafts and
-- modules created after this migration keep the paid-by-default setting.
update public.modules
set is_free = true
where id in (
  select m.id
  from public.modules m
  where m.is_published
  order by m.order_index, m.id
  limit 6
);

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
    select 1 from public.modules m
    where m.id = p_module_id and m.is_published and m.is_free
  );
end;
$$;

revoke all on function public.can_open_academy_module(bigint) from public, anon;
grant execute on function public.can_open_academy_module(bigint) to authenticated;

-- The existing lesson-preview, progress, exam-start/submission and answer
-- policies continue to call this helper, preserving their intake/lesson gates.

-- Remove the obsolete order-based gate inside the private exam implementation.
create or replace function public.start_module_exam_unchecked(p_module_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_exam_id bigint;
  v_attempt_id uuid;
  v_active_count integer;
  v_valid_count integer;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    return jsonb_build_object('success', false, 'error', 'Je bent niet aangemeld.');
  end if;

  -- The public wrapper additionally requires every published lesson watched.
  -- Reuse the same entitlement helper here instead of a second order gate.
  if not public.can_open_academy_module(p_module_id) then
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

revoke all on function public.start_module_exam_unchecked(bigint) from public, anon, authenticated;

-- Include the setting in the existing RLS-backed dashboard projection.
create or replace function public.get_my_dashboard_read_model()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_student_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select s.id
    into v_student_id
    from public.students s
   where s.auth_user_id = v_auth_user_id;

  if v_student_id is null then
    raise exception 'student not found'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'studentId', v_student_id,
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'title', m.title,
          'slug', m.slug,
          'description', m.description,
          'short_description', m.short_description,
          'order_index', m.order_index,
          'thumbnail_url', m.thumbnail_url,
          'is_published', m.is_published,
          'is_free', m.is_free
        )
        order by m.order_index, m.id
      )
      from public.modules m
      where m.is_published = true
    ), '[]'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'module_id', l.module_id,
          'type', l.type,
          'title', l.title,
          'slug', l.slug,
          'description', l.description,
          'takeaway', l.takeaway,
          'action_items', l.action_items,
          'thumbnail_url', l.thumbnail_url,
          'order_index', l.order_index,
          'is_published', l.is_published
        )
        order by l.module_id, l.order_index
      )
      from public.lessons l
      where l.is_published = true
    ), '[]'::jsonb),
    'exams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'module_id', e.module_id,
          'title', e.title,
          'description', e.description,
          'passing_score', e.passing_score,
          'is_published', e.is_published
        )
        order by e.module_id
      )
      from public.exams e
      where e.is_published = true
    ), '[]'::jsonb),
    'onboarding', (
      select jsonb_build_object(
        'id', o.id,
        'student_id', o.student_id,
        'experience_level', o.experience_level,
        'primary_market', o.primary_market,
        'main_challenge', o.main_challenge,
        'goal_90_days', o.goal_90_days,
        'weekly_time_commitment', o.weekly_time_commitment,
        'mentorship_interest', o.mentorship_interest,
        'confidence_score', o.confidence_score
      )
      from public.student_onboarding_responses o
      where o.student_id = v_student_id
      limit 1
    ),
    'passedExamIds', coalesce((
      select jsonb_agg(distinct r.exam_id)
      from public.exam_results r
      where r.student_id = v_student_id
        and r.passed = true
    ), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'lesson_id', p.lesson_id,
          'watched', p.watched,
          'watched_at', p.watched_at
        )
        order by p.lesson_id
      )
      from public.progress p
      where p.student_id = v_student_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_dashboard_read_model() from public;
revoke all on function public.get_my_dashboard_read_model() from anon;
grant execute on function public.get_my_dashboard_read_model() to authenticated;
grant execute on function public.get_my_dashboard_read_model() to service_role;

comment on function public.get_my_dashboard_read_model() is
  'Narrow RLS-backed dashboard payload for the current auth.uid(); no caller-supplied student id.';
