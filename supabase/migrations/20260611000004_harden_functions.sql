-- Security hardening for Supabase database linter findings.
-- Addresses: anon/authenticated-executable SECURITY DEFINER functions
-- (lints 0028/0029) and mutable function search_path (lint 0011).
-- Verified against both repos before writing:
--   * exec_sql / rls_auto_enable  -> not referenced by any app (orphans)
--   * increment_points            -> called by the mobile app as `authenticated`
--   * is_admin()                  -> used inside RLS policies (must stay executable)
--   * sync_* / gardener_summaries_* -> trigger functions (triggers fire regardless
--                                      of direct EXECUTE grants)
-- Idempotent / safe to re-run.

-- 1. CRITICAL: arbitrary SQL over the public REST API by the anon role.
--    Not used by any application code. Remove it entirely.
drop function if exists public.exec_sql(text);

-- 2. (rls_auto_enable is NOT dropped: it backs the `ensure_rls` event trigger
--    that auto-enables RLS on new tables. It's handled with the other trigger
--    functions in steps 3 and 6 below.)

-- 3. Trigger / event-trigger functions must not be directly callable via
--    /rest/v1/rpc. Revoking EXECUTE does NOT stop the triggers from firing.
do $$
declare
  r record;
  fns text[] := array[
    'sync_profile_email',
    'sync_admin_profile_fields',
    'sync_journal_mood',
    'gardener_summaries_update',
    'gardener_summaries_delete',
    'rls_auto_enable'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(fns)
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $$;

-- 4. increment_points: the mobile app calls it as an authenticated user, so keep
--    that grant, but the anon role has no reason to award points.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'increment_points'
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;

-- 5. increment_ai_calls: written by edge functions via the service-role key
--    (which ignores grants). No public role should call it directly.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'increment_ai_calls'
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $$;

-- 6. Pin search_path on every SECURITY DEFINER / flagged function so it can't be
--    hijacked. These bodies reference public tables and the (schema-qualified)
--    auth.uid(), so `public, pg_temp` keeps them resolving while making the
--    search_path immutable. Signature-agnostic so it works whatever the args are.
do $$
declare
  r record;
  fns text[] := array[
    'increment_points',
    'increment_ai_calls',
    'is_admin',
    'sync_profile_email',
    'sync_admin_profile_fields',
    'sync_journal_mood',
    'gardener_summaries_update',
    'gardener_summaries_delete',
    'rls_auto_enable'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(fns)
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;
