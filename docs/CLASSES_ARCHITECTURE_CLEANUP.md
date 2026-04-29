---
> ⚠️ **DEPRECATED — DO NOT IMPLEMENT FROM THIS SPEC**
>
> This document references tables, columns, or architectural decisions that 
> conflict with the live database or current canonical specs. Last verified 
> against live DB on 2026-04-29.
>
> **Issue:** Drafted before the canonical doc index existed. Reconciliation review (in chat, 2026-04-29) found 7 conflicts with canonical specs: discipline_ids type mismatch (text[] vs uuid[]), status vocabulary disagreement, visibility column naming inconsistency, undefined current_tenant_id() helper, studio_locations reference to nonexistent table, levels join contradicts CLASSES.md, and tenant_id-on-classes contradicts DATABASE_SCHEMA.md. Schema migration in §6 is partially correct but unsafe to execute without rewrite.
>
> **Canonical replacement:** Pending rewrite — see _INDEX.md "Pending Reconciliation" list item 8
>
> See `docs/_AUDIT_2026_04_29.md` for full audit findings.
> See `docs/_INDEX.md` for the current canonical doc map.

---

# Classes Architecture Cleanup — BAM Platform Spec

**Status:** Draft v1
**Owner:** Derek Shaw
**Type:** Architecture refactor (Path B — clean up in place, defer full table split)
**Depends on:** nothing — self-contained
**Unblocks:** `docs/SEASON_PLANNER.md`, `docs/RE_ENROLLMENT_AND_CARTS.md`

---

## 1. Why this exists

The `classes` table has accumulated 44 columns over time. Several are duplicates of each other (text + uuid versions of the same field), some are dead, and the table has no `tenant_id` despite being the operational center of the platform. Visibility logic is split across `is_active`, `is_hidden`, `status`, and `online_registration` with no clear hierarchy. The `levels` field is a `text[]` of human-readable strings, which means there's no referential integrity with `studio_levels` and renaming a level breaks data.

We're cleaning this up *now*, while the database has 63 classes / 0 enrollments / 0 attendance rows and the cost is purely code-side. Once Amanda is using the platform with real enrollments and attendance, the same cleanup becomes a 5x more expensive project.

This doc deliberately does **not** split `classes` into `class_definitions` + `class_offerings`. That split is the right end-state but the cost (70 files touched, every dependent table refactored) is too high for a one-person team driving toward Fall 2026 go-live. We extract 80% of the value with a column-level cleanup plus a single self-reference for cross-season class identity.

## 2. Goals

- One canonical column for each concept (no more `season` AND `season_id`)
- `tenant_id` on `classes` for proper multi-tenant RLS
- A clear, single source of truth for class visibility and lifecycle (`status` enum)
- Referential integrity between classes and levels via a join table
- Support for a class that bridges seasons (Company year over year) via `parent_class_id`
- A documented promotion path to the full definitions/offerings split, deferred to a future spec

## 3. Non-Goals (deferred)

- Splitting `classes` into `class_definitions` + `class_offerings`
- Removing the `class_teachers` join (still single-teacher in practice but the join is harmless)
- Reworking `schedule_instances` generation
- Migrating the legacy `room` text column data into `studio_rooms` rows (separate cleanup)
- Cleaning up the `levels` text values that don't map to a `studio_levels` row (Amanda must do this)

## 4. Current State (verified against live DB)

44 columns total. Verified column-by-column on April 28, 2026 against project `niabwaofqsirfsktyyff`.

### 4.1 Duplicate columns (all 63 rows have both, all consistent)

| Keep | Drop | Reason |
|---|---|---|
| `season_id` (uuid → seasons) | `season` (text) | FK is the source of truth |
| `max_enrollment` (int) | `max_students` (int) | More accurate name; "students" is overloaded |
| `room_id` (uuid → rooms) | `room` (text) | FK is the source of truth |
| `days_of_week` (int[]) | `day_of_week` (int) | A class can meet multiple days |
| `discipline_ids` (text[]) | `discipline` (text) | Array is the real shape |

Verified zero disagreement across all 63 rows for `max_students` vs `max_enrollment`, and full coverage on the others.

### 4.2 Visibility / lifecycle field salad

Currently scattered across:

