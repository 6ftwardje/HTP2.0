-- Keep the publisher attribution from the existing chart/text release when
-- projecting author avatars for the new detail layout.
create or replace function public.can_read_student_avatar(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from auth.users u where u.id = auth.uid())
    and (
      exists (select 1 from public.students s where s.id = p_student_id and s.auth_user_id = auth.uid())
      or exists (
        select 1 from public.weekly_updates w
        where (case when w.content_format <> 'video' or w.content_kind = 'article'
          then coalesce(w.published_by_student_id, w.mentor_student_id, w.created_by_student_id)
          else coalesce(w.mentor_student_id, w.created_by_student_id) end) = p_student_id
          and public.can_read_market_post(w.id)
      )
    );
$$;
revoke all on function public.can_read_student_avatar(uuid) from public, anon;
grant execute on function public.can_read_student_avatar(uuid) to authenticated;

create or replace function public.market_post_author(p_post_id bigint)
returns table(name text, object_path text, student_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_read_market_post(p_post_id) then
    raise exception 'Post access denied' using errcode = '42501';
  end if;
  return query
    select case when w.content_format <> 'video' or w.content_kind = 'article'
      then coalesce(nullif(btrim(w.published_by_display_name), ''), nullif(btrim(s.name), ''), w.author_name, 'Auteur')
      else coalesce(nullif(btrim(s.name), ''), w.author_name, 'Auteur') end,
      a.object_path, s.id
    from public.weekly_updates w
    left join public.students s on s.id = case when w.content_format <> 'video' or w.content_kind = 'article'
      then coalesce(w.published_by_student_id, w.mentor_student_id, w.created_by_student_id)
      else coalesce(w.mentor_student_id, w.created_by_student_id) end
    left join public.student_avatars a on a.student_id = s.id
    where w.id = p_post_id;
end;
$$;
revoke all on function public.market_post_author(bigint) from public, anon;
grant execute on function public.market_post_author(bigint) to authenticated;
