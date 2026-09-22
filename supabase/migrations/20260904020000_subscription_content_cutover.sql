-- Launch cutover. Apply this migration together with the application release,
-- never during the additive billing-schema preparation phase.

update public.weekly_updates
set access_tier = 'subscription'
where type in ('weekly_outlook', 'market_update', 'live_session');

drop policy if exists "weekly_updates_select_subscription" on public.weekly_updates;
create policy "weekly_updates_select_subscription"
  on public.weekly_updates for select to authenticated
  using (
    is_published = true
    and access_tier = 'subscription'
    and type in ('weekly_outlook', 'market_update')
    and public.has_active_entitlement('subscriber_content')
  );

-- Existing Academy customers receive one complimentary month beginning at
-- the actual cutover. New Academy purchases receive three months through the
-- Stripe webhook and never become an automatically renewing subscription.
insert into public.student_entitlements (
  student_id,
  entitlement_key,
  source_type,
  source_id,
  starts_at,
  ends_at,
  metadata
)
select
  student.id,
  'subscriber_content',
  'legacy_academy_bonus',
  'subscription-launch-2026-09',
  now(),
  now() + interval '1 month',
  jsonb_build_object('months', 1, 'reason', 'existing_academy_customer')
from public.students student
where student.access_level = 2
on conflict (student_id, entitlement_key, source_type, source_id) do nothing;
