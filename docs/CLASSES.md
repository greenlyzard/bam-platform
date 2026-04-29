# BAM Platform — Class Management System
# docs/CLASSES.md
# Version 2.0 | March 2026

**Purpose:** Consolidated spec for class management — data model, admin UI,
scheduling, teacher assignment, disciplines, curriculum, pricing, rehearsal
integration, and reporting. Overwrites the original CLASSES.md.
Also serves as the authoritative reference for Angelina AI class placement.

---

## Level System

### Primary Levels

| Level | Age Range | Description |
|---|---|---|
| Petites | 3–5 | Pre-technique, creative movement and imaginative play |
| Level 1 | 5–7 | Foundational technique, first formal dance training |
| Level 2 | 7–10 | Building structured technique across disciplines |
| Level 3 | 10–13 | Refining and advancing technique toward company level |
| Level 4 | 13+ | Company-level, pre-professional, performance focused |
| Adult/Teen | 14+ | All levels, non-competitive, welcoming environment |

### Sub-Levels (Levels 2, 3, 4 only)

| Sub-Level | Skill | Description |
|---|---|---|
| A | Beginner | New to formal technique in this age group |
| B | Intermediate | Solid foundation, advancing combinations |
| C | Advanced | Near-company level, performance focused |

**Combined levels:** Classes may span multiple level combinations.
Examples: Level 2B+/2C, Level 3C/4B, Level 4B/4C.
Stored as an array of level values on the class record.

**Valid level values for multi-select:**
Petites, Level 1, Level 2A, Level 2B, Level 2C, Level 3A, Level 3B,
Level 3C, Level 4A, Level 4B, Level 4C, Adult/Teen

---

## Disciplines

A class can be tied to one or more disciplines (e.g., a Ballet/Jazz Combo).

| Discipline | Description | Levels Available |
|---|---|---|
| Ballet | Classical technique, barre, center, across the floor | All |
| Jazz | Upbeat, stylized, turns and leaps | Level 1+ |
| Contemporary | Lyrical, floor work, expressive movement | Level 2B+ |
| Hip Hop | Grooves, footwork, formations | Level 1, Level 4 |
| Pointe | Pointe shoes, strength, classical variations | Level 2C+, Level 3C+, Level 4 |
| Musical Theater | Acting, performance, Broadway-style dance | Level 1, Level 2A |
| Combo | Ballet + another discipline in one class | Petites, Level 2A |
| Conditioning | Strength, flexibility, Pilates, tricks | Level 2B+, Level 3+, Level 4 |

Disciplines are a fixed list managed at Settings → Disciplines.
Admin can add, edit, deactivate. Deactivated disciplines are hidden from
class edit but preserved on existing records.

---

## Dance Curriculum

Separate from disciplines. Curriculum is the teaching methodology applied.
A Ballet class may be taught using RAD methodology. A class can reference
one or more curricula.

Examples: RAD, Cecchetti, Vaganova, ABT, NYCB, Horton, Graham,
Progressing Ballet Technique (PBT), Acrobatic Arts.

Amanda manages curriculum at Settings → Curriculum.
Admin can add, edit, deactivate, and drag to reorder.

---

## Pricing

- Single class: $100–$150/month depending on duration
- Standard classes: $125/month
- Extended classes (90 min+): $150/month
- Short technique classes (30–45 min): $100–$125/month
- Unlimited Classes: $249/month
- First class: Always free — no commitment required
- Pop-Up / Special sessions: $250 flat (e.g., 9-week Hip Hop session)

Early bird pricing schedules are configured per class. See Pricing section below.

---

## Full Class Schedule 2025–2026

