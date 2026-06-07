-- Add lesson takeaways and simple, lesson-scoped action tracking.

alter table public.lessons add column if not exists takeaway text;
alter table public.lessons add column if not exists action_items jsonb not null default '[]'::jsonb;

alter table public.lessons drop constraint if exists lessons_action_items_array_check;
alter table public.lessons add constraint lessons_action_items_array_check
  check (jsonb_typeof(action_items) = 'array');

create table if not exists public.lesson_action_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  action_index integer not null check (action_index >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id, action_index)
);

drop trigger if exists set_lesson_action_progress_updated_at on public.lesson_action_progress;
create trigger set_lesson_action_progress_updated_at
  before update on public.lesson_action_progress
  for each row
  execute function public.set_updated_at();

create index if not exists idx_lesson_action_progress_student_id
  on public.lesson_action_progress (student_id);
create index if not exists idx_lesson_action_progress_lesson_id
  on public.lesson_action_progress (lesson_id);

alter table public.lesson_action_progress enable row level security;

drop policy if exists "lesson_action_progress_select_own" on public.lesson_action_progress;
create policy "lesson_action_progress_select_own"
  on public.lesson_action_progress for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = lesson_action_progress.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "lesson_action_progress_insert_own" on public.lesson_action_progress;
create policy "lesson_action_progress_insert_own"
  on public.lesson_action_progress for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = lesson_action_progress.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "lesson_action_progress_update_own" on public.lesson_action_progress;
create policy "lesson_action_progress_update_own"
  on public.lesson_action_progress for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = lesson_action_progress.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = lesson_action_progress.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "lesson_action_progress_select_admin" on public.lesson_action_progress;
create policy "lesson_action_progress_select_admin"
  on public.lesson_action_progress for select
  to authenticated
  using (public.is_platform_admin());

-- Trade-specific takeaways and actions are imported with the course content.
