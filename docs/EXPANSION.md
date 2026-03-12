# BAM Platform — Expansion Intelligence

## Purpose

Data-driven decision making for opening Ballet Academy and Movement Location #2. This module tracks market demographics, competitor studios, and studio-level readiness indicators to surface when and where expansion makes strategic sense.

**Route:** `/admin/expansion`
**Access:** Admin and Super Admin only
**Tables:** `expansion_markets`, `competitor_studios`

---

## Expansion Readiness Score

The readiness score is a composite 0–100 integer stored on each `expansion_markets` row. It is currently set manually by the admin based on weighted evaluation of the factors below. A future enhancement will compute this automatically.

### Readiness Formula (Target)

| Factor | Weight | Threshold | Source |
|--------|--------|-----------|--------|
| Studio enrollment capacity | 25% | ≥ 90% for 3+ months | `classes.max_students` vs `enrollments` count |
| Active waitlist depth | 20% | ≥ 15 students | `enrollments` where `status = 'waitlist'` |
| Monthly revenue target | 20% | Met (internal threshold) | Future: Stripe/QuickBooks integration |
| Target market demographics | 15% | Income ≥ $120k, families % ≥ 25 | `expansion_markets` fields |
| Competitor landscape | 10% | ≤ 3 direct competitors | `expansion_markets.competitor_count` |
| Brand search volume growth | 10% | Positive trend | Future: Google Search Console API |

### Studio-Level Indicators (Shown on Dashboard)

These are computed live from platform data and displayed as pass/fail indicators:

- **Capacity ≥ 90%** — `(total enrolled across active classes) / (sum of max_students)` × 100
- **Waitlist ≥ 15** — count of `enrollments` with `status = 'waitlist'`

Expansion is recommended only when all indicators are met for 3+ consecutive months and revenue targets are achieved.

### Score Color Coding

| Score Range | Color | Meaning |
|-------------|-------|---------|
| 75–100 | Green (`text-success`) | Ready or near-ready |
| 50–74 | Amber (`text-warning`) | Evaluating, promising |
| 0–49 | Gray (`text-slate`) | Research phase, not yet viable |

---

## expansion_markets Table

```sql
create table expansion_markets (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text default 'CA',
  region text,                          -- e.g., 'South Orange County'
  population int,
  median_household_income int,          -- USD
  families_with_children_pct numeric(4,1), -- e.g., 32.5
  competitor_count int default 0,
  drive_time_minutes int,               -- from San Clemente HQ
  commercial_rent_per_sqft numeric(6,2),-- monthly $/sqft
  readiness_score int                   -- 0–100, constrained by CHECK
    check (readiness_score between 0 and 100),
  status text default 'research'
    check (status in ('research', 'evaluating', 'ready', 'opened', 'passed')),
  pros text[] default '{}',             -- array of advantage strings
  cons text[] default '{}',             -- array of disadvantage strings
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Status Lifecycle

```
research → evaluating → ready → opened
                      ↘ passed
```

| Status | Meaning |
|--------|---------|
| `research` | Initial data gathering, not yet visited |
| `evaluating` | Active site visits, lease inquiries, deeper analysis |
| `ready` | All criteria met, expansion approved |
| `opened` | Location #2 is open |
| `passed` | Evaluated and rejected (too expensive, wrong market, etc.) |

### Indexes

- `idx_expansion_status` — filter by pipeline stage
- `idx_expansion_score` — sort by readiness

### Target Markets (Priority Order)

1. **Ladera Ranch** — Score 78, evaluating. High-income families, limited ballet competition, 15 min from HQ.
2. **Rancho Mission Viejo** — Score 72, research. New development with growing affluent population.
3. **San Juan Capistrano** — Score 65, research. Larger population but lower income and more competitors.
4. Laguna Niguel — Not yet added, future candidate.

---

## competitor_studios Table

```sql
create table competitor_studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text default 'CA',
  address text,
  website text,
  phone text,
  programs text[] default '{}',         -- e.g., {'ballet', 'jazz', 'tap'}
  segment text
    check (segment in (
      'classical_ballet', 'competition', 'recreational',
      'conservatory', 'franchise', 'commercial'
    )),
  threat_level text default 'medium'
    check (threat_level in ('low', 'medium', 'high')),
  google_rating numeric(2,1),           -- e.g., 4.8
  google_review_count int,
  yelp_rating numeric(2,1),
  yelp_review_count int,
  estimated_students int,
  price_range text,                     -- e.g., '$150–$200/mo'
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  notes text,
  last_researched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Segment Definitions

