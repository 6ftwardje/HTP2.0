-- Mirror the permissive hand-created policies found on HTP 2.0. Local-only,
-- rollback-only test fixture; this is not a migration.
create policy "Allow public select" on public.students for select to public using (true);
create policy "Allow public insert" on public.students for insert to public with check (true);
create policy "Allow public read" on public.modules for select to public using (true);
create policy "Enable read access for all users" on public.lessons for select to public using (true);
create policy "Allow public read exams" on public.exams for select to public using (true);
create policy "Enable read access for all users" on public.exams for select to public using (true);
create policy "Enable read access for all users" on public.exam_questions for select to public using (true);
create policy "Students can insert own exam results" on public.exam_results for insert to public with check (true);
create policy "Students can insert own progress" on public.progress for insert to public with check (true);
create policy "Students can update own progress" on public.progress for update to public using (true) with check (true);

create table public.practical_lessons (
  id integer primary key,
  module_id integer not null,
  title text not null,
  description text,
  location text,
  thumbnail_url text
);
alter table public.practical_lessons enable row level security;
grant select on public.practical_lessons to anon, authenticated;
create policy "Allow public select practical_lessons"
  on public.practical_lessons for select to public using (true);

-- State that already existed when the entitlement cutover took place.
insert into public.students (id, auth_user_id, email, name, access_level) values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'access-free-new@example.invalid', 'Free new', 1),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'access-free-ready@example.invalid', 'Free ready', 1),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'access-paid@example.invalid', 'Paid', 2),
  ('92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000004', 'access-admin@example.invalid', 'Admin', 3),
  ('92000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000006', 'access-progress-legacy@example.invalid', 'Free progress legacy', 1),
  ('92000000-0000-0000-0000-000000000007', '91000000-0000-0000-0000-000000000007', 'access-forged-result@example.invalid', 'Free result only', 1);

insert into public.student_onboarding_responses (
  student_id, experience_level, primary_market, main_challenge,
  goal_90_days, weekly_time_commitment, mentorship_interest, confidence_score,
  completed_at
) values (
  '92000000-0000-0000-0000-000000000002', 'beginner', 'crypto', 'structuur',
  'plan volgen', '3_5', 'self_paced', 3, now()
);

insert into public.modules (id, title, slug, order_index, is_published) values
  (920000001, 'Access test 1', 'access-test-1', -9204, true),
  (920000002, 'Access test 2', 'access-test-2', -9203, true),
  (920000003, 'Access test 3', 'access-test-3', -9202, true),
  (920000004, 'Access test 4', 'access-test-4', -9201, true),
  (920000005, 'Access test draft', 'access-test-draft', -9200, false),
  (920000006, 'Access test gap', 'access-test-gap', -9199, true);

insert into public.lessons (
  id, module_id, title, slug, video_url, order_index, is_published
) values
  (920000000011, 920000001, 'Preview', 'access-test-lesson-1a', 'https://example.invalid/1a', 1, true),
  (920000000012, 920000001, 'After intake', 'access-test-lesson-1b', 'https://example.invalid/1b', 2, true),
  (920000000021, 920000002, 'Free two', 'access-test-lesson-2', 'https://example.invalid/2', 1, true),
  (920000000031, 920000003, 'Free three', 'access-test-lesson-3', 'https://example.invalid/3', 1, true),
  (920000000041, 920000004, 'Paid four', 'access-test-lesson-4', 'https://example.invalid/4', 1, true);

insert into public.exams (id, module_id, title, is_published) values
  (920000003, 920000003, 'Access test 3', true),
  (920000004, 920000004, 'Access test 4', true);

insert into public.exam_questions (
  id, exam_id, module_id, question, question_text, options,
  correct_answer, order_index
) values (
  920000000051, 920000004, 920000004,
  'Which answer is correct?', 'Which answer is correct?',
  '["A", "B"]'::jsonb, 'A', 1
);

insert into public.practical_lessons (id, module_id, title) values
  (920001, 920000001, 'Free practice'),
  (920004, 920000004, 'Paid practice'),
  (920005, 920000005, 'Draft practice');

-- This submitted attempt came from the server-scored exam flow. An old
-- exam_results row without a matching attempt is intentionally not trusted.
insert into public.exam_attempts (
  student_id, exam_id, module_id, status, score, total_questions, passed, submitted_at
) values (
  '92000000-0000-0000-0000-000000000002', 920000003, 920000003,
  'submitted', 100, 1, true, now()
);
insert into public.exam_results (student_id, exam_id, score, passed) values
  ('92000000-0000-0000-0000-000000000002', 920000003, 100, true),
  ('92000000-0000-0000-0000-000000000002', 920000004, 100, true),
  ('92000000-0000-0000-0000-000000000007', 920000003, 100, true);

insert into public.progress (student_id, lesson_id, watched, watched_at) values
  ('92000000-0000-0000-0000-000000000006', 920000000041, true, now());
