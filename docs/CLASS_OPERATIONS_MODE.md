# Class Operations Mode — Attendance Window, Snapshot Lock & Escalation

**Status:** Draft spec v1 — awaiting approval. Not built.
**Authored:** 2026-07-30
**Governs:** the attendance-taking window, the roster snapshot, escalation and override,
teacher attendance grading, and the tenant-level toggle that enables all of it.
**Related:** `docs/OCCURRENCE_GENERATION.md` (attendance is keyed on the occurrence) ·
`docs/STUDIO_CLOSURES.md` (a cancelled occurrence takes no attendance) ·
`docs/INCIDENT_REPORTING.md` (attendance is evidence) ·
`docs/PAYROLL_CORRECTNESS_AND_REPORTING.md` (attendance and timesheets are separate facts)

---

## 1. Why this exists

Attendance taken during class is accurate. Attendance reconstructed at 9 PM is fiction, and
fiction is what makes an incident report indefensible three months later. "Was that child in
the building on the 14th?" has to have an answer that was written while someone was looking
at the room.

Amanda experienced this control at a previous professional studio company. It works because
it is a **process** constraint, not a data-entry constraint: it forces the count to happen at
the moment a count is meaningful.

This spec is the mechanism. It is **off by default** and enabled per tenant.

---

## 2. The core distinction — snapshot vs. record

**This is the design decision the whole spec rests on.**

A five-minute lock and a late arrival are the same event to a naive implementation, and they
must not be. A four-year-old arriving at minute 20 is routine at a ballet studio — parking,
siblings, traffic, a sibling's class running long. If marking that child present requires
admin escalation, the escalation queue fills with non-compliance events within two weeks and
the person reviewing it starts rubber-stamping. **The control then dies from noise, not from
disagreement.**

So the lock is on the **initial roster snapshot**, not on the attendance record.

| Phase | What the teacher can do |
|---|---|
| Before class start time | **Nothing.** Submission is blocked — see §7 |
| Minute 0 → window close | Mark the roster freely. Edits are edits |
| At window close | **Snapshot locks.** Who was present at the start is fixed and timestamped |
| After window close | Late arrivals and corrections are **appends** — attributed, timestamped, no escalation |
| Window closed, no snapshot taken | **Escalation.** Nobody counted the children |

The compliance artifact is the snapshot: proof that a responsible adult was in the room,
looking, at the start of class. Everything after it is a correction to a record that exists,
which is normal bookkeeping, not a compliance event.

**The failure this catches is a missing snapshot, not a changed one.**

---

## 3. Tenant configuration

All of this is off unless a tenant turns it on. Settings live on `studio_settings` or a
dedicated `class_operations_config` table — decide at implementation, following the
`registration_fee_mode` precedent.

| Setting | Type | Default | Meaning |
|---|---|---|---|
| `attendance_window_enabled` | boolean | **false** | Master switch. Off = today's behaviour, attendance any time |
| `attendance_window_minutes` | int | 5 | Minutes after class start before the snapshot locks |
| `attendance_window_warn_at` | int | 2 | Minutes remaining when the UI escalates its warning |
| `attendance_grade_enabled` | boolean | false | Whether teachers see a grade (§8) |
| `attendance_escalation_role` | enum | `admin` | Who resolves an escalation |
| `attendance_override_requires_reason` | boolean | **true** | Reason picklist required on override |

**Window length is tenant-level, not per-class** — confirmed 2026-07-30. A 45-minute
pre-ballet class and a two-hour rehearsal may eventually want different windows; that is a
v2 question and deliberately not built now. Adding per-class override later is one nullable
column on `classes` and one `coalesce` in the resolver.

---

## 4. Who may take attendance

Confirmed 2026-07-30. **All of these, on any occurrence:**

- the assigned teacher
- **the substitute teacher on that occurrence**
- any admin
- any studio_manager
- any super_admin

### 4.1 🔴 Blocking prerequisite

**`markAttendance` currently authorizes on `classes.teacher_id`, so a substitute cannot mark
attendance at all.** Under a window this stops being an annoyance and becomes systematic:
every substituted class fails its window automatically and escalates, so the escalation
queue fills with cases that are not compliance failures — they are an authorization bug. The
control is discredited in its first month.

**Fix substitute authorization before any of this ships.** Authorization must read
`schedule_instances.substitute_teacher_id` alongside `classes.teacher_id`, and the admin
tiers must come from `profile_roles` via a `SECURITY DEFINER` helper, never `profiles.role`.

### 4.2 🔴 `studio_manager` does not exist

