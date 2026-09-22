-- Additive, rollback-friendly metadata for the unified Marktinzicht experience.
-- Existing video rows, URLs, playback ids, dates and relationships stay in place.

alter table public.weekly_updates
  add column if not exists markets text[] not null default '{}'::text[],
  add column if not exists actuality_status text not null default 'current',
  add column if not exists event_context text,
  add column if not exists period_label text,
  add column if not exists chapters jsonb not null default '[]'::jsonb,
  add column if not exists related_content jsonb not null default '[]'::jsonb,
  add column if not exists needs_review boolean not null default false;

alter table public.live_sessions
  add column if not exists markets text[] not null default '{}'::text[],
  add column if not exists summary text,
  add column if not exists chapters jsonb not null default '[]'::jsonb,
  add column if not exists thumbnail_url text;

update public.weekly_updates
set markets = array[market]
where market is not null and cardinality(markets) = 0;

-- Only classify strong title signals. Everything ambiguous remains available and
-- is queued for a human check in admin.
update public.weekly_updates
set type = 'weekly_outlook', market = null, needs_review = false
where type is null
  and lower(title) ~ '(weekly[ -]?outlook|weekvooruitblik|vooruitblik van de week)';

update public.weekly_updates
set type = 'live_session', market = null, needs_review = false
where type is null
  and lower(title) ~ '(live[ -]?(sessie|session|stream)|livestream|q&a live)';

update public.weekly_updates
set type = 'market_update', needs_review = false
where type is null
  and market is not null
  and lower(title) ~ '(markt[ -]?(update|breakdown)|market[ -]?(update|breakdown))';

update public.weekly_updates
set needs_review = (type is null)
where needs_review is distinct from (type is null);

alter table public.weekly_updates
  drop constraint if exists weekly_updates_actuality_status_check;
alter table public.weekly_updates
  add constraint weekly_updates_actuality_status_check
  check (actuality_status in ('current', 'still_relevant', 'archive'));

alter table public.weekly_updates
  drop constraint if exists weekly_updates_markets_check;
alter table public.weekly_updates
  add constraint weekly_updates_markets_check
  check (markets <@ array['stocks', 'forex', 'crypto', 'commodities', 'macro']::text[]);

alter table public.live_sessions
  drop constraint if exists live_sessions_markets_check;
alter table public.live_sessions
  add constraint live_sessions_markets_check
  check (markets <@ array['stocks', 'forex', 'crypto', 'commodities', 'macro']::text[]);

alter table public.weekly_updates
  drop constraint if exists weekly_updates_chapters_array_check;
alter table public.weekly_updates
  add constraint weekly_updates_chapters_array_check
  check (jsonb_typeof(chapters) = 'array' and jsonb_typeof(related_content) = 'array');

alter table public.live_sessions
  drop constraint if exists live_sessions_chapters_array_check;
alter table public.live_sessions
  add constraint live_sessions_chapters_array_check
  check (jsonb_typeof(chapters) = 'array');

create index if not exists idx_weekly_updates_market_insight_filters
  on public.weekly_updates (type, actuality_status, published_at desc)
  where is_published = true;
create index if not exists idx_weekly_updates_needs_review
  on public.weekly_updates (needs_review, created_at desc)
  where needs_review = true;

-- Uncertain legacy records remain readable through the student fallback instead
-- of disappearing while they wait for an admin classification.
drop policy if exists "weekly_updates_select_subscription" on public.weekly_updates;
create policy "weekly_updates_select_subscription"
  on public.weekly_updates for select to authenticated
  using (
    is_published = true
    and access_tier = 'subscription'
    and (type in ('weekly_outlook', 'market_update', 'live_session') or type is null)
    and public.has_active_entitlement('subscriber_content')
  );

drop policy if exists "weekly_updates_select_published_free" on public.weekly_updates;
create policy "weekly_updates_select_published_free"
  on public.weekly_updates for select to authenticated
  using (
    is_published = true
    and access_tier = 'free'
    and (type in ('weekly_outlook', 'market_update', 'live_session') or type is null)
  );

drop policy if exists "weekly_updates_select_full_course" on public.weekly_updates;
create policy "weekly_updates_select_full_course"
  on public.weekly_updates for select to authenticated
  using (
    is_published = true
    and access_tier = 'full_course'
    and (type in ('weekly_outlook', 'market_update', 'live_session') or type is null)
    and exists (
      select 1 from public.students s
      where s.auth_user_id = auth.uid() and s.access_level >= 2
    )
  );

-- A shared read model; source tables remain authoritative and retain their RLS.
create or replace view public.market_insight_content
with (security_invoker = true) as
select
  'video:' || wu.id::text as content_id,
  case
    when wu.type = 'weekly_outlook' then 'weekly_outlook'
    when wu.type = 'live_session' then 'live_session'
    else 'market_breakdown'
  end as format,
  wu.title,
  wu.slug,
  wu.summary,
  case when cardinality(wu.markets) > 0 then wu.markets
       when wu.market is not null then array[wu.market]
       else '{}'::text[] end as markets,
  wu.published_at as occurs_at,
  wu.video_duration_seconds as duration_seconds,
  wu.thumbnail_url,
  wu.actuality_status,
  case when wu.type = 'live_session' then 'completed' else 'published' end as status,
  wu.needs_review,
  'weekly_updates'::text as source_table,
  wu.id::text as source_id
from public.weekly_updates wu
where wu.is_published = true
union all
select
  'live:' || ls.id::text,
  'live_session',
  ls.title,
  ls.slug,
  coalesce(ls.summary, ls.description),
  ls.markets,
  ls.starts_at,
  greatest(0, extract(epoch from (ls.ends_at - ls.starts_at)))::integer,
  ls.thumbnail_url,
  'current',
  ls.status,
  false,
  'live_sessions',
  ls.id::text
from public.live_sessions ls
where ls.is_published = true;

comment on view public.market_insight_content is
  'Unified, non-destructive read model for Weekvooruitblikken, Marktbreakdowns and Live marktsessies.';
