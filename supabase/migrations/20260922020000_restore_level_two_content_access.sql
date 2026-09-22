-- Keep the prepared subscription model dormant until its public rollout.
-- Existing level-2 Academy members retain access to all published market
-- insight content, regardless of the prepared subscription access tier.

drop policy if exists "weekly_updates_select_subscription" on public.weekly_updates;
create policy "weekly_updates_select_subscription"
  on public.weekly_updates for select to authenticated
  using (
    is_published = true
    and access_tier = 'subscription'
    and (type in ('weekly_outlook', 'market_update', 'live_session') or type is null)
    and exists (
      select 1
      from public.students student
      where student.auth_user_id = auth.uid()
        and student.access_level >= 2
    )
  );

drop policy if exists "live_sessions_select_subscriber" on public.live_sessions;
create policy "live_sessions_select_subscriber"
  on public.live_sessions for select to authenticated
  using (
    is_published = true
    and status in ('scheduled', 'live', 'completed', 'cancelled')
    and exists (
      select 1
      from public.students student
      where student.auth_user_id = auth.uid()
        and student.access_level >= 2
    )
  );
