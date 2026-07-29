# Absence, Substitution & Assignment History

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. Three requirements

1. **A teacher can record an absence after the fact.** Teachers are bad at admin. A system that only accepts absences in advance records nothing.
2. **A planned absence creates a staffing need** — it publishes a substitute request somebody has to fill, before the class happens.
3. **A teacher can change mid-season without destroying the record of who taught what.** This is the one with a real hazard in it.

---

## 2. Findings

### 2.1 The substitution chain exists and is entirely unwired

| Piece | State |
|---|---|
| `substitute_requests` | `instance_id`, `requesting_teacher_id`, `reason`, `status`, `filled_by`, `filled_at`. Already **occurrence-scoped**, which is right. **0 rows** |
| `schedule_instances.substitute_teacher_id` | Exists. **0 instances have one** |
| `schedule_instances.event_type = 'teacher_absence'` | Allowed value, unused |
| `timesheet_entries.is_substitute`, `substitute_for_teacher_id` | Exist, never written |
| Draft generator (`20260728000007`) | **Already honours substitution**: drafts for the substitute as `substitute`, drafts nothing for the covered teacher |
| `/teach/report-absence` | Asks the teacher to type a **raw UUID**. Unusable |

The generator is ahead of the rest of the chain. It will do the right thing the moment `substitute_teacher_id` is populated by something.

### 2.2 `teacher_profiles` hides departed teachers — including from payroll

```sql
SELECT p.id, p.first_name, … , t.is_active
FROM profiles p JOIN teachers t ON t.id = p.id
WHERE t.is_active = true
```

**Deactivate a teacher and they disappear from the view.** `/admin/timesheets/payroll` builds its teacher list from `teacher_profiles`, so a teacher who leaves mid-season vanishes from the report — final pay included. Claude Code found the symptom independently on 2026-07-28 (entries belonging to a teacher not on the roster land in no section and no total) and added a warning banner; this is the cause.

**Nobody has left yet — 0 inactive teachers.** The first departure is when this bites, and it bites at exactly the moment someone is owed a final cheque.

### 2.3 `class_teachers` has no effective dating

`id, class_id, teacher_id, role, is_primary, tenant_id, created_at`. No `valid_from`, no `valid_to`.

So a mid-season teacher change has only one obvious implementation — update the row — and that **silently rewrites history**. Every past occurrence of that class would then report the new teacher, who never taught them.

### 2.4 What already protects history

- `timesheet_entries` reaches a teacher through `timesheets.teacher_id`. An entry created for the old teacher stays theirs — reassignment would require moving it to a different timesheet.
- The snapshot trigger (`20260728000005`) **refuses** to change `date` or `timesheet_id` on a paid entry.
- The trigger re-resolves on `timesheet_id` change, so an entry moved between teachers reprices to the new teacher's rate rather than keeping a stale one.

The entry side is sound. The assignment side is not.

---

## 3. Absence

### 3.1 One record, two lead times

An absence is a fact about an occurrence. Whether it is reported before or after the class changes what the studio can *do*, not what gets recorded.

```
teacher_absences
  id, tenant_id
  schedule_instance_id      not null       -- the occurrence, never class+date
  teacher_id                not null       -- who is out
  reported_at, reported_by
  absence_type                             -- planned | same_day | retroactive
  reason                    null           -- admin-visible, never parent-visible
  coverage_status                          -- needed | requested | filled
                                           --   | unfilled | not_required
```

`absence_type` is derived from `reported_at` against the occurrence date, not chosen by the teacher — a dropdown asking someone to classify their own lateness gets the wrong answer.

**Retroactive absence is a correction, not a request.** No substitute can be found for last Tuesday. What it does is fix the record and the pay: the class either happened with someone else (record the sub) or did not happen (mark the instance cancelled).

### 3.2 Consequences for pay

| Situation | Absent teacher | Substitute |
|---|---|---|
| Planned, filled | No draft | `substitute` draft at their own rate |
| Same-day, filled | No draft | `substitute` draft |
| Retroactive, someone covered | Draft deleted or flipped to zero | `substitute` draft created retroactively |
| Absence, nobody covered, class cancelled | No draft | — |
| Absence reported after the entry was **paid** | **Nothing changes automatically.** Adjustment entry only | — |

