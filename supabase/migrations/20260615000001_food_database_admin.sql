-- Migration: Food Database admin management section
-- Adds publishing/review controls to the scraped `foods` table, a scraper run
-- log, a full-text search index, and the RLS + Realtime plumbing the admin
-- panel's live feed needs.
--
-- Run this in the Supabase SQL editor (project ref: ytukubeognlxeiidstro)
-- BEFORE deploying the admin Food Database section.

-- 1a. Publishing control on foods
alter table foods add column if not exists is_published boolean default true;

-- 1b. Manual-review flags on foods
alter table foods add column if not exists flagged_for_review boolean default false;
alter table foods add column if not exists flag_reason text;

-- 1c. Scraper run log
create table if not exists scraper_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text default 'running',          -- 'running' | 'completed' | 'failed'
  products_scraped int default 0,
  off_hits int default 0,
  ollama_hits int default 0,
  misses int default 0,
  errors int default 0,
  source text,                            -- 'woolworths' | 'coles' | 'all'
  notes text,
  created_at timestamptz default now()
);

create index if not exists scraper_runs_started_at_idx on scraper_runs(started_at desc);

-- 1d. Full-text search index over name + brand + barcode
create index if not exists foods_search_idx
  on foods using gin(to_tsvector('english',
    coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(barcode,'')
  ));

-- Common filter/sort helpers
create index if not exists foods_source_idx on foods(source);
create index if not exists foods_created_at_idx on foods(created_at desc);
create index if not exists foods_is_published_idx on foods(is_published);
create index if not exists foods_flagged_idx on foods(flagged_for_review);

-- 1e. RLS + Realtime
-- The admin panel reads/writes foods + scraper_runs with the service-role key
-- (which bypasses RLS), but the Overview live feed subscribes over Realtime,
-- which DOES respect RLS. Grant authenticated admins SELECT so change events
-- are delivered, and keep writes admin-only via the service role.
alter table foods enable row level security;
alter table scraper_runs enable row level security;

drop policy if exists "admin read foods" on foods;
create policy "admin read foods" on foods
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admin read scraper_runs" on scraper_runs;
create policy "admin read scraper_runs" on scraper_runs
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Add foods to the Realtime publication so INSERT/UPDATE events stream to the
-- Overview live feed. Wrapped so re-running the migration is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'foods'
  ) then
    alter publication supabase_realtime add table foods;
  end if;
end $$;
