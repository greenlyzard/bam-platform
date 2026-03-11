-- ============================================================
-- BAM Platform — Expansion & Competitive Intelligence Tables
-- Creates: competitor_studios, expansion_markets
-- Admin-only tables
-- ============================================================

-- ============================================================
-- competitor_studios
-- ============================================================
create table competitor_studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text default 'CA',
  address text,
  website text,
  phone text,
  programs text[] default '{}',
  segment text
    check (segment in ('classical_ballet', 'competition', 'recreational', 'conservatory', 'franchise', 'commercial')),
  threat_level text default 'medium'
    check (threat_level in ('low', 'medium', 'high')),
  google_rating numeric(2,1),
  google_review_count int,
  yelp_rating numeric(2,1),
  yelp_review_count int,
  estimated_students int,
  price_range text,
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  notes text,
  last_researched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_competitors_city on competitor_studios(city);
create index idx_competitors_threat on competitor_studios(threat_level);

-- ============================================================
-- expansion_markets
-- ============================================================
create table expansion_markets (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text default 'CA',
  region text,
  population int,
  median_household_income int,
  families_with_children_pct numeric(4,1),
  competitor_count int default 0,
  drive_time_minutes int,
  commercial_rent_per_sqft numeric(6,2),
  readiness_score int check (readiness_score between 0 and 100),
  status text default 'research'
    check (status in ('research', 'evaluating', 'ready', 'opened', 'passed')),
  pros text[] default '{}',
  cons text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_expansion_status on expansion_markets(status);
create index idx_expansion_score on expansion_markets(readiness_score);