- `status` (text, default `'active'`) — values unconstrained
- `is_active` (bool, default `true`)
- `is_hidden` (bool, default `false`)
- `online_registration` (bool, default `true`)
- `is_new` (bool, default `false`) + `new_expires_at` (date)

These overlap. A class can be `is_active=true`, `status='active'`, `is_hidden=true` simultaneously and it's unclear what wins.

Replace with a single `status` enum and a separate `is_publicly_listed` boolean for Hidden mode (which is *visibility*, not *lifecycle*). `online_registration` stays — it's a separate concept (the class is published but registration is closed).

### 4.3 Marketing-layer fields

`is_new` + `new_expires_at` exist to render a "NEW" badge in the UI. Keep, but document them as marketing only — not lifecycle.

### 4.4 Missing fields

- `tenant_id` — must be added for proper RLS
- `parent_class_id` — for cross-season class identity (the multi-season case)
- `cancelled_at` + `cancellation_reason` — for the `cancelled` status

## 5. Target Schema

### 5.1 `classes` table after cleanup

```
classes (
  -- identity
  id                    uuid PK
  tenant_id             uuid NOT NULL → tenants                          [NEW]
  name                  text NOT NULL
  style                 text NOT NULL
  description           text
  short_description     text
  medium_description    text
  long_description      text
  color_hex             text
  notes                 text
  
  -- classification (drop singular text versions)
  discipline_ids        text[]
  curriculum_ids        text[]
  age_min               integer
  age_max               integer
  gender                text DEFAULT 'any'
  
  -- scheduling
  season_id             uuid → seasons                                   [keep, was nullable, stays nullable for is_ongoing]
  days_of_week          integer[]                                        [keep array]
  start_time            time
  end_time              time
  start_date            date
  end_date              date
  location_id           uuid → studio_locations
  room_id               uuid → studio_rooms
  
  -- enrollment + capacity
  max_enrollment        integer
  enrolled_count        integer NOT NULL DEFAULT 0
  trial_eligible        boolean NOT NULL DEFAULT true
  point_cost            integer NOT NULL DEFAULT 1
  fee_cents             integer
  
  -- lifecycle (replaces is_active + status text + is_hidden)
  status                class_status NOT NULL DEFAULT 'draft'             [ENUM, see §5.2]
  cancelled_at          timestamptz                                       [NEW]
  cancellation_reason   text                                              [NEW]
  
  -- visibility (separate from lifecycle)
  is_publicly_listed    boolean NOT NULL DEFAULT true                     [renamed from is_hidden, inverted]
  show_capacity_public  boolean NOT NULL DEFAULT false                    [keep]
  online_registration   boolean NOT NULL DEFAULT true                     [keep]
  
  -- marketing
  is_new                boolean NOT NULL DEFAULT false
  new_expires_at        date
  
  -- production flags
  is_rehearsal          boolean NOT NULL DEFAULT false
  is_performance        boolean NOT NULL DEFAULT false
  is_ongoing            boolean NOT NULL DEFAULT false                    [NEW, makes implicit rule explicit]
  
  -- cross-season identity
  parent_class_id       uuid → classes                                    [NEW, self-ref, nullable]
  
  -- timestamps
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()
  
  -- DROPPED: season, max_students, room, day_of_week, discipline, levels, is_active, teacher_id
)
```

**Note on `teacher_id`:** Currently exists on `classes` AND `class_teachers` join table exists. The `class_teachers` table is the future-proof model (substitutes, multiple teachers, etc.). Drop `classes.teacher_id` and rely entirely on `class_teachers`. Code touch needed — see §7.

### 5.2 New `class_status` enum

```sql
CREATE TYPE class_status AS ENUM (
  'draft',       -- being planned, not visible to parents
  'published',   -- live, accepting enrollment per online_registration flag
  'cancelled',   -- was published, no longer running; preserved for history
  'archived'     -- season ended; read-only history
);
```

Lifecycle rules:

```
draft ──────► published ──────► archived
                  │
                  └────► cancelled
```

- `draft → published` happens via Season Planner publish action
- `published → archived` happens automatically on season end
- `published → cancelled` is an explicit admin action with a reason
- `published → draft` allowed only with zero enrollments and super_admin role
- `cancelled → published` allowed (un-cancel) within 30 days

