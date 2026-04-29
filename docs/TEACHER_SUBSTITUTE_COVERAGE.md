# BAM Platform — Substitute & Coverage Alerts Module

**Status:** Spec Updated — v2  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_PORTAL.md, TEACHER_SCHEDULE_INTEGRATION.md, TEACHER_TIME_ATTENDANCE.md, MAKEUP_POLICY.md

---

## Overview

Manages the full workflow for teacher absences, substitute assignment, and coverage notifications. Ensures classes are covered, timesheets are updated, and all stakeholders are notified in real time. If no substitute is found and the class is cancelled, enrolled students become eligible for a makeup class per the Makeup Policy.

---

## Absence Reporting

### Teacher-Initiated Absence
1. Teacher opens the affected session in **My Schedule**
2. Selects **"Report Absence"**
3. Selects reason category (required): `illness` / `personal` / `emergency` / `professional_development` / `other`
4. Adds optional notes (visible to Admin; not visible to parents)
5. System flags session as needing coverage
6. Studio Admin, Studio Manager, and Super Admin (Amanda) notified immediately via push + email

### Admin-Initiated Absence
- Studio Admin or Super Admin marks teacher absent on their behalf
- Same notification flow triggered
- Reason category required; admin enters on teacher's behalf

---

## Substitute Assignment

### Amanda as Substitute
If Amanda (Super Admin) teaches a class in place of an absent teacher, she is recorded as the substitute in the system using the same substitute assignment workflow as any other teacher. Her timesheet receives a substitute entry for the session. This is the standard path — Amanda is not a special case in the code; she just has the Super Admin role.

### Manual Assignment (Admin — Phase 1)
1. Admin receives absence alert
2. Opens flagged session in Admin → Coverage view
3. Views available substitute list (teachers not already scheduled at that time, same tenant)
4. System auto-checks for scheduling conflicts before showing list
5. Admin selects substitute → substitute notified via push + email
6. Substitute must **confirm or decline** within configurable window (default: 2 hours)
7. If declined → Admin reassigns; prior decline recorded (tracked for reliability reporting)
8. If no sub confirmed 1 hour before class → Admin + Super Admin receive urgent alert

### Outcome: No Substitute Found
When the class period arrives with no confirmed substitute:
- Admin manually cancels the session in the schedule
- All enrolled families notified of cancellation (message: "class cancelled — instructor unavailable"; teacher not identified)
- Session marked `is_cancelled: true`, `cancellation_reason: no_coverage`
- **Makeup eligibility triggered** for all enrolled active students (see MAKEUP_POLICY.md)
- Session is removed from lead teacher's timesheet (no pay for cancelled session)

### Self-Serve Substitute Pool (Phase 2)
- Teachers declare availability windows
- Available teachers can self-claim open coverage needs
- Pending Admin confirmation before finalizing

---

## Notification Flow

| Event | Who Gets Notified | Channel |
|---|---|---|
| Teacher reports absence | Studio Admin, Studio Manager, Super Admin | Push + email |
| Substitute assigned | Substitute teacher | Push + email |
| Substitute confirms | Admin, Super Admin, absent teacher | In-app |
| Substitute declines | Admin, Super Admin | Push + in-app |
| 1 hour before class, no sub | Admin, Super Admin | Urgent push + email |
| Session cancelled — no sub found | Admin, Super Admin, enrolled families | Push + email |
| Frequent absence flag triggered | Studio Manager, Super Admin | Email |

---

## Timesheet Impact

| Event | Timesheet Effect |
|---|---|
| Absence confirmed | Session entry → `attendance_status: absent`; hours = 0 on absent teacher's timesheet |
| Substitute confirmed | New `timesheet_entry` created on substitute's timesheet; `is_substitute: true`; `substitute_for_teacher_id` = absent teacher |
| Substitute entry includes notes | `substitute_notes` field carries context (e.g., reason, any class adjustments) |
| No sub / cancelled | Session removed from lead teacher's timesheet; no pay; makeup eligibility triggered |
| Amanda as substitute | Standard substitute entry on Amanda's timesheet (Super Admin account) |
| Finance Admin flag | Both timesheets flagged `is_substitute_event: true` for payroll review |

### Notes Visibility on Substitute Records

| Viewer | What They See |
|---|---|
| Substitute teacher (own portal) | Class name, date, program — NOT the absent teacher's name |
| Absent teacher (own portal) | Class, date, "Covered by [First Name]" — confirming coverage happened |
| Admin / Finance Admin / Super Admin | Full detail: absent teacher, substitute, reason, notes |

---

## Substitute Teacher Accounts

