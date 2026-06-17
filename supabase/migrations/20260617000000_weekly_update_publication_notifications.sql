-- Ensure weekly update publication notifications are idempotent per update.

create unique index if not exists notification_events_weekly_update_published_unique
  on public.notification_events (type, target_table, target_id)
  where type = 'weekly_update.published'
    and target_table = 'weekly_updates';