### 5.3 New `class_levels` join table

```sql
CREATE TABLE class_levels (
  class_id  uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  level_id  uuid NOT NULL REFERENCES studio_levels(id) ON DELETE RESTRICT,
  PRIMARY KEY (class_id, level_id)
);
CREATE INDEX class_levels_level_idx ON class_levels (level_id);
```

Replaces `classes.levels text[]`. Backfill via name-match against `studio_levels.name` for each class's `levels` array, then drop the array column.

8 classes serve multiple levels. Backfill must preserve all rows. Any `levels` array entry that does not match a `studio_levels` row is logged to a `migration_unmatched_levels` table for Amanda to resolve manually after the migration runs.

### 5.4 RLS policy update

`classes` currently has three policies, none filter by tenant. Replace with:

```sql
-- Read: any authenticated user in the tenant
CREATE POLICY classes_select ON classes
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Write: admins of the tenant
CREATE POLICY classes_modify ON classes
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND is_admin()
  );

-- Public read for published, publicly-listed classes (parent enrollment widget)
CREATE POLICY classes_public_listing ON classes
  FOR SELECT USING (
    status = 'published'
    AND is_publicly_listed = true
  );
```

`current_tenant_id()` is a SECURITY DEFINER function that resolves the active tenant from the user's `profile_roles` row.

## 6. Migration Plan

### 6.1 Order of operations (single migration file)

```sql
-- Migration: 20260428_classes_architecture_cleanup.sql

BEGIN;

-- 1. Add tenant_id, backfill from profile_roles via teacher_id, then NOT NULL
ALTER TABLE classes ADD COLUMN tenant_id uuid;
UPDATE classes SET tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993';  -- BAM only tenant
ALTER TABLE classes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE classes ADD CONSTRAINT classes_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- 2. Create the class_status enum, add the new column, backfill from is_active+status
CREATE TYPE class_status AS ENUM ('draft','published','cancelled','archived');
ALTER TABLE classes ADD COLUMN status_new class_status;
UPDATE classes SET status_new =
  CASE
    WHEN is_active = false THEN 'archived'
    WHEN status = 'cancelled' THEN 'cancelled'
    WHEN status = 'draft' THEN 'draft'
    ELSE 'published'
  END;
ALTER TABLE classes ALTER COLUMN status_new SET NOT NULL;
ALTER TABLE classes DROP COLUMN status;
ALTER TABLE classes RENAME COLUMN status_new TO status;
ALTER TABLE classes ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Add cancelled_at, cancellation_reason, parent_class_id, is_ongoing
ALTER TABLE classes ADD COLUMN cancelled_at timestamptz;
ALTER TABLE classes ADD COLUMN cancellation_reason text;
ALTER TABLE classes ADD COLUMN parent_class_id uuid REFERENCES classes(id);
ALTER TABLE classes ADD COLUMN is_ongoing boolean NOT NULL DEFAULT false;
UPDATE classes SET is_ongoing = true WHERE season_id IS NULL;

-- 4. Rename is_hidden to is_publicly_listed (inverted)
ALTER TABLE classes ADD COLUMN is_publicly_listed boolean NOT NULL DEFAULT true;
UPDATE classes SET is_publicly_listed = NOT COALESCE(is_hidden, false);
ALTER TABLE classes DROP COLUMN is_hidden;

-- 5. Create class_levels, backfill from levels array
CREATE TABLE class_levels (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES studio_levels(id) ON DELETE RESTRICT,
  PRIMARY KEY (class_id, level_id)
);
CREATE INDEX class_levels_level_idx ON class_levels (level_id);

CREATE TABLE migration_unmatched_levels (
  class_id uuid,
  class_name text,
  unmatched_level_value text,
  noted_at timestamptz DEFAULT now()
);

INSERT INTO class_levels (class_id, level_id)
SELECT c.id, sl.id
FROM classes c
JOIN LATERAL unnest(c.levels) AS lv(value) ON true
JOIN studio_levels sl ON sl.name = lv.value AND sl.tenant_id = c.tenant_id
ON CONFLICT DO NOTHING;

INSERT INTO migration_unmatched_levels (class_id, class_name, unmatched_level_value)
SELECT c.id, c.name, lv.value
FROM classes c
JOIN LATERAL unnest(c.levels) AS lv(value) ON true
LEFT JOIN studio_levels sl ON sl.name = lv.value AND sl.tenant_id = c.tenant_id
WHERE sl.id IS NULL;

-- 6. Drop the duplicate/replaced columns
ALTER TABLE classes DROP COLUMN season;
ALTER TABLE classes DROP COLUMN max_students;
ALTER TABLE classes DROP COLUMN room;
ALTER TABLE classes DROP COLUMN day_of_week;
ALTER TABLE classes DROP COLUMN discipline;
ALTER TABLE classes DROP COLUMN levels;
ALTER TABLE classes DROP COLUMN is_active;
ALTER TABLE classes DROP COLUMN teacher_id;

-- 7. Replace RLS policies
DROP POLICY IF EXISTS classes_select_authenticated ON classes;
DROP POLICY IF EXISTS classes_all_admin ON classes;
DROP POLICY IF EXISTS teacher_read_classes ON classes;

CREATE POLICY classes_select ON classes
  FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY classes_modify ON classes
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND is_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_admin());
CREATE POLICY classes_public_listing ON classes
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_publicly_listed = true);

-- 8. Indexes
CREATE INDEX classes_tenant_status_idx ON classes (tenant_id, status);
CREATE INDEX classes_tenant_season_idx ON classes (tenant_id, season_id);
CREATE INDEX classes_parent_idx ON classes (parent_class_id) WHERE parent_class_id IS NOT NULL;

COMMIT;
```

