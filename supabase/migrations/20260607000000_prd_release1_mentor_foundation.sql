-- PRD Release 1: mentor relationship foundation.
-- Adds onboarding context, mentor-only notes, and lightweight student triage metadata.

alter table public.students
  add column if not exists mentor_status text not null default 'active',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists onboarding_skipped_at timestamptz;

alter table public.students drop constraint if exists students_mentor_status_check;
alter table public.students add constraint students_mentor_status_check
  check (mentor_status in ('active', 'watch', 'needs_attention'));

create index if not exists idx_students_mentor_status
  on public.students (mentor_status);

create table if not exists public.student_onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students (id) on delete cascade,
  experience_level text,
  primary_market text,
  main_challenge text,
  goal_90_days text,
  weekly_time_commitment text,
  mentorship_interest text,
  tools jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_student_onboarding_responses_updated_at
  on public.student_onboarding_responses;
create trigger set_student_onboarding_responses_updated_at
  before update on public.student_onboarding_responses
  for each row
  execute function public.set_updated_at();

create index if not exists idx_student_onboarding_responses_student_id
  on public.student_onboarding_responses (student_id);

alter table public.student_onboarding_responses enable row level security;

drop policy if exists "student_onboarding_select_own" on public.student_onboarding_responses;
create policy "student_onboarding_select_own"
  on public.student_onboarding_responses for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_onboarding_responses.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_onboarding_insert_own" on public.student_onboarding_responses;
create policy "student_onboarding_insert_own"
  on public.student_onboarding_responses for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_onboarding_responses.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_onboarding_update_own" on public.student_onboarding_responses;
create policy "student_onboarding_update_own"
  on public.student_onboarding_responses for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_onboarding_responses.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_onboarding_responses.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_onboarding_select_admin" on public.student_onboarding_responses;
create policy "student_onboarding_select_admin"
  on public.student_onboarding_responses for select
  to authenticated
  using (public.is_platform_admin());

create table if not exists public.student_mentor_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_student_id uuid references public.students (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_student_mentor_notes_updated_at
  on public.student_mentor_notes;
create trigger set_student_mentor_notes_updated_at
  before update on public.student_mentor_notes
  for each row
  execute function public.set_updated_at();

create index if not exists idx_student_mentor_notes_student_id
  on public.student_mentor_notes (student_id, created_at desc);
create index if not exists idx_student_mentor_notes_author_student_id
  on public.student_mentor_notes (author_student_id);

alter table public.student_mentor_notes enable row level security;

drop policy if exists "student_mentor_notes_select_admin" on public.student_mentor_notes;
create policy "student_mentor_notes_select_admin"
  on public.student_mentor_notes for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "student_mentor_notes_insert_admin" on public.student_mentor_notes;
create policy "student_mentor_notes_insert_admin"
  on public.student_mentor_notes for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "student_mentor_notes_update_admin" on public.student_mentor_notes;
create policy "student_mentor_notes_update_admin"
  on public.student_mentor_notes for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "student_mentor_notes_delete_admin" on public.student_mentor_notes;
create policy "student_mentor_notes_delete_admin"
  on public.student_mentor_notes for delete
  to authenticated
  using (public.is_platform_admin());
