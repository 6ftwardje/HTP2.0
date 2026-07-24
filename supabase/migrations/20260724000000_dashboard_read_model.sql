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
          'is_published', m.is_published
        )
        order by m.order_index
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
