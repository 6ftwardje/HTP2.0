-- Notify mentors/admins once when a student completes the sales intake.

create unique index if not exists notification_events_student_intake_completed_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'student_intake.completed'
    and target_table = 'students';

create or replace function public.notify_student_intake_completed(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_response public.student_onboarding_responses%rowtype;
  v_event_id uuid;
  v_recipient_count integer := 0;
begin
  select *
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'student_not_found');
  end if;

  if not (
    public.is_platform_admin()
    or v_student.auth_user_id = auth.uid()
  ) then
    raise exception 'Not allowed to notify intake completion for this student'
      using errcode = '42501';
  end if;

  select *
  into v_response
  from public.student_onboarding_responses
  where student_id = p_student_id;

  if not found
    or v_response.completed_at is null
    or nullif(trim(coalesce(v_response.experience_level, '')), '') is null
    or nullif(trim(coalesce(v_response.primary_market, '')), '') is null
    or nullif(trim(coalesce(v_response.main_challenge, '')), '') is null
    or nullif(trim(coalesce(v_response.goal_90_days, '')), '') is null
    or nullif(trim(coalesce(v_response.weekly_time_commitment, '')), '') is null
    or nullif(trim(coalesce(v_response.mentorship_interest, '')), '') is null
    or v_response.confidence_score is null
    or v_response.confidence_score < 1
    or v_response.confidence_score > 5
  then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'intake_incomplete');
  end if;

  select id
  into v_event_id
  from public.notification_events
  where type = 'student_intake.completed'
    and target_table = 'students'
    and target_id = p_student_id::text
  limit 1;

  if v_event_id is null then
    insert into public.notification_events (
      type,
      actor_student_id,
      target_table,
      target_id,
      title,
      body,
      href,
      metadata
    )
    values (
      'student_intake.completed',
      p_student_id,
      'students',
      p_student_id::text,
      'Nieuwe intake ingevuld',
      coalesce(nullif(trim(v_student.name), ''), v_student.email) || ' heeft de intake afgerond.',
      '/admin/students/' || p_student_id::text,
      jsonb_build_object(
        'student_id', p_student_id,
        'student_email', v_student.email,
        'access_level', v_student.access_level,
        'completed_at', v_response.completed_at,
        'experience_level', v_response.experience_level,
        'primary_market', v_response.primary_market,
        'weekly_time_commitment', v_response.weekly_time_commitment,
        'mentorship_interest', v_response.mentorship_interest,
        'confidence_score', v_response.confidence_score
      )
    )
    on conflict (type, target_table, target_id)
      where type = 'student_intake.completed'
        and target_table = 'students'
    do nothing
    returning id into v_event_id;

    if v_event_id is null then
      select id
      into v_event_id
      from public.notification_events
      where type = 'student_intake.completed'
        and target_table = 'students'
        and target_id = p_student_id::text
      limit 1;
    end if;
  end if;

  if v_event_id is null then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'event_not_created');
  end if;

  insert into public.notification_recipients (event_id, student_id)
  select v_event_id, s.id
  from public.students s
  where s.access_level = 3
    and s.id <> p_student_id
  on conflict (event_id, student_id) do nothing;

  get diagnostics v_recipient_count = row_count;

  return jsonb_build_object(
    'notified', v_recipient_count,
    'skipped', v_recipient_count = 0,
    'event_id', v_event_id
  );
end;
$$;

grant execute on function public.notify_student_intake_completed(uuid) to authenticated;