| Type | Account Access |
|---|---|
| Existing BAM staff (any role) | Coverage session added to their schedule and timesheet |
| External substitute | Limited platform account: assigned session + timesheet only |
| 1099 external substitute | Same as external; tracked as 1099 in payroll export |
| Super Admin (Amanda) | Standard substitute workflow on her account |

---

## Data Model

The live database splits the absence and substitute workflow into five 
related tables. Each plays a distinct role in the coverage workflow.

### `absence_records` — student or teacher absence events
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `schedule_instance_id` | FK → schedule_instances | The session affected |
| `class_id` | FK → classes (optional) | The class context |
| `student_id` | FK → students | The student (this table primarily tracks student absences) |
| `absence_date` | date | When |
| `report_channel` | text | How the absence was reported (e.g., parent_app, admin, sms) |
| `status` | text | Lifecycle status |
| `parent_note` | text | Optional reason from parent |
| `reported_by` | FK → profiles | Who logged it |
| `notified_admin_at` | timestamptz | When admin was notified |
| `notified_teacher_at` | timestamptz | When teacher was notified |
| `override_by` | FK → profiles | If admin overrode the record |
| `override_note` | text | Why |
| `created_at` | timestamptz | |

> **Note:** Teacher absences are tracked through the `substitute_requests` 
> table (the teacher's session needs coverage); `absence_records` here 
> primarily covers student absences. If teacher-absence reporting needs 
> a parallel structure with reason categories per the workflow above, 
> that's tracked as a future enhancement.

### `substitute_requests` — coverage needed for a session
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `instance_id` | FK → schedule_instances | The session needing coverage |
| `requesting_teacher_id` | FK → profiles | The absent teacher |
| `reason` | text | Free-form reason or category |
| `status` | text | open / filled / cancelled |
| `filled_by` | FK → profiles | Substitute who confirmed |
| `filled_at` | timestamptz | When confirmed |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `substitute_alerts` — outreach attempts to potential substitutes
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `request_id` | FK → substitute_requests | |
| `teacher_id` | FK → profiles | The substitute who was alerted |
| `alert_channel` | text[] | Which channels (push, email, sms) |
| `alert_sent_at` | timestamptz | When alert went out |
| `response` | text | confirmed / declined / no_response |
| `responded_at` | timestamptz | When they responded |
| `created_at` | timestamptz | |

> Multiple `substitute_alerts` rows can exist per `substitute_request` — 
> the system can outreach to several potential subs in priority order.

### `substitute_authorizations` — which teachers can sub for what
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `teacher_id` | FK → profiles | |
| `authorized_for_levels` | text[] | Levels this teacher can substitute for |
| `authorized_for_types` | text[] | Class types they can sub (regular, private, etc.) |
| `priority_order` | integer | Sort order when offering subs |
| `is_active` | boolean | |
| `notes` | text | |
| `created_at` | timestamptz | |

### `teacher_sub_eligibility` — per-teacher overall sub flag
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `teacher_id` | FK → profiles | |
| `is_sub_eligible` | boolean | Master flag for whether this teacher can sub |
| `eligible_disciplines` | text[] | |
| `eligible_levels` | text[] | |
| `notes` | text | |
| `updated_by` | FK → profiles | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Workflow summary
1. Teacher absent → `substitute_requests` row created (status=open)
2. System fans out via `substitute_alerts` to teachers in priority order
3. First confirm wins → `substitute_requests.filled_by` and `filled_at` set
4. Other alerts marked declined or no_response
5. If no fills before class → admin escalation, possible cancellation

### Workflow gap to fix
The original spec used the name `substitute_assignment` for the per-fill 
record. The live schema uses `substitute_requests` with `filled_by`/`filled_at` 
columns rather than a separate assignment record. References to 
`substitute_assignment` in this doc and any code should be updated to 
`substitute_requests`.

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_SCHEDULE_INTEGRATION.md** | Flags sessions needing coverage; session cancellation state |
| **TEACHER_TIME_ATTENDANCE.md** | Adjusts timesheet entries for absent teacher and substitute |
| **MAKEUP_POLICY.md** | Cancelled session (no sub) triggers makeup eligibility for enrolled students |
| **Notification System** | All alert flows |
| **TEACHER_PORTAL.md** | Absence reporting UI; substitute confirmation UI |
| **REGISTRATION_AND_ONBOARDING.md** | Parent notification on cancellation |

---

## Open Questions
- [ ] Is there a compensation policy for substitutes when they confirm but the class is cancelled within 1 hour?
- [ ] Should there be a separate external substitute roster distinct from regular staff?
- [ ] What is the policy when Amanda is also unavailable and no sub is found?
