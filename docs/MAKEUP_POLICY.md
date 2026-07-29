# BAM Platform — Makeup Policy Module

**Status:** Spec Complete — Policy Confirmed  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_SUBSTITUTE_COVERAGE.md, TEACHER_TIME_ATTENDANCE.md, SCHEDULING_AND_LMS.md, REGISTRATION_AND_ONBOARDING.md, STUDIO_CLOSURES.md, OCCURRENCE_GENERATION.md

> **Amended 2026-07-29 — plumbing only.** The policy in this document was confirmed
> with Amanda in March 2026 and **remains authoritative**. Nothing about who gets a
> makeup, who may dismiss one, when it expires, or how a private conversion is paid has
> changed. What had gone stale is every **table and column name** the spec reaches for:
> it was written 2026-03-12 against a schema that has since moved, and four of the
> tables it names do not exist in the live database at all. This amendment repoints
> those references, verified against live 2026-07-29, and records the questions the
> repointing exposed. **Where a correction would have required inventing policy, it is
> filed as an open question instead** — see "Open Questions — Mechanism" near the end.
>
> **Nothing in this spec is built.** `makeup_credits` does not exist in the database.
> There is no table, no route, no queue, and no credit has ever been issued.

---

## Overview

Defines when a student is eligible for a makeup class, how makeup credits are issued, how parents request and dismiss them through the portal, and how Admin approves and schedules them. Credits are generated automatically from absence and cancellation events. Parents initiate requests; Admin approves and finalizes scheduling.

---

## Confirmed Policy (BAM)

| Policy Question | Answer |
|---|---|
| Expiration window | Within the current school season |
| End-of-season handling | Credit may be converted to a private makeup lesson (no charge to family) |
| Who can dismiss | Admin/Super Admin **or** Parent — either party can close a credit |
| Offered for unexcused absences? | Yes — all absences, if parent requests |
| Unlimited level eligible? | **No** — students on Unlimited enrollment are exempt |
| Cross-level makeups? | Yes — if approved by Admin or Super Admin |
| Parent can request through portal? | Yes |

---

## Eligibility Rules

### Student IS eligible when:
1. **Student missed an active class** and the parent requests a makeup
2. **Active class was cancelled** (no sub found, or the class fell under a studio closure)

> **Amended 2026-07-29 — "studio closure for a single day" no longer describes a
> closure.** When this was written a closure was one flat date. Per
> `STUDIO_CLOSURES.md` v2 a closure is a **date range** (`closed_through`), is
> **location-scoped**, and is either **total** (`is_total`) or **partial** (exempting
> event types via `exempt_event_types` or individual classes via
> `classes.closure_exempt`). Credit issuance follows the cancelled occurrence, not the
> closure row, which resolves all three cases below without a policy change:
>
> - **A multi-day closure issues one credit per cancelled occurrence, not one per
>   closure.** If the studio follows Capistrano Unified and closes the full week of
>   Thanksgiving (Nov 23–27 2026), a class meeting Monday through Friday yields **five**
>   credits for each affected enrollment.
> - **A partial closure that exempts a class issues no credit for that class.** The
>   class ran. There is nothing to make up.
> - **A location-scoped closure issues credits only for classes at that location.** A
>   San Clemente closure creates no credit for an RSM class.

### Student is NOT eligible when:
- Enrolled in the **Unlimited level** — Unlimited students have open access to sessions; no formal makeup credit is issued
- The **entire program is inactive** — ended, discontinued, or between seasons
- The makeup credit has been **dismissed** by Admin or the parent
- The student has been unenrolled or has withdrawn

> **Key distinction:** Eligibility follows the class, not the teacher. A cancellation due to no sub → students get makeups. A program closing at end of season → no makeups.

---

## Expiration & End-of-Season Conversion

All makeup credits expire at the **last day of the current school season** (pulled from `seasons.end_date` — tenant-configured by Super Admin).

> **Amended 2026-07-29:** `school_years` does not exist. The live table is `seasons`
> (3 rows, with `start_date`, `end_date`, `is_active`, `tenant_id`). The policy is
> unchanged — only the source table name was wrong.
>
> ⚠️ **The season-end rule breaks on one live season.** `seasons` contains
> **"Adult", running 2026-07-01 → 2030-06-15** — a four-year span. Alongside
> 2025/2026 (ends 2026-06-30) and 2026/2027 (ends 2027-06-30), an adult student's
> credit would expire in **2030** under this rule, which is indistinguishable from
> never expiring. `studio_levels` also carries **Adult** and **Adult/Teen**, so this is
> a live catalogue concern rather than a hypothetical. Filed as open question M-3.

