-- HTP-29: presentation metadata only; parent entitlements remain authoritative.
alter table public.pdf_documents
 add column if not exists description text not null default '' check(length(description)<=600),
 add column if not exists sort_order integer not null default 0 check(sort_order between 0 and 10000),
 add column if not exists shelf text not null default 'course' check(shelf in ('course','toolbox')),
 add column if not exists cover_path text;
alter table public.pdf_documents drop constraint if exists pdf_cover_path_valid;
alter table public.pdf_documents add constraint pdf_cover_path_valid check(cover_path is null or cover_path ~ ('^covers/'||id::text||'/[a-f0-9-]{36}\.webp$'));
create index if not exists pdf_documents_update_order on public.pdf_documents(weekly_update_id,sort_order,id);
create index if not exists pdf_documents_module_order on public.pdf_documents(module_id,shelf,sort_order,id);

create or replace function public.list_visible_pdf_documents(p_kind text,p_parent_ids bigint[])
returns table(id uuid,title text,description text,page_count integer,version uuid,shelf text,sort_order integer,has_cover boolean,reading_available boolean,module_id bigint,weekly_update_id bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_kind not in ('update','module') or cardinality(p_parent_ids) not between 1 and 100 then raise invalid_parameter_value using message='Invalid parents'; end if;
 return query select d.id,d.title,d.description,d.page_count,d.version,d.shelf,d.sort_order,d.cover_path is not null,d.accessible_verified,d.module_id,d.weekly_update_id
 from public.pdf_documents d where
 ((p_kind='update' and d.weekly_update_id=any(p_parent_ids)) or (p_kind='module' and d.module_id=any(p_parent_ids)))
 and d.state='ready' and d.storage_ready and public.can_read_pdf(d.id)
 order by d.sort_order,d.id;
end;$$;
revoke all on function public.list_visible_pdf_documents(text,bigint[]) from public,anon;
grant execute on function public.list_visible_pdf_documents(text,bigint[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('protected-learning-assets','protected-learning-assets',false,3145728,array['image/webp','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists protected_learning_assets_no_direct_access on storage.objects;
create policy protected_learning_assets_no_direct_access on storage.objects as restrictive for all to public
using(bucket_id<>'protected-learning-assets') with check(bucket_id<>'protected-learning-assets');
