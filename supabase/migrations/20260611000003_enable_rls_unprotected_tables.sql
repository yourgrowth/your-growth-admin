-- Security fix: enable RLS + "admin only" policy on tables created in
-- 20260611000001_admin_new_tables.sql, which were left without RLS.
-- Without RLS these public-schema tables are reachable by the anon key.
--
-- Each table is guarded with to_regclass so the migration is safe to run
-- even if a table was never created in this database (it simply skips it).
-- Idempotent and safe to re-run. Matches the policy pattern in
-- 20260611000002_admin_missing_tables.sql.

do $$
declare
  t text;
  tables text[] := array[
    'false_positives',
    'page_views',
    'ai_usage_log',
    'feature_flags',
    'user_feature_flags'
  ];
begin
  foreach t in array tables loop
    -- Skip tables that don't exist in this database
    if to_regclass('public.' || t) is null then
      raise notice 'Skipping % — table does not exist', t;
      continue;
    end if;

    -- Enable RLS (no-op if already enabled)
    execute format('alter table public.%I enable row level security', t);

    -- Create the admin-only policy if it isn't already there
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'admin only'
    ) then
      execute format(
        'create policy "admin only" on public.%I for all
           using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))',
        t
      );
    end if;
  end loop;
end $$;
