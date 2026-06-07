-- Persistent student next steps. This is intentionally generic so the same
-- surface can later include live sessions, physical lessons, calls, or custom
-- mentor tasks.
create table if not exists public.student_next_steps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  step_key text not null,
  step_type text not null,
  status text not null default 'active',
  title text not null,
  description text,
  href text,
  cta_label text,
  source_table text,
  source_id text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, step_key)
);

alter table public.student_next_steps
  drop constraint if exists student_next_steps_step_type_check;

alter table public.student_next_steps
  add constraint student_next_steps_step_type_check
  check (
    step_type in (
      'intake',
      'lesson',
      'lesson_action',
      'exam',
      'module',
      'mentor_action',
      'live_session',
      'physical_lesson',
      'custom'
    )
  );

alter table public.student_next_steps
  drop constraint if exists student_next_steps_status_check;

alter table public.student_next_steps
  add constraint student_next_steps_status_check
  check (status in ('active', 'completed', 'dismissed'));

drop trigger if exists set_student_next_steps_updated_at
  on public.student_next_steps;
create trigger set_student_next_steps_updated_at
  before update on public.student_next_steps
  for each row
  execute function public.set_updated_at();

create index if not exists idx_student_next_steps_student_status
  on public.student_next_steps (student_id, status, sort_order);

alter table public.student_next_steps enable row level security;

drop policy if exists "student_next_steps_select_own" on public.student_next_steps;
create policy "student_next_steps_select_own"
  on public.student_next_steps for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_insert_own" on public.student_next_steps;
create policy "student_next_steps_insert_own"
  on public.student_next_steps for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_update_own" on public.student_next_steps;
create policy "student_next_steps_update_own"
  on public.student_next_steps for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_select_admin" on public.student_next_steps;
create policy "student_next_steps_select_admin"
  on public.student_next_steps for select
  to authenticated
  using (public.is_platform_admin());

insert into public.student_next_steps (
  student_id,
  step_key,
  step_type,
  status,
  title,
  description,
  href,
  cta_label,
  source_table,
  sort_order,
  metadata
)
select
  s.id,
  'intake',
  'intake',
  'active',
  'Vul je intake in',
  'Verplicht voordat je de videocourse opent. Zo krijgen mentors en toekomstige AI-coaching betere context over je huidige staat.',
  '/onboarding',
  'Intake invullen',
  'student_onboarding_responses',
  10,
  '{}'::jsonb
from public.students s
left join public.student_onboarding_responses r
  on r.student_id = s.id
where r.completed_at is null
on conflict (student_id, step_key) do update
set
  status = 'active',
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  cta_label = excluded.cta_label,
  sort_order = excluded.sort_order,
  completed_at = null;