When a credit is approaching expiry and no suitable group class slot has been found, Admin may convert it to a **private makeup lesson**:
- No charge is issued to the family
- The private makeup is assigned to a teacher and appears on their schedule
- **Teacher receives pay at their standard private rate** — `teacher_rates.rate_key = 'private'`. The discounted-private case is unresolved in the schema: see open question M-2. *(Amended 2026-07-29: the identifiers `rate_private` / `rate_discounted_private` do not exist. The live `teacher_rates.rate_key` is `text` with nine seeded values — `admin`, `class_assistant`, `class_lead`, `competition`, `performance_event`, `private`, `rehearsal`, `substitute`, `training` — seeded for all 19 teachers. `private` is correct; there is no discounted variant.)* The **policy** that Amanda may apply a discount is confirmed and unchanged
- The discount amount is **visible to the parent on their account statement** so they can see the value Amanda is providing — the line item shows full rate, discount applied, and net amount owed ($0 for a makeup conversion, but the discount is shown explicitly)
- The credit status is set to `converted_to_private`
- The timesheet entry is created **only when the private is fulfilled (attended)**. If the student does not attend, no timesheet entry is created and no pay is generated. A missed private makeup returns the credit to `pending` status (subject to re-miss rules below).

---

## Unlimited Level Exemption

Students enrolled in the **Unlimited level** are excluded from makeup credit creation. Because Unlimited enrollment provides open access to any available class session, a missed session is resolved by attending any other session — no formal credit is needed.

The system enforces this at credit creation: if the enrollment is at the Unlimited level, no `makeup_credits` record is created and no notification is sent.

> ⚠️ **Amended 2026-07-29 — this check has nothing to read.** The spec said
> `enrollment.level = 'unlimited'`, but **`enrollments` has no `level` column** and no
> column anywhere on that table holds `'unlimited'`. The nearest candidates are
> `enrollment_type` (the one live row is `'full'`) and `billing_plan_type` (null).
> `studio_levels` holds the 18 level names and none of them is "Unlimited". So the
> Unlimited exemption — one of the seven confirmed policy answers — **cannot currently
> be evaluated against any live column.** Not repointed here, because choosing where
> Unlimited lives is a data-model decision, not a rename. Filed as open question M-1.

---

## Cross-Level Makeups

A student may attend a makeup at a different program level from their enrolled class. The parent may note a preferred level in their request. Admin or Super Admin makes the final scheduling decision.

| Behavior | Detail |
|---|---|
| Default suggestion | Same program level as missed class |
| Cross-level allowed | Yes, if Admin or Super Admin approves at scheduling time |
| Cross-level logged | `makeup_level_override: true` + `makeup_level_approved_by` (user ID) |

---

## Dismissal

Either party may dismiss a pending makeup credit without scheduling:

| Actor | Portal Location | Result |
|---|---|---|
| Parent | Parent Portal → Makeup Credits → Dismiss | `status: dismissed_by_parent` |
| Admin / Super Admin | Admin → Makeups → Dismiss | `status: dismissed_by_admin`; optional reason logged |

Dismissed credits are retained in the database for reporting but removed from all active queues.

---

## Eligibility Triggers (System-Generated)

| Event | Source | Credit Issued? | To Whom |
|---|---|---|---|
| Student absent; parent requests makeup | Teacher marks absent → parent initiates | ✓ Yes (if not Unlimited) | That student |
| Class cancelled — no sub found | `schedule_instances.status='cancelled'` + `cancellation_reason: no_coverage` | ✓ Auto-issued | All enrolled non-Unlimited students |
| Class cancelled — studio closure | `schedule_instances.status='cancelled'` + `cancellation_reason: studio_closure`, written by `apply_closures` | ✓ Auto-issued | All enrolled non-Unlimited students. **One credit per cancelled occurrence** — see Eligibility Rules |
| Student enrolled in Unlimited | ⚠️ no live column — open question M-1 | ✗ No | — |
| Program inactive / ended | `studio_programs.is_active = false` | ✗ No | — |
| Student unenrolled | enrollment inactive | ✗ No | — |

