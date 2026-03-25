# BAM Platform — Teacher Time & Attendance Module

**Status:** Spec Updated — v2  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_PORTAL.md, TEACHER_RATE_MANAGEMENT.md, TEACHER_SCHEDULE_INTEGRATION.md, TEACHER_SUBSTITUTE_COVERAGE.md, TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md, PERFORMANCE_COMPETITION_COSTS.md, MAKEUP_POLICY.md

> **Real-World Basis:** Informed by Lauryn's active timesheet (SY 2025–2026). Pay period cadence, entry types, private billing workflow, and payroll submission confirmed from live data.

---

## Overview

Replaces manual spreadsheet tracking (currently emailed to `payroll@bamsocal.com`) with a structured teacher-facing timesheet system. Auto-populates class hours from the schedule, supports flexible manual entry for privates, admin time, rehearsals, performances, and competition events, and routes completed timesheets through Finance Admin review before payroll export.

---

## Pay Period

| Setting | Value |
|---|---|
| Cadence | Monthly |
| Submission deadline | **26th of each month** |
| Payroll contact | payroll@bamsocal.com |
| Reminder notifications | 3 days before deadline, 1 day before deadline |
| Late submission | Flagged for Finance Admin and Studio Manager; teacher notified |

---

## User Roles

| Role | Permissions |
|---|---|
| Teacher (W-2) | Submit own timesheet, view pay summary, view approval status |
| Teacher (1099 / Sub / Drop-in) | Submit hours for sessions worked; no rate visibility |
| Finance Admin / Finance Lead | View all timesheets, edit rates, approve/reject, export to payroll |
| Studio Manager | View all timesheets and reports; cannot edit rates or approve |
| Studio Admin | Override finance approval, manage rate configurations |
| **Super Admin (Amanda)** | All permissions; receives all flagged alerts; cannot be locked out |

> **Super Admin note:** Amanda's account is designated Super Admin. She has full read/write access to all modules including rate management, approval override, and all flagged notifications. This role cannot be reassigned or removed except by direct database action.

---

## Entry Types

| Entry Type | Auto or Manual | Rate Applied | Notes |
|---|---|---|---|
| Class — Lead | Auto-populated | `rate_regular_class` or `rate_discounted_class` | Teacher confirms presence |
| Class — Assistant | Auto-populated | `rate_assistant_class` or `rate_discounted_assistant_class` | Separate rate from lead; set by Super Admin or Finance Lead |
| Private Lesson | Manual (teacher-entered) | `rate_private` or `rate_discounted_private` | Includes private billing sub-tracker; teacher confirms happened |
| Rehearsal | Auto or Manual | `rate_performance` | Must be tagged to a Production (see PERFORMANCE_COMPETITION_COSTS.md) |
| Performance Event | Auto or Manual | `rate_performance` | Tagged to Production; appears in performance cost report |
| Competition Supervision | Manual | `rate_competition` | Tagged to Competition event; appears in competition cost report |
| Training | Manual | `rate_admin` | PD, workshops, curriculum meetings |
| Administration | Manual | `rate_admin` | Planning, parent communication, meetings |
| Substitute Coverage | Auto (from sub assignment) | Sub rate (Finance Admin configures) | Sourced from TEACHER_SUBSTITUTE_COVERAGE.md |
| Bonus | Finance Admin / Super Admin only | `rate_bonus` | Cannot be self-entered by teacher |

---

## Auto-Population from Schedule

When a new monthly pay period opens (1st of month):
1. System queries all class sessions in the pay period assigned to the teacher (as lead or assistant)
2. Sessions appear as pre-filled rows: class name, date, start/end time, calculated duration
3. Rate applied based on teacher's role in the session:
   - Lead teacher → `rate_regular_class` (or discounted variant)
   - Assistant teacher → `rate_assistant_class` (or discounted variant)
4. Teacher reviews each entry and marks status:
   - **Confirmed** — teacher was present
   - **Absent** — teacher was absent (triggers substitute workflow)
   - **Substitute Covered** — auto-applied when sub is confirmed
5. Rehearsal and performance event sessions auto-populate if assigned; tagged to their Production
6. Auto-populated entries cannot be deleted; only status can be changed

---

## Private Lesson Entry & Billing Sub-Tracker

