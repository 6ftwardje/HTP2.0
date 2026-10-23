select jsonb_build_object(
  'columns', (select coalesce(jsonb_agg(to_jsonb(c) order by c.table_name,c.column_name),'[]') from (
    select table_name,column_name,udt_name,is_nullable,column_default,is_identity,identity_generation
    from information_schema.columns where table_schema='public'
  ) c),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(c) order by c.table_name,c.name),'[]') from (
    select r.relname as table_name,c.conname as name,pg_get_constraintdef(c.oid,true) as definition
    from pg_constraint c join pg_class r on r.oid=c.conrelid where r.relnamespace='public'::regnamespace
  ) c),
  'indexes', (select coalesce(jsonb_agg(to_jsonb(i) order by i.tablename,i.indexname),'[]') from (
    select tablename,indexname,indexdef from pg_indexes where schemaname='public'
  ) i),
  'functions', (select coalesce(jsonb_agg(to_jsonb(f) order by f.signature),'[]') from (
    select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,
      p.prosecdef as security_definer,
      (select array_agg(a::text order by a::text) from unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a) as acl
    from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
  ) f),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname),'[]') from (
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies where schemaname in ('public','storage')
  ) p),
  'rls', (select coalesce(jsonb_agg(to_jsonb(r) order by r.relname),'[]') from (
    select relname,relrowsecurity,relforcerowsecurity from pg_class
    where relnamespace='public'::regnamespace and relkind in ('r','p')
  ) r),
  'views', (select coalesce(jsonb_agg(to_jsonb(v) order by v.relname),'[]') from (
    select c.relname,pg_get_viewdef(c.oid,true) as definition,c.reloptions
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('v','m')
  ) v),
  'table_acl', (select coalesce(jsonb_agg(to_jsonb(t) order by t.relname),'[]') from (
    select c.relname,(select array_agg(a::text order by a::text) from unnest(coalesce(c.relacl,acldefault('r',c.relowner))) a) as acl
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v')
  ) t),
  'triggers', (select coalesce(jsonb_agg(to_jsonb(t) order by t.schema_name,t.table_name,t.name),'[]') from (
    select n.nspname as schema_name,c.relname as table_name,t.tgname as name,t.tgenabled as enabled,pg_get_triggerdef(t.oid,true) as definition
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.pronamespace='public'::regnamespace
  ) t),
  'enums', (select coalesce(jsonb_agg(to_jsonb(e) order by e.name,e.enumsortorder),'[]') from (
    select t.typname as name,e.enumlabel,e.enumsortorder from pg_enum e join pg_type t on t.oid=e.enumtypid
    where t.typnamespace='public'::regnamespace
  ) e)
)::text
