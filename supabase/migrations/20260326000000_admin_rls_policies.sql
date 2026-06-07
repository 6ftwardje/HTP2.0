-- Allow platform admins (students.access_level = 3) to manage directory and progress
-- using the normal authenticated Supabase client (anon key + JWT). No service_role needed.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where auth_user_id = auth.uid()
      and access_level = 3
  );
$$;

comment on function public.is_platform_admin() is 'True when the current user is a platform admin (access_level 3). Uses SECURITY DEFINER to avoid RLS recursion on students.';

grant execute on function public.is_platform_admin() to authenticated;

-- students: admins can read all rows (OR with students_select_own)
create policy "students_select_admin"
  on public.students for select
  to authenticated
  using (public.is_platform_admin());

-- students: admins can update any row (e.g. access_level) (OR with students_update_own_profile)
create policy "students_update_admin"
  on public.students for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- progress: admins can read all rows
create policy "progress_select_admin"
  on public.progress for select
  to authenticated
  using (public.is_platform_admin());

-- progress: admins can insert for any student
create policy "progress_insert_admin"
  on public.progress for insert
  to authenticated
  with check (public.is_platform_admin());

-- progress: admins can update any row
create policy "progress_update_admin"
  on public.progress for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- progress: admins can delete (module / full reset)
create policy "progress_delete_admin"
  on public.progress for delete
  to authenticated
  using (public.is_platform_admin());

-- exam_results: admins can read all (student detail / analytics)
create policy "exam_results_select_admin"
  on public.exam_results for select
  to authenticated
  using (public.is_platform_admin());