The last row is the important one. A paid entry is immutable (`PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.1), so a late absence report against a paid period produces an adjustment somebody approves — never a silent rewrite of a period Square already ran.

### 3.3 Fixing the report-absence surface

Replace the UUID input with the teacher's own upcoming occurrences, and add a second path for "I was out" covering the recent past — bounded by the pay period's edit cutoff, since anything older is an adjustment.

---

## 4. Substitution

### 4.1 The chain

```
absence recorded
  → substitute_requests row (instance_id, requesting_teacher_id, reason)
  → admin or eligible teacher accepts        → filled_by, filled_at
  → schedule_instances.substitute_teacher_id set
  → generator drafts `substitute` for the sub, nothing for the absent teacher
```

Every link exists as a column. None is written today.

**`substitute_teacher_id` on the instance is the authority for pay.** `PAYROLL_CORRECTNESS_AND_REPORTING.md` §2.6 lists six representations of substitution; this settles which one the generator reads — it already does.

### 4.2 Nobody is sub-eligible

`teachers.is_sub_eligible` is **false for all 20**. The substitute pool is empty, so a request has nobody to offer it to. That is a data question for Amanda, not a design one, and it blocks the whole flow.

### 4.3 An unfilled request is a studio problem, not a teacher problem

A request that goes unfilled as the class approaches must escalate — visibly, on an admin surface, with the class date attached. The failure mode otherwise is a request sitting in a queue nobody reads and a class with no teacher on the day.

---

## 5. Mid-season teacher change

### 5.1 The rule

**Assignment is effective-dated, exactly like pay rates.**

```
class_teachers
  + valid_from date not null default current_date
  + valid_to   date null
```

A teacher change **closes the old row and opens a new one**. It never updates `teacher_id` in place.

Past occurrences keep pointing at whoever actually taught them, because `schedule_instances.teacher_id` was stamped when the occurrence was generated and is not derived at read time.

**Regeneration must respect this.** If the occurrence generator re-runs over past dates and re-derives teachers from a live `class_teachers` lookup, it will rewrite history the very thing effective dating exists to prevent. The generator resolves assignment **as of the occurrence date**.

### 5.2 What must not move

| Object | On teacher change |
|---|---|
| Past `schedule_instances` | Unchanged. The old teacher taught them |
| Existing `timesheet_entries` | Unchanged. They belong to the old teacher's timesheet |
| Paid entries | Immutable, enforced by trigger |
| `teacher_rates` for the old teacher | Retained. Their history is what past pay was priced from — never deleted, only closed with `valid_to` |
| Future occurrences after the change date | Re-pointed to the new teacher |

### 5.3 Departure ≠ deletion

Deactivating a teacher must not remove them from payroll, reporting, or history.

**Required fix:** `teacher_profiles` drops its `WHERE is_active = true`, and every caller that wants only current staff filters explicitly. A view that quietly excludes rows is a trap — the caller cannot see the filter and will not think to question an empty result.

That is a breaking change across every consumer of the view, so it needs its own pass and a full caller audit. Until then, **a departing teacher must not be deactivated until their final pay has been run**, and that should be written into the offboarding checklist rather than assumed.

Related: `substitute_requests.filled_by` and `timesheet_entries.substitute_for_teacher_id` may reference someone who has since left. Those references must survive — `ON DELETE SET NULL` at most, never cascade.

### 5.4 Offboarding, in order

1. Close `class_teachers` rows with `valid_to`
2. Re-point future occurrences to the incoming teacher
3. Confirm all outstanding drafts for the departing teacher
4. Run their final pay
5. Close their `teacher_rates` rows with `valid_to`
6. **Only then** set `is_active = false`

Steps 3–4 before step 6 is the whole point.

---

## 6. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | `teacher_absences`; absence recording from an occurrence picker, forward and recent-past | Medium |
| **2** | Fix `/teach/report-absence` — occurrence picker, not a UUID field | Low |
| **3** | Absence → `substitute_requests` row; admin queue with escalation as the date nears | Medium |
| **4** | Accept a request → set `substitute_teacher_id`. **The generator already handles the rest** | Low |
| **5** | `is_sub_eligible` — an answer from Amanda, then the data (§4.2) | Blocked on Amanda |
| **6** | Retroactive absence consequences: delete or zero the absent teacher's draft; create the sub's | Medium |
| **7** | Effective dating on `class_teachers`; occurrence generation resolves assignment as of the occurrence date | **High. Silently rewrites history if wrong** |
| **8** | Teacher-change admin flow following §5.4 | Medium |
| **9** | `teacher_profiles` view: drop the `is_active` filter, audit every caller | **High. Breaking change** |

Phases 1–4 are the visible feature. Phases 7 and 9 are the correctness work, and 9 becomes urgent the first time someone leaves.

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Who is substitute-eligible?** All 20 are false today (§4.2) | Phase 5 |
| 2 | **How far back can a teacher self-report an absence?** Proposed: to the period's edit cutoff; older becomes an adjustment | Phase 1 |
| 3 | **Can a teacher accept a substitute request directly**, or does an admin assign? | Phase 4 |
| 4 | **Is a teacher paid for a class cancelled at short notice** they were scheduled for? | Phase 6 |
| 5 | **Does an unfilled request auto-cancel the class** as the date passes, or stay open for an admin? Auto-cancel touches families | Phase 3 |
| 6 | **Does a substitute inherit `class_lead` or `class_assistant`** when covering an assistant? Currently no assistants exist | Phase 4 |

---

## 8. Related

- `TIMESHEET_AUTODRAFT.md` §4.2 — the generator already implements the pay consequences of substitution
- `PAYROLL_CORRECTNESS_AND_REPORTING.md` §2.6 (six representations), §3.1 (paid immutability), §3.6 (substitute earns their own rate)
- `TEACHER_TIME_ATTENDANCE.md` — period lock rules an absence correction must respect
- `_INDEX.md` task 19 — occurrence generator; §5.1 is a constraint on it
