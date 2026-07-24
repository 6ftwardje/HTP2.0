create or replace function public.get_my_notification_shell()
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
    'unreadCount', (
      select count(*)
      from public.notification_recipients nr
      where nr.student_id = v_student_id
        and nr.read_at is null
        and nr.archived_at is null
    ),
    'notifications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'created_at', recent.created_at,
          'read_at', recent.read_at,
          'event', jsonb_build_object(
            'title', recent.title,
            'body', recent.body,
            'href', recent.href
          )
        )
        order by recent.created_at desc
      )
      from (
        select
          nr.id,
          nr.created_at,
          nr.read_at,
          ne.title,
          ne.body,
          ne.href
        from public.notification_recipients nr
        join public.notification_events ne on ne.id = nr.event_id
        where nr.student_id = v_student_id
          and nr.archived_at is null
        order by nr.created_at desc
        limit 8
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_notification_shell() from public;
revoke all on function public.get_my_notification_shell() from anon;
grant execute on function public.get_my_notification_shell() to authenticated;
grant execute on function public.get_my_notification_shell() to service_role;

comment on function public.get_my_notification_shell() is
  'Exact unread count plus eight recent shell notifications for auth.uid(); security invoker and RLS-backed.';
