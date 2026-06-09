-- Weekly Updates foundation.
-- Adds subscription-ready market update content, separate from course lessons.

create table if not exists public.weekly_updates (
  id bigserial primary key,
  title text not null,
  slug text unique not null,
  summary text,
  key_takeaways jsonb not null default '[]'::jsonb,
  market text,
  week_start_date date not null,
  mentor_student_id uuid references public.students (id) on delete set null,
  created_by_student_id uuid references public.students (id) on delete set null,
  access_tier text not null default 'premium',
  video_provider text not null default 'mux',
  video_url text,
  video_duration_seconds integer check (
    video_duration_seconds is null or video_duration_seconds >= 0
  ),
  thumbnail_url text,
  mux_asset_id text,
  mux_playback_id text,
  mux_playback_policy text not null default 'signed',
  mux_status text,
  mux_upload_id text,
  mux_error_message text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.weekly_updates drop constraint if exists weekly_updates_key_takeaways_array_check;
alter table public.weekly_updates add constraint weekly_updates_key_takeaways_array_check
  check (jsonb_typeof(key_takeaways) = 'array');

alter table public.weekly_updates drop constraint if exists weekly_updates_access_tier_check;
alter table public.weekly_updates add constraint weekly_updates_access_tier_check
  check (access_tier in ('free', 'full_course', 'premium', 'mentor_membership'));

alter table public.weekly_updates drop constraint if exists weekly_updates_video_provider_check;
alter table public.weekly_updates add constraint weekly_updates_video_provider_check
  check (video_provider in ('mux', 'vimeo', 'youtube'));

alter table public.weekly_updates drop constraint if exists weekly_updates_mux_playback_policy_check;
alter table public.weekly_updates add constraint weekly_updates_mux_playback_policy_check
  check (mux_playback_policy in ('public', 'signed'));

alter table public.weekly_updates drop constraint if exists weekly_updates_mux_status_check;
alter table public.weekly_updates add constraint weekly_updates_mux_status_check
  check (mux_status is null or mux_status in ('preparing', 'ready', 'errored'));

drop trigger if exists set_weekly_updates_updated_at on public.weekly_updates;
create trigger set_weekly_updates_updated_at
  before update on public.weekly_updates
  for each row
  execute function public.set_updated_at();

create unique index if not exists weekly_updates_mux_asset_id_unique
  on public.weekly_updates (mux_asset_id)
  where mux_asset_id is not null;

create unique index if not exists weekly_updates_mux_playback_id_unique
  on public.weekly_updates (mux_playback_id)
  where mux_playback_id is not null;

create unique index if not exists weekly_updates_mux_upload_id_unique
  on public.weekly_updates (mux_upload_id)
  where mux_upload_id is not null;

create index if not exists idx_weekly_updates_published_week
  on public.weekly_updates (is_published, week_start_date desc);

create index if not exists idx_weekly_updates_mentor_student_id
  on public.weekly_updates (mentor_student_id);

create index if not exists idx_weekly_updates_access_tier
  on public.weekly_updates (access_tier);

create index if not exists idx_weekly_updates_mux_status
  on public.weekly_updates (mux_status)
  where mux_status is not null;

create table if not exists public.weekly_update_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  weekly_update_id bigint not null references public.weekly_updates (id) on delete cascade,
  watched boolean not null default false,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, weekly_update_id)
);

drop trigger if exists set_weekly_update_views_updated_at on public.weekly_update_views;
create trigger set_weekly_update_views_updated_at
  before update on public.weekly_update_views
  for each row
  execute function public.set_updated_at();

create index if not exists idx_weekly_update_views_student_id
  on public.weekly_update_views (student_id);

create index if not exists idx_weekly_update_views_weekly_update_id
  on public.weekly_update_views (weekly_update_id);

create index if not exists idx_weekly_update_views_student_update
  on public.weekly_update_views (student_id, weekly_update_id);

alter table public.weekly_updates enable row level security;
alter table public.weekly_update_views enable row level security;

drop policy if exists "weekly_updates_select_published_free" on public.weekly_updates;
create policy "weekly_updates_select_published_free"
  on public.weekly_updates for select
  to authenticated
  using (is_published = true and access_tier = 'free');

drop policy if exists "weekly_updates_select_full_course" on public.weekly_updates;
create policy "weekly_updates_select_full_course"
  on public.weekly_updates for select
  to authenticated
  using (
    is_published = true
    and access_tier = 'full_course'
    and exists (
      select 1
      from public.students s
      where s.auth_user_id = auth.uid()
        and s.access_level >= 2
    )
  );

drop policy if exists "weekly_updates_select_admin" on public.weekly_updates;
create policy "weekly_updates_select_admin"
  on public.weekly_updates for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "weekly_updates_insert_admin" on public.weekly_updates;
create policy "weekly_updates_insert_admin"
  on public.weekly_updates for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "weekly_updates_update_admin" on public.weekly_updates;
create policy "weekly_updates_update_admin"
  on public.weekly_updates for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "weekly_updates_delete_admin" on public.weekly_updates;
create policy "weekly_updates_delete_admin"
  on public.weekly_updates for delete
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "weekly_update_views_select_own" on public.weekly_update_views;
create policy "weekly_update_views_select_own"
  on public.weekly_update_views for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = weekly_update_views.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "weekly_update_views_insert_own" on public.weekly_update_views;
create policy "weekly_update_views_insert_own"
  on public.weekly_update_views for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = weekly_update_views.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "weekly_update_views_update_own" on public.weekly_update_views;
create policy "weekly_update_views_update_own"
  on public.weekly_update_views for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = weekly_update_views.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = weekly_update_views.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "weekly_update_views_select_admin" on public.weekly_update_views;
create policy "weekly_update_views_select_admin"
  on public.weekly_update_views for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "weekly_update_views_insert_admin" on public.weekly_update_views;
create policy "weekly_update_views_insert_admin"
  on public.weekly_update_views for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "weekly_update_views_update_admin" on public.weekly_update_views;
create policy "weekly_update_views_update_admin"
  on public.weekly_update_views for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "weekly_update_views_delete_admin" on public.weekly_update_views;
create policy "weekly_update_views_delete_admin"
  on public.weekly_update_views for delete
  to authenticated
  using (public.is_platform_admin());
