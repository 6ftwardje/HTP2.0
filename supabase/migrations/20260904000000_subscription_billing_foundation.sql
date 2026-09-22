-- Subscription billing foundation for the EUR 99/month market-content product.
-- Product access is deliberately independent from Academy access_level and staff roles.

create table if not exists public.user_roles (
  student_id uuid not null references public.students (id) on delete cascade,
  role text not null check (role in ('student', 'mentor', 'content_manager', 'admin')),
  created_at timestamptz not null default now(),
  primary key (student_id, role)
);

-- Preserve the existing level-3 admin population while roles are migrated gradually.
insert into public.user_roles (student_id, role)
select id, 'admin'
from public.students
where access_level = 3
on conflict (student_id, role) do nothing;

create table if not exists public.billing_customers (
  student_id uuid primary key references public.students (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  stripe_price_id text not null,
  status text not null check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  trial_end timestamptz,
  latest_invoice_id text,
  last_stripe_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_student_updated
  on public.subscriptions (student_id, updated_at desc);
create index if not exists idx_subscriptions_customer
  on public.subscriptions (stripe_customer_id);
create index if not exists idx_subscriptions_status
  on public.subscriptions (status);

create table if not exists public.student_entitlements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_]*$'),
  source_type text not null check (
    source_type in ('stripe_subscription', 'academy_bonus', 'legacy_academy_bonus', 'manual')
  ),
  source_id text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, entitlement_key, source_type, source_id),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists idx_student_entitlements_active
  on public.student_entitlements (student_id, entitlement_key, starts_at, ends_at)
  where revoked_at is null;

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'completed', 'failed')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.one_time_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  product_key text not null check (product_key in ('academy')),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text not null,
  stripe_price_id text not null,
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  payment_status text not null check (payment_status in ('paid', 'refunded', 'disputed')),
  purchased_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_one_time_purchases_student
  on public.one_time_purchases (student_id, purchased_at desc);
create unique index if not exists idx_one_time_purchases_payment_intent
  on public.one_time_purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

drop trigger if exists set_billing_customers_updated_at on public.billing_customers;
create trigger set_billing_customers_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists set_student_entitlements_updated_at on public.student_entitlements;
create trigger set_student_entitlements_updated_at
  before update on public.student_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists set_stripe_webhook_events_updated_at on public.stripe_webhook_events;
create trigger set_stripe_webhook_events_updated_at
  before update on public.stripe_webhook_events
  for each row execute function public.set_updated_at();

drop trigger if exists set_one_time_purchases_updated_at on public.one_time_purchases;
create trigger set_one_time_purchases_updated_at
  before update on public.one_time_purchases
  for each row execute function public.set_updated_at();

create or replace function public.has_active_entitlement(p_entitlement_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.student_entitlements entitlement
      join public.students student on student.id = entitlement.student_id
      where student.auth_user_id = auth.uid()
        and entitlement.entitlement_key = p_entitlement_key
        and entitlement.revoked_at is null
        and entitlement.starts_at <= now()
        and (entitlement.ends_at is null or entitlement.ends_at > now())
    );
$$;

revoke all on function public.has_active_entitlement(text) from public;
grant execute on function public.has_active_entitlement(text) to authenticated;

alter table public.user_roles enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.student_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.one_time_purchases enable row level security;

create policy "user_roles_select_own_or_admin"
  on public.user_roles for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students student
      where student.id = user_roles.student_id
        and student.auth_user_id = auth.uid()
    )
  );

create policy "user_roles_manage_admin"
  on public.user_roles for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "billing_customers_select_own_or_admin"
  on public.billing_customers for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students student
      where student.id = billing_customers.student_id
        and student.auth_user_id = auth.uid()
    )
  );

create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students student
      where student.id = subscriptions.student_id
        and student.auth_user_id = auth.uid()
    )
  );

create policy "student_entitlements_select_own_or_admin"
  on public.student_entitlements for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students student
      where student.id = student_entitlements.student_id
        and student.auth_user_id = auth.uid()
    )
  );

create policy "one_time_purchases_select_own_or_admin"
  on public.one_time_purchases for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.students student
      where student.id = one_time_purchases.student_id
        and student.auth_user_id = auth.uid()
    )
  );

-- No authenticated policies intentionally exist for mutating billing data or
-- reading webhook receipts. These operations use the server-only service role.

create unique index if not exists notification_events_bonus_expired_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'subscription.bonus_expired'
    and target_table = 'student_entitlements';

create unique index if not exists notification_events_payment_failed_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'subscription.payment_failed'
    and target_table = 'stripe_invoices';

alter table public.weekly_updates
  drop constraint if exists weekly_updates_access_tier_check;
alter table public.weekly_updates
  add constraint weekly_updates_access_tier_check
  check (access_tier in ('free', 'full_course', 'subscription', 'premium', 'mentor_membership'));
