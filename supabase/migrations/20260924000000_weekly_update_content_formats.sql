-- Add text and chart formats without changing existing video rows, IDs or access policies.
-- Rollback, if no new content has been created: drop the three constraints below,
-- then drop image_paths, body and content_format. Keep this migration in history
-- once non-video content exists; reverting would discard that content.

alter table public.weekly_updates
  add column if not exists content_format text not null default 'video',
  add column if not exists body text,
  add column if not exists image_paths text[] not null default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.weekly_updates'::regclass and conname = 'weekly_updates_content_format_check') then
    alter table public.weekly_updates add constraint weekly_updates_content_format_check
      check (content_format in ('video', 'chart', 'text'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.weekly_updates'::regclass and conname = 'weekly_updates_body_length_check') then
    alter table public.weekly_updates add constraint weekly_updates_body_length_check
      check (body is null or char_length(body) <= 12000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.weekly_updates'::regclass and conname = 'weekly_updates_image_paths_check') then
    alter table public.weekly_updates add constraint weekly_updates_image_paths_check
      check (cardinality(image_paths) <= 4 and array_position(image_paths, null) is null and array_position(image_paths, '') is null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.weekly_updates'::regclass and conname = 'weekly_updates_published_non_video_check') then
    alter table public.weekly_updates add constraint weekly_updates_published_non_video_check
      check (
        is_published is not true or content_format = 'video' or (
          type = 'market_update' and market is not null and body is not null
          and char_length(btrim(body)) >= 20
          and (content_format = 'text' or cardinality(image_paths) >= 1)
        )
      );
  end if;
end $$;

comment on column public.weekly_updates.content_format is 'Presentation format; existing rows remain video.';
comment on column public.weekly_updates.body is 'Plain-text analysis body, at most 12000 characters.';
comment on column public.weekly_updates.image_paths is 'Private chart object paths, at most four per update.';
