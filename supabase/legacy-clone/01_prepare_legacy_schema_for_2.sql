-- Run this script ONLY on a restored clone of the legacy Trade Platform.
-- It is intentionally kept outside supabase/migrations so it cannot be pushed
-- accidentally as part of the normal migration chain.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Modules --------------------------------------------------------------------

alter table public.modules add column if not exists slug text;
alter table public.modules add column if not exists short_description text;
alter table public.modules add column if not exists order_index integer;
alter table public.modules add column if not exists thumbnail_url text;
alter table public.modules add column if not exists is_published boolean default true;
alter table public.modules add column if not exists created_at timestamptz default now();
alter table public.modules add column if not exists updated_at timestamptz default now();

update public.modules
set
  slug = coalesce(
    slug,
    regexp_replace(
      lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g')),
      '(^-+|-+$)',
      '',
      'g'
    ) || '-' || id::text
  ),
  short_description = coalesce(short_description, description),
  order_index = coalesce(order_index, "order"),
  thumbnail_url = coalesce(thumbnail_url, icon_url),
  is_published = coalesce(is_published, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if exists (
    select 1 from public.modules
    where slug is null or order_index is null
  ) then
    raise exception 'Cannot prepare modules: slug or order_index is null';
  end if;
end
$$;

alter table public.modules alter column slug set not null;
alter table public.modules alter column order_index set not null;
alter table public.modules alter column is_published set not null;
alter table public.modules alter column created_at set not null;
alter table public.modules alter column updated_at set not null;

create unique index if not exists modules_slug_unique on public.modules (slug);
create unique index if not exists modules_order_index_unique on public.modules (order_index);
create index if not exists idx_modules_is_published
  on public.modules (is_published) where is_published = true;

drop trigger if exists set_modules_updated_at on public.modules;
create trigger set_modules_updated_at
  before update on public.modules
  for each row
  execute function public.set_updated_at();

-- Lessons --------------------------------------------------------------------

alter table public.lessons add column if not exists slug text;
alter table public.lessons add column if not exists video_provider text default 'vimeo';
alter table public.lessons add column if not exists video_duration_seconds integer;
alter table public.lessons add column if not exists order_index integer;
alter table public.lessons add column if not exists is_published boolean default true;
alter table public.lessons add column if not exists created_at timestamptz default now();
alter table public.lessons add column if not exists updated_at timestamptz default now();

with ordered_lessons as (
  select
    id,
    coalesce(
      "order",
      row_number() over (
        partition by module_id
        order by "order" nulls last, id
      )::integer
    ) as generated_order
  from public.lessons
)
update public.lessons l
set
  slug = coalesce(
    slug,
    regexp_replace(
      lower(regexp_replace(trim(l.title), '[^a-zA-Z0-9]+', '-', 'g')),
      '(^-+|-+$)',
      '',
      'g'
    ) || '-' || l.id::text
  ),
  video_provider = coalesce(video_provider, 'vimeo'),
  order_index = coalesce(order_index, ordered_lessons.generated_order),
  is_published = coalesce(is_published, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
from ordered_lessons
where l.id = ordered_lessons.id;

do $$
begin
  if exists (
    select 1 from public.lessons
    where slug is null or order_index is null
  ) then
    raise exception 'Cannot prepare lessons: slug or order_index is null';
  end if;
end
$$;

alter table public.lessons alter column slug set not null;
alter table public.lessons alter column video_provider set not null;
alter table public.lessons alter column order_index set not null;
alter table public.lessons alter column is_published set not null;
alter table public.lessons alter column created_at set not null;
alter table public.lessons alter column updated_at set not null;

create unique index if not exists lessons_slug_unique on public.lessons (slug);
create unique index if not exists lessons_module_order_unique
  on public.lessons (module_id, order_index);
create index if not exists idx_lessons_is_published
  on public.lessons (is_published) where is_published = true;

drop trigger if exists set_lessons_updated_at on public.lessons;
create trigger set_lessons_updated_at
  before update on public.lessons
  for each row
  execute function public.set_updated_at();

-- Exams ----------------------------------------------------------------------

alter table public.exams add column if not exists description text;
alter table public.exams add column if not exists passing_score integer default 70;
alter table public.exams add column if not exists is_published boolean default true;
alter table public.exams add column if not exists created_at timestamptz default now();
alter table public.exams add column if not exists updated_at timestamptz default now();

update public.exams
set
  passing_score = coalesce(passing_score, 70),
  is_published = coalesce(is_published, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.exams alter column passing_score set not null;
alter table public.exams alter column is_published set not null;
alter table public.exams alter column created_at set not null;
alter table public.exams alter column updated_at set not null;

create unique index if not exists exams_module_id_unique on public.exams (module_id);
create index if not exists idx_exams_is_published
  on public.exams (is_published) where is_published = true;

drop trigger if exists set_exams_updated_at on public.exams;
create trigger set_exams_updated_at
  before update on public.exams
  for each row
  execute function public.set_updated_at();

-- Exam questions -------------------------------------------------------------

alter table public.exam_questions add column if not exists order_index integer;
alter table public.exam_questions add column if not exists created_at timestamptz default now();
alter table public.exam_questions add column if not exists updated_at timestamptz default now();

with ordered_questions as (
  select
    id,
    row_number() over (partition by exam_id order by id)::integer as generated_order
  from public.exam_questions
)
update public.exam_questions q
set order_index = ordered_questions.generated_order
from ordered_questions
where q.id = ordered_questions.id
  and q.order_index is null;

update public.exam_questions
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.exam_questions alter column order_index set not null;
alter table public.exam_questions alter column created_at set not null;
alter table public.exam_questions alter column updated_at set not null;

create unique index if not exists exam_questions_exam_order_unique
  on public.exam_questions (exam_id, order_index);

drop trigger if exists set_exam_questions_updated_at on public.exam_questions;
create trigger set_exam_questions_updated_at
  before update on public.exam_questions
  for each row
  execute function public.set_updated_at();

-- Existing progress and result history ---------------------------------------

alter table public.progress add column if not exists created_at timestamptz default now();
alter table public.progress add column if not exists updated_at timestamptz default now();

update public.progress
set
  created_at = coalesce(created_at, watched_at, now()),
  updated_at = coalesce(updated_at, watched_at, now());

alter table public.progress alter column created_at set not null;
alter table public.progress alter column updated_at set not null;

create unique index if not exists progress_student_lesson_unique
  on public.progress (student_id, lesson_id);

drop trigger if exists set_progress_updated_at on public.progress;
create trigger set_progress_updated_at
  before update on public.progress
  for each row
  execute function public.set_updated_at();

alter table public.exam_results add column if not exists created_at timestamptz default now();

update public.exam_results
set created_at = coalesce(created_at, submitted_at, now());

alter table public.exam_results alter column created_at set not null;

-- RLS expected by the server-side 2.0 application ----------------------------

alter table public.students enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_results enable row level security;
alter table public.progress enable row level security;

drop policy if exists "modules_select_published" on public.modules;
create policy "modules_select_published"
  on public.modules for select
  to authenticated
  using (is_published = true);

drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_published"
  on public.lessons for select
  to authenticated
  using (is_published = true);

drop policy if exists "exams_select_published" on public.exams;
create policy "exams_select_published"
  on public.exams for select
  to authenticated
  using (is_published = true);

drop policy if exists "exam_questions_select_published_exams" on public.exam_questions;
create policy "exam_questions_select_published_exams"
  on public.exam_questions for select
  to authenticated
  using (
    exists (
      select 1
      from public.exams e
      where e.id = exam_questions.exam_id
        and e.is_published = true
    )
  );

drop policy if exists "students_select_own" on public.students;
create policy "students_select_own"
  on public.students for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "students_update_own_profile" on public.students;
create policy "students_update_own_profile"
  on public.students for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "students_insert_own" on public.students;
create policy "students_insert_own"
  on public.students for insert
  to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own"
  on public.progress for select
  to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own"
  on public.progress for insert
  to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
  on public.progress for update
  to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = progress.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "exam_results_select_own" on public.exam_results;
create policy "exam_results_select_own"
  on public.exam_results for select
  to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = exam_results.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "exam_results_insert_own" on public.exam_results;
create policy "exam_results_insert_own"
  on public.exam_results for insert
  to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = exam_results.student_id and s.auth_user_id = auth.uid()
    )
  );

commit;