### Monday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Princess Ballet — Ballet & Movement Combo | Petites | 3–5 | Ballet, Combo | 3:30–4:15 PM | $125 | |
| Mini Star Ballet | Level 1 | 5–9 | Ballet | 3:30–4:15 PM | $125 | |
| Level 2B+/2C Jazz | Level 2B, 2C | 9–14 | Jazz | 3:30–4:00 PM | $125 | |
| Pop Star Mini Jazz (Ages 5-7) | Level 2A | 5–9 | Jazz | 4:30–5:15 PM | $125 | Waitlist |
| Level 2B+/2C Ballet | Level 2B, 2C | 9–14 | Ballet | 4:30–5:30 PM | $125 | |
| Level 4B Ballet | Level 4B | 12+ | Ballet | 4:30–6:00 PM | $150 | |
| Level 3A Beginner Ballet | Level 3A | 9–14 | Ballet | 5:30–6:30 PM | $125 | |
| Level 4C Jazz, Stretching & Tricks | Level 4C | 12+ | Jazz, Conditioning | 5:30–6:30 PM | $125 | |
| Level 4C Ballet | Level 4C | 12+ | Ballet | 6:30–8:00 PM | $150 | |
| Teen/Adult Beginner Ballet | Adult/Teen | 14+ | Ballet | 7:00–8:00 PM | $125 | |

### Tuesday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Tippy Toes & Twirls — Ballet & Movement | Petites | 3–5 | Ballet, Combo | 3:30–4:15 PM | $125 | |
| 2C+ Advanced Ballet | Level 2B, 2C | 9–14 | Ballet | 3:30–4:30 PM | $125 | Full |
| Ballet & Broadway Combo | Level 2A | 5–9 | Ballet, Musical Theater | 3:30–4:45 PM | $150 | |
| Level 2C+ Intermediate Contemporary | Level 2B, 2C | 9–14 | Contemporary | 5:00–5:30 PM | $125 | |
| Level 3C/4B Intermediate Ballet | Level 3C, 4B | 9–14 | Ballet | 5:00–6:30 PM | $150 | Over cap |
| Level 4C Ballet Full Company | Level 4C | 12+ | Ballet | 5:00–6:30 PM | $150 | |
| Level 4B Contemporary | Level 4B | 12+ | Contemporary | 5:30–6:30 PM | $125 | |
| Level 4B Conditioning & Stretching | Level 4B | 12+ | Conditioning | 6:30–7:00 PM | $125 | |
| Level 4C Contemporary | Level 4C | 12+ | Contemporary | 7:00–7:45 PM | $125 | Full |

### Wednesday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Level 2B+/2C Ballet | Level 2B, 2C | 9–14 | Ballet | 3:30–4:30 PM | $125 | |
| Sparkle & Shine Jazz | Level 1 | 5–9 | Jazz | 3:30–4:15 PM | $125 | |
| POP Star Jazz! (Ages 5-9) | Level 2A | 5–9 | Jazz | 3:30–4:15 PM | $125 | |
| Level 2A Beginner Ballet | Level 2A | 5–9 | Ballet | 4:30–5:15 PM | $125 | |
| Level 2B+/2C Jazz & Tricks | Level 2B, 2C | 9–14 | Jazz, Conditioning | 4:30–5:30 PM | $125 | |
| Level 4B Ballet | Level 4B | 12+ | Ballet | 4:30–6:00 PM | $150 | |
| Level 3B Intermediate Jazz | Level 3B | 9–14 | Jazz | 5:30–6:15 PM | $125 | Full |
| Level 4C Ballet | Level 4C | 12+ | Ballet | 5:30–7:00 PM | $150 | |
| 4B Pointe & Pilates | Level 4B | 12+ | Pointe, Conditioning | 6:00–6:30 PM | $125 | |
| Level 4B Jazz — Turns & Jumps | Level 4B | 12+ | Jazz | 6:30–7:30 PM | $125 | |
| Level 4C Pointe | Level 4C | 12+ | Pointe | 7:00–7:30 PM | $125 | |
| Level 4C Jazz — Jumps and Turns | Level 4C | 12+ | Jazz | 7:30–8:15 PM | $125 | |

