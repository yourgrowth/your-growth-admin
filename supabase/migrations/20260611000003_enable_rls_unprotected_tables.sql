-- Security fix: enable RLS + "admin only" policy on tables created in
-- 20260611000001_admin_new_tables.sql, which were left without RLS.
-- Without RLS these public-schema tables are reachable by the anon key.
-- Safe to re-run (guards on pg_policies). Matches the pattern in
-- 20260611000002_admin_missing_tables.sql.

-- false_positives
alter table false_positives enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'false_positives' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on false_positives for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- page_views
alter table page_views enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'page_views' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on page_views for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- ai_usage_log
alter table ai_usage_log enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'ai_usage_log' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on ai_usage_log for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- feature_flags
alter table feature_flags enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'feature_flags' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on feature_flags for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- user_feature_flags
alter table user_feature_flags enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_feature_flags' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on user_feature_flags for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;
