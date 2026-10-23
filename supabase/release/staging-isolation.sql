-- Environment override, never a production migration. No outbound lead automation in staging.
alter table public.students disable trigger on_new_htp_lead;
do $$ begin
  if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
    where not t.tgisinternal and t.tgenabled<>'D' and p.pronamespace='public'::regnamespace
    and pg_get_functiondef(p.oid) ~* 'net\.http|http_post|dblink') then
    raise exception 'An outbound database automation is still enabled';
  end if;
end $$;
