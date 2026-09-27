-- Safe to apply before the Academy application rollout. These historical
-- permissive policies exposed student profiles, exam answers and lesson URLs
-- to anonymous callers, and allowed authenticated users to grant themselves
-- admin access or write a forged passed exam result.
drop policy if exists "Allow public select" on public.students;
drop policy if exists "Allow public insert" on public.students;
drop policy if exists "Enable read access for all users" on public.lessons;
drop policy if exists "Enable read access for all users" on public.exam_questions;
drop policy if exists "Students can insert own exam results" on public.exam_results;

-- Signup still works: ensureCurrentStudent uses the defaults below.
drop policy if exists "students_insert_own" on public.students;
create policy "students_insert_own"
  on public.students for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and access_level = 1
    and mentor_status = 'active'
    and cardinality(tags) = 0
  );

-- The old own-profile UPDATE policy checked only auth_user_id. A row trigger
-- closes the privileged-column hole without blocking name/phone/intake edits.
create or replace function public.protect_student_privileged_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to update a student'
      using errcode = '42501';
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  if (to_jsonb(new) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at']) then
    raise exception 'Only profile fields can be changed by a student'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_student_privileged_fields on public.students;
create trigger protect_student_privileged_fields
  before update on public.students
  for each row execute function public.protect_student_privileged_fields();

revoke all on function public.protect_student_privileged_fields() from public, anon, authenticated;
