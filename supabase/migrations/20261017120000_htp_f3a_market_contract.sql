-- HTP-12: additive, repeatable contract widening. No content UPDATE, RLS or billing changes.
begin;
alter table public.weekly_updates drop constraint if exists weekly_updates_market_check;
alter table public.weekly_updates add constraint weekly_updates_market_check
  check (market is null or market in ('stocks','forex','crypto','gold','commodities','trading'));
alter table public.weekly_updates drop constraint if exists weekly_updates_markets_check;
alter table public.weekly_updates add constraint weekly_updates_markets_check
  check (markets <@ array['stocks','forex','crypto','gold','commodities','trading','macro','indices','general']::text[]
    and array_position(markets, null) is null);

alter table public.weekly_updates drop constraint if exists weekly_updates_update_structure_check;
alter table public.weekly_updates add constraint weekly_updates_update_structure_check
  check (update_structure is null or coalesce((
    type = 'market_update' and jsonb_typeof(update_structure) = 'object'
    and update_structure->'version' = '1'::jsonb
    and update_structure->>'category' in ('crypto','forex','stocks','gold','commodities','trading','macro','indices','general')
    and update_structure->>'type' in ('setup','analysis','news','education')
    and jsonb_typeof(update_structure->'fields') = 'object'
    and jsonb_typeof(update_structure->'targets') = 'array'
    and jsonb_typeof(update_structure->'history') = 'array'
  ),false));
alter table public.weekly_updates drop constraint if exists weekly_updates_type_market_check;
alter table public.weekly_updates add constraint weekly_updates_type_market_check
  check (type is null or (type = 'market_update' and (
    market is not null or cardinality(markets) > 0
    or coalesce(update_structure->>'category' in ('indices','general'),false)
  )) or (type in ('weekly_outlook','live_session') and market is null));
alter table public.weekly_updates drop constraint if exists weekly_updates_published_non_video_check;
alter table public.weekly_updates add constraint weekly_updates_published_non_video_check
  check (is_published is not true or content_format = 'video' or (
    type = 'market_update' and (market is not null or cardinality(markets) > 0
      or coalesce(update_structure->>'category' in ('indices','general'),false))
    and body is not null and (char_length(btrim(body)) >= 20 or update_structure is not null)
    and (content_format = 'text' or cardinality(image_paths) >= 1)
  ));

create or replace function public.valid_market_chapters(chapters jsonb, duration numeric, markets text[])
returns boolean language plpgsql immutable security invoker set search_path = public,pg_temp as $$
declare chapter jsonb; seconds numeric; previous numeric := -1;
begin
  if chapters is null or jsonb_typeof(chapters) <> 'array' then return false; end if;
  if jsonb_array_length(chapters) > 200 then return false; end if;
  for chapter in select value from jsonb_array_elements(chapters) loop
    if jsonb_typeof(chapter) <> 'object'
      or chapter - array['title','seconds','market']::text[] <> '{}'::jsonb
      or jsonb_typeof(chapter->'title') is distinct from 'string'
      or length(btrim(chapter->>'title')) = 0 or length(chapter->>'title') > 240
      or jsonb_typeof(chapter->'seconds') is distinct from 'number' then return false; end if;
    seconds := (chapter->>'seconds')::numeric;
    if seconds < 0 or seconds > 9007199254740991 or seconds <> trunc(seconds)
      or seconds <= previous or (duration > 0 and seconds >= duration) then return false; end if;
    if chapter ? 'market' and (jsonb_typeof(chapter->'market') is distinct from 'string'
      or not coalesce((chapter->>'market') = any(markets),false)
      or not ((chapter->>'market') = any(array['stocks','forex','crypto','gold','commodities','trading','macro','indices','general']))) then return false; end if;
    previous := seconds;
  end loop;
  return true;
end;
$$;
-- New/edited rows are checked immediately; historical malformed rows are inventoried,
-- not rewritten or silently erased. Validate this constraint only after the release audit.
alter table public.weekly_updates drop constraint if exists weekly_updates_chapters_contract_check;
alter table public.weekly_updates add constraint weekly_updates_chapters_contract_check
  check (public.valid_market_chapters(chapters,video_duration_seconds,markets)) not valid;
comment on column public.weekly_updates.markets is 'Complete market tags. Six document markets plus distinct historical macro/indices/general. Scalar market and structure.category are compatibility projections.';
comment on column public.weekly_updates.chapters is 'Ordered {title,seconds,market?}; optional market references a selected update tag. Week date and period_label remain unchanged.';
commit;
