-- Admin performance: student directory sorting/search and student detail lookups.

create extension if not exists pg_trgm;

create index if not exists idx_students_created_at_desc
  on public.students (created_at desc);

create index if not exists idx_students_email
  on public.students (email);

create index if not exists idx_students_access_level
  on public.students (access_level);

create index if not exists idx_students_name_trgm
  on public.students using gin (name gin_trgm_ops);

create index if not exists idx_students_email_trgm
  on public.students using gin (email gin_trgm_ops);

create index if not exists idx_ai_student_summaries_student_feature
  on public.ai_student_summaries (student_id, feature);
