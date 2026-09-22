-- Weekly Outlook live-session calendar. Provider join URLs are stored separately
-- so normal table reads can never expose them to clients.

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  display_timezone text not null default 'Europe/Brussels',
  mentor_student_id uuid references public.students (id) on delete set null,
  created_by_student_id uuid references public.students (id) on delete set null,
  provider text not null default 'clickmeeting'
    check (provider in ('clickmeeting', 'external')),
  provider_event_id text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'live', 'completed', 'cancelled')),
  is_published boolean not null default false,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  replay_weekly_update_id bigint references public.weekly_updates (id) on delete set null,
  replay_available_from timestamptz,
  replay_available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    replay_available_until is null
    or replay_available_from is null
    or replay_available_until >= replay_available_from + interval '28 days'
  ),
  check (
    status <> 'cancelled'
    or (cancelled_at is not null and length(trim(coalesce(cancellation_reason, ''))) > 0)
  )
);

create table if not exists public.live_session_provider_secrets (
  live_session_id uuid primary key references public.live_sessions (id) on delete cascade,
  external_join_url text not null check (external_join_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_sessions_upcoming
  on public.live_sessions (starts_at)
  where is_published = true and status in ('scheduled', 'live');
create index if not exists idx_live_sessions_archive
  on public.live_sessions (starts_at desc)
  where is_published = true and status in ('completed', 'cancelled');
create index if not exists idx_live_sessions_mentor
  on public.live_sessions (mentor_student_id, starts_at desc);

drop trigger if exists set_live_sessions_updated_at on public.live_sessions;
create trigger set_live_sessions_updated_at
  before update on public.live_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_live_session_provider_secrets_updated_at
  on public.live_session_provider_secrets;
create trigger set_live_session_provider_secrets_updated_at
  before update on public.live_session_provider_secrets
  for each row execute function public.set_updated_at();

alter table public.live_sessions enable row level security;
alter table public.live_session_provider_secrets enable row level security;

create policy "live_sessions_select_subscriber"
  on public.live_sessions for select to authenticated
  using (
    is_published = true
    and status in ('scheduled', 'live', 'completed', 'cancelled')
    and public.has_active_entitlement('subscriber_content')
  );

create policy "live_sessions_select_admin"
  on public.live_sessions for select to authenticated
  using (public.is_platform_admin());

create policy "live_sessions_insert_admin"
  on public.live_sessions for insert to authenticated
  with check (public.is_platform_admin());

create policy "live_sessions_update_admin"
  on public.live_sessions for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "live_sessions_delete_admin"
  on public.live_sessions for delete to authenticated
  using (public.is_platform_admin());

-- Provider secrets have no authenticated policy. Only trusted server code using
-- the service role can read or mutate the external join URL.

create unique index if not exists notification_events_live_session_scheduled_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'live_session.scheduled' and target_table = 'live_sessions';

create unique index if not exists notification_events_live_session_cancelled_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'live_session.cancelled' and target_table = 'live_sessions';
