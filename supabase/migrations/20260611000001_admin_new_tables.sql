-- Migration: Admin dashboard new tables
-- Created for Sessions 50 admin expansion

-- false_positives: track output filter replacements marked as false positives for prompt tuning
create table if not exists false_positives (
  id uuid default gen_random_uuid() primary key,
  safety_flag_id uuid,
  original_response text,
  reviewed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- page_views: track admin-side page view events (app views if not using PostHog)
create table if not exists page_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  page_name text not null,
  viewed_at timestamptz default now(),
  session_id text,
  created_at timestamptz default now()
);

create index if not exists page_views_page_name_idx on page_views(page_name);
create index if not exists page_views_user_id_idx on page_views(user_id);

-- ai_usage_log: track Claude API calls per feature for cost analysis
create table if not exists ai_usage_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  feature text,                    -- gardener_chat, gardener_summary, food_analysis, meal_suggestions, etc.
  model text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  error text,
  created_at timestamptz default now()
);

create index if not exists ai_usage_log_created_at_idx on ai_usage_log(created_at);
create index if not exists ai_usage_log_feature_idx on ai_usage_log(feature);
create index if not exists ai_usage_log_user_id_idx on ai_usage_log(user_id);

-- feature_flags: global feature flag registry
create table if not exists feature_flags (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  enabled boolean default false,
  description text,
  updated_at timestamptz,
  updated_by text,
  created_at timestamptz default now()
);

-- user_feature_flags: per-user flag overrides
create table if not exists user_feature_flags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  flag_name text not null,
  enabled boolean not null default false,
  created_at timestamptz default now(),
  unique(user_id, flag_name)
);

create index if not exists user_feature_flags_user_id_idx on user_feature_flags(user_id);