### Thursday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Princess Petites | Petites | 3–5 | Ballet | 3:30–4:15 PM | $125 | |
| Level 2A Contemporary Flow | Level 2A | 5–9 | Contemporary | 3:30–4:30 PM | $125 | |
| 2C+ Ballet | Level 2B, 2C | 9–14 | Ballet | 3:30–4:30 PM | $125 | |
| K-pop & Mini Groovers Hip Hop | Level 1 | 5–9 | Hip Hop | 4:30–5:30 PM | $125 | |
| Level 2C+ Jazz | Level 2B, 2C | 9–14 | Jazz | 5:00–5:30 PM | $125 | |
| Levels 3C/4B Intermediate Ballet | Level 3C, 4B | 9–14 | Ballet | 5:00–6:30 PM | $150 | |
| Level 4B/4C Advanced Contemporary | Level 4B, 4C | 12+ | Contemporary | 5:30–6:30 PM | $125 | |
| Pop-Up Hip Hop — 9 Weeks! | Level 1–4 | 5–14 | Hip Hop | 5:30–6:30 PM | $250 | Limited session |
| Level 3C/4B Intermediate Contemporary | Level 3C, 4B | 9–14 | Contemporary | 6:30–7:30 PM | $125 | Over cap |
| Level 4 Hip Hop (Ages 12+) | Level 4 | 12+ | Hip Hop | 6:30–7:30 PM | $125 | |
| Teen/Adult Pre-Pointe & Variations | Adult/Teen | 14+ | Pointe | 7:00–7:30 PM | $100 | NEW |
| Teen/Adult Intermediate Ballet | Adult/Teen | 14+ | Ballet | 7:30–8:30 PM | $125 | |

### Friday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Tippy Toes & Twirls — Ballet & Movement | Petites | 3–5 | Ballet, Combo | 10:00–10:45 AM | $125 | |
| Tiny Tutus & Twirls | Petites | 3–5 | Ballet | 3:30–4:15 PM | $125 | NEW, Waitlist |
| Mini Musical Theater | Level 1 | 5–9 | Musical Theater | 4:30–5:15 PM | $125 | NEW, Waitlist |

### Saturday

| Class | Level | Ages | Discipline | Time | Fee | Notes |
|---|---|---|---|---|---|---|
| Level 2C/2C+/3C Pre-Pointe | Level 2C, 3C | 9–14 | Pointe | 10:00–10:30 AM | $125 | Full |
| 4B/4C Advanced Ballet | Level 4B, 4C | 12+ | Ballet | 10:30 AM–12 PM | $150 | |
| Level 2C/2C+/3C Jazz | Level 2C, 3C | 9–14 | Jazz | 10:30–11:30 AM | $125 | |
| Level 4 Conditioning & Tricks | Level 4 | 12+ | Conditioning | 11:30 AM–12:15 PM | $125 | |
| Level 2C/2C+/3C Stretching & Tricks | Level 2C, 3C | 9–14 | Conditioning | 11:30 AM–12 PM | $125 | Full |

---

## Placement Quick Reference (Angelina AI)

| Child's Age | No Experience | Some Experience | Experienced |
|---|---|---|---|
| 3–4 | Petites | Petites | Petites |
| 5–6 | Level 1 | Level 1 | Level 2A |
| 7–8 | Level 2A | Level 2A–2B | Level 2B–2C |
| 9–10 | Level 2A–3A | Level 2B–3B | Level 3B–3C |
| 11–12 | Level 3A | Level 3A–3B | Level 3C–4B |
| 13+ | Level 3A or Adult/Teen | Level 4A–4B | Level 4B–4C |
| Adult | Adult/Teen Beginner | Adult/Teen Int. | Adult/Teen Int. |

**When unsure:** Always recommend a free assessment class.
"We'd love to see [name] dance and place her in the perfect class!"
Contact: dance@bamsocal.com or (949) 229-0846.

---

## Data Model

### classes (extended columns)

```sql
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS short_description    text,
  ADD COLUMN IF NOT EXISTS medium_description   text,
  ADD COLUMN IF NOT EXISTS long_description     text,
  ADD COLUMN IF NOT EXISTS gender               text CHECK (gender IN ('any', 'female', 'male')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS age_min              integer,
  ADD COLUMN IF NOT EXISTS age_max              integer,
  -- Level: array of valid level values
  -- e.g. ARRAY['Level 2B', 'Level 2C'] for a combined class
  ADD COLUMN IF NOT EXISTS levels               text[],
  -- Disciplines: array of discipline names
  ADD COLUMN IF NOT EXISTS discipline_ids       uuid[],
  -- Curriculum: array of curriculum IDs
  ADD COLUMN IF NOT EXISTS curriculum_ids       uuid[],
  ADD COLUMN IF NOT EXISTS days_of_week         integer[],  -- 0=Sun..6=Sat
  ADD COLUMN IF NOT EXISTS start_date           date,
  ADD COLUMN IF NOT EXISTS end_date             date,
  ADD COLUMN IF NOT EXISTS season_id            uuid REFERENCES seasons(id),
  ADD COLUMN IF NOT EXISTS max_enrollment       integer,
  ADD COLUMN IF NOT EXISTS show_capacity_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_registration  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_expires_at       date,
  ADD COLUMN IF NOT EXISTS is_rehearsal         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_performance       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();
```

