-- Low-risk indexes for the high-frequency student progress and access queries.

create index if not exists idx_exam_results_student_passed_exam
  on public.exam_results (student_id, passed, exam_id);

create index if not exists idx_lessons_published_module_order
  on public.lessons (module_id, order_index)
  where is_published = true;