*Amended 2026-07-29: cancellation is now a real, observable state — `status='cancelled'`
on `schedule_instances` — because the occurrence generator shipped (`OCCURRENCE_GENERATION.md`,
Phases 0–3). Closure-driven cancellations are written by `apply_closures`
(`STUDIO_CLOSURES.md` v2), which is not yet built. `program` → `studio_programs`
(4 live rows: Company, Competition Team, Junior Company, Studio Company).*

---

## Makeup Request Workflow

### Student Absence (Parent-Initiated)

```
Teacher marks student absent
        ↓
Parent sees "Missed Class" notice in parent portal
        ↓
Parent taps "Request Makeup"
  → Optional: notes on preferred level or available date range
        ↓
makeup_credit created (status: requested)
        ↓
Admin sees request in Makeups → Pending queue
        ↓
Admin selects slot:
  - Same level (default)
  - Cross-level (requires Admin or Super Admin approval; logged)
        ↓
Parent notified: "Makeup scheduled — [Date] in [Class]"
        ↓
Teacher marks attendance at makeup session
  → Attended: status = redeemed; teacher timesheet entry created at private/class rate
  → Absent (re-miss): status = expired (credit automatically closed)
     Admin or Super Admin can re-open manually; re-open logged with user ID + reason
```

**One re-miss closes the credit automatically.** Admin and Super Admin can override and re-open at their discretion — there is no system cap on overrides, but each re-open is logged for accountability.

**If parent does not request:** No credit is created. Absence is recorded. Parent may request retroactively until the season end date.

### Cancelled Class (Auto-Issued)

*Throughout the workflows below, "session" means a row in `schedule_instances` — the
occurrence. The word is kept because it is what staff say; the table is not
`class_sessions`, which does not exist.*

```
Occurrence cancelled (no sub / studio closure) — status='cancelled'
        ↓
System auto-creates makeup_credit for all eligible enrolled students
(status: pending)
        ↓
Parent notified: "Class cancelled — you have a makeup credit available"
        ↓
Parent either:
  → Requests scheduling (enters Admin queue)
  → Dismisses (credit closed, no action needed)
```

### End-of-Season Private Conversion

```
Makeup credit approaching season expiry; no group slot available
        ↓
Admin sees "Near Expiry" flag in Makeups queue
        ↓
Admin selects "Convert to Private Makeup"
  → Assigns teacher + student
  → No charge to family
        ↓
Private appears on teacher's schedule
        ↓
When private occurs: teacher marks complete → credit redeemed
```

---

## Data Model

### `makeup_credits`