Private lessons are tracked on the teacher's timesheet **and** generate charges on the billing accounts of the students' families. The timesheet is the authoritative source for what was taught; billing records are the bridge to parent charges.

### Who Confirms the Private Happened

**The teacher confirms** that the private lesson occurred when submitting the timesheet entry. Finance Admin reviews for accuracy and processes the charge. This replaces the prior model where Finance Admin was the sole confirmer.

| Step | Actor | Action |
|---|---|---|
| 1 | Teacher | Logs private entry; marks "Did this happen?" Yes/No |
| 2 | Teacher | Suggests billing split across students/accounts |
| 3 | Finance Admin | Reviews; adjusts billing accounts or amounts if needed |
| 4 | Finance Admin | Creates charge(s) on account(s) |
| 5 | Finance Admin | Records date card charged and transaction reference |

### Teacher Entry Fields (per private)

| Field | Type | Notes |
|---|---|---|
| Date | date | |
| Start time | time | |
| End time | time | |
| Total hours | decimal | Auto-calculated |
| Did this happen? | boolean | **Teacher confirms** at time of entry |
| Student(s) | multi-select → enrolled students | Supports group privates |
| Description | text | Optional; notes on session focus |
| Notes | text | e.g., "split between Morgan and Izzy families" |
| Studio / Location | string | Studio room or off-site |
| Billing split | array | See Split Billing below |

### Split Billing for Group Privates

When multiple students share a private session, the charge can be split across their family accounts. Teacher proposes the split; Finance Admin confirms or adjusts.

**Split record (per student in the session):**

| Field | Type | Notes |
|---|---|---|
| Student ID | FK → student | |
| Billing account | FK → account | Default: student's primary family account |
| Split amount | decimal | Dollar amount for this student's share |
| Split percentage | decimal | Convenience display; amount is authoritative |
| Billing account override | boolean | True if Finance Admin changed from teacher's suggestion |

