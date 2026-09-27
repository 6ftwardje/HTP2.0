-- Local-only, rollback-only integration test:
-- PGPASSWORD=postgres psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 \
--   -U postgres -d postgres -f tests/sql/admin-audit-log.sql
\set ON_ERROR_STOP on
begin;
\ir ../../supabase/migrations/20260927030000_admin_audit_log.sql

set role authenticated;
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT') then
    raise exception 'Browser role can read or write the admin audit trail';
  end if;
end;
$$;

reset role;
set role service_role;
insert into public.admin_audit_log (event_type, actor_student_id)
values ('test.created', '27030000-0000-4000-8000-000000000001');
reset role;

do $$
begin
  if (select count(*) from public.admin_audit_log where event_type = 'test.created') <> 1 then
    raise exception 'Service-role audit insert failed';
  end if;

  begin
    update public.admin_audit_log set event_type = 'test.changed'
    where event_type = 'test.created';
    raise exception 'Audit UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.admin_audit_log where event_type = 'test.created';
    raise exception 'Audit DELETE unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
