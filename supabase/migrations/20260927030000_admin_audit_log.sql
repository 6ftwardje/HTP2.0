-- Append-only log of successful admin actions. Only trusted server code with
-- the service-role key inserts; no authenticated client can read or write it.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    char_length(event_type) between 3 and 128
    and event_type ~ '^[a-z][a-z0-9_.]*$'
  ),
  -- Keep identifiers even if a student account is later removed; the event
  -- remains attributable without storing names, emails, or note bodies.
  actor_student_id uuid not null,
  target_student_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_actor_created_at
  on public.admin_audit_log (actor_student_id, created_at desc);
create index if not exists idx_admin_audit_log_target_created_at
  on public.admin_audit_log (target_student_id, created_at desc)
  where target_student_id is not null;

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant insert on public.admin_audit_log to service_role;
-- Deliberately no RLS policies: direct browser reads, inserts, updates, and
-- deletes are all denied. The service-role client bypasses RLS for inserts.

create or replace function public.reject_admin_audit_log_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'admin_audit_log is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists reject_admin_audit_log_update_delete on public.admin_audit_log;
create trigger reject_admin_audit_log_update_delete
  before update or delete on public.admin_audit_log
  for each row execute function public.reject_admin_audit_log_mutation();

drop trigger if exists reject_admin_audit_log_truncate on public.admin_audit_log;
create trigger reject_admin_audit_log_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.reject_admin_audit_log_mutation();
