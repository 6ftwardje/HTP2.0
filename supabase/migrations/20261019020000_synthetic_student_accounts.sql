-- Q2.3: service-owned classification. User metadata and email patterns are not proof.
create table if not exists public.student_test_accounts(
 student_id uuid primary key references public.students(id) on delete cascade,
 run_id uuid not null,
 created_at timestamptz not null default now()
);
alter table public.student_test_accounts enable row level security;
revoke all on public.student_test_accounts from public,anon,authenticated;
grant select on public.student_test_accounts to authenticated;
grant all on public.student_test_accounts to service_role;
drop policy if exists student_test_accounts_admin_read on public.student_test_accounts;
create policy student_test_accounts_admin_read on public.student_test_accounts for select to authenticated using(public.is_platform_admin());

create or replace function public.is_synthetic_auth_user(p_auth_user_id uuid) returns boolean
-- Fresh snapshot is required inside the production Auth INSERT -> profile INSERT trigger chain.
language sql volatile security definer set search_path='' as $$
 select (auth.uid() is null or auth.uid()=p_auth_user_id or public.is_platform_admin()) and exists(
  select 1 from auth.users u where u.id=p_auth_user_id
  and u.raw_app_meta_data->>'synthetic_test_run_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
$$;
revoke all on function public.is_synthetic_auth_user(uuid) from public,anon;
grant execute on function public.is_synthetic_auth_user(uuid) to authenticated,service_role,supabase_auth_admin;

create or replace function public.student_is_synthetic(p_student_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_test_accounts t where t.student_id=p_student_id)
  or exists(select 1 from public.students s join auth.users u on u.id=s.auth_user_id where s.id=p_student_id
   and u.raw_app_meta_data->>'synthetic_test_run_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
$$;
revoke all on function public.student_is_synthetic(uuid) from public,anon,authenticated;
grant execute on function public.student_is_synthetic(uuid) to service_role;

create or replace function public.mark_synthetic_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_run text;
begin
 select u.raw_app_meta_data->>'synthetic_test_run_id' into v_run from auth.users u where u.id=new.auth_user_id;
 if v_run ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  insert into public.student_test_accounts(student_id,run_id) values(new.id,v_run::uuid) on conflict(student_id) do nothing;
 end if;
 return new;
end;$$;
revoke all on function public.mark_synthetic_student() from public,anon,authenticated;
drop trigger if exists aaa_mark_synthetic_student on public.students;
create trigger aaa_mark_synthetic_student after insert on public.students for each row execute function public.mark_synthetic_student();

-- Preserve the observed optional integration without copying or changing its URL.
-- The trusted Auth marker is checked even before the classification AFTER trigger.
do $$
begin
 if exists(select 1 from pg_trigger where tgrelid='public.students'::regclass and tgname='on_new_htp_lead') then
  if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where t.tgrelid='public.students'::regclass and t.tgname='on_new_htp_lead' and n.nspname='public' and p.proname='notify_clickup_on_lead' and t.tgtype=5 and t.tgnargs=0 and t.tgenabled='O') then
   raise exception 'Review the unexpected existing lead trigger before applying Q2.3';
  end if;
  drop trigger on_new_htp_lead on public.students;
  create trigger on_new_htp_lead after insert on public.students for each row
   when(not public.is_synthetic_auth_user(new.auth_user_id)) execute function public.notify_clickup_on_lead();
 end if;
end;$$;

-- Security-invoker preserves the existing students RLS. Admins see the flags;
-- ordinary members cannot inspect private classification or other students.
create or replace view public.student_directory with(security_invoker=true) as
 select s.* from public.students s where not exists(select 1 from public.student_test_accounts t where t.student_id=s.id);
revoke all on public.student_directory from public,anon;
grant select on public.student_directory to authenticated,service_role;

-- Keep the existing optional bounce/unsubscribe behavior and add synthetic denial.
create or replace function public.chat_email_is_suppressed(p_student_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_user uuid;v_email text;v_suppressed boolean;
begin
 if public.student_is_synthetic(p_student_id) then return true;end if;
 select u.id,u.email into v_user,v_email from public.students s join auth.users u on u.id=s.auth_user_id where s.id=p_student_id;
 if not found or v_email is null then return true;end if;
 if to_regclass('public.email_contacts') is not null then
  execute 'select exists(select 1 from public.email_contacts where auth_user_id=$1 and deleted_at is not null)' into v_suppressed using v_user;
  if v_suppressed then return true;end if;
 end if;
 if to_regclass('public.email_suppressions') is null then return false;end if;
 if to_regprocedure('public.email_identity_key(text)') is null then return true;end if;
 execute 'select exists(select 1 from public.email_suppressions where scope in (''all'',''mentor'') and identity_key=public.email_identity_key($1))' into v_suppressed using v_email;
 if v_suppressed then return true;end if;
 if to_regclass('public.email_contacts') is not null then
  execute 'select exists(select 1 from public.email_suppressions x join public.email_contacts c on c.identity_key=x.identity_key where c.auth_user_id=$1 and x.scope in (''all'',''mentor''))' into v_suppressed using v_user;
 end if;
 return coalesce(v_suppressed,false);
exception when others then return true;
end;$$;

create or replace function public.automation_email_allowed(p_auth_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.students s on s.auth_user_id=u.id
  where u.id=p_auth_user_id and not public.student_is_synthetic(s.id));
$$;
create or replace function public.test_account_chat_email_allowed(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_email_outbox j join public.conversation_threads t on t.id=j.thread_id where j.id=p_job_id
  and not public.student_is_synthetic(j.recipient_student_id) and not public.student_is_synthetic(j.mentor_student_id) and not public.student_is_synthetic(t.student_id));
$$;
revoke all on function public.automation_email_allowed(uuid),public.test_account_chat_email_allowed(uuid) from public,anon,authenticated;
grant execute on function public.automation_email_allowed(uuid),public.test_account_chat_email_allowed(uuid) to service_role;

create or replace function public.deny_synthetic_chat_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.student_is_synthetic(new.recipient_student_id) or public.student_is_synthetic(new.mentor_student_id)
  or exists(select 1 from public.conversation_threads t where t.id=new.thread_id and public.student_is_synthetic(t.student_id)) then return null;end if;
 return new;
end;$$;
revoke all on function public.deny_synthetic_chat_email() from public,anon,authenticated;
drop trigger if exists deny_synthetic_chat_email on public.chat_email_outbox;
create trigger deny_synthetic_chat_email before insert on public.chat_email_outbox for each row execute function public.deny_synthetic_chat_email();

create or replace function public.cancel_classified_test_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.chat_email_outbox j set status='cancelled',last_error='synthetic_account',lease_token=null,lease_until=null
 where status in('queued','retry','leased') and (j.recipient_student_id=new.student_id or j.mentor_student_id=new.student_id
  or exists(select 1 from public.conversation_threads t where t.id=j.thread_id and t.student_id=new.student_id));
 return new;
end;$$;
revoke all on function public.cancel_classified_test_email() from public,anon,authenticated;
drop trigger if exists cancel_classified_test_email on public.student_test_accounts;
create trigger cancel_classified_test_email after insert on public.student_test_accounts for each row execute function public.cancel_classified_test_email();
notify pgrst,'reload schema';
