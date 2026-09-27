-- Chart images are private. Only the server checks subscription access before serving them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-update-charts', 'market-update-charts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- An older broad SELECT policy on storage.objects allows level-2 students to
-- read objects from *any* bucket. This restrictive policy closes that path for
-- charts without changing access to existing buckets. Service role bypasses RLS.
drop policy if exists market_update_charts_no_direct_read on storage.objects;
create policy market_update_charts_no_direct_read
  on storage.objects as restrictive for select to public
  using (bucket_id <> 'market-update-charts');