> **Does not exist in the database.** Table names below were corrected 2026-07-29
> against live; four of the originals were phantom tables. `⚠` marks a reference that
> could not be repointed without a decision — see "Open Questions — Mechanism".
>
> **Column renames that come with repointing `class_session` → `schedule_instances`**,
> for anyone implementing against an occurrence: `session_date` → `event_date`,
> `lead_teacher_id` → `teacher_id`, `session_notes` → `notes`, `room` (text) →
> `room_id` (FK), `is_cancelled` (boolean) → `status = 'cancelled'`. Full repointing
> footprint: `docs/_INDEX.md` task 19.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `student_id` | FK → students | |
| `enrollment_id` | FK → enrollments | Used to validate non-Unlimited at creation ⚠ M-1 |
| `originating_session_id` | FK → `schedule_instances` | The missed or cancelled occurrence. *(Was `class_session` — phantom)* |
| `trigger_type` | enum | `student_absence` / `class_cancelled_no_coverage` / `class_cancelled_studio_closure` — the closure case is now per-occurrence, so a multi-day closure produces several credits with this same value |
| `originating_program_id` | FK → `studio_programs` | Student's enrolled program. *(Was `program` — phantom.)* ⚠ M-4: the note said "program **level**", but `studio_programs` holds the 4 company tracks; levels live in `studio_levels` (18 rows) |
| `status` | enum | `pending` / `requested` / `scheduled` / `redeemed` / `expired` / `dismissed_by_parent` / `dismissed_by_admin` / `converted_to_private` |
| `expires_at` | date | Last day of current school season (from `seasons.end_date`). *(Was `school_years.end_date` — phantom.)* ⚠ M-3 for the 4-year Adult season |
| `parent_preference_notes` | text | Parent's notes at time of request |
| `makeup_session_id` | FK → `schedule_instances` | Populated when group makeup is scheduled. *(Was `class_session` — phantom)* |
| `makeup_level_override` | boolean | True if scheduled at a different level |
| `makeup_level_approved_by` | FK → user | Admin or Super Admin who approved cross-level |
| `redeemed_at` | datetime | |
| `dismissed_at` | datetime | |
| `dismissed_by` | FK → user | Staff user ID if dismissed by Admin |
| `dismissal_reason` | text | Optional; Admin-only |
| `converted_to_private` | boolean | True if converted to end-of-season private |
| `private_rate_key` | text | Matches `teacher_rates.rate_key` (`text`, not an enum). `'private'` is the live value. ⚠ M-2: there is no discounted-private key |
| `private_rate_amount_cents` | integer | Snapshot of rate at time of conversion. *(Was `private_rate_amount decimal` — violates the locked integer-cents convention; `teacher_rates.amount_cents` is `integer`)* |
| `private_fulfilled_at` | datetime | When private makeup actually occurred; triggers timesheet entry creation |
| `private_session_id` | FK → `private_session_billing` | Populated on private conversion. *(Was `private_billing_record` — phantom.)* Note that table's own link to the session is `session_id`, and its money columns (`amount_owed`, `market_value`, `studio_contribution`, `teacher_contribution`) are `numeric`, not cents — reconciling that is out of scope here |
| `remiss_count` | integer | Number of times student has missed a scheduled makeup; auto-closes at 1 |
| `reopened_by` | FK → user | Admin/Super Admin who last re-opened after auto-close |
| `reopen_reason` | text | Required when re-opening after auto-close |
| `reopen_count` | integer | Total number of times credit has been re-opened (audit) |
| `created_at` | datetime | |
| `notes` | text | Admin internal notes |

---

## Admin Makeup Queue

**Location:** Admin → Makeups

| Tab | Contents |
|---|---|
| **Pending** | Credits awaiting scheduling — auto-issued and parent-requested |
| **Scheduled** | Upcoming makeup sessions; link to session detail |
| **Near Expiry** | Credits expiring within 14 days; flag for private conversion |
| **Redeemed** | Completed makeups this season |
| **Dismissed** | Closed without scheduling (by parent or Admin) |

**Per-credit actions:**
- **Schedule — same level** → slot picker filtered to originating program
- **Schedule — cross-level** → full slot picker; Admin/Super Admin approval required; logged
- **Convert to Private** → assign teacher; no charge to family
- **Dismiss** → optional reason; confirmation prompt

---

## Parent Portal View

**Location:** Parent Portal → [Child name] → Makeup Credits

- "Makeup Available" badge on affected enrollment card
- Per-credit card shows: class missed, date, expiration date
- **"Request Makeup" button** → opens request form (optional: preferred level, available date range)
- **"Dismiss" button** → "Are you sure? This will remove your makeup credit." confirmation
- Scheduled makeups show: date, class name, level
- Redeemed credits visible in history

---

## Studio Policy Settings (Super Admin)

| Setting | BAM Value |
|---|---|
| Makeup expiration | End of school season (`seasons.end_date`) |
| Makeups for all absences | Yes — if parent requests |
| Makeups for cancelled classes | Yes — auto-issued |
| Unlimited level exempt | Yes — enforced by system |
| Cross-level makeups | Yes — Admin/Super Admin approval required |
| Parent can request | Yes — through parent portal |
| Parent can dismiss | Yes — through parent portal |
| Admin can dismiss | Yes — through Admin panel |
| End-of-season private conversion | Yes — Admin-initiated, no charge to family |
| Private conversion teacher pay | Yes — at the private rate (`teacher_rates.rate_key = 'private'`), or a discounted private rate if Amanda applies one (⚠ M-2 — no such key exists yet); only on fulfillment |
| Discount shown on parent statement | Yes — full rate, discount applied, net $0 shown explicitly |
| Re-miss limit | 1 re-miss auto-closes credit; Admin/Super Admin can re-open (logged) |
| Expiry reminder notification to parents | Configurable — Admin can turn off per-tenant in Studio Settings |
| Expiry reminder window | Default: 14 days before season end (Admin-adjustable) |

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_SUBSTITUTE_COVERAGE.md** | Class cancellation (no sub) auto-triggers credits |
| **TEACHER_TIME_ATTENDANCE.md** | Student absence event makes credit available for parent to request |
| **SCHEDULING_AND_LMS.md** | Makeup = temporary enrollment in a class session; Unlimited level check |
| **REGISTRATION_AND_ONBOARDING.md** | Parent portal request and dismiss UI; enrollment level lookup |
| **Notification System** | Parent notified: credit issued, makeup scheduled, near expiry |

