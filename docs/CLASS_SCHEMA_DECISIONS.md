# Class Schema Decisions — BAM Platform

**Date:** 2026-04-29
**Owner:** Derek Shaw
**Resolves:** `docs/_INDEX.md` Pending item #9 — Inter-canonical conflict resolution
**Type:** Architectural decision record

---

## Why this exists

Three docs disagreed on class-related schema:

- **`docs/DATABASE_SCHEMA.md`** — accurately documents the live database
- **`docs/CLASSES.md`** v2.0 — operational class management spec
- **`docs/SCHEDULING_AND_LMS.md`** v2.0 — labeled "Authoritative" but proposes substantial future-state rearchitecture (renamed columns, new tables, `tenant_id` on classes, four-layer naming system) that was never built

Treating SCHEDULING_AND_LMS.md as ground truth caused drift. Every doc drafted against its proposals contradicted the live DB. This decision record reconciles all three to a single coherent picture.

---

## Decisions

### D1 — `SCHEDULING_AND_LMS.md` is a vision document, not an implementation contract

It contains genuinely valuable design thinking (AI attendance intelligence, livestream alert system, multi-day competition structure, bundles/promotions). But the fundamental schema rearchitecture it proposes — `class_sessions` to replace `schedule_instances`, four-layer naming, `tenant_id` everywhere, renamed lifecycle columns — was never implemented and would be a multi-week refactor with no clear payoff.

**Action:**
- Add a header to `SCHEDULING_AND_LMS.md`: "VISION DOC — design exploration, not current implementation contract."
- Update `_INDEX.md` so it is no longer the Scheduling canonical. CLASSES.md + DATABASE_SCHEMA.md hold canonical for current state.
- Sections of SCHEDULING_AND_LMS.md that describe behaviors actually implemented today (substitute workflow, calendar sync, check-in flow — sections 5/6/7) get cross-referenced from CLASSES.md as accurate behavioral docs.
- Future specs that want to pull ideas from it (e.g., livestream alerts, multi-day competitions) cite it as inspiration but specify their own implementation against the current schema.

### D2 — Classes do not get `tenant_id`

The live DB does not have it. RLS works through `class_teachers.tenant_id` joins and other adjacent tables.

**Reasoning:** Adding `tenant_id` to `classes` is a SaaS-scaling investment that pays off when you have tenant #2. Today there is one tenant. Until that's no longer true, the migration cost (every class-related query touched, RLS rewritten, types regenerated, code reviewed) outweighs the benefit.

**Action:**
- Document this decision explicitly. CLAUDE.md Section 4 already says "classes has NO tenant_id" — keep that and add a note that this is a deliberate decision, revisitable when adding tenant #2.
- Future-state migration to add `tenant_id` is documented as a Pending item in `_INDEX.md` for the white-label expansion phase, not now.

### D3 — Add a CHECK constraint to `classes.status`

Currently `classes.status` is unconstrained `text` defaulting to `'active'`. Anyone can set it to anything. This violates the spec-first / verify-distinct-values discipline in CLAUDE.md §17.

**Decision:** Add `CHECK (status IN ('draft','active','cancelled','completed'))` to match the vocabulary proposed in SCHEDULING_AND_LMS.md §2.2.

**Rationale for these specific values:**
- `draft` — class being planned, not yet visible/enrollable. Matches the season-planning workflow Amanda needs.
- `active` — currently the default. Live, enrollable. Matches existing rows.
- `cancelled` — was active, no longer running. Distinct from archived because cancelled implies preserved history but the class is no longer happening.
- `completed` — season ended naturally. Distinct from cancelled because the class ran to completion.

**Migration:**

