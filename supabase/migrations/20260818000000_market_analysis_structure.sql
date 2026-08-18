-- Refactor Weekly Updates into the categorized Market Analysis library.
-- The existing table name stays in place to preserve watch history, Mux assets,
-- notification targets and RLS policies.

alter table public.weekly_updates
  add column if not exists type text;

-- Known legacy market labels can be migrated without ambiguity.
update public.weekly_updates
set
  type = 'market_update',
  market = lower(trim(market))
where lower(trim(coalesce(market, ''))) in ('stocks', 'forex', 'crypto');

-- A single marketless item in a week is the best safe match for the weekly
-- outlook. When there are duplicates, only the newest is assigned and the rest
-- remain visible in the admin's uncategorized list.
with ranked_marketless as (
  select
    id,
    date_trunc('week', week_start_date::timestamp)::date as week_monday,
    row_number() over (
      partition by date_trunc('week', week_start_date::timestamp)::date
      order by published_at desc nulls last, created_at desc, id desc
    ) as position_in_week
  from public.weekly_updates
  where market is null and type is null
)
update public.weekly_updates as update_row
set
  type = 'weekly_outlook',
  week_start_date = ranked_marketless.week_monday
from ranked_marketless
where update_row.id = ranked_marketless.id
  and ranked_marketless.position_in_week = 1;

-- Invalid legacy market labels are deliberately not guessed.
update public.weekly_updates
set market = null
where market is not null
  and lower(trim(market)) not in ('stocks', 'forex', 'crypto');

-- Preserve a useful publication date for already-published legacy content.
update public.weekly_updates
set published_at = created_at
where is_published = true and published_at is null;

alter table public.weekly_updates
  drop constraint if exists weekly_updates_type_check;
alter table public.weekly_updates
  add constraint weekly_updates_type_check
  check (type is null or type in ('weekly_outlook', 'market_update', 'live_session'));

alter table public.weekly_updates
  drop constraint if exists weekly_updates_market_check;
alter table public.weekly_updates
  add constraint weekly_updates_market_check
  check (market is null or market in ('stocks', 'forex', 'crypto'));

alter table public.weekly_updates
  drop constraint if exists weekly_updates_type_market_check;
alter table public.weekly_updates
  add constraint weekly_updates_type_market_check
  check (
    type is null
    or (type = 'market_update' and market is not null)
    or (type in ('weekly_outlook', 'live_session') and market is null)
  );

create unique index if not exists weekly_updates_one_outlook_per_week
  on public.weekly_updates (week_start_date)
  where type = 'weekly_outlook';

create index if not exists idx_weekly_updates_published_type_date
  on public.weekly_updates (type, published_at desc, created_at desc)
  where is_published = true;

create index if not exists idx_weekly_updates_market_updates
  on public.weekly_updates (market, published_at desc, created_at desc)
  where is_published = true and type = 'market_update';

-- Uncategorized and future live-session records stay admin-only until they are
-- deliberately supported on the member side.
drop policy if exists "weekly_updates_select_published_free" on public.weekly_updates;
create policy "weekly_updates_select_published_free"
  on public.weekly_updates for select
  to authenticated
  using (
    is_published = true
    and access_tier = 'free'
    and type in ('weekly_outlook', 'market_update')
  );

drop policy if exists "weekly_updates_select_full_course" on public.weekly_updates;
create policy "weekly_updates_select_full_course"
  on public.weekly_updates for select
  to authenticated
  using (
    is_published = true
    and access_tier = 'full_course'
    and type in ('weekly_outlook', 'market_update')
    and exists (
      select 1
      from public.students s
      where s.auth_user_id = auth.uid()
        and s.access_level >= 2
    )
  );