---

## Confirmed Decisions (All Questions Resolved)

| Question | Answer |
|---|---|
| Teacher pay on private makeup conversion | Yes — the private rate, or a discounted private rate at Amanda's discretion; entry created only on fulfillment. *(Policy confirmed. The rate-key plumbing is open — M-2)* |
| Discount visibility on parent statement | Discount shown explicitly: full rate → discount applied → net $0; parent sees Amanda's generosity |
| Expiry reminder notifications | Yes — on by default; Admin can disable per-tenant in Studio Settings |
| Re-miss limit | 1 auto-closes the credit; Admin/Super Admin can re-open with logged reason; no system cap on overrides |
| Timesheet entry timing | Created only when private is fulfilled (attended); no entry if student misses the makeup private |

---

## Open Questions — Mechanism (raised 2026-07-29)

These are **not** reopened policy. The seven confirmed answers above stand. Each of
these is a place where the March spec named something that does not exist and where
picking a replacement would mean inventing a rule rather than correcting a name.

| # | Question | Why it is open | Blocks |
|---|---|---|---|
| M-1 | **Where does "Unlimited" live?** The exemption reads `enrollment.level = 'unlimited'`, but `enrollments` has no `level` column and nothing on it holds that value. `enrollment_type` (`'full'`) and `billing_plan_type` (null) are the only candidates, and none of the 18 `studio_levels` rows is "Unlimited". | Deciding whether Unlimited is an enrollment type, a billing plan, a level, or a per-class flag is a data-model choice with billing consequences. | Credit creation — the exemption cannot be enforced |
| M-2 | **Does a discounted private makeup need a tenth `rate_key`, or is it the standard `private` rate with the adjustment recorded elsewhere?** `teacher_rates.rate_key` has nine seeded values and no discounted variant. | Adding a rate key changes what payroll pays from; recording an adjustment instead keeps one rate and moves the discount to the statement line. Both satisfy the confirmed policy. **Amanda / finance** | Private conversion pay + the parent statement display |
| M-3 | **Do adult students get makeups, and if so on what expiry basis?** `seasons` contains **"Adult", 2026-07-01 → 2030-06-15**. Under the season-end rule an adult credit expires in 2030, which is effectively never. `studio_levels` carries Adult and Adult/Teen. **Amanda** | The season-end rule was written when every season was one school year. A four-year season breaks it without being wrong itself. | Expiry calculation |
| M-4 | **Is `originating_program_id` the company track or the level?** The field note says "program level," but `studio_programs` holds 4 company tracks (Company, Competition Team, Junior Company, Studio Company) while levels are 18 rows in `studio_levels`. | Cross-level makeups are a confirmed policy, and "same level (default)" in the Admin queue needs the level, not the track. It may need both. | Slot picker + `makeup_level_override` |

---

## Private Makeup — Parent Statement Display

When a makeup is converted to a private lesson, the parent's account statement should show:

```
Private Lesson — Makeup Conversion       [Teacher Name]    [Date]
  Standard private rate:                                  $[full rate]
  Makeup credit applied:                                 -$[full rate]
  Amanda's courtesy discount:                             $0.00
  Amount due:                                             $0.00
```

If a discounted rate applies (e.g., multi-student family rate), the statement shows:

```
Private Lesson — Makeup Conversion       [Teacher Name]    [Date]
  Standard private rate:                                  $[full rate]
  Discounted rate applied:                               -$[discount amount]
  Makeup credit applied:                                 -$[discounted rate]
  Amount due:                                             $0.00
```

This makes Amanda's contribution visible without requiring her to explain it verbally.
