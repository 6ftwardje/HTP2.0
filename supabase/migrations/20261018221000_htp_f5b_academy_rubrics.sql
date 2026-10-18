-- HTP-30: explicit presentation grouping; never an additional entitlement layer.
create table if not exists public.academy_rubrics(
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
 description text not null default '' check(length(description)<=1000),
 sort_order integer not null default 0 check(sort_order between 0 and 10000),
 is_published boolean not null default false, version integer not null default 1 check(version>0)
);
create table if not exists public.academy_rubric_modules(
 rubric_id uuid not null references public.academy_rubrics(id) on delete cascade,
 module_id bigint not null references public.modules(id) on delete restrict,
 primary key(rubric_id,module_id)
);
alter table public.academy_rubrics enable row level security;
alter table public.academy_rubric_modules enable row level security;
revoke all on public.academy_rubrics,public.academy_rubric_modules from public,anon,authenticated;
grant select on public.academy_rubrics,public.academy_rubric_modules to authenticated;
grant all on public.academy_rubrics,public.academy_rubric_modules to service_role;
create or replace function public.has_live_learning_account() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s join auth.users u on u.id=s.auth_user_id where u.id=auth.uid());
$$;
revoke all on function public.has_live_learning_account() from public,anon;
grant execute on function public.has_live_learning_account() to authenticated;
drop policy if exists academy_rubrics_read on public.academy_rubrics;
create policy academy_rubrics_read on public.academy_rubrics for select to authenticated using(public.has_live_learning_account() and (is_published or public.is_pdf_admin()));
drop policy if exists academy_rubric_modules_read on public.academy_rubric_modules;
create policy academy_rubric_modules_read on public.academy_rubric_modules for select to authenticated using(exists(select 1 from public.academy_rubrics r where r.id=rubric_id));

create or replace function public.save_academy_rubric(p_id uuid,p_version integer,p_title text,p_slug text,p_description text,p_sort_order integer,p_published boolean,p_modules bigint[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_current integer;
begin
 if not public.is_pdf_admin() then raise insufficient_privilege;end if;
 if p_title is null or length(trim(p_title)) not between 1 and 160 or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' or p_description is null or length(p_description)>1000 or p_sort_order is null or p_sort_order not between 0 and 10000 or p_published is null or p_modules is null or cardinality(p_modules)>100 then raise invalid_parameter_value;end if;
 if exists(select 1 from unnest(p_modules) m where m is null or not exists(select 1 from public.modules x where x.id=m)) or (p_published and cardinality(p_modules)=0) then raise invalid_parameter_value using message='Choose existing modules';end if;
 if p_id is null then
  insert into public.academy_rubrics(title,slug,description,sort_order,is_published) values(trim(p_title),p_slug,p_description,p_sort_order,p_published) returning id into v_id;
 else
  select version into v_current from public.academy_rubrics where id=p_id for update;
  if v_current is null or v_current is distinct from p_version then raise exception using errcode='40001',message='Rubric changed';end if;
  update public.academy_rubrics set title=trim(p_title),slug=p_slug,description=p_description,sort_order=p_sort_order,is_published=p_published,version=version+1 where id=p_id;v_id=p_id;
 end if;
 delete from public.academy_rubric_modules where rubric_id=v_id;
 insert into public.academy_rubric_modules(rubric_id,module_id) select v_id,m from unnest(p_modules)m group by m;
 return v_id;
end;$$;
revoke all on function public.save_academy_rubric(uuid,integer,text,text,text,integer,boolean,bigint[]) from public,anon;
grant execute on function public.save_academy_rubric(uuid,integer,text,text,text,integer,boolean,bigint[]) to authenticated;
create or replace function public.delete_academy_rubric(p_id uuid,p_version integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_pdf_admin() then raise insufficient_privilege;end if;
 delete from public.academy_rubrics where id=p_id and version=p_version;
 if not found then raise exception using errcode='40001',message='Rubric changed';end if;
 -- Only the presentation mapping is removed. Modules, PDFs, progress and exams survive.
 return true;
end;$$;
revoke all on function public.delete_academy_rubric(uuid,integer) from public,anon;
grant execute on function public.delete_academy_rubric(uuid,integer) to authenticated;