### classes.status — valid values

The `status` column has four valid values (CHECK constraint added 2026-04-29):

- `draft` — being planned, not yet enrollable
- `active` — currently running and enrollable (default)
- `cancelled` — was active, no longer running; preserved for history
- `completed` — season ended naturally

See docs/CLASS_SCHEMA_DECISIONS.md for the decision record.

### class_teachers

```sql
CREATE TABLE IF NOT EXISTS class_teachers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'lead'
              CHECK (role IN ('lead', 'assistant', 'accompanist', 'observer')),
  is_primary  boolean DEFAULT false,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(class_id, teacher_id)
);
-- Single teacher = automatically lead + primary.
-- Multiple teachers = admin designates primary.
-- Both teachers may not attend every session.
-- Teacher attendance is tracked per session, not per class assignment.
```

### disciplines

```sql
CREATE TABLE IF NOT EXISTS disciplines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
```

### dance_curriculum

```sql
CREATE TABLE IF NOT EXISTS dance_curriculum (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
```

### class_pricing_rules

```sql
CREATE TABLE IF NOT EXISTS class_pricing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label          text NOT NULL,       -- "Early Bird", "Full Price"
  deadline       date,                -- NULL = base/full price
  amount         numeric(10,2) NOT NULL,
  discount_type  text CHECK (discount_type IN ('flat', 'percentage')),
  discount_value numeric(10,2),
  is_base_price  boolean DEFAULT false,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
```

**Example pricing schedule:**
| Label | Deadline | Amount | Savings vs Full |
|---|---|---|---|
| Super Early Bird | Apr 1 | $180 | Save $60 |
| Early Bird | May 1 | $210 | Save $30 |
| Full Price | — | $240 | — |

Current applicable tier highlighted in pricing grid embed.
Countdown to next deadline shown.

### class_phases

```sql
CREATE TABLE IF NOT EXISTS class_phases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phase         text NOT NULL CHECK (phase IN ('technique', 'rehearsal', 'performance')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  notes         text,
  production_id uuid REFERENCES productions(id),
  created_at    timestamptz DEFAULT now()
);
```

### studio_closures

```sql
CREATE TABLE IF NOT EXISTS studio_closures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  closed_date date NOT NULL,
  reason      text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, closed_date)
);
```

---

## Admin UI — Class Management

### List View (`/admin/classes`)

- Search by class name
- Filters: Season | Teacher | Level | Discipline | Day | Type | Status
- View toggle: List | Calendar
- Bulk select + bulk actions

**Columns:** Name | Teacher(s) | Level | Discipline | Day/Time | Season |
Enrolled | Status badges (NEW / HIDDEN / REHEARSAL) | Online Reg toggle | Actions

**Calendar view:** Week default, month available. Color coded by type.
Click block to open edit drawer.

**Print:** Weekly schedule filtered by active filters.
Prints class name, teacher, room, time, enrolled count.

---

### Class Edit Drawer (8 Sections)

#### 1 — Identity
- Name (required)
- Short / Medium / Long description
- Gender: Any / Female / Male
- Age minimum / Age maximum
- **Levels** (multi-select array): Petites | Level 1 | Level 2A | Level 2B |
  Level 2C | Level 3A | Level 3B | Level 3C | Level 4A | Level 4B | Level 4C |
  Adult/Teen
- **Disciplines** (multi-select from `disciplines` table)
- **Curriculum** (multi-select from `dance_curriculum` table)

#### 2 — Schedule
- Days of week (pill toggles: Su Mo Tu We Th Fr Sa)
- Start time / End time
- Start date / End date
- Season (dropdown)
- Studio closure warnings shown inline

