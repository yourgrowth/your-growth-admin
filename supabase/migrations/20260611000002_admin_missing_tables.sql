-- Admin missing tables: created by audit session
-- Uses CREATE TABLE IF NOT EXISTS throughout — safe to re-run

-- app_errors: client-side / server-side error reporting
create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  error_type text,
  message text,
  stack text,
  user_id uuid references profiles(id) on delete set null,
  edge_function text,
  resolved boolean default false,
  created_at timestamptz default now()
);

create index if not exists app_errors_created_idx on app_errors(created_at desc);
create index if not exists app_errors_resolved_idx on app_errors(resolved);

alter table app_errors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'app_errors' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on app_errors for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- service_incidents: track active service outages
create table if not exists service_incidents (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  description text,
  started_at timestamptz default now(),
  resolved_at timestamptz
);

alter table service_incidents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'service_incidents' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on service_incidents for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- edge_function_logs: execution logs for Supabase Edge Functions
create table if not exists edge_function_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text,
  status text default 'success',
  duration_ms integer,
  error_message text,
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists edge_function_logs_created_idx on edge_function_logs(created_at desc);
create index if not exists edge_function_logs_fn_idx on edge_function_logs(function_name);

alter table edge_function_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'edge_function_logs' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on edge_function_logs for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- video_watch_events: detailed video viewing analytics (see also video_watch_history)
create table if not exists video_watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  video_id uuid not null references growth_bible_videos(id) on delete cascade,
  watch_percentage integer not null default 0,
  completed boolean not null default false,
  watched_at timestamptz not null default now()
);

create index if not exists video_watch_events_video_idx on video_watch_events(video_id);
create index if not exists video_watch_events_user_idx on video_watch_events(user_id, watched_at desc);

alter table video_watch_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'video_watch_events' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on video_watch_events for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- notifications_log: push notification send log
create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  segment text,
  sent_at timestamptz default now(),
  open_count integer default 0
);

alter table notifications_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'notifications_log' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on notifications_log for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- onboarding_events: per-step funnel tracking
create table if not exists onboarding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  step text not null,
  completed boolean not null default false,
  time_spent_seconds integer,
  dropped boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists onboarding_events_user_step_idx on onboarding_events(user_id, step);
create index if not exists onboarding_events_created_idx on onboarding_events(created_at desc);

alter table onboarding_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'onboarding_events' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on onboarding_events for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- support_tickets: help desk tickets
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table support_tickets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'support_tickets' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on support_tickets for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- ticket_replies: threaded replies on support tickets
create table if not exists ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  admin_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

alter table ticket_replies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'ticket_replies' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on ticket_replies for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- admin_sessions: admin login history
create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz default now(),
  last_active_at timestamptz default now()
);

alter table admin_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'admin_sessions' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on admin_sessions for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- login_attempts: auth attempt log
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  ip_address text,
  created_at timestamptz default now()
);

alter table login_attempts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'login_attempts' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on login_attempts for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- admin_notes: admin notes attached to user profiles
create table if not exists admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  admin_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz default now()
);

alter table admin_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'admin_notes' and policyname = 'admin only'
  ) then
    execute 'create policy "admin only" on admin_notes for all
      using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))';
  end if;
end $$;

-- Add reviewed_at and reviewed_by to safety_flag_log
alter table safety_flag_log
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references profiles(id);