```sql
-- 20260429_classes_status_constraint.sql
DO $$
DECLARE
  invalid_count integer;
BEGIN
  -- Check no existing rows would violate the constraint
  SELECT count(*) INTO invalid_count
  FROM classes
  WHERE status NOT IN ('draft','active','cancelled','completed');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot add CHECK constraint: % rows have status values outside the allowed set. Run: SELECT DISTINCT status FROM classes; to see them.', invalid_count;
  END IF;
END $$;

ALTER TABLE classes
  ADD CONSTRAINT classes_status_check
  CHECK (status IN ('draft','active','cancelled','completed'));
```

The pre-flight check ensures the migration only succeeds if existing data is compatible. If any rows have other values (e.g., legacy `'inactive'`), the migration fails loudly and we resolve the data first.

### D4 — `is_hidden` stays as the visibility column

The live DB has `is_hidden boolean default false`. CLASSES.md uses `is_hidden`. SCHEDULING_AND_LMS.md proposed renaming to `is_published` (inverted semantics).

**Decision:** Keep `is_hidden`. No migration. SCHEDULING_AND_LMS.md will be updated to remove the `is_published` proposal.

**Rationale:** Renaming columns is expensive (every query touched, every type updated) and provides no functional benefit. The semantics of "hidden = true means hide it" are clear enough.

### D5 — Status of new specs drafted before this reconciliation

Two specs drafted earlier today before the canonical doc index existed:

- **`docs/CLASSES_ARCHITECTURE_CLEANUP.md`** — already deprecated (header added). Conflicts with all four decisions above. Stays deprecated.
- **`docs/SEASON_PLANNER.md`** (saved as a draft, not yet committed to repo) — proposed a `class_status` enum (`draft`/`published`/`cancelled`/`archived`) that conflicts with D3. Should be rewritten using the D3 vocabulary if/when that work resumes.

---

## What this changes in the canonical docs

| Doc | Change |
|---|---|
| `docs/SCHEDULING_AND_LMS.md` | Add "VISION DOC" header at top. No content changes. |
| `docs/_INDEX.md` | Move SCHEDULING_AND_LMS from Canonical to "Vision/Reference" under Scheduling. CLASSES.md becomes the Scheduling canonical alongside DATABASE_SCHEMA.md. Mark item #9 resolved. |
| `docs/CLASSES.md` | Add a small section noting the four valid status values per D3. |
| `docs/DATABASE_SCHEMA.md` | Update the `classes.status` row to show the CHECK constraint after migration runs. |
| `/CLAUDE.md` | No change — Section 4 already says classes has no tenant_id. |

---

## Migration plan

One migration to apply (D3):

```
supabase/migrations/20260429_classes_status_constraint.sql
```

Steps in order:

1. Run pre-flight check via Supabase MCP: `SELECT DISTINCT status FROM classes;`
2. If any value isn't in the allowed set, fix that data first (won't be needed if all current rows are `active`).
3. Apply migration via `supabase db push` (Regular Terminal).
4. Regenerate types: `supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts`
5. Update DATABASE_SCHEMA.md to reflect the CHECK constraint.
6. Commit.

Other doc changes are pure markdown — no migrations, no code changes.

---

## What remains pending after this

From `_INDEX.md` Pending Reconciliation Tasks:

| # | Item | Status after this doc |
|---|---|---|
| 1 | Enrollment master | Still pending |
| 2 | Module count to 13 | Still pending |
| 3 | UNIFIED_SCHEDULE implementation status | Still pending |
| 4 | Teacher rate management | Still pending |
| 5 | Teacher substitute system | Still pending |
| 6 | SUBSTITUTE_TEACHER 39KB | Still pending |
| 7 | Style/UX nuance pass | Still pending |
| 8 | CLASSES_ARCHITECTURE_CLEANUP rewrite | Still pending (or close as no-longer-needed) |
| **9** | **Inter-canonical class conflict** | **✅ RESOLVED by this doc** |

---

## Decision authority

These decisions made by Derek Shaw on 2026-04-29 in consultation with Claude. To override any decision, document the new decision and the rationale in a follow-up record.
