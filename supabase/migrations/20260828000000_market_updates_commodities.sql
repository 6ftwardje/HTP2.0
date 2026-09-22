-- Add Commodities to the existing categorized market-update CMS.

alter table public.weekly_updates
  drop constraint if exists weekly_updates_market_check;

alter table public.weekly_updates
  add constraint weekly_updates_market_check
  check (market is null or market in ('stocks', 'forex', 'crypto', 'commodities'));
