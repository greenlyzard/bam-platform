# Occurrence Generation

_Task 19. Written 2026-07-29. Amended 2026-07-29 with Phase 0–3 results.
Status: **Phases 0–3 shipped. Phase 4 blocked on Amanda (§8 Q1). Phases 5–6 not started.**_

Fall begins **2026-08-15**.

---

## 1. Why this exists

`schedule_instances` is the occurrence table. Attendance is keyed on it (`cda3a64`),
timesheet drafts are generated from it (`20260728000007`), and instance-level
scheduling and closures enforcement both depend on it.

**There was no generator.** The 1,042 rows in the table were output from
`20260311000016_seed_bam_schedule.sql`, a one-time March seed. Coverage stopped
where that seed's loop stopped. Nothing had created an occurrence since.

This was therefore a build, not a repair. That distinction mattered: the §5.1
constraint in `ABSENCE_SUBSTITUTION_AND_ASSIGNMENT.md` was written to stop a
regeneration from rewriting history, but no regeneration had ever run. We chose the
rule before the first execution rather than retrofitting one.

---

## 2. State as of 2026-07-29, after Phases 1–3

| Fact | Value |
|---|---|
| Classes | 153 — all `status='active'`, all `is_active=true` |
| Recurrence data | **complete on all 153** |
| Classes intersecting the Fall window | **91** · ended before Fall: **62** |
| `schedule_instances` rows | 1,042 |
| Orphans (NULL `class_id`) | 61 — **all now `cancelled`** (Phase 3) |
| Orphan date range | 2026-03-09 → 2026-03-14, the frozen March seed week |
| Classes with no `teacher_id` | 4 |
| Rehearsal classes | 39 |
| `studio_closures` | **6 rows, all Spring Break 2026-04-06 → 04-11 — nothing for Fall** |
| `attendance` / `attendance_records` / `rehearsal_attendance` | all empty |
| `days_of_week` | `integer[]`, values 1–6, no Sunday anywhere |

### Corrections to the 2026-07-28 pickup note

- Orphans are **61**, not 35; the orphan and retired-room figures were conflated.
- Rehearsal classes are **39**, not 26.
- `classes.status` is `'active'`, **not** `'published'`. Filtering classes on
  `'published'` silently returns nothing.
- `class_recurrence_rules`, `class_sessions`, `session_attendance` and
  `admin_tasks` **do not exist in the database**, though
  `20260312000004_schedule_phase1.sql` defines all four and reports as applied.
  **Migration-list parity is not schema parity on this project.** The `admin_tasks`
  P1 defect is genuine.
- All three attendance tables are empty. The "second attendance system" is code
  duplication with no data behind it.

---

## 3. Decisions settled

**The occurrence is the snapshot.** Generation resolves the teacher at write time
and stores it on `schedule_instances.teacher_id`. It is never recomputed from a
live `class_teachers` lookup. This satisfies §5.1 without adding effective dating to
`class_teachers` — the occurrence row *is* the effective-dated record of who was
assigned. Effective dating on `class_teachers` remains backlog, not a Fall blocker.

**Generation never touches the past.** Only dates strictly after `current_date` are
considered, and the function contains no UPDATE and no DELETE. Re-running over a
past window is a no-op. Deliberately not configurable: a `p_force` flag would be the
entire safety property with an off switch.

**Per-class window.** Generation walks each class's own `[start_date, end_date]`
intersected with the requested range. The season table is not consulted. This is why
a Fall run covers 91 classes and not 153 — 62 classes ended before Fall.

**Idempotent by natural key.** Partial unique index on
`(class_id, event_date, start_time) WHERE class_id IS NOT NULL`, with bare
`ON CONFLICT DO NOTHING`. The bare form is required: the index is partial, so an
explicit arbiter would have to restate the predicate exactly.

**Weekdays are ISO: Monday 1 … Sunday 7. `0` is invalid.** ISO `isodow` and Postgres
`dow` are identical Monday–Saturday and diverge only on Sunday (7 vs 0). All 981
testable instances matched both, so live data cannot settle it. Resolved by fiat and
pinned by `classes_days_of_week_iso_check`. Without it, the first Sunday class
entered as `0` would generate nothing and raise no error.

**Single-tenant only, enforced by a guard.** `classes` has **no `tenant_id`
column**, so eligible classes cannot be scoped by tenant. With a second tenant
present the generator would stamp every studio's classes under one `p_tenant_id`.
The function raises when `tenants > 1`. Adding `classes.tenant_id` is the real fix;
the guard is its forcing function. A migration pre-flight also raises if
`classes.tenant_id` ever appears, so the guard cannot be left stale.

**Closures are skipped at generation** and counted in `dates_skipped_closed`.

**Rehearsal classes generate `event_type='rehearsal'`**, driven by
`classes.is_rehearsal`. Everything else is `'class'`.

**Generated rows are `status='published'`, `approval_status='approved'`,
`is_trial_eligible` copied from the class.** Copying trial eligibility is not
optional — leaving it at the column default would silently mark trial-eligible
classes' occurrences as ineligible.

**Substitutes are not set by generation.** `substitute_teacher_id` stays NULL.

