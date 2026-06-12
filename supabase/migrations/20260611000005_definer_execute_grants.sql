-- Follow-up to 20260611000004. The linter (0028/0029) still flags several
-- SECURITY DEFINER functions as executable by anon/authenticated because
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default — revoking from
-- anon/authenticated alone is ineffective while PUBLIC still holds the grant.
--
-- Strategy:
--   * Trigger / event-trigger functions  -> REVOKE EXECUTE FROM PUBLIC (+roles).
--     Triggers still fire; nothing should call them over /rest/v1/rpc.
--   * is_admin()        -> convert to SECURITY INVOKER. It only reads the
--     caller's own profiles row (permitted by the "own data only" policy), so
--     RLS policies that call it keep working, and it's no longer a DEFINER
--     function. Verified: is_admin() is not referenced by any policy ON profiles,
--     so there is no RLS recursion.
--   * increment_points()-> convert to SECURITY INVOKER. Also closes a real hole:
--     as DEFINER any signed-in user could award arbitrary points to any user_id.
--     As INVOKER the UPDATE is constrained by the caller's own-row RLS.
-- Idempotent / safe to re-run.

-- 1. Trigger / event-trigger functions: remove all direct RPC access.
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
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 2. is_admin(): SECURITY DEFINER -> SECURITY INVOKER (reads caller's own row).
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;

-- 3. increment_points(): SECURITY DEFINER -> SECURITY INVOKER. Logic unchanged;
--    the caller's own-row RLS now scopes the update to themselves.
create or replace function public.increment_points(user_id uuid, amount integer)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update profiles
  set total_points = total_points + amount,
      bonsai_stage = case
        when total_points + amount >= 1500 then 5
        when total_points + amount >= 800 then 4
        when total_points + amount >= 400 then 3
        when total_points + amount >= 150 then 2
        else 1
      end
  where id = user_id;
$$;
