-- Store module and lesson thumbnails in a public bucket, while limiting writes
-- to platform admins who use the authenticated admin UI.

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

grant execute on function public.is_platform_admin() to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "course_thumbnails_public_read" on storage.objects;
create policy "course_thumbnails_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'course-thumbnails');

drop policy if exists "course_thumbnails_admin_insert" on storage.objects;
create policy "course_thumbnails_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-thumbnails'
    and public.is_platform_admin()
  );

drop policy if exists "course_thumbnails_admin_update" on storage.objects;
create policy "course_thumbnails_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-thumbnails'
    and public.is_platform_admin()
  )
  with check (
    bucket_id = 'course-thumbnails'
    and public.is_platform_admin()
  );

drop policy if exists "course_thumbnails_admin_delete" on storage.objects;
create policy "course_thumbnails_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'course-thumbnails'
    and public.is_platform_admin()
  );
