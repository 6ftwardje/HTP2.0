-- Auth account deletion cleans only the new features. Existing profile/history
-- retention is preserved; no destructive new cascade is added to legacy tables.
create function public.cleanup_deleted_auth_market_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.market_post_reactions r using public.students s
    where r.student_id = s.id and s.auth_user_id = old.id;
  update public.avatar_objects o set state = 'garbage'
    from public.students s where o.student_id = s.id and s.auth_user_id = old.id;
  delete from public.student_avatars a using public.students s
    where a.student_id = s.id and s.auth_user_id = old.id;
  return old;
end;
$$;
revoke all on function public.cleanup_deleted_auth_market_profile() from public, anon, authenticated;
create trigger cleanup_deleted_auth_market_profile after delete on auth.users
  for each row execute function public.cleanup_deleted_auth_market_profile();

-- A deleted account's unexpired JWT must not recreate a reaction directly.
create or replace function public.can_read_market_post(p_post_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from auth.users u where u.id = auth.uid())
    and exists (
    select 1 from public.weekly_updates w
    where w.id = p_post_id and w.is_published and (
      public.is_platform_admin() or w.access_tier = 'free'
      or (w.access_tier = 'full_course' and exists (
        select 1 from public.students s where s.auth_user_id = auth.uid() and s.access_level >= 2
      ))
      or (w.access_tier = 'subscription'
        and (w.type in ('weekly_outlook', 'market_update', 'live_session') or w.type is null)
        and exists (select 1 from public.students s where s.auth_user_id = auth.uid() and s.access_level >= 2))
    )
  );
$$;
revoke all on function public.can_read_market_post(bigint) from public, anon;
grant execute on function public.can_read_market_post(bigint) to authenticated;

-- Lock the live Auth parent for direct inserts as well as the idempotent RPC.
-- Account deletion then runs after the insert and removes it in the same
-- deletion transaction; an insert arriving afterwards cannot recreate it.
create function public.guard_reaction_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users u join public.students s on s.auth_user_id = u.id
    where s.id = new.student_id for key share of u;
  if not found then raise exception 'Account no longer exists' using errcode = '42501'; end if;
  return new;
end;
$$;
revoke all on function public.guard_reaction_account() from public, anon, authenticated;
create trigger guard_reaction_account before insert on public.market_post_reactions
  for each row execute function public.guard_reaction_account();

create or replace function public.set_market_post_reaction(p_post_id bigint, p_active boolean)
returns table(total bigint, active boolean) language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  -- Take the account lock first, consistently with direct reaction inserts.
  perform 1 from auth.users where id = auth.uid() for key share;
  if not found then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.weekly_updates where id = p_post_id for update;
  if not public.can_read_market_post(p_post_id) then raise exception 'Post access denied' using errcode = '42501'; end if;
  select id into v_student from public.students where auth_user_id = auth.uid();
  if v_student is null or p_active is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_active then
    insert into public.market_post_reactions(post_id, student_id) values(p_post_id, v_student) on conflict do nothing;
  else
    delete from public.market_post_reactions where post_id = p_post_id and student_id = v_student;
  end if;
  return query select * from public.market_post_reaction_state(p_post_id);
end;
$$;

create or replace function public.commit_student_avatar(p_auth_uid uuid, p_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_old text;
begin
  -- Serialize against Auth account deletion, including in-flight uploads.
  perform 1 from auth.users where id = p_auth_uid for key share;
  if not found then raise exception 'Account no longer exists'; end if;
  select id into v_student from public.students where auth_user_id = p_auth_uid for update;
  if v_student is null then raise exception 'Profile not found'; end if;
  if p_path is not null then
    perform 1 from public.avatar_objects where object_path = p_path and student_id = v_student and state = 'pending' for update;
    if not found then raise exception 'Avatar is not pending or owned by this user'; end if;
    perform 1 from storage.objects where bucket_id = 'profile-avatars' and name = p_path;
    if not found then raise exception 'Avatar object missing'; end if;
  end if;
  select object_path into v_old from public.student_avatars where student_id = v_student;
  insert into public.student_avatars(student_id, object_path) values(v_student, p_path)
    on conflict(student_id) do update set object_path = excluded.object_path, updated_at = now();
  update public.avatar_objects set state = 'active' where object_path = p_path;
  update public.avatar_objects set state = 'garbage' where object_path = v_old and object_path is distinct from p_path;
  return p_path;
end;
$$;