#### 3 — Teachers
- First row: Lead + Primary (default)
- "+ Add Teacher" for additional rows
- Each row: Teacher dropdown | Role (Lead / Assistant / Accompanist / Observer)
- One teacher must be primary at all times
- Note: both teachers may not attend every session —
  teacher attendance is tracked per session in the attendance module

#### 4 — Enrollment & Visibility
- Max enrollment
- Show capacity publicly (toggle) — "3 spots left" on website
- Online registration (toggle)
- Hidden from live schedule (toggle)

#### 5 — Flags
- **New flag** (toggle) + expiry date
  - NEW badge on admin list, schedule embed, class detail, Angelina AI
  - Nightly cron removes flag after expiry date
- **Rehearsal flag** (toggle) + production link
- **Performance flag** (toggle)

#### 6 — Class Phases
- Table: Phase | Start | End | Production | Notes
- "+ Add Phase"
- Rehearsal phase sessions push to rehearsal schedule and parent calendar
- Parents notified on phase transition

#### 7 — Pricing
- Base price (required)
- "+ Add Early Bird Tier": Label | Deadline | Amount | Type (flat/%) | Value
- Savings auto-calculated vs full price
- "Preview Pricing Grid" button

#### 8 — Reporting (existing classes, read-only)
- Enrollment / max, attendance rate, revenue, waitlist count
- Link to full class report

---

## Bulk Edit

Select multiple classes → bulk panel:
Assign teacher | Change season | Set dates | Toggle online reg |
Toggle hidden | Set New flag | Delete

Does NOT touch pricing, descriptions, or phases.

---

## Pricing Grid Embed Widget

```
/embed/pricing?class=[id]&tenant=[id]
/embed/pricing?season=[id]&tenant=[id]
```

Shows tiered pricing table, current tier highlighted, countdown to next deadline,
"Register Now" button. WordPress iframe embed — same pattern as calendar widget.

---

## Ad Hoc Rehearsals

Not all rehearsals are tied to a regular class:
- Saturday cast rehearsals for specific roles
- Guest teacher Pas de Deux Fridays
- Full cast dress rehearsals with role-based call times

Created in Productions → Rehearsals module. Role-based call times defined
per rehearsal record. System generates per-student schedules based on casting
role, sends to parents, printable for lobby posting.

See `docs/CASTING_AND_REHEARSAL.md`.

---

## Rehearsal Phase → Parent Communication

When sessions fall within a rehearsal phase:
1. Sessions flagged as rehearsal type
2. Parent calendar shows rehearsal indicator
3. Parents notified: "[Class] transitions to Nutcracker rehearsals starting [date]"
4. ICS subscription updates automatically
5. Sessions appear in productions module rehearsal schedule

---

## Teacher Scorecard Integration

Failure to submit attendance for a class is automatically logged against
the teacher's scorecard. Scorecard dimensions:
1. Attendance submission compliance
2. Timesheet submission timeliness
3. Substitute requests and coverage
4. Curriculum adherence
5. Training completion
6. Student results (future phase)

Full scorecard spec is a separate document.

---

## Settings Pages Required

- Settings → Disciplines (CRUD, drag to reorder)
- Settings → Curriculum (CRUD, drag to reorder)
- Settings → Studio Calendar (closure dates CRUD)

---

## Implementation Order

1. Migration: extend `classes`, create `class_teachers`, `disciplines`,
   `dance_curriculum`, `class_pricing_rules`, `class_phases`, `studio_closures`
2. Settings → Disciplines, Curriculum, Studio Calendar
3. Class edit drawer (all 8 sections)
4. Class list view (filters, bulk edit, view toggle, print)
5. Pricing grid embed widget
6. Class phases → rehearsal push + parent notification
7. "New" flag expiry cron
8. Class reporting pages

---

## Dependencies

- `docs/CASTING_AND_REHEARSAL.md` — ad hoc rehearsal spec
- `docs/SEASONS_AND_ARCHIVAL.md` — season linkage
- `docs/BILLING_AND_CREDITS.md` — pricing rules → tuition posting
- `docs/NOTIFICATIONS.md` — rehearsal phase notifications, scorecard flags

---

*Last updated: March 2026 | Green Lyzard / Ballet Academy and Movement*
