-- Additive post content, private processed avatars and persistent useful reactions.
alter table public.weekly_updates
  add column if not exists content_kind text not null default 'video' check (content_kind in ('video', 'article')),
  add column if not exists intro text,
  add column if not exists article_html text,
  add column if not exists author_name text;

-- Match the deployed content policies, including the dormant subscription rollout.
-- This explicit check also runs inside SECURITY DEFINER aggregations (no RLS bypass).
create or replace function public.can_read_market_post(p_post_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
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

create table public.market_post_reactions (
  post_id bigint not null references public.weekly_updates(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, student_id)
);
create index market_post_reactions_student on public.market_post_reactions(student_id);
alter table public.market_post_reactions enable row level security;
create policy reactions_read_own on public.market_post_reactions for select to authenticated
  using (public.can_read_market_post(post_id) and student_id in (select id from public.students where auth_user_id = auth.uid()));
create policy reactions_add_own on public.market_post_reactions for insert to authenticated
  with check (public.can_read_market_post(post_id) and student_id in (select id from public.students where auth_user_id = auth.uid()));
create policy reactions_remove_own on public.market_post_reactions for delete to authenticated
  using (public.can_read_market_post(post_id) and student_id in (select id from public.students where auth_user_id = auth.uid()));
revoke all on public.market_post_reactions from anon, authenticated;
grant select, insert, delete on public.market_post_reactions to authenticated;

create function public.market_post_reaction_state(p_post_id bigint)
returns table(total bigint, active boolean) language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  if not public.can_read_market_post(p_post_id) then raise exception 'Post access denied' using errcode = '42501'; end if;
  select id into v_student from public.students where auth_user_id = auth.uid();
  return query select count(*), coalesce(bool_or(r.student_id = v_student), false)
    from public.market_post_reactions r where r.post_id = p_post_id;
end;
$$;
create function public.set_market_post_reaction(p_post_id bigint, p_active boolean)
returns table(total bigint, active boolean) language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  -- Serialize all mutations per post before taking the count; retries are idempotent.
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
revoke all on function public.market_post_reaction_state(bigint), public.set_market_post_reaction(bigint, boolean) from public, anon;
grant execute on function public.market_post_reaction_state(bigint), public.set_market_post_reaction(bigint, boolean) to authenticated;

-- Separate profile field: the existing broad admin students policy cannot edit avatars.
create table public.avatar_objects (
  object_path text primary key check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  student_id uuid references public.students(id) on delete set null,
  state text not null default 'pending' check (state in ('pending', 'active', 'garbage')),
  created_at timestamptz not null default now()
);
create index avatar_objects_cleanup on public.avatar_objects(state, created_at);
create table public.student_avatars (
  student_id uuid primary key references public.students(id) on delete cascade,
  object_path text unique references public.avatar_objects(object_path),
  updated_at timestamptz not null default now()
);
alter table public.avatar_objects enable row level security;
alter table public.student_avatars enable row level security;
revoke all on public.avatar_objects, public.student_avatars from anon, authenticated;
grant select on public.student_avatars to authenticated;

create function public.can_read_student_avatar(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.students s where s.id = p_student_id and s.auth_user_id = auth.uid())
    or exists (select 1 from public.weekly_updates w
      where coalesce(w.mentor_student_id, w.created_by_student_id) = p_student_id and public.can_read_market_post(w.id))
  );
$$;
revoke all on function public.can_read_student_avatar(uuid) from public, anon;
grant execute on function public.can_read_student_avatar(uuid) to authenticated;
create policy avatars_read_visible on public.student_avatars for select to authenticated
  using (public.can_read_student_avatar(student_id));

-- Only the trusted image route can register/store/commit processed images.
-- Row lock prevents replacement/removal races; each path is used exactly once.
create function public.commit_student_avatar(p_auth_uid uuid, p_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_old text;
begin
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
create function public.claim_avatar_garbage()
returns table(object_path text) language plpgsql security definer set search_path = '' as $$
begin
  -- Reconcile files whose expired pending record was removed before a slow
  -- Storage upload finished. A referenced avatar always has its FK record.
  insert into public.avatar_objects(object_path, state)
    select o.name, 'garbage' from storage.objects o
    where o.bucket_id = 'profile-avatars'
      and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
      and not exists (select 1 from public.avatar_objects a where a.object_path = o.name)
    order by o.created_at limit 100 on conflict on constraint avatar_objects_pkey do nothing;
  return query with candidates as (
    select o.object_path from public.avatar_objects o
    where (o.state = 'garbage' or (o.state = 'pending' and o.created_at < now() - interval '1 hour'))
      and not exists (select 1 from public.student_avatars a where a.object_path = o.object_path)
    order by o.created_at limit 100 for update skip locked
  ) update public.avatar_objects o set state = 'garbage' from candidates c
    where o.object_path = c.object_path returning o.object_path;
end;
$$;
create function public.mark_deleted_student_avatar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.avatar_objects set state = 'garbage' where student_id = old.id;
  return old;
end;
$$;
create trigger deleted_student_avatar before delete on public.students for each row execute function public.mark_deleted_student_avatar();
revoke all on function public.commit_student_avatar(uuid, text), public.claim_avatar_garbage(), public.mark_deleted_student_avatar() from public, anon, authenticated;
grant execute on function public.commit_student_avatar(uuid, text), public.claim_avatar_garbage() to service_role;
grant all on public.avatar_objects, public.student_avatars to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 1048576, array['image/webp'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- No client INSERT/UPDATE/DELETE policies, even for admins. Sources never enter storage.
create policy avatars_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'profile-avatars' and exists (select 1 from public.student_avatars a where a.object_path = name)
);

-- A narrow author projection avoids widening private student profile RLS.
create function public.market_post_author(p_post_id bigint)
returns table(name text, object_path text, student_id uuid) language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_read_market_post(p_post_id) then raise exception 'Post access denied' using errcode = '42501'; end if;
  return query select coalesce(nullif(s.name, ''), nullif(w.author_name, ''), 'Auteur'), a.object_path, s.id
    from public.weekly_updates w
    left join public.students s on s.id = coalesce(w.mentor_student_id, w.created_by_student_id)
    left join public.student_avatars a on a.student_id = s.id where w.id = p_post_id;
end;
$$;
revoke all on function public.market_post_author(bigint) from public, anon;
grant execute on function public.market_post_author(bigint) to authenticated;
