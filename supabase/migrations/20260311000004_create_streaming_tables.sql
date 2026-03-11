-- ============================================================
-- BAM Platform — Live Streaming Tables
-- Creates: live_sessions, stream_access
-- ============================================================

-- ============================================================
-- live_sessions — scheduled and live streams
-- ============================================================
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete set null,
  teacher_id uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  session_type text not null
    check (session_type in ('class_stream', 'performance', 'workshop', 'competition')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  stream_key text,
  playback_url text,
  recording_url text,
  is_paid boolean default false,
  ticket_price_cents int default 0,
  scheduled_start timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  max_viewers int,
  viewer_count int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_live_sessions_status on live_sessions(status);
create index idx_live_sessions_scheduled on live_sessions(scheduled_start);
create index idx_live_sessions_class on live_sessions(class_id);

-- ============================================================
-- stream_access — who can view a stream
-- ============================================================
create table stream_access (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  access_type text not null
    check (access_type in ('enrolled', 'purchased', 'complimentary', 'admin')),
  purchased_at timestamptz,
  amount_paid_cents int default 0,
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  unique(session_id, user_id)
);

create index idx_stream_access_session on stream_access(session_id);
create index idx_stream_access_user on stream_access(user_id);
