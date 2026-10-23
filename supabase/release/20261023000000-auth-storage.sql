-- Custom auth triggers, storage policies, bucket configuration and Realtime table membership.
-- No auth users, files, subscriptions, provider secrets, cron jobs or application rows.
CREATE TRIGGER cleanup_deleted_auth_market_profile AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_auth_market_profile();
CREATE TRIGGER cleanup_deleted_auth_pdf_logs BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_auth_pdf_logs();
CREATE TRIGGER cleanup_deleted_auth_pdf_positions BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_auth_pdf_positions();
CREATE TRIGGER cleanup_deleted_auth_video_positions AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_auth_video_positions();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
create policy "Students with access_level >= 2 can view PDF" on storage.objects as PERMISSIVE for SELECT to authenticated using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.access_level >= 2))))));
create policy avatars_storage_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'profile-avatars'::text) AND (EXISTS ( SELECT 1
   FROM public.student_avatars a
  WHERE (a.object_path = objects.name)))));
create policy course_thumbnails_admin_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'course-thumbnails'::text) AND public.is_platform_admin()));
create policy course_thumbnails_admin_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'course-thumbnails'::text) AND public.is_platform_admin()));
create policy course_thumbnails_admin_update on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'course-thumbnails'::text) AND public.is_platform_admin())) with check (((bucket_id = 'course-thumbnails'::text) AND public.is_platform_admin()));
create policy course_thumbnails_public_read on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'course-thumbnails'::text));
create policy market_update_charts_no_direct_read on storage.objects as RESTRICTIVE for SELECT to public using ((bucket_id <> 'market-update-charts'::text));
create policy mentor_chat_attachments_no_direct_storage on storage.objects as RESTRICTIVE for ALL to public using ((bucket_id <> 'mentor-chat-attachments'::text)) with check ((bucket_id <> 'mentor-chat-attachments'::text));
create policy protected_learning_assets_no_direct_access on storage.objects as RESTRICTIVE for ALL to public using ((bucket_id <> 'protected-learning-assets'::text)) with check ((bucket_id <> 'protected-learning-assets'::text));
create policy protected_pdfs_no_direct_access on storage.objects as RESTRICTIVE for ALL to public using ((bucket_id <> 'protected-pdfs'::text)) with check ((bucket_id <> 'protected-pdfs'::text));
create policy updates_images_delete_own_mentors_only on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'update-images'::text) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.access_level = 3)))) AND (owner = auth.uid())));
create policy updates_images_insert_mentors_only on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'update-images'::text) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.access_level = 3))))));
create policy updates_images_select_all_students on storage.objects as PERMISSIVE for SELECT to public using (((bucket_id = 'update-images'::text) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = s.id))))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('black friday','black friday',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('course-materials','course-materials',false,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('course-thumbnails','course-thumbnails',true,5242880,'{image/jpeg,image/png,image/webp,image/avif}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('Cryptoriez','Cryptoriez',false,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('Cryptoriez Landingspage','Cryptoriez Landingspage',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('HTP','HTP',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('HTP Icons','HTP Icons',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('lesson-thumbnails','lesson-thumbnails',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('market-update-charts','market-update-charts',false,10485760,'{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('mentor-chat-attachments','mentor-chat-attachments',false,4194304,'{image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('mentor-photos','mentor-photos',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('Peak Landingspage','Peak Landingspage',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('praktijk-thumbnails','praktijk-thumbnails',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('profile-avatars','profile-avatars',false,1048576,'{image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('protected-learning-assets','protected-learning-assets',false,3145728,'{image/webp,application/octet-stream}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('protected-pdfs','protected-pdfs',false,3145728,'{application/pdf}'::text[]) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('socialbrand.com','socialbrand.com',true,null,null) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('update-images','update-images',false,null,null) on conflict (id) do nothing;
alter publication supabase_realtime add table public.conversation_messages;
alter publication supabase_realtime add table public.conversation_threads;
alter publication supabase_realtime add table public.notification_recipients;