**Incomplete classes are skipped, not fatal.** `schedule_instances.end_time` is NOT
NULL while `classes.end_time` is nullable, so one half-entered class would otherwise
abort an entire season run. Zero classes are excluded today. Such a class is
invisible in the return contract — §7 check 1 catches it instead.

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

`SECURITY DEFINER`, `set search_path = public, pg_temp`. Execute revoked from
`public`, granted to `authenticated`, with an in-body `is_admin()` check.
`is_schedule_approver()` exists and reads `schedule_approvers`, which is empty — 
gating on it would refuse everyone including Amanda. The authz check fires only when
`auth.uid()` is not null, so migrations, the SQL editor and service-role calls (all
already privileged, all without a JWT) can run it. Those two mechanisms are
load-bearing **together**: the null-uid carve-out alone would admit `anon`, and the
grant is what excludes it. Do not "simplify" either.

`occurrences_created` counts rows actually inserted — `ON CONFLICT` skips do not
appear in `RETURNING`, so a second identical run reports 0.

---

## 5. Phases

**Phase 0 — pre-flight. ✅ 2026-07-29.** Weekday encoding resolved. Zero classes
with `end_date < start_date`.

**Phase 1 — constraints. ✅ `20260729000001`, commit `2633d1a`.** Natural-key
partial unique index; ISO weekday CHECK. Zero duplicates and zero violations at
apply time.

**Phase 2 — the generator. ✅ `20260729000002`, commit `3222fec`.** Verified by a
rollback-wrapped `DO` block against live data: **2,918 occurrences across 91
classes; second run created 0; zero on closure dates; zero in the past; zero
weekday mismatches; 1,116 rehearsal rows; 130 with a NULL teacher.** Nothing
persisted.

**Phase 3 — orphan disposition. ✅ `20260729000003`, commit `d7e7b9f`.** All 61
orphans set `status='cancelled'` with a reason naming this spec. Zero real classes
touched; total row count unchanged at 1,042. Pre-flight found `timesheet_entries`
reaches `schedule_instances` through **two** FK columns — `schedule_instance_id`
**and** `session_id` — both zero. Checking only the first would have cleared the
migration while leaving a payroll row pointed at a cancelled session.

**Phase 4 — first generation. 🔴 BLOCKED on §8 Q1.** Run for
`2026-08-15 → 2027-06-15`. Expect ~2,918 rows across 91 classes.

**Phase 5 — verification.** Per §7.

**Phase 6 — cron.** Rolling extension so coverage never expires again. **Inherits
Phase 4's block** — a cron that generates against an empty closure calendar
propagates the same error on a schedule. Fails closed if `CRON_SECRET` is unset,
following the draft cron rather than the older routes that fail open.

---

## 6. Consequences to expect at Phase 4

- **Timesheet drafts roughly double.** One Fall week produced 63 drafts from 66
  covered classes; 91 will be covered.
- **130 occurrences will have a NULL teacher** — the 4 unassigned classes. They
  generate no draft and no payroll. That is the honest representation: the gap is in
  the assignment, not the schedule.
- **1,116 rehearsal occurrences have no attendance surface.** `/api/teach/roster`
  filters `event_type='class'`. Eleven rows kept this marginal; 1,116 will not.
  See §8 Q2.
- **`markAttendance` still authorizes on `classes.teacher_id`**, so a substitute
  cannot mark attendance. Unchanged by this spec.

---

## 7. Verification

1. **Every class whose `[start_date, end_date]` intersects the generation window has
   at least one occurrence.** Not "all 153" — 62 classes ended before Fall and
   correctly produce nothing. This check is also what catches a class silently
   skipped for incomplete data (§3).
2. Zero occurrences fall on a `studio_closures.closed_date`.
3. Zero occurrences created with `event_date <= current_date`.
4. Every occurrence's weekday is in its class's `days_of_week`.
5. A second identical run creates **zero** rows.
6. Spot-check one class against its published schedule by hand.
7. Draft generation for one Fall week produces priced entries for newly covered
   classes.

Checks 1–5 run as one `DO` block ending in `RAISE EXCEPTION 'RESULT | %'`, which
rolls the whole thing back and carries the findings out. This was used for Phase 2
and beats reasoning about whether the function does what you think.

---

## 8. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | 🔴 **The Fall holiday calendar is empty.** All 6 `studio_closures` rows are Spring Break 2026-04-06→04-11. There is no Thanksgiving, no winter break, no spring 2027. **Amanda** | **Phase 4** |
| 2 | Should rehearsal occurrences be attendance-markable? 1,116 of them arrive at Phase 4 | Roster route |
| 3 | Who teaches the Friday 3:30–6:30 Tricks block? Generation produces those occurrences with a NULL teacher | Fall |

**Q1 is the whole reason Phase 4 has not run.** Generating now writes occurrences
through Thanksgiving and winter break. Those produce timesheet drafts, and drafts
feed payroll and proration — so the cost is not a wrong calendar, it is wrong money.
Unwinding it means deleting occurrences that attendance may by then hang off. The
closure list must be loaded **before** the first generation, not after.