### 6.2 Verification queries

After migration, run:

```sql
-- Should return 0 — every class belongs to BAM
SELECT count(*) FROM classes WHERE tenant_id IS NULL;

-- Should equal 63 (or whatever current_count + new) — sanity check
SELECT count(*) FROM classes;

-- Should return at least 63 — every class has at least one level mapping
SELECT count(DISTINCT class_id) FROM class_levels;

-- Surface unmatched levels for Amanda to resolve
SELECT * FROM migration_unmatched_levels;

-- Confirm enum is in use
SELECT status, count(*) FROM classes GROUP BY status;
```

### 6.3 Rollback

The migration is wrapped in `BEGIN/COMMIT`. If any step fails, the whole thing rolls back. Manually rolling back after success requires restoring dropped columns from a pre-migration backup — take one before applying.

## 7. Code Touch Plan (70 files)

### 7.1 Priority order

1. **Type regen** — first thing after migration: `supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts`. This will surface most code breaks at compile time.

2. **Search-and-replace fixes** (mechanical, ~30 files):
   - `season:` → `season_id:` (where it was using the text column)
   - `max_students` → `max_enrollment`
   - `room:` (when the value is a text room name from the dropped column) → `room_id:` plus a join to fetch the name
   - `day_of_week` → `days_of_week[0]` (or refactor to handle multi-day)
   - `discipline:` → `discipline_ids:`
   - `is_active = false` → `status = 'archived'`
   - `is_hidden = true` → `is_publicly_listed = false`
   - `class.levels` (array) → join through `class_levels`
   - `class.teacher_id` → join through `class_teachers`

3. **Logical fixes** (require thought, ~20 files):
   - Anywhere visibility is computed from `is_active && !is_hidden && status=='active'` — replace with `status = 'published' AND is_publicly_listed`
   - Anywhere a class lookup assumes one teacher — handle the `class_teachers` join (head teacher vs. assistants)
   - Public enrollment endpoints — apply the new public RLS policy

4. **API route updates** (16 routes):
   - `/api/admin/classes/*` — accept new field names
   - `/api/enrollment/*` — filter by `status='published'`
   - `/api/widget/schedule/*` — filter by `status='published' AND is_publicly_listed`
   - `/api/teach/classes/*` — same status filter

5. **UI updates** (~20 components):
   - Class create/edit forms
   - Class card components (visibility badge logic)
   - Schedule grid filters
   - Admin classes list — replace "active" toggle with status dropdown

### 7.2 Files that need explicit attention

These files contain logic that won't be caught by mechanical search-and-replace:

| File | Why |
|---|---|
| `lib/queries/admin.ts` | Class list with status filter logic |
| `lib/queries/enroll.ts` | Public enrollment filtering |
| `lib/queries/teach.ts` | Teacher class filtering |
| `lib/queries/portal.ts` | Parent-side class filtering |
| `lib/schedule/generate-sessions.ts` | Filters which classes generate sessions |
| `lib/angelina/context.ts` | What classes Angelina knows about |
| `app/api/enrollment/webhook/route.ts` | Stripe webhook capacity logic |
| `app/(public)/enroll/enrollment-wizard.tsx` | 1,911-line file, lots of class filtering |
| `components/angelina/enrollment-chat.tsx` | Class recommendation logic |

Each gets its own pass after the mechanical sweep.

## 8. Phased Rollout

### Phase 1 — Schema migration (1 day)
- Take database backup
- Run migration via `supabase db push` (NOT MCP `apply_migration` — preserve local migration history)
- Verify with §6.2 queries
- Regenerate types

### Phase 2 — Mechanical code sweep (1 day)
- TypeScript compile errors guide the work
- Find/replace pass for column renames
- Commit per logical group, never one giant commit

### Phase 3 — Logical fixes (2 days)
- Visibility logic
- Teacher join migration
- Levels join migration
- Status enum semantics

### Phase 4 — Test surface (1 day)
- Manually walk: admin classes list, schedule, enrollment widget, teacher dashboard, parent portal, Angelina
- Test each role: super_admin, admin, teacher, parent
- Confirm RLS works via different sessions

### Phase 5 — Cleanup (0.5 day)
- Resolve `migration_unmatched_levels` rows with Amanda
- Drop `migration_unmatched_levels` table
- Document the final schema in CLAUDE.md

**Total: ~5.5 days of focused Claude Code time.**

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Code references a dropped column we miss | TypeScript compile errors after `gen types` will catch all of them; don't deploy until clean compile |
| RLS breaks parent enrollment | The `classes_public_listing` policy is explicit; test via incognito browser before merging |
| `migration_unmatched_levels` has too many rows | Run an exploratory query before migration: `SELECT DISTINCT unnest(levels) FROM classes EXCEPT SELECT name FROM studio_levels` — fix Amanda's data first if needed |
| Teacher dropdown breaks because we dropped `teacher_id` | Pre-flight check: every class has a `class_teachers` row. Verified — there are 64 `class_teachers` rows for 63 classes. |
| Cross-season class identity needed before we built it | Won't bite until the second season; we have until summer 2027 |

## 10. Forward Compatibility — Path to Definitions/Offerings Split

When the day comes (likely summer 2027 when year-over-year reporting becomes urgent):

1. Create `class_definitions` table with identity fields from `classes` (name, style, descriptions, discipline, etc.)
2. For each unique `(name, style)` in `classes`, insert one definition
3. Add `class_definition_id` to `classes`, backfill, NOT NULL
4. Rename `classes` to `class_offerings`
5. Update FKs and types

The `parent_class_id` self-reference we're adding now becomes the migration aid — chains of related classes across seasons get rolled up into a single definition.

## 11. Open Questions

1. **Does Amanda want a `notes_admin_only` field separate from `notes`?** Right now there's only one notes field; if it surfaces to teachers/parents in any view, she can't write things like "watch this kid carefully." Defer.
2. **Should `is_ongoing` be derived (`season_id IS NULL`) or stored?** Stored is faster and explicit. Going with stored.
3. **Should `class_teachers` get a `role` column** (head/assistant/substitute) now while we're cleaning up? Worth doing — small addition, future-proofs. Adding to migration §6.1 step 9 if Derek confirms.

## 12. Success Criteria

- All 63 classes migrated with no data loss
- TypeScript compiles cleanly across the repo
- All four user roles (super_admin, admin, teacher, parent) can complete their main flows
- Public enrollment widget shows only `published + publicly_listed` classes
- Zero references in code to the dropped columns
- Type definitions are 25%+ smaller for the classes table
- Schema is ready to layer Season Planner draft/published flow on top of without further changes

---

**Next:** review this doc, then `docs/SEASON_PLANNER.md` rebases on top of it (the planner gets simpler — its `classes.status` column already exists from this cleanup).
