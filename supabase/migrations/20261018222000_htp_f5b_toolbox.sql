-- HTP-31: links and explicit downloads inherit a full module's existing gate.
create table if not exists public.toolbox_resources(
 id uuid primary key default gen_random_uuid(), module_id bigint not null references public.modules(id) on delete restrict,
 title text not null check(length(title) between 1 and 160),description text not null default '' check(length(description)<=600),
 kind text not null check(kind in ('link','file')),url text,filename text,object_path text,sha256 text,byte_size integer,
 sort_order integer not null default 0 check(sort_order between 0 and 10000),version uuid not null default gen_random_uuid(),
 state text not null default 'draft' check(state in ('draft','ready','error','deleting')),storage_ready boolean not null default false,
 error_message text,created_at timestamptz not null default now(),
 check((kind='link' and url is not null and url ~ '^https://' and filename is null and object_path is null and byte_size is null and sha256 is null)
 or (kind='file' and url is null and object_path is not null and byte_size is not null and sha256 is not null and filename is not null and length(filename) between 1 and 180 and object_path='resources/'||id::text||'/source.bin' and byte_size between 1 and 3145728 and sha256 ~ '^[a-f0-9]{64}$')),
 check(state<>'ready' or kind='link' or storage_ready)
);
alter table public.toolbox_resources enable row level security;
revoke all on public.toolbox_resources from public,anon,authenticated;
grant all on public.toolbox_resources to service_role;
create index if not exists toolbox_resources_module_order on public.toolbox_resources(module_id,sort_order,id);
create or replace function public.can_read_toolbox_resource(p_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare r public.toolbox_resources;
begin
 if not public.has_live_learning_account() then return false;end if;
 select * into r from public.toolbox_resources where id=p_id;if r.id is null then return false;end if;
 if public.is_pdf_admin() then return r.state in ('draft','ready') and (r.kind='link' or r.storage_ready);end if;
 return r.state='ready' and (r.kind='link' or r.storage_ready) and public.can_open_academy_module(r.module_id);
end;$$;
revoke all on function public.can_read_toolbox_resource(uuid) from public,anon;
grant execute on function public.can_read_toolbox_resource(uuid) to authenticated;
create or replace function public.list_visible_toolbox_resources(p_modules bigint[])
returns table(id uuid,module_id bigint,title text,description text,kind text,url text,filename text,byte_size integer,sort_order integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if cardinality(p_modules) not between 1 and 100 then raise invalid_parameter_value;end if;
 return query select r.id,r.module_id,r.title,r.description,r.kind,r.url,r.filename,r.byte_size,r.sort_order from public.toolbox_resources r where r.module_id=any(p_modules) and r.state='ready' and public.can_read_toolbox_resource(r.id) order by r.sort_order,r.id;
end;$$;
revoke all on function public.list_visible_toolbox_resources(bigint[]) from public,anon;
grant execute on function public.list_visible_toolbox_resources(bigint[]) to authenticated;
