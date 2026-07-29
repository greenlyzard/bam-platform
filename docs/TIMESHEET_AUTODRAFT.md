# Timesheet Auto-Draft & Confirmation

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28
**Expands:** `PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.6

---

## 1. The target

A teacher opens their timesheet and finds the month already there — every class they were scheduled to teach, every private they were booked for, every rehearsal, each with hours and a dollar figure. Their job is to **confirm, adjust, or delete**, not to reconstruct three weeks from memory.

That is the entire difference between this platform and the Google Sheet it replaces. Katherine's June sheet exists because she had to remember what she taught on the 2nd.

**Accuracy is a chain**, and every link is a place where an entry silently fails to appear:

```
occurrence exists → teacher assigned → entry type resolved → rate in effect →
draft created → teacher confirms → approved → posted
```

A break anywhere produces *nothing* rather than an error. §3 is about the breaks that exist today.

---

## 2. What is already in place

| Piece | State |
|---|---|
| `schedule_instances` | **961 rows** for Fall (2026-08-15 → 2026-11-25), all `status = 'published'` |
| `timesheet_entries.is_auto_populated` | Column exists, never written |
| `timesheet_entries.schedule_instance_id` | Exists, never written |
| `timesheet_entries.session_id` | Exists, never written — the private-lesson join |
| `timesheet_entries.attendance_status` | `confirmed` / `absent` / `substitute_covered`. Never written |
| `timesheet_entries.is_substitute`, `substitute_for_teacher_id` | Exist, never written |
| `class_teachers.role`, `is_primary` | The `class_lead` vs `class_assistant` source |
| `schedule_instances.substitute_teacher_id` | The substitute source |
| Rate snapshot | **Built 2026-07-28.** A draft prices itself on insert |

The machinery was designed. None of it is wired.

---

## 3. Four data problems that must be fixed first

These are not design questions. They are conditions that would make auto-drafting quietly incomplete.

### 3.1 Seventy-seven Fall instances have no `teacher_id`

`schedule_instances.teacher_id` is null on 77 of 1,028 rows. **A draft cannot be created for nobody.** Those classes would produce no entry, no warning, and no pay — and they would look identical to a class that simply had no hours.

This matches the four teacherless Fall classes already known (Thu/Sat Petites, Tricks) multiplied across their weekly occurrences. It is a data-entry gap, not a bug, and it needs closing before the season.

**Requirement:** an admin report of instances with no teacher, in the visible date range, surfaced before the period closes rather than after.

### 3.2 No assistants exist in `class_teachers`

All **150** rows are `role = 'lead'`, `is_primary = true`. Zero non-primary rows.

So `class_assistant` — seeded at $20/hr for all 19 teachers — is currently unreachable by auto-draft. Either assistants genuinely aren't used, in which case the rate is dead weight, or they are used and aren't recorded, in which case assistants will be unpaid by default.

**This needs an answer from Amanda before Fall**, not a design decision.

### 3.3 `attendance` cannot be joined to an occurrence

`attendance` is `(class_id, student_id, class_date, status, …)`. There is **no `schedule_instance_id`**. So "was attendance taken for this occurrence" can only be answered by matching class and date, which breaks the moment a class meets twice in a day — which rehearsal weeks do.

**Requirement:** add `schedule_instance_id` to `attendance`. Zero rows exist today, so this is free now and a backfill later.

### 3.4 Generation stops at 2026-11-25

The season runs to 2027-06-15. Instances exist for roughly the first three months. **Drafts would simply stop appearing in December** — twenty teachers opening an empty timesheet in the same week, with no error to explain it.

The occurrence generator (`_INDEX.md` task 19) needs either a rolling horizon or a full-season run. Also note only **15 rehearsal instances** exist against 26 rehearsal classes, so rehearsal generation is already incomplete.

---

## 4. Draft generation

### 4.1 When

- **Nightly**, for a rolling window: yesterday back through the start of the open period, forward seven days. Past-dated drafts appear the morning after the class.
- **On demand**, when a teacher opens their timesheet — same function, so the page never shows a stale set.

**Idempotent, keyed on `(teacher_id, schedule_instance_id)`** for classes and `(teacher_id, session_id)` for privates. Re-running never duplicates. A draft the teacher deleted stays deleted — deletion is a decision, and regenerating it would be the system arguing with them.

### 4.2 What gets drafted, and as what

| Source | Condition | `entry_type` |
|---|---|---|
| `schedule_instances`, `event_type = 'class'` | Teacher is `class_teachers.role = 'lead'` | `class_lead` |
| Same | Teacher is a non-primary assignment | `class_assistant` |
| Same, `substitute_teacher_id` set | For the **substitute** | `substitute` |
| Same, `substitute_teacher_id` set | For the **assigned teacher** | **No draft.** Settled 2026-07-28: a covered teacher is not paid |
| `schedule_instances`, `event_type = 'rehearsal'`, or `classes.is_rehearsal` | Assigned teacher | `rehearsal` |
| `schedule_instances`, `event_type = 'performance'` | Assigned teacher | `performance_event` |
| `private_sessions` | Teacher is `primary_teacher_id`, status not `cancelled` | `private` |
| Competition events | Assigned teacher | `competition` |

**Hours** derive from `end_time − start_time`. Where an instance has no times, the draft is created with hours null and flagged — never defaulted to a guess.

**Dimensions carried onto the entry**, all of which exist and none of which the current form writes: `schedule_instance_id`, `class_id`, `session_id`, `production_id` / `event_id`, `is_substitute`, `substitute_for_teacher_id`, `is_auto_populated = true`.

That last set is what makes event P&L possible (`EVENT_ACCOUNTING_AND_EXPENSES.md`) — the tag is a relationship, not a typed string.

### 4.3 What is never drafted

- `admin`, `training`, `bonus` — no schedule source. Manual entry only.
- Anything in a period past its `teacher_edit_cutoff`.
- Cancelled instances and cancelled sessions.
- Any occurrence with no assigned teacher (§3.1) — surfaced on the admin report instead.

---

## 5. Confirmation

### 5.1 The teacher's view

The month's drafts listed by date, each showing class, time, hours, and amount. Three actions per row — **confirm**, **adjust**, **delete** — plus **confirm all** for the common case where the week ran as scheduled.

An entry stays `is_auto_populated = true` after confirmation. That distinction matters later: "hours we generated and they accepted" is different evidence from "hours they typed."

### 5.2 Attendance is a prompt, never a block

If attendance was not taken for that occurrence, the row shows it and links straight to the attendance screen.

**It does not prevent confirmation.** The draft exists because the class was scheduled; that is evidence it happened. Blocking pay on an administrative lapse teaches teachers to take attendance carelessly just to unlock their timesheet, and it makes payroll a hostage to record-keeping.

Instead: "confirmed with no attendance recorded" becomes an **admin report**, which is where it can actually be addressed.

### 5.3 Unconfirmed drafts at period close

Settled here, because §3.6 left it open and both defaults are bad:

- **Auto-submitting** pays for classes that may not have happened.
- **Silently dropping** loses real hours a teacher earned.

**Neither. Unconfirmed drafts stay unconfirmed, visible, and unsubmitted**, and the admin sees a count per teacher before running payroll. The number is small and actionable, and it makes the gap somebody's decision rather than a default.

A teacher who never confirms is a conversation, not a data policy.

---

## 6. Angelina and bulk action

Bulk confirmation is exactly the kind of work worth automating — "confirm all my classes for last week" is a sentence, not a screen.

But write access to payroll is a different thing from read access, and the safeguards should be explicit:

| Rule | Why |
|---|---|
| **Preview before commit, always.** Angelina states what she will change, and the person confirms | A confident mistake across twenty entries propagates before anyone sees it |
| **Scoped to the requester's own data** unless the requester passes `can_manage_pay()` | A teacher can bulk-confirm their own; only finance can act across teachers |
| **Never confirms an entry the teacher has not seen** | Bulk-confirming an unreviewed draft defeats the purpose of confirmation |
| **Never crosses a period cutoff or touches a paid entry** | Both already refused at the database (`20260728000005`); Angelina must fail cleanly, not surface a Postgres error |
| **Every action logged with actor, prompt, and affected rows** | An audit trail that says "Angelina did it" is not an audit trail |

The general principle: **Angelina may do in bulk what the person could do individually, never more.** Enforcing that at the query and RLS layer rather than in the prompt is what makes it true — a prompt instruction is a suggestion.

---

## 7. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Fix the 77 teacherless instances; answer the assistant question (§3.1, §3.2) | Data + decision. **Blocks everything** |
| **2** | `attendance.schedule_instance_id` (§3.3) — free at 0 rows | Low |
| **3** | Occurrence generation to the full season; rehearsal coverage (§3.4, task 19) | Medium. Blocks December onward |
| **4** | Draft generator for classes, idempotent, on-demand path | Medium |
| **5** | Confirm / adjust / delete UI + confirm-all | Medium |
| **6** | Substitute handling — sub drafts, assigned teacher suppressed | Low |
| **7** | Private session drafts + per-student confirmation (`PRIVATE_LESSON_BILLING_AND_CREDITS.md` §4.8) | Medium |
| **8** | Rehearsal and performance drafts with `event_id` | Low. Depends on `events` |
| **9** | Nightly job + admin exception reports (no teacher, no attendance, unconfirmed) | Low |
| **10** | Angelina bulk confirmation with preview and audit (§6) | Medium |

Phases 1–3 are prerequisites nobody can design around. Phase 4 is where a teacher first sees a timesheet they did not have to write.

---

## 8. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Are class assistants used?** Zero exist in `class_teachers`, yet the rate is seeded at $20 for all 19 (§3.2) | Phase 1 |
| 2 | **Who teaches the 77 teacherless occurrences?** Thu/Sat Petites and the Tricks classes | Phase 1, before Fall |
| 3 | **Does the occurrence generator get a rolling horizon or a full-season run?** (§3.4) | Phase 3 |
| 4 | **Is a teacher paid for a cancelled class** they were scheduled for and not told about in time? | Phase 4 |
| 5 | **How far back does the nightly generator reach?** Proposed: the start of the open period | Phase 9 |
| 6 | **Six representations of substitution** — which is authoritative for pay? Carried from payroll §2.6 | Phase 6 |

---

## 9. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.6 — this expands it; §3.1 for the snapshot that prices a draft
- `PRIVATE_LESSON_BILLING_AND_CREDITS.md` §4.8 — private confirmation, per-student attendance
- `EVENT_ACCOUNTING_AND_EXPENSES.md` — `event_id` on drafted entries is what makes event P&L work
- `TEACHER_TIME_ATTENDANCE.md` — period lock rules a draft must respect
- `_INDEX.md` task 19 — occurrence generator, the hard dependency
