-- Add structure to the update rubric without rewriting content, changing row IDs,
-- RLS, publication notifications, media, or any existing integration.
alter table public.weekly_updates
  add column if not exists update_structure jsonb;

-- The production clone predates the commodities constraint widening. Include
-- that rubric-only prerequisite here rather than running the unrelated backlog.
alter table public.weekly_updates
  drop constraint if exists weekly_updates_market_check;
alter table public.weekly_updates
  add constraint weekly_updates_market_check
  check (market is null or market in ('stocks', 'forex', 'crypto', 'commodities'));

alter table public.weekly_updates
  add constraint weekly_updates_update_structure_check
  check (
    update_structure is null or coalesce((
      type = 'market_update'
      and jsonb_typeof(update_structure) = 'object'
      and update_structure->'version' = '1'::jsonb
      and update_structure->>'category' in ('crypto', 'forex', 'stocks', 'indices', 'commodities', 'general')
      and update_structure->>'type' in ('setup', 'analysis', 'news', 'education')
      and jsonb_typeof(update_structure->'fields') = 'object'
      and jsonb_typeof(update_structure->'targets') = 'array'
      and jsonb_typeof(update_structure->'history') = 'array'
    ), false)
  );

-- The legacy market column has no indices/general values. Only structured
-- updates in these two categories may leave it empty; all legacy checks remain.
alter table public.weekly_updates
  drop constraint if exists weekly_updates_type_market_check;
alter table public.weekly_updates
  add constraint weekly_updates_type_market_check
  check (
    type is null
    or (type = 'market_update' and (
      market is not null
      or (update_structure is not null and update_structure->>'category' in ('indices', 'general'))
    ))
    or (type in ('weekly_outlook', 'live_session') and market is null)
  );

alter table public.weekly_updates
  drop constraint if exists weekly_updates_published_non_video_check;
alter table public.weekly_updates
  add constraint weekly_updates_published_non_video_check
  check (
    is_published is not true or content_format = 'video' or (
      type = 'market_update'
      and (market is not null or (update_structure is not null and update_structure->>'category' in ('indices', 'general')))
      -- Structured templates carry the required explanation in their fields;
      -- an optional additional note can therefore be shorter than 20 characters.
      and body is not null and (char_length(btrim(body)) >= 20 or update_structure is not null)
      and (content_format = 'text' or cardinality(image_paths) >= 1)
    )
  );

comment on column public.weekly_updates.update_structure is 'Versioned category, template and manual setup follow-up for the update rubric. Null preserves legacy content.';

-- Reserve the two pin positions atomically, including simultaneous publications.
-- Expired pins release their position without modifying the historical row.
create or replace function public.guard_market_update_pin_position()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.is_published is true
    and coalesce(new.actuality_status, 'current') <> 'archive'
    and new.update_structure->>'pinned_rank' in ('1', '2')
    and (
      new.update_structure->>'pin_until' is null
      or (new.update_structure->>'pin_until')::timestamptz > now()
    )
  then
    perform pg_advisory_xact_lock(hashtext('weekly_updates_structured_pin_positions'));
    if exists (
      select 1 from public.weekly_updates existing
      where existing.id <> new.id
        and existing.is_published is true
        and coalesce(existing.actuality_status, 'current') <> 'archive'
        and existing.update_structure->>'pinned_rank' = new.update_structure->>'pinned_rank'
        and (
          existing.update_structure->>'pin_until' is null
          or (existing.update_structure->>'pin_until')::timestamptz > now()
        )
    ) then
      raise exception using errcode = '23505', message = 'Deze pinpositie is al in gebruik. Kies de andere positie of maak de bestaande positie vrij.';
    end if;
  end if;
  return new;
end;
$$;

create trigger market_update_pin_position_guard
before insert or update of update_structure, is_published, actuality_status
on public.weekly_updates
for each row execute function public.guard_market_update_pin_position();
