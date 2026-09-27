-- A recipient row can outlive a staff role. Treat it as delivery history, not
-- authorization to read staff-only notification contents after demotion.
-- This is additive to the notification tables and does not alter subscriptions.

create or replace function public.can_read_notification_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.notification_events ne
      join public.notification_recipients nr on nr.event_id = ne.id
      join public.students s on s.id = nr.student_id
      where ne.id = p_event_id
        and s.auth_user_id = auth.uid()
        -- Fail closed for newly introduced event types until they are reviewed.
        and ne.type in (
          'mentor_reply',
          'weekly_update.published',
          'live_session.scheduled',
          'live_session.cancelled',
          'subscription.bonus_expired',
          'subscription.payment_failed'
        )
    );
$$;

revoke all on function public.can_read_notification_event(uuid) from public;
revoke all on function public.can_read_notification_event(uuid) from anon;
grant execute on function public.can_read_notification_event(uuid) to authenticated;

comment on function public.can_read_notification_event(uuid) is
  'Current admins may read staff notifications; students may read only their own explicitly student-visible event types. SECURITY DEFINER avoids cross-table RLS recursion.';

drop policy if exists "notification_events_select_recipients" on public.notification_events;
create policy "notification_events_select_recipients"
  on public.notification_events for select
  to authenticated
  using (public.can_read_notification_event(id));

drop policy if exists "notification_recipients_select_own" on public.notification_recipients;
create policy "notification_recipients_select_own"
  on public.notification_recipients for select
  to authenticated
  using (
    public.is_platform_admin()
    or (
      exists (
        select 1 from public.students s
        where s.id = notification_recipients.student_id
          and s.auth_user_id = auth.uid()
      )
      and public.can_read_notification_event(event_id)
    )
  );

drop policy if exists "notification_recipients_update_own" on public.notification_recipients;
create policy "notification_recipients_update_own"
  on public.notification_recipients for update
  to authenticated
  using (
    public.is_platform_admin()
    or (
      exists (
        select 1 from public.students s
        where s.id = notification_recipients.student_id
          and s.auth_user_id = auth.uid()
      )
      and public.can_read_notification_event(event_id)
    )
  )
  with check (
    public.is_platform_admin()
    or (
      exists (
        select 1 from public.students s
        where s.id = notification_recipients.student_id
          and s.auth_user_id = auth.uid()
      )
      and public.can_read_notification_event(event_id)
    )
  );

-- RLS protects the tables, and the read model applies the same check itself
-- so a future policy change cannot silently reintroduce a stale shell count.
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
        and public.can_read_notification_event(nr.event_id)
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
          and public.can_read_notification_event(nr.event_id)
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
  'Exact unread count plus eight recent notifications for auth.uid(); RLS-backed and role-aware after staff demotion.';
