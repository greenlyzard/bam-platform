# SEASONS_AND_ARCHIVAL.md
# Ballet Academy and Movement — Seasons, Class Lifecycle & Archival Spec
# Status: Ready to build
# Related: BILLING_AND_CREDITS.md, STUDENT_PROGRESSION.md, DATA_MIGRATION.md

---

## 1. Overview

Ballet Academy and Movement runs structured seasonal programs alongside
ongoing classes. Seasonal classes require re-registration each term.
Archived seasons and classes are never deleted — they form the foundation
of student progression history, evaluations, and badge milestones.

This spec defines how seasons are created, managed, and archived, and how
class visibility changes across the student lifecycle.

---

## 2. Season Model

### 2.1 Season Types

| Type | Description | Examples |
|------|-------------|---------|
| `fall` | Fall semester | Sep – Dec |
| `spring` | Spring semester | Jan – May |
| `summer` | Summer intensive | Jun – Aug |
| `rolling` | No fixed dates | Ongoing classes, privates |

### 2.2 Season States

```
draft → active → enrollment_closed → in_progress → completed → archived
```

| State | Description |
|-------|-------------|
| `draft` | Being configured, not visible to parents |
| `active` | Open for enrollment |
| `enrollment_closed` | Classes running, no new enrollments |
| `in_progress` | Season underway |
| `completed` | Season ended, data finalizing |
| `archived` | Fully closed, read-only |

---

## 3. Database Schema

### 3.1 seasons table

```sql
CREATE TABLE seasons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,           -- e.g. "Fall 2025"
  type            text NOT NULL CHECK (type IN (
                    'fall', 'spring', 'summer', 'rolling'
                  )),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
                    'draft', 'active', 'enrollment_closed',
                    'in_progress', 'completed', 'archived'
                  )),
  start_date      date,
  end_date        date,
  enrollment_open_date  date,
  enrollment_close_date date,
  is_current      boolean DEFAULT false,   -- only one per tenant at a time
  notes           text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  archived_at     timestamptz,
  UNIQUE(tenant_id, name)
);
```

### 3.2 classes table additions

```sql
-- Add to existing classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  season_id uuid REFERENCES seasons(id);   -- null = ongoing/rolling

ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  class_type text NOT NULL DEFAULT 'seasonal' CHECK (class_type IN (
    'seasonal',    -- tied to a season, requires re-enrollment
    'ongoing',     -- rolls indefinitely, no season
    'private',     -- one student, ad hoc scheduling
    'semi_private' -- 2-6 students, ad hoc scheduling
  ));

ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',       -- not yet visible
    'active',      -- enrolling and running
    'full',        -- at capacity
    'cancelled',   -- cancelled before starting
    'completed',   -- season ended
    'archived'     -- read-only history
  ));

ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  archived_at timestamptz;

ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  archived_by uuid REFERENCES profiles(id);
```

### 3.3 Ongoing class types (no season_id)

These class types always have `season_id = null`:
- Private lessons
- Semi-private lessons  
- Pilates
- Gyrotonic
- Personal Training

They are never archived with a season — they continue until explicitly
cancelled or the student stops attending. Billing is per-session or
monthly depending on the class configuration.

---

## 4. Season Lifecycle

### 4.1 Creating a New Season

Admin workflow at `/admin/seasons/new`:
1. Set name, type, start/end dates
2. Set enrollment open/close dates
3. Status starts as `draft`
4. Admin clones classes from previous season OR creates fresh
5. Sets capacity, pricing, teacher assignments per class
6. Publishes season (status → `active`)

### 4.2 Cloning from Previous Season

When creating a new season, admin can clone all classes from a prior season:
- Copies class name, level, studio, duration, day/time
- Does NOT copy enrollments (students must re-register)
- Does NOT copy casting or productions
- Teacher assignments carried over but can be changed
- Pricing carried over but can be adjusted

### 4.3 Archiving a Season

When a season ends:
1. Admin marks season as `completed`
2. System runs archival job:
   - All seasonal classes → status = `archived`, archived_at = now()
   - All enrollments for those classes → status = `completed`
   - Attendance records locked (read-only)
   - Billing finalized
3. Admin confirms → season status → `archived`
4. Archived season disappears from active enrollment UI
5. All data remains accessible in history/progression views

### 4.4 What Happens to Ongoing Classes During Archival

Ongoing classes (`class_type IN ('ongoing', 'private', 'semi_private')`)
are NOT affected by season archival. They continue running and billing
normally. They are only archived when explicitly closed by an admin.

---

## 5. Class Visibility Rules

### 5.1 Active Enrollment UI (what parents see when registering)

Show only:
- Classes where `status IN ('active', 'full')`
- Classes belonging to the current active season OR `season_id IS NULL`
- Classes appropriate for the student's age/level

Never show:
- Archived classes
- Classes from past seasons
- Draft classes
- Cancelled classes

### 5.2 Student History / Progression View

Show all classes the student has ever been enrolled in, grouped by season:

