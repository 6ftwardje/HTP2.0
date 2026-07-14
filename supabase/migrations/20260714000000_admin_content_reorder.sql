-- Atomic admin reordering for modules and lessons.
-- The temporary negative positions avoid unique constraint collisions while
-- normalizing the final order back to 1..n inside one database transaction.

create or replace function public.reorder_modules_admin(module_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_distinct_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can reorder modules.' using errcode = '42501';
  end if;

  select count(*) into v_expected_count from public.modules;
  select count(distinct module_id) into v_distinct_count
  from unnest(module_ids) as module_id;

  if coalesce(cardinality(module_ids), 0) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(module_ids) as submitted_id
      left join public.modules m on m.id = submitted_id
      where m.id is null
    )
  then
    raise exception 'Module order payload must contain every module exactly once.';
  end if;

  update public.modules
  set order_index = -array_position(module_ids, id)::integer
  where id = any(module_ids);

  update public.modules
  set order_index = array_position(module_ids, id)::integer
  where id = any(module_ids);
end;
$$;

grant execute on function public.reorder_modules_admin(bigint[]) to authenticated;

create or replace function public.reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_distinct_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can reorder lessons.' using errcode = '42501';
  end if;

  if target_module_id is null then
    raise exception 'Module id is required.';
  end if;

  select count(*) into v_expected_count
  from public.lessons
  where module_id = target_module_id;

  select count(distinct lesson_id) into v_distinct_count
  from unnest(lesson_ids) as lesson_id;

  if coalesce(cardinality(lesson_ids), 0) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(lesson_ids) as submitted_id
      left join public.lessons l
        on l.id = submitted_id
       and l.module_id = target_module_id
      where l.id is null
    )
  then
    raise exception 'Lesson order payload must contain every lesson in the module exactly once.';
  end if;

  update public.lessons
  set order_index = -array_position(lesson_ids, id)::integer
  where module_id = target_module_id
    and id = any(lesson_ids);

  update public.lessons
  set order_index = array_position(lesson_ids, id)::integer
  where module_id = target_module_id
    and id = any(lesson_ids);
end;
$$;

grant execute on function public.reorder_lessons_admin(bigint, bigint[]) to authenticated;

create or replace function public.normalize_modules_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_ids bigint[];
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can normalize modules.' using errcode = '42501';
  end if;

  select coalesce(array_agg(id order by order_index, id), array[]::bigint[])
  into v_module_ids
  from public.modules;

  if cardinality(v_module_ids) = 0 then
    return;
  end if;

  perform public.reorder_modules_admin(v_module_ids);
end;
$$;

grant execute on function public.normalize_modules_admin() to authenticated;

create or replace function public.normalize_lessons_admin(target_module_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson_ids bigint[];
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can normalize lessons.' using errcode = '42501';
  end if;

  if target_module_id is null then
    raise exception 'Module id is required.';
  end if;

  select coalesce(array_agg(id order by order_index, id), array[]::bigint[])
  into v_lesson_ids
  from public.lessons
  where module_id = target_module_id;

  if cardinality(v_lesson_ids) = 0 then
    return;
  end if;

  perform public.reorder_lessons_admin(target_module_id, v_lesson_ids);
end;
$$;

grant execute on function public.normalize_lessons_admin(bigint) to authenticated;
