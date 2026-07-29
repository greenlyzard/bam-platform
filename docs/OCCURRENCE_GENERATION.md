# Occurrence Generation

_Task 19. Written 2026-07-29. Amended 2026-07-29 with Phase 0 results.
Status: spec. Phase 0 complete, Phases 1–6 not built._

Fall begins **2026-08-15**.

---

## 1. Why this exists

`schedule_instances` is the occurrence table. Attendance is keyed on it (`cda3a64`),
timesheet drafts are generated from it (`20260728000007`), and instance-level
scheduling and closures enforcement both depend on it.

**There is no generator.** The 1,042 rows in the table are output from
`20260311000016_seed_bam_schedule.sql`, a one-time March seed. Coverage stops where
that seed's loop stopped. Nothing has created an occurrence since.

This is therefore a build, not a repair. That distinction matters: the §5.1
constraint in `ABSENCE_SUBSTITUTION_AND_ASSIGNMENT.md` was written to stop a
regeneration from rewriting history, but no regeneration has ever run. We are
choosing the rule before the first execution rather than retrofitting one.

---

## 2. Current state — verified against the live database 2026-07-29

| Fact | Value |
|---|---|
| Classes | 153 — all `status='active'`, all `is_active=true` |
| Recurrence data | **complete on all 153** — no missing `days_of_week`, `start_date`, `end_date`, `start_time` |
| Classes with occurrences | 66 · **87 have none** |
| `schedule_instances` rows | 1,042, all `status='published'` |
| Coverage window | 2026-03-09 → **2026-11-26** |
| Rows with NULL `class_id` | **61** |
| `event_type` present | `class` 1,031 · `rehearsal` 11 |
| Rehearsal classes | **39** |
| Classes with no `teacher_id` | 4 |
| Seasons on classes | 2 — prior `2025-08-14 → 2026-06-15`, Fall `2026-08-15 → 2027-06-15` |
| `studio_closures` | 6 rows, `closed_date` (single date), tenant-scoped |
| Duplicates on `(class_id, event_date, start_time)` | **0** |
| `attendance` / `attendance_records` / `rehearsal_attendance` | **all empty** |
| `days_of_week` | `integer[]`, distinct values **1–6 only** |
| Sunday instances | **0** · classes containing `0`: **0** · containing `7`: **0** |
| Classes with `end_date < start_date` | **0** |

### Corrections to the 2026-07-28 pickup note

- Orphans are **61**, not 35. There is no separate 35-row set; the orphan and
  retired-room figures were conflated.
- Rehearsal classes are **39**, not 26.
- `classes.status` is `'active'`, **not** `'published'`. The `'published'`
  convention belongs to `schedule_instances.status`. Filtering classes on
  `'published'` silently returns nothing.
- `class_recurrence_rules`, `class_sessions`, `session_attendance` and
  `admin_tasks` **do not exist in the database**, though
  `20260312000004_schedule_phase1.sql` defines all four and reports as applied on
  both local and remote. Migration-list parity is not schema parity on this
  project. The `admin_tasks` P1 defect is genuine.
- All three attendance tables are empty. The "second attendance system" is code
  duplication with no data behind it.

---

## 3. Decisions settled

**The occurrence is the snapshot.** Generation resolves the teacher at write time
and stores it on `schedule_instances.teacher_id`. It is never recomputed from a
live `class_teachers` lookup afterwards. This satisfies §5.1 without adding
effective dating to `class_teachers`, because the occurrence row *is* the
effective-dated record of who was assigned. Effective dating on `class_teachers`
remains backlog, not a Fall blocker.

**Generation never touches the past.** The function refuses to insert, update or
delete any occurrence with `event_date <= current_date`. Re-running over a past
window is a no-op, not a rewrite. This is the mechanical guarantee behind the rule
above.

**Per-class window, not a global season window.** Every class carries its own
`start_date` and `end_date` and all 153 are populated. Generation walks
`[start_date, end_date]` per class. The season table is not consulted.

**Idempotent by natural key.** `(class_id, event_date, start_time)` is unique among
existing rows, so a partial unique index is created and generation is
`ON CONFLICT DO NOTHING`. Re-running produces zero new rows and zero errors.

**Weekdays are ISO: Monday 1 … Sunday 7. `0` is invalid.** Phase 0 established that
ISO (`isodow`) and Postgres `dow` are *identical* for Monday–Saturday and diverge
only on Sunday — ISO 7 against `dow` 0. All 981 testable instances matched both
encodings, so the existing data cannot distinguish them and does not need to: no
Sunday class exists, and no array contains `0` or `7`. The ambiguity is therefore
harmless today and dangerous tomorrow, because an admin adding the first Sunday
class could reasonably enter either value and one of them would silently generate
nothing. Resolved by fiat: generation uses `isodow`, and a CHECK constraint pins
`days_of_week` elements to `1..7`. No current row violates it.

**Closures are skipped at generation.** A date present in `studio_closures` for the
tenant produces no occurrence. Closure rows are single-date. This is what makes the
proration rule in the billing spec computable.

**Rehearsal classes generate `event_type='rehearsal'`.** `classes.is_rehearsal`
drives it. All other generated rows are `event_type='class'`.

