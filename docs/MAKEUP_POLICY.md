# BAM Platform — Makeup Policy Module

**Status:** Spec Complete — Policy Confirmed  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_SUBSTITUTE_COVERAGE.md, TEACHER_TIME_ATTENDANCE.md, SCHEDULING_AND_LMS.md, REGISTRATION_AND_ONBOARDING.md

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
2. **Active class was cancelled** (no sub found, or studio closure for a single day)

### Student is NOT eligible when:
- Enrolled in the **Unlimited level** — Unlimited students have open access to sessions; no formal makeup credit is issued
- The **entire program is inactive** — ended, discontinued, or between seasons
- The makeup credit has been **dismissed** by Admin or the parent
- The student has been unenrolled or has withdrawn

> **Key distinction:** Eligibility follows the class, not the teacher. A cancellation due to no sub → students get makeups. A program closing at end of season → no makeups.

---

## Expiration & End-of-Season Conversion

All makeup credits expire at the **last day of the current school season** (pulled from `school_years.end_date` — tenant-configured by Super Admin).

When a credit is approaching expiry and no suitable group class slot has been found, Admin may convert it to a **private makeup lesson**:
- No charge is issued to the family
- The private makeup is assigned to a teacher and appears on their schedule
- **Teacher receives pay at their standard private rate** (`rate_private`) — or discounted private rate (`rate_discounted_private`) if Amanda applies a discount
- The discount amount is **visible to the parent on their account statement** so they can see the value Amanda is providing — the line item shows full rate, discount applied, and net amount owed ($0 for a makeup conversion, but the discount is shown explicitly)
- The credit status is set to `converted_to_private`
- The timesheet entry is created **only when the private is fulfilled (attended)**. If the student does not attend, no timesheet entry is created and no pay is generated. A missed private makeup returns the credit to `pending` status (subject to re-miss rules below).

---

## Unlimited Level Exemption

Students enrolled in the **Unlimited level** are excluded from makeup credit creation. Because Unlimited enrollment provides open access to any available class session, a missed session is resolved by attending any other session — no formal credit is needed.

The system enforces this at credit creation: if `enrollment.level = 'unlimited'`, no `makeup_credit` record is created and no notification is sent.

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
| Class cancelled — no sub found | `cancellation_reason: no_coverage` | ✓ Auto-issued | All enrolled non-Unlimited students |
| Class cancelled — studio closure | `cancellation_reason: studio_closure` | ✓ Auto-issued | All enrolled non-Unlimited students |
| Student enrolled in Unlimited | `enrollment.level = 'unlimited'` | ✗ No | — |
| Program inactive / ended | `program.is_active: false` | ✗ No | — |
| Student unenrolled | enrollment inactive | ✗ No | — |

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

```
Session cancelled (no sub / studio closure)
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
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `student_id` | FK → student | |
| `enrollment_id` | FK → enrollment | Used to validate non-Unlimited at creation |
| `originating_session_id` | FK → class_session | The missed or cancelled session |
| `trigger_type` | enum | `student_absence` / `class_cancelled_no_coverage` / `class_cancelled_studio_closure` |
| `originating_program_id` | FK → program | Student's enrolled program level |
| `status` | enum | `pending` / `requested` / `scheduled` / `redeemed` / `expired` / `dismissed_by_parent` / `dismissed_by_admin` / `converted_to_private` |
| `expires_at` | date | Last day of current school season (from `school_years.end_date`) |
| `parent_preference_notes` | text | Parent's notes at time of request |
| `makeup_session_id` | FK → class_session | Populated when group makeup is scheduled |
| `makeup_level_override` | boolean | True if scheduled at a different level |
| `makeup_level_approved_by` | FK → user | Admin or Super Admin who approved cross-level |
| `redeemed_at` | datetime | |
| `dismissed_at` | datetime | |
| `dismissed_by` | FK → user | Staff user ID if dismissed by Admin |
| `dismissal_reason` | text | Optional; Admin-only |
| `converted_to_private` | boolean | True if converted to end-of-season private |
| `private_rate_key` | enum | `rate_private` / `rate_discounted_private` — which rate applies to the teacher's pay |
| `private_rate_amount` | decimal | Snapshot of rate at time of conversion |
| `private_fulfilled_at` | datetime | When private makeup actually occurred; triggers timesheet entry creation |
| `private_session_id` | FK → private_billing_record | Populated on private conversion |
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
| Makeup expiration | End of school season (`school_years.end_date`) |
| Makeups for all absences | Yes — if parent requests |
| Makeups for cancelled classes | Yes — auto-issued |
| Unlimited level exempt | Yes — enforced by system |
| Cross-level makeups | Yes — Admin/Super Admin approval required |
| Parent can request | Yes — through parent portal |
| Parent can dismiss | Yes — through parent portal |
| Admin can dismiss | Yes — through Admin panel |
| End-of-season private conversion | Yes — Admin-initiated, no charge to family |
| Private conversion teacher pay | Yes — at `rate_private` or `rate_discounted_private`; only on fulfillment |
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
| Teacher pay on private makeup conversion | Yes — `rate_private` or `rate_discounted_private`; entry created only on fulfillment |
| Discount visibility on parent statement | Discount shown explicitly: full rate → discount applied → net $0; parent sees Amanda's generosity |
| Expiry reminder notifications | Yes — on by default; Admin can disable per-tenant in Studio Settings |
| Re-miss limit | 1 auto-closes the credit; Admin/Super Admin can re-open with logged reason; no system cap on overrides |
| Timesheet entry timing | Created only when private is fulfilled (attended); no entry if student misses the makeup private |

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
