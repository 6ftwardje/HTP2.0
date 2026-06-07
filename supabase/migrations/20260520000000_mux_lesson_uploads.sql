-- Add Mux video metadata to lessons and allow platform admins to manage lesson video fields.

-- Keep this migration safe to run on databases where the earlier admin-RLS
-- migration has not been applied yet.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where auth_user_id = auth.uid()
      and access_level = 3
  );
$$;

comment on function public.is_platform_admin() is 'True when the current user is a platform admin (access_level 3). Uses SECURITY DEFINER to avoid RLS recursion on students.';

grant execute on function public.is_platform_admin() to authenticated;

alter table public.lessons add column if not exists mux_asset_id text;
alter table public.lessons add column if not exists mux_playback_id text;
alter table public.lessons add column if not exists mux_playback_policy text not null default 'public';
alter table public.lessons add column if not exists mux_status text;
alter table public.lessons add column if not exists mux_upload_id text;
alter table public.lessons add column if not exists mux_error_message text;

alter table public.lessons drop constraint if exists lessons_mux_playback_policy_check;
alter table public.lessons add constraint lessons_mux_playback_policy_check check (mux_playback_policy in ('public', 'signed'));

alter table public.lessons drop constraint if exists lessons_mux_status_check;
alter table public.lessons add constraint lessons_mux_status_check check (mux_status is null or mux_status in ('preparing', 'ready', 'errored'));

create unique index if not exists lessons_mux_asset_id_unique on public.lessons (mux_asset_id) where mux_asset_id is not null;

create unique index if not exists lessons_mux_playback_id_unique on public.lessons (mux_playback_id) where mux_playback_id is not null;

create index if not exists idx_lessons_mux_status on public.lessons (mux_status) where mux_status is not null;

drop policy if exists "modules_select_admin" on public.modules;
create policy "modules_select_admin"
  on public.modules for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "modules_insert_admin" on public.modules;
create policy "modules_insert_admin"
  on public.modules for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "modules_update_admin" on public.modules;
create policy "modules_update_admin"
  on public.modules for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "modules_delete_admin" on public.modules;
create policy "modules_delete_admin"
  on public.modules for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "lessons_select_admin" on public.lessons;
create policy "lessons_select_admin"
  on public.lessons for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "lessons_insert_admin" on public.lessons;
create policy "lessons_insert_admin"
  on public.lessons for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "lessons_update_admin" on public.lessons;
create policy "lessons_update_admin"
  on public.lessons for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "lessons_delete_admin" on public.lessons;
create policy "lessons_delete_admin"
  on public.lessons for delete
  to authenticated
  using (public.is_platform_admin());