**Generated rows are `status='published'`, `approval_status='approved'`** — matching
both column defaults and all 1,042 existing rows. Generation does not introduce an
approval step; `schedule_approvers` and `schedule_change_requests` are empty and out
of scope here.

**Room and location are copied from the class** (`room_id`, `location_id`). Retired
rooms are not resolved by this spec.

**Substitutes are not set by generation.** `substitute_teacher_id` stays NULL.
Substitution is assignment-time behaviour and belongs to
`ABSENCE_SUBSTITUTION_AND_ASSIGNMENT.md`.

---

## 4. The generation contract

```
generate_occurrences(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_class_id  uuid default null   -- null = all eligible classes
) returns table (classes_processed int, occurrences_created int, dates_skipped_closed int)
```

For each eligible class — `is_active`, `status='active'`, tenant-scoped — and each
date `d` in the intersection of `[p_from, p_to]` and the class's
`[start_date, end_date]`:

1. Skip unless `extract(isodow from d)::int = any(days_of_week)`.
2. Skip if `d` is in `studio_closures` for the tenant.
3. Skip if `d <= current_date`.
4. Insert with the class's `start_time`, `end_time`, `teacher_id`, `room_id`,
   `location_id`; `event_type` from `is_rehearsal`; `ON CONFLICT DO NOTHING`.

`SECURITY DEFINER`, tenant-scoped, callable only by schedule managers.

---

## 5. Phases

**Phase 0 — pre-flight. ✅ Complete 2026-07-29.**
Weekday encoding resolved (§3). `end_date < start_date`: zero rows. Nothing blocks
Phase 1.

**Phase 1 — constraints.**
- Partial unique index on
  `(class_id, event_date, start_time) WHERE class_id IS NOT NULL`. Safe: zero
  duplicates today.
- CHECK constraint pinning `days_of_week` elements to `1..7`. Safe: zero violations
  today.

**Phase 2 — the function.** As §4.

**Phase 3 — orphan disposition.** The 61 NULL-`class_id` rows. They can record no
attendance and produce no drafts, and they are unrecoverable. Recommended: mark
`status='cancelled'` with a `cancellation_reason` naming this spec, rather than
delete — the table is referenced by `timesheet_entries.schedule_instance_id` and a
delete could cascade or fail. **Confirm no timesheet entry references them before
running.**

**Phase 4 — first generation.** Run for the Fall window `2026-08-15 → 2027-06-15`.
Expected: occurrences for all 153 classes, not 66; nothing before today; nothing on
the 6 closure dates.

**Phase 5 — verification.** Per §7.

**Phase 6 — cron.** Rolling extension so coverage never expires again. The draft
generator cron (08:30 UTC) is the precedent. **Fails closed if `CRON_SECRET` is
unset** — the existing routes fail open, the draft cron does not, and this follows
the draft cron.

---

## 6. Consequences to expect

Generating for all 153 classes will surface things currently hidden by the 87
classes having no occurrences at all:

- **Timesheet drafts multiply.** One Fall week produced 63 drafts from 66 covered
  classes. Full coverage will roughly double that. Rates are seeded for all 19
  teachers, so they should price; unpriced entries surface as warnings.
- **The 4 classes with no `teacher_id`** produce occurrences with a NULL teacher.
  They generate no draft and no payroll. This is the honest representation — the
  gap is in the assignment, not the schedule.
- **Rehearsal occurrences have no attendance surface.** `/api/teach/roster` filters
  `event_type='class'`. Generating 39 rehearsal classes' occurrences makes that gap
  visible where 11 rows kept it marginal. Not fixed here; recorded.
- **`markAttendance` still authorizes on `classes.teacher_id`**, so a substitute
  cannot mark attendance. Unchanged by this spec.

---

## 7. Verification

Generation is correct when, for the Fall window:

1. All 153 classes have at least one occurrence.
2. Zero occurrences fall on a `studio_closures.closed_date`.
3. Zero occurrences exist with `event_date <= current_date` that did not exist
   before the run — compare a snapshot count taken first.
4. Every occurrence's weekday is in its class's `days_of_week`.
5. A second identical run creates **zero** rows.
6. Spot-check one class against its published schedule by hand.
7. Draft generation for one Fall week produces priced entries for the newly covered
   classes.

Checks 1–5 are single queries and should be run as one `DO` block ending in
`RAISE EXCEPTION 'RESULT | %'` so the whole thing rolls back and reports.

---

## 8. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | Do any `timesheet_entries` reference the 61 orphans? | Phase 3 |
| 2 | Should rehearsal occurrences be attendance-markable for Fall? | Roster route |
| 3 | Are the 6 closure rows complete for the Fall season, or is the holiday calendar still to be entered? **Amanda** | Phase 4 correctness |
| 4 | Who teaches the Friday 3:30–6:30 Tricks block? Already open. Generation will now produce those occurrences with a NULL teacher | Fall |

Question 3 matters more than it looks. Generating a full season against an
incomplete closure list produces occurrences on days the studio is shut, which then
produce timesheet drafts and, downstream, proration against dates nobody worked.
