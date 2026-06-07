-- Allow authenticated users to create their own `students` row
-- so `ensureCurrentStudent()` can bootstrap after magic link login.

create policy "students_insert_own"
  on public.students for insert
  to authenticated
  with check (auth_user_id = auth.uid());

