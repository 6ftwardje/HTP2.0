-- AI feature foundation: Mentor Copilot.
-- Additief only: voegt twee nieuwe tabellen toe, raakt geen bestaande objecten of data aan.
--   ai_interactions      : append-only logboek van AI-calls (audit + kostenbron).
--   ai_student_summaries : cache van de laatst gegenereerde AI-samenvatting per student per feature.
-- Beide admin-only via public.is_platform_admin(), zelfde patroon als student_mentor_notes.

-- =========================================================================
-- ai_interactions (append-only log)
-- =========================================================================
create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  actor_student_id uuid references public.students (id) on delete set null,
  feature text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'success' check (status in ('success', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_interactions_student
  on public.ai_interactions (student_id, created_at desc);
create index if not exists idx_ai_interactions_feature
  on public.ai_interactions (feature, created_at desc);

alter table public.ai_interactions enable row level security;

drop policy if exists "ai_interactions_select_admin" on public.ai_interactions;
create policy "ai_interactions_select_admin"
  on public.ai_interactions for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "ai_interactions_insert_admin" on public.ai_interactions;
create policy "ai_interactions_insert_admin"
  on public.ai_interactions for insert
  to authenticated
  with check (public.is_platform_admin());

-- Bewust geen update/delete policy: dit logboek is append-only.

-- =========================================================================
-- ai_student_summaries (cache, upsert per student + feature)
-- =========================================================================
create table if not exists public.ai_student_summaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  feature text not null default 'mentor_summary',
  summary jsonb not null,
  model text,
  generated_by uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, feature)
);

drop trigger if exists set_ai_student_summaries_updated_at
  on public.ai_student_summaries;
create trigger set_ai_student_summaries_updated_at
  before update on public.ai_student_summaries
  for each row
  execute function public.set_updated_at();

create index if not exists idx_ai_student_summaries_student
  on public.ai_student_summaries (student_id);

alter table public.ai_student_summaries enable row level security;

drop policy if exists "ai_student_summaries_select_admin" on public.ai_student_summaries;
create policy "ai_student_summaries_select_admin"
  on public.ai_student_summaries for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "ai_student_summaries_insert_admin" on public.ai_student_summaries;
create policy "ai_student_summaries_insert_admin"
  on public.ai_student_summaries for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "ai_student_summaries_update_admin" on public.ai_student_summaries;
create policy "ai_student_summaries_update_admin"
  on public.ai_student_summaries for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
