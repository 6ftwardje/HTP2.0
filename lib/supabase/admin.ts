/**
 * Admin data access uses `@/lib/supabase/server` (anon key + user session) with RLS policies
 * for `access_level = 3` — see `supabase/migrations/*_admin_rls_policies.sql`.
 *
 * A service-role client is not required for the admin UI. You can still add
 * `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` here for one-off server scripts if needed.
 */