| Segment | Description | Relevance to BAM |
|---------|-------------|-------------------|
| `classical_ballet` | Classical technique focus, pre-professional track | Direct competitor |
| `competition` | Competition/convention circuit studios | Indirect — different culture |
| `recreational` | Multi-style, low commitment | Competes for beginners |
| `conservatory` | University-affiliated or intensive programs | Competes for advanced students |
| `franchise` | Chain studios (Tutu School, etc.) | Competes for toddler/pre-ballet |
| `commercial` | Hip-hop, jazz, contemporary focus | Minimal overlap |

### Threat Levels

| Level | Criteria | UI Color |
|-------|----------|----------|
| `high` | Same city, overlapping programs and age range | Red (`text-error`) |
| `medium` | Nearby city (15–20 min), partial program overlap | Amber (`text-warning`) |
| `low` | Different market segment or > 25 min drive | Gray (`text-slate`) |

### Indexes

- `idx_competitors_city` — filter by geography
- `idx_competitors_threat` — prioritize high-threat monitoring

### Tracked Competitors (Seed Data)

| Studio | City | Segment | Threat |
|--------|------|---------|--------|
| San Clemente Dance Academy | San Clemente | Competition | High |
| Southland Ballet Academy | Mission Viejo | Classical Ballet | Medium |
| Pacific Ballet Conservatory | Laguna Niguel | Classical Ballet | Medium |
| Capistrano Academy of Dance | San Juan Capistrano | Recreational | Medium |
| South Coast Conservatory | Costa Mesa | Conservatory | Low |
| Tutu School | Various | Franchise | Medium |
| Moxie Dance | Ladera Ranch | Commercial | Low |
| Variant Dance | Mission Viejo | Commercial | Low |

---

## RLS Policies

Both tables are admin-only. RLS is enabled via the global admin policy in `20260311000009_enable_rls.sql`:

- Only users with `role in ('admin', 'super_admin')` can SELECT, INSERT, UPDATE, or DELETE.
- No parent, teacher, or student access.

---

## Query Layer

All expansion queries live in `lib/queries/admin.ts`:

- `getExpansionMarkets()` — all markets sorted by readiness_score descending
- `getCompetitors()` — all competitors sorted by threat_level descending, then name
- `getCapacitySummary()` — computes total classes, capacity %, classes at capacity, open spots
- `getEnrollmentStats()` — total students, enrollments, waitlist count, trial count

---

## UI Components

The expansion page at `/admin/expansion` displays:

1. **Readiness Indicators** — live pass/fail checks (capacity ≥ 90%, waitlist ≥ 15)
2. **Target Markets** — cards with demographics, readiness gauge, pros/cons, status badges
3. **Competitor Directory** — list with threat level, segment, ratings, programs, strengths/weaknesses

The admin dashboard at `/admin/dashboard` shows:
- Top 3 expansion markets as a preview section with readiness scores

---

## Future Enhancements

- Auto-compute readiness_score from weighted formula (requires revenue data from Stripe)
- Google Search Console integration for brand search volume tracking
- Automated competitor monitoring (scrape Google/Yelp ratings periodically)
- Map visualization of target markets and competitor locations
- Historical readiness score tracking (trend over time)
- Alert when expansion threshold is met for 3+ consecutive months
