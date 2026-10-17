-- F2: preserve the optimized participant-aware visibility query; change only
-- badge age, five-item preview and type metadata. No new event visibility.
begin;
create or replace function public.get_my_notification_shell()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid := public.current_chat_mentor_id();
  v_is_admin boolean;
  v_result jsonb;
begin
  if v_student_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select s.access_level = 3 into v_is_admin from public.students s where s.id = v_student_id;
  with my_threads as materialized (
    select cp.thread_id, cp.role
    from public.conversation_participants cp
    join public.chat_principals p on p.id = cp.principal_id
    join public.conversation_threads t on t.id = cp.thread_id
    where p.kind = 'human' and p.student_id = v_student_id
      and cp.active and cp.revoked_at is null and t.source_type = 'mentor_chat'
      and public.chat_participant_role(t.id) = cp.role
  ), own_events as materialized (
    select nr.id, nr.created_at, nr.read_at, ne.type, ne.title, ne.body, ne.href,
      ne.target_table, ne.metadata,
      case
        when ne.target_table = 'conversation_threads'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ne.target_id::uuid
        when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (ne.metadata ->> 'thread_id')::uuid
        when ne.target_table = 'conversation_messages'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
        else null
      end thread_id
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    where nr.student_id = v_student_id and nr.archived_at is null
  ), classified as materialized (
    select e.*, case when t.id is not null and t.source_type <> 'mentor_chat' then false
      else e.type in ('mentor_new_message', 'mentor_reply')
        or e.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
        or e.metadata ? 'thread_id' end is_chat
    from own_events e left join public.conversation_threads t on t.id = e.thread_id
  ), visible as materialized (
    select e.id, e.created_at, e.read_at, e.type, e.title, e.body, e.href
    from classified e left join my_threads mt on mt.thread_id = e.thread_id
    where case when e.is_chat then mt.thread_id is not null
      and (e.type <> 'mentor_new_message' or mt.role = 'mentor')
      and (e.type <> 'mentor_reply' or mt.role = 'student')
    else v_is_admin or e.type in ('mentor_reply', 'weekly_update.published',
      'live_session.scheduled', 'live_session.cancelled',
      'subscription.bonus_expired', 'subscription.payment_failed') end
  )
  select jsonb_build_object(
    'version', 2,
    'studentId', v_student_id,
    'unreadCount', (select count(*) from visible where read_at is null and created_at >= now() - interval '720 hours'),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'created_at', r.created_at, 'read_at', r.read_at,
        'event', jsonb_build_object('type', r.type, 'title', r.title, 'body', r.body, 'href', r.href)
      ) order by r.created_at desc, r.id desc)
      from (select * from visible order by created_at desc, id desc limit 5) r
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;


revoke all on function public.get_my_notification_shell() from public, anon;
grant execute on function public.get_my_notification_shell() to authenticated, service_role;
comment on function public.get_my_notification_shell() is
  'F2 v2: own visible unread deliveries up to 30 days; five recent deliveries with type. Preserves participant privacy.';

-- Paginate all visible history, including old unread deliveries. SECURITY INVOKER
-- deliberately keeps the existing event/recipient RLS and role demotion checks.
create or replace function public.get_my_notifications_page(p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_result jsonb;
begin
  if v_student_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_limit < 1 or p_limit > 50 or p_offset < 0 or p_offset > 1000000 or p_limit is null or p_offset is null then
    raise exception 'invalid pagination' using errcode = '22023';
  end if;
  with visible as materialized (
    select nr.id, nr.event_id, nr.student_id, nr.read_at, nr.archived_at, nr.created_at,
      jsonb_build_object('id',ne.id,'type',ne.type,'actor_student_id',ne.actor_student_id,
        'target_table',ne.target_table,'target_id',ne.target_id,'title',ne.title,
        'body',ne.body,'href',ne.href,'metadata',ne.metadata,'created_at',ne.created_at) event
    from public.notification_recipients nr join public.notification_events ne on ne.id=nr.event_id
    where nr.student_id=v_student_id and nr.archived_at is null
  )
  select jsonb_build_object(
    'totalCount',(select count(*) from visible),
    'unreadTotal',(select count(*) from visible where read_at is null),
    'notifications',coalesce((
      select jsonb_agg(to_jsonb(r) order by (r.read_at is null) desc,r.created_at desc,r.id desc)
      from (select * from visible order by (read_at is null) desc,created_at desc,id desc limit p_limit offset p_offset) r
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_my_notifications_page(integer,integer) from public, anon;
grant execute on function public.get_my_notifications_page(integer,integer) to authenticated, service_role;
create index if not exists notification_recipients_own_history
  on public.notification_recipients(student_id, (read_at is null) desc, created_at desc, id desc)
  where archived_at is null;
commit;