```
📅 Spring 2026 (current)
  └── Ballet 3B — Tuesdays 4:30pm
  └── Pointe Prep — Thursdays 5:00pm

📅 Fall 2025 (archived)
  └── Ballet 3A — Tuesdays 4:30pm
  └── Pre-Pointe — Thursdays 5:00pm

📅 Spring 2025 (archived)
  └── Ballet 2B — Wednesdays 4:00pm

📅 Ongoing
  └── Private Lessons with Amanda — Fridays 3:00pm
```

### 5.3 Teacher View

Teachers see:
- Current active classes they're assigned to
- Archived classes in "Past Classes" section (read-only roster, attendance)
- Ongoing classes always visible in current view

### 5.4 Admin View

Admins see everything with filters:
- Filter by season (all seasons listed including archived)
- Filter by status
- Filter by class type
- Archived classes clearly marked with archive badge

---

## 6. Re-Registration Flow

At the start of each new season:

1. New season published with cloned classes
2. Parents notified via Klaviyo: "Registration is now open for Spring 2026"
3. Parent logs into portal → sees enrollment page for current season
4. Previous season's classes do NOT auto-populate — parent must actively choose
5. System shows recommended classes based on student's current level
6. If student was in a class last season, system shows "Continue in [class]?" prompt
7. Parent confirms enrollment → credit charge or invoice created

### 6.1 Waitlist Carry-Over

If a student was waitlisted in a prior season:
- System flags them as priority for the new season
- Admin can one-click enroll from the waitlist carry-over report

---

## 7. Admin Seasons UI

### /admin/seasons
- List of all seasons (current, past, archived)
- Status badges
- Quick stats: enrolled students, classes, revenue
- "New Season" button
- "Archive Season" button (with confirmation)

### /admin/seasons/[id]
- Season detail
- Class list for this season
- Enrollment stats
- "Clone to new season" button
- "Close enrollment" button
- "Archive season" button

### /admin/seasons/[id]/classes
- All classes in this season
- Add/remove classes
- Bulk operations (set teacher, set price, etc.)

---

## 8. Parent Portal Enrollment UI

### /portal/enrollment (active season)
- Shows only current season classes
- Grouped by level/day
- Student's recommended level highlighted
- "Already enrolled" badge if student is in the class
- Clear "Archived" indicator if viewing history

### /portal/enrollment/history
- Full class history per student
- Season groupings with dates
- Shows level progression visually
- Links to evaluations and badges per season

---

## 9. Ongoing Class Management

### Class Types That Never Archive with a Season
- Private lessons
- Semi-private lessons
- Pilates
- Gyrotonic
- Personal Training

### Ongoing Class Lifecycle
```
active → paused → cancelled
```

| State | Description |
|-------|-------------|
| `active` | Running, billing active |
| `paused` | Temporarily suspended (injury, break) |
| `cancelled` | Permanently ended |

### Billing for Ongoing Classes
- Billed per session (credit deduction on session close) OR
- Billed monthly (flat credit charge on billing date)
- Set at class level, overridable per student

---

## 10. Data Integrity Rules

1. Archived seasons are read-only — no new enrollments, no attendance edits
2. Archiving a season does not delete any records
3. Credit transactions for archived sessions remain in audit log
4. Student progression data (evaluations, badges) persists forever
5. Teacher hours from archived seasons included in lifetime hour totals
6. Archived classes still appear in reports with date range filtering

---

## 11. Notifications & Automation

### Season-Based Klaviyo Triggers
| Event | Trigger | Audience |
|-------|---------|----------|
| Enrollment opens | season.status → active | All active parents |
| Enrollment closing soon | 7 days before close date | Parents not yet enrolled |
| Enrollment closed | season.status → enrollment_closed | Waitlisted parents |
| Season starting | 1 week before start_date | Enrolled parents |
| Season ending | 2 weeks before end_date | All enrolled parents |
| Re-enrollment reminder | New season published | Prior season parents |

---

## 12. Files to Create / Modify

### New Files
- `supabase/migrations/20260315000001_seasons_and_class_lifecycle.sql`
- `app/admin/seasons/page.tsx`
- `app/admin/seasons/[id]/page.tsx`
- `app/admin/seasons/new/page.tsx`
- `app/portal/enrollment/history/page.tsx`
- `components/seasons/SeasonBadge.tsx`
- `components/seasons/ClassHistoryTree.tsx`
- `lib/seasons/archive.ts` (archival job logic)

### Files to Modify
- `app/portal/enrollment/page.tsx` — filter to current season only
- `app/admin/classes/page.tsx` — add season filter + archived view
- `app/teach/schedule/page.tsx` — show ongoing + current season only
- Klaviyo integration — add season lifecycle triggers

---

## 13. Acceptance Criteria

1. Creating a new season and cloning classes from prior season works end-to-end
2. Archived season classes do not appear in the enrollment UI
3. Student history view shows all past seasons with correct grouping
4. Ongoing classes (private, Pilates, etc.) are unaffected by season archival
5. Re-enrollment flow shows "Continue in [class]?" prompt for returning students
6. Admin can archive a season with one action — all classes update atomically
7. All archived data is read-only but fully visible in history views
8. Klaviyo triggers fire correctly on season state transitions
9. Multi-tenant: seasons are fully scoped to tenant
