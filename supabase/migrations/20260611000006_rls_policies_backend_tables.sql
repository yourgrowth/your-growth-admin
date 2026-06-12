-- Clears the rls_enabled_no_policy INFO (lint 0008) on four backend-only tables.
-- Verified: nutrition_cache, product_analyses, pipeline_runs and safety_flag_log
-- are written/read ONLY by edge functions via the service-role key (which
-- bypasses RLS). No client/anon access exists. RLS was already enabled with no
-- policy (= deny-all to the public), so these were already secure; this just
-- adds an explicit "admin only" policy to document intent and satisfy the lint.
-- The admin dashboard also reads via the service-role key, so it is unaffected.
-- Guarded + idempotent: skips missing tables, won't duplicate policies.

do $$
declare
  t text;
  tables text[] := array[
    'nutrition_cache',
    'product_analyses',
    'pipeline_runs',
    'safety_flag_log'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Skipping % — table does not exist', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'admin only'
    ) then
      execute format('create policy "admin only" on public.%I for all using (is_admin())', t);
    end if;
  end loop;
end $$;