Roles in use as of 2026-07-29: teacher 20 · admin 3 · super_admin 2 · finance_admin 1 ·
parent 1. There are **zero `studio_manager` rows and no `front_desk` role**. This spec
references studio_manager, and so does `STUDIO_CLOSURES.md` (closure blocking). The role has
to be created before either can enforce it. Until it exists, treat studio_manager as admin.

---

## 5. The snapshot

### 5.1 What it is

One row per occurrence, written once, never updated:

- `schedule_instance_id` (the occurrence — never `class_id` + date, per `OCCURRENCE_GENERATION.md`)
- `taken_by` (profile id), `taken_by_role` (role at time of taking — denormalized, because
  roles change and the artifact must not)
- `taken_at` (timestamptz)
- `window_opened_at`, `window_closes_at` (resolved at open, stored, so a later config change
  cannot retroactively make a compliant snapshot non-compliant)
- `present_student_ids`, `absent_student_ids` (arrays, as recorded at lock)
- `roster_size` at time of snapshot

### 5.2 Append-only after lock

Later changes are rows in a companion table, not edits:

- `schedule_instance_id`, `student_id`, `change_type` (`late_arrival`, `correction`,
  `early_departure`), `new_state`, `changed_by`, `changed_at`, optional `note`

**Follow the ledger pattern already in the codebase** — append-only enforced at the database
level, not by convention.

### 5.3 Cancelled occurrences take no attendance

An occurrence with `status = 'cancelled'` is out of scope entirely: no window, no snapshot,
no escalation, no grade impact. As of 2026-07-30 there are 478 cancelled occurrences, 417 of
them from closures. A teacher must never be graded down for a class the studio cancelled.

---

## 6. Escalation

### 6.1 Trigger

The window closes with no snapshot. Nothing else escalates. A snapshot taken at minute 4 and
corrected six times at minute 40 is fully compliant.

### 6.2 What happens

1. Occurrence is flagged `attendance_missed`
2. Notification to the configured escalation role, and to the teacher
3. The occurrence appears in an admin resolution queue
4. **An admin may reopen the window** so the teacher can complete it — ideally before they
   leave the building. This is the common, healthy path: the class happened, the count
   happened in someone's head, the teacher got pulled into a parent conversation
5. A reopened window produces a snapshot marked `was_reopened = true`, `reopened_by`,
   `reopened_at`. It is a valid record and an honest one — it does not pretend to be a
   within-window snapshot

### 6.3 Reason required

Confirmed 2026-07-30. Overrides and reopenings require a reason from a **tenant-configurable
picklist**, following the `refunds.reason_id` pattern — a FK to a reason table, not free
text, so the reasons are countable.

Starting set: `teacher_with_parent`, `technical_issue`, `class_ran_over`, `substitute_confusion`,
`emergency`, `forgot`, `other`. `other` requires a note.

**`forgot` belongs on the list.** A picklist with no honest option for the most common cause
teaches people to mis-file, and then the data is worthless for the thing it exists to reveal.

### 6.4 What escalation does NOT do

It does not block the teacher's timesheet entry. Attendance is a compliance fact; the
timesheet is a pay fact. Withholding pay over a paperwork lapse is a wage-and-hour question,
not a product decision, and `PAYROLL_CORRECTNESS_AND_REPORTING.md` keeps these separate
deliberately. Flag it, report it, do not gate pay on it.

---

## 7. The countdown UI

Confirmed 2026-07-30: warning and countdown timer required.

- **Before class start:** attendance UI is visible but **submission is disabled**, with the
  start time shown. This is the anti-gaming guard — see §8.2
- **Window open:** persistent countdown, unobtrusive
- **At `attendance_window_warn_at`:** the warning escalates — colour, prominence, and a push
  notification to the teacher's device if they have one
- **Window closed, snapshot taken:** confirmation with the timestamp, plus an "add late
  arrival" affordance that stays available for the rest of the class
- **Window closed, no snapshot:** clear statement that it escalated, who was notified, and
  what to do next. Not a scolding — a next step

⚠️ **Push has a known gap.** 88 notifications currently sit unread with no UI to read them.
The push path must be finished before it is load-bearing for a compliance control.

---

## 8. Grading

Confirmed 2026-07-30: gamify attendance, give teachers a grade.

### 8.0 Class Operations does not own the scoreboard

Amanda has named further teacher metrics: **curriculum adherence**, and **gold stars for
substituting a given number of times**. More will follow.

**Therefore this spec emits metrics; it does not own grading.** Class Operations publishes
two facts per occurrence (§8.1) into a shared teacher-recognition surface, and that surface —
a separate module, spec'd separately — decides how facts become grades, badges, stars, or
nothing at all.

Building the scoreboard inside attendance means rebuilding it the moment the second metric
arrives, and it puts curriculum and substitution logic in a file about attendance. The
recognition module is not needed for Phases 0–4; the metrics just need to be emitted in a
shape something else can consume.

