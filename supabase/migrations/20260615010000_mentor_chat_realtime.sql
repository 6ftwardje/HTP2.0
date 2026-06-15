-- Enable Supabase Realtime Postgres Changes for mentor chat tables.
-- Safe to run repeatedly: each table is added only when missing.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_threads'
  ) then
    alter publication supabase_realtime add table public.conversation_threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_recipients'
  ) then
    alter publication supabase_realtime add table public.notification_recipients;
  end if;
end $$;