**Split rules:**
- All split amounts must sum to the total charge amount
- Finance Admin can adjust individual split amounts before charging
- If a student has no billing account on file, Finance Admin creates a manual charge record with a note
- Third-party billing (e.g., a grandparent's account, or "Maudi's account") is supported — Finance Admin selects any active account in the tenant
- Split billing applies per-charge; teacher pay is unaffected by how the charge is divided

### Admin Billing Tracker Fields (Finance Admin completes)

| Field | Type | Notes |
|---|---|---|
| Teacher confirmation | boolean | Carried from teacher entry; Finance Admin can override if incorrect |
| Admin entered into calendar? | boolean | Reconciliation check: session logged in booking system |
| Billing split confirmed | boolean | Finance Admin has reviewed and approved the split |
| Charge status per account | enum | `unbilled` / `pending` / `charged` / `waived` / `disputed` |
| Date card charged | date | Per split; recorded when payment processed |
| Charge reference | string | Payment processor transaction ID per charge |

### Private Billing Summary (per pay period, per teacher)

| Metric | Description |
|---|---|
| Total privates logged | All private entries on timesheet |
| Teacher-confirmed happened | `did_private_happen: true` (teacher-set) |
| Fully charged | All splits at `billing_status: charged` |
| Partially charged | Some splits charged, some pending |
| Pending charge | All splits confirmed but not yet billed |
| Unbilled | Teacher logged; not yet confirmed |
| Waived | Confirmed happened; charge intentionally waived |
| Disputed | Charge created; parent has disputed |

Surfaces as a Finance Admin action item until all confirmed privates are fully resolved.

---

## Performance & Competition Cost Tracking

Rehearsal, performance event, and competition entries on timesheets must be tagged to a specific Production or Competition event. This enables Amanda to see the true labor cost of each production and each competition season.

See **PERFORMANCE_COMPETITION_COSTS.md** for the full reporting spec.

**At timesheet entry level:**
- Rehearsal entry → requires `production_id` (FK → productions table)
- Performance event entry → requires `production_id`
- Competition entry → requires `competition_id` (FK → competitions table)

These fields auto-populate if the session was created in the production/competition calendar. If manually entered, teacher selects from a dropdown of active productions/competitions.

---

## Makeup Policy Integration

When a class session is cancelled (active class, not an inactive program), enrolled students become eligible for a makeup class. Similarly, when a student misses a class (marked absent), they may be eligible for a makeup depending on the reason.

The timesheet records the event (absence or cancellation). The makeup eligibility is tracked in a separate Makeup Policy module (see **MAKEUP_POLICY.md**).

**Timesheet trigger conditions for makeup eligibility:**
- `attendance_status: absent` on a teacher's entry → student absence recorded → makeup may be offered per policy
- Session `is_cancelled: true` on an active class → enrolled students → makeup may be offered
- Session cancelled because entire class program is inactive → **no makeup offered**

The timesheet module does not manage makeups directly — it generates the event record that the Makeup Policy module reads.

---

## Monthly Summary View

Each timesheet displays a summary table:

| Work Type | Hours | Pay Rate | Total |
|---|---|---|---|
| Classes (Lead) | auto-sum | from rate profile | calculated |
| Classes (Assistant) | auto-sum | from rate profile | calculated |
| Privates | auto-sum | from rate profile | calculated |
| Rehearsals | auto-sum | from rate profile | calculated |
| Performances | auto-sum | from rate profile | calculated |
| Competitions | auto-sum | from rate profile | calculated |
| Training | auto-sum | from rate profile | calculated |
| Administration | auto-sum | from rate profile | calculated |
| Substitute Coverage Given | auto-sum | sub rate | calculated |
| **Total Monthly Hours** | auto-sum | — | auto-sum |
| **Total Monthly Pay** | — | — | auto-sum |

---

## Timesheet Workflow

```
[Pay Period Opens on 1st]
       ↓
[Class, rehearsal, and performance sessions auto-populated]
       ↓
[Teacher adds privates, admin, competition entries manually]
       ↓
[Teacher confirms each auto-populated entry and all private confirmations]
       ↓
[Teacher submits by 26th]
       ↓
[Finance Admin + Studio Manager notified]
       ↓
[Finance Admin reviews → edits if needed → approves or rejects]
       ↓
[If rejected: teacher notified with comments → revise → resubmit]
       ↓
[If approved: locked; payroll export available]
       ↓
[Finance Admin processes private billing charges]
```

---

## Finance Admin Approval View

- All teachers with timesheet status per period
- Status badges: Not Started / In Progress / Submitted / Approved / Rejected / Exported
- Per-timesheet view: all entries with entry type, rate, hours, calculated pay
- Performance/competition entries tagged with production/event name
- Inline rate override (logged with admin ID + timestamp)
- Approve / Reject with comment
- Bulk approve if no issues flagged
- Private billing tracker: outstanding items highlighted; unresolved items block payroll export warning

---

## Payroll Export

- Format: CSV (ADP, Gusto, or manual payroll)
- Columns: teacher name, employment type (W-2/1099), entry type, production/competition tag (if applicable), hours, rate, total pay, date, notes
- Rate history included for audit
- 1099 entries flagged separately
- Substitute entries flagged `is_substitute: true`
- Performance and competition entries flagged with production/competition name for cost reporting

---

## Data Model

### `pay_period`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `period_month` | integer | 1–12 |
| `period_year` | integer | |
| `submission_deadline` | date | Default: 26th |
| `status` | enum | open / closed / exported |

### `timesheet`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `teacher_id` | FK → teacher_profile | |
| `pay_period_id` | FK → pay_period | |
| `status` | enum | draft / submitted / approved / rejected / exported |
| `submitted_at` | datetime | |
| `reviewed_by` | FK → user | Finance Admin |
| `reviewed_at` | datetime | |
| `rejection_notes` | text | |
| `total_hours` | decimal | Calculated |
| `total_pay` | decimal | Calculated |

### `timesheet_entry`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `timesheet_id` | FK → timesheet | |
| `entry_type` | enum | class_lead / class_assistant / private / rehearsal / performance_event / competition / training / admin / substitute / bonus |
| `teacher_role` | enum | lead / assistant / substitute | For class entries |
| `session_id` | FK → class_session | Null for manual entries |
| `production_id` | FK → production | Required for rehearsal / performance_event entries |
| `competition_id` | FK → competition | Required for competition entries |
| `date` | date | |
| `start_time` | time | |
| `end_time` | time | |
| `total_hours` | decimal | Calculated from start/end |
| `description` | text | Class name, production name, or manual description |
| `notes` | text | |
| `rate_key` | FK → rate_definition | |
| `rate_amount` | decimal | Snapshot at time of entry |
| `rate_override` | boolean | True if Finance Admin overrode |
| `rate_override_by` | FK → user | |
| `is_auto_populated` | boolean | True if sourced from schedule |
| `attendance_status` | enum | confirmed / absent / substitute_covered |
| `is_substitute` | boolean | True if this entry is substitute coverage |
| `substitute_for_teacher_id` | FK → teacher_profile | Populated when is_substitute: true |
| `substitute_notes` | text | Notes on coverage context |

### `private_billing_record`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `timesheet_entry_id` | FK → timesheet_entry | One record per private session |
| `teacher_confirmed` | boolean | Teacher confirmed it happened at entry time |
| `admin_confirmed` | boolean | Finance Admin override confirmation |
| `admin_entered_calendar` | boolean | |
| `billing_split_confirmed` | boolean | Finance Admin has approved the billing split |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### `private_billing_split`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `private_billing_record_id` | FK → private_billing_record | |
| `student_id` | FK → student | |
| `billing_account_id` | FK → account | Finance Admin–confirmed account |
| `billing_account_suggested` | FK → account | Teacher's suggestion at entry time |
| `billing_account_override` | boolean | True if Finance Admin changed from suggestion |
| `split_amount` | decimal | Dollar amount for this student's share |
| `billing_status` | enum | unbilled / pending / charged / waived / disputed |
| `date_card_charged` | date | |
| `charge_reference` | string | Payment processor transaction ID |
| `waiver_reason` | text | Required if waived |
| `dispute_notes` | text | |

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_SCHEDULE_INTEGRATION.md** | Source for auto-populated class, rehearsal, and performance entries |
| **TEACHER_RATE_MANAGEMENT.md** | Reads rate profile per teacher per entry type (including assistant rate) |
| **TEACHER_SUBSTITUTE_COVERAGE.md** | Triggers entry removal/addition on absence; Amanda-as-sub logic |
| **TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md** | Absence and substitution data for reporting |
| **PERFORMANCE_COMPETITION_COSTS.md** | Production and competition tags drive cost reports |
| **MAKEUP_POLICY.md** | Absence and cancellation events generate makeup eligibility |
| **Billing / Payment System** | `private_billing_split` creates charges on parent accounts; charge_reference links to Stripe transaction |
| **REGISTRATION_AND_ONBOARDING.md** | Source for default billing_account_id per student |
| **Notification System** | Deadline reminders, approval/rejection alerts, billing action items |
| **Payroll Export** | Final CSV after Finance Admin approval |

---

## Open Questions
- [ ] Which payroll processor does BAM use today? (ADP, Gusto, or manual — determines export column order)
- [ ] Can teachers enter hours retroactively after the 26th deadline, or is the period locked?
- [ ] When a private is waived, does the teacher still receive pay for that session?
- [ ] Is the Stripe account for private billing the same account used for tuition, or separate?
- [ ] Should Finance Admin receive a configurable alert when uncharged privates exceed X days pending?
- [ ] For competition entries: is the rate the same as performance rate, or a distinct rate?

---

## Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Payroll processor | Square Payroll — CSV export columns will match Square Payroll import format |
| 2 | Teacher edit cutoff | Default = last day of the month; Finance Admin and above can override per pay period in tenant settings; supported cadences: weekly, bi-weekly, bi-monthly, monthly, custom date |
| 3 | Retroactive entry after cutoff | Requires Finance Admin approval; teacher submits request with reason |
| 4 | Waived private — teacher pay | Finance Admin decides per case; Finance Admin toggles "pay teacher" per waived entry |
| 5 | Stripe account | Same Stripe account as tuition; private billing charges go through the same pipeline |
| 6 | Uncharged private alert | Yes — configurable threshold in days; Finance Admin sets in tenant settings |
| 7 | Competition rate | Finance Admin sets rate per competition event; not tied to a global performance rate |

## Open Questions
- [ ] Should weekly/bi-weekly pay cadences generate automatic pay period records, or does Finance Admin create them manually?
- [ ] For retroactive entry requests, does the teacher see a status tracker, or is it handled entirely by Finance Admin off-platform?