**Note for counsel, not a blocker:** recognition programs that reward taking more shifts can
read as performance incentives, which touches worker classification. BAM has 1099
contractors and an open AB5 question already (`SUBSTITUTE_TEACHER.md`). Worth raising when
substitution stars are actually built, not now.

### 8.1 The two metrics — measured separately

Confirmed 2026-07-30. These are distinct facts and must never be collapsed into one number.

| Metric | Question | Counts a reopened snapshot? |
|---|---|---|
| **Completion** | Was attendance taken at all? | **Yes** |
| **Timeliness** | Was it taken inside the window? | **No** |

Completion is the safety metric — every class has a record of who was in the room.
Timeliness is the process metric — the record was made when it was meaningful.

A teacher who takes attendance for every class but often runs past the window has a
completion problem of zero and a timeliness problem worth a conversation. A teacher who
sometimes never takes it at all has a different and more serious problem. **One blended
score hides exactly the distinction Amanda needs to see.**

Both are ratios over eligible occurrences across a rolling window. Eligible excludes
cancelled occurrences (§5.3) and classes the teacher neither taught nor substituted.

This also resolves §10 Q5: a reopened snapshot is neither compliant nor a miss. It is
**complete but not timely** — a real third state, and the reason two metrics exist rather
than one with an asterisk.

### 8.2 What is deliberately NOT measured, and why

**Never grade the content of the roster.** Neither metric looks at *who* is marked present —
only that a snapshot exists, and when. If teachers are scored on anything about the roster's
content, the cheapest way to score well is to mark everyone present at minute one and never
look again. That produces a compliance artifact that is confidently wrong — worse than no
attendance at all, because it will be trusted in an incident review.

**Timeliness is the metric most exposed to this**, since it rewards speed directly. The
guards below exist primarily to protect it.

Three guards, all required:

1. **No submission before class start time** (§7). Removes pre-marking entirely
2. **Late-arrival appends never reduce the grade.** A teacher who marks four present at
   minute 3 and adds a fifth at minute 20 did the job correctly and must score identically
   to one whose class arrived on time
3. **Corrections never reduce the grade.** Correcting a record is the behaviour we want. A
   system that penalizes correction gets fewer corrections, not fewer errors

### 8.3 Presentation

Grading is **off by default** even when the window is on. Turn the window on first, let
teachers live with it, then decide whether a visible grade adds anything.

When on: visible to the teacher for themselves at all times. Visible to admin across all
teachers. **Not** visible teacher-to-teacher — a public leaderboard on a compliance metric
turns a safety control into a social contest, and the losing strategy is to stop reporting
edge cases.

---

## 9. Build sequence

| Phase | What | Depends on |
|---|---|---|
| **0** | **Substitute authorization on `markAttendance`** | — 🔴 blocks everything |
| **0b** | **Create the `studio_manager` role** | — 🔴 blocks §4 |
| 1 | Schema: snapshot table, append table, reason picklist, tenant config | 0, 0b |
| 2 | Window resolution + snapshot write + lock enforcement | 1 |
| 3 | Countdown UI, warning, confirmation states | 2 |
| 4 | Escalation: flag, notify, admin queue, reopen with reason | 2 |
| 5 | Grading, off by default | 2 |

Phases 0 and 0b are small and unblock a great deal beyond this spec.

---

## 10. Open questions

| # | Question | For |
|---|---|---|
| 1 | Does the window open at scheduled start time, or at a teacher "start class" action? Scheduled is simpler; an action is more honest about a class that started late | Amanda |
| 2 | Rehearsals — same window? Multi-teacher rehearsals raise "who is responsible for the snapshot" | Amanda |
| 3 | What is the rolling window for the grade — 30 days, term, season? | Amanda |
| 4 | Can a teacher reopen their own window within some grace period, or is admin always required? Admin-always is stricter and more escalations | Amanda |
| 5 | ~~Does a reopened snapshot count as compliant?~~ **Resolved 2026-07-30:** two metrics — it counts for **completion**, not **timeliness** (§8.1) | — |
| 7 | Should completion and timeliness use the same rolling window, or is completion better as a season-long figure? | Amanda |
| 6 | Trial students and drop-ins are not on the roster. How are they recorded in a snapshot? | Amanda |

---

## 11. Honesty boundary

What this spec does **not** do, stated plainly so nobody assumes otherwise:

- It does not work without rosters. `enrollments` has **1 row** as of 2026-07-30. Attendance
  needs students in classes, so a roster import is a hard prerequisite for testing this
  against anything real
- It does not verify that the roster is accurate. It verifies that someone looked
- It does not gate pay (§6.4)
- It does not replace incident reporting. It produces evidence incident reporting relies on
