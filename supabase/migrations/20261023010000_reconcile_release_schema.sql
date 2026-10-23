-- Schema-only reconciliation after the audited production baseline.
-- These two committed structures were absent from the live schema on 2026-10-23.
-- No student backfill or application data copy.
-- Persistent student next steps. This is intentionally generic so the same
-- surface can later include live sessions, physical lessons, calls, or custom
-- mentor tasks.
create table if not exists public.student_next_steps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  step_key text not null,
  step_type text not null,
  status text not null default 'active',
  title text not null,
  description text,
  href text,
  cta_label text,
  source_table text,
  source_id text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, step_key)
);

alter table public.student_next_steps
  drop constraint if exists student_next_steps_step_type_check;

alter table public.student_next_steps
  add constraint student_next_steps_step_type_check
  check (
    step_type in (
      'intake',
      'lesson',
      'lesson_action',
      'exam',
      'module',
      'mentor_action',
      'live_session',
      'physical_lesson',
      'custom'
    )
  );

alter table public.student_next_steps
  drop constraint if exists student_next_steps_status_check;

alter table public.student_next_steps
  add constraint student_next_steps_status_check
  check (status in ('active', 'completed', 'dismissed'));

drop trigger if exists set_student_next_steps_updated_at
  on public.student_next_steps;
create trigger set_student_next_steps_updated_at
  before update on public.student_next_steps
  for each row
  execute function public.set_updated_at();

create index if not exists idx_student_next_steps_student_status
  on public.student_next_steps (student_id, status, sort_order);

alter table public.student_next_steps enable row level security;

drop policy if exists "student_next_steps_select_own" on public.student_next_steps;
create policy "student_next_steps_select_own"
  on public.student_next_steps for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_insert_own" on public.student_next_steps;
create policy "student_next_steps_insert_own"
  on public.student_next_steps for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_update_own" on public.student_next_steps;
create policy "student_next_steps_update_own"
  on public.student_next_steps for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_next_steps.student_id
        and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_next_steps_select_admin" on public.student_next_steps;
create policy "student_next_steps_select_admin"
  on public.student_next_steps for select
  to authenticated
  using (public.is_platform_admin());


grant select,insert,update on public.student_next_steps to authenticated;
grant all on public.student_next_steps to service_role;
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
