# BAM Platform — Teacher Portal

**Status:** Spec Complete  
**Phase:** 2 — Internal Operations  
**Related Modules:** SCHEDULING_AND_LMS.md, TEACHER_TIME_ATTENDANCE.md, TEACHER_RATE_MANAGEMENT.md, TEACHER_SUBSTITUTE_COVERAGE.md, TEACHER_ANNOUNCEMENTS.md, TEACHER_SCHEDULE_INTEGRATION.md

---

## Overview

The Teacher Portal is the primary interface for all teaching staff on the BAM platform. It provides role-appropriate access to schedules, student rosters, attendance, timesheets, communications, curriculum resources, and performance data. Accessible via web (`portal.balletacademyandmovement.com`) and the BAM mobile app (future phase).

> ⚠️ **Auth Note:** Authentication is via Supabase Auth (email/password + magic link), **not** WooCommerce. Teacher accounts are provisioned by Studio Admin. This replaces all legacy WooCommerce/WordPress user references.

---

## Teacher Types

| Type | Description | Portal Access Level |
|---|---|---|
| Lead Teacher | Primary instructor for one or more programs | Full teacher portal |
| Assistant Teacher | Supports lead in classes | Scoped to assigned classes only |
| Substitute / Drop-in | Covers classes on an ad hoc basis | Assigned session + timesheet only |
| 1099 Contractor | Independent instructor | Timesheet + assigned schedule only |
| Admin-Only Staff | No teaching duties | Admin views only; no class/roster access |

---

## Portal Sections

### 1. Dashboard
- Today's schedule (classes, privates, admin blocks)
- Timesheet status widget (current monthly pay period)
- Unread messages and announcements
- Pending action items:
  - Attendance not marked
  - Timesheet not submitted by 26th deadline
  - Required announcements not acknowledged
  - Private billing items needing resolution
- Student flags requiring attention

### 2. My Schedule
- Weekly/monthly calendar view
- Sessions: class sessions, private lessons, admin blocks, performances, competitions
- Tap/click session → roster, notes, attendance history
- Initiate substitute request from session view
- Cross-reference: **TEACHER_SCHEDULE_INTEGRATION.md**

### 3. My Classes
- All assigned classes by program/division (Petites, Company, Competitive, etc.)
- Per class: roster, attendance history, curriculum progress, class notes
- Quick attendance marking per session

### 4. My Students
- Searchable list of all students across assigned classes
- Student card: contact info, enrollment status, attendance summary, flags, notes
- Parent contact info gated by role (Lead Teacher and above)

### 5. Attendance
- Mark attendance per session (present / late / early departure / absent excused / absent unexcused)
- Substitute assignment if teacher is absent
- Attendance history and summary reports
- Cross-reference: **SCHEDULING_AND_LMS.md** (attendance tracking)

### 6. Timesheet
- Monthly pay period; submission deadline: **26th of each month**
- Auto-populated from schedule; manual entry for privates, admin, rehearsals, training
- Private billing sub-tracker (see TEACHER_TIME_ATTENDANCE.md)
- Routes to Finance Admin for approval before payroll export
- Cross-reference: **TEACHER_TIME_ATTENDANCE.md**

### 7. Communications
- Studio announcements (see TEACHER_ANNOUNCEMENTS.md)
- Direct messaging with Studio Admin
- Parent contact (gated by role)
- Future: group messaging per program

### 8. Documents & Files
- Studio policies and handbooks
- Curriculum guides per program level (see BALLET_DOMAIN.md)
- Performance and production materials
- Downloadable forms

### 9. Payroll & Rates
- View own rate profile by category (W-2 teachers only)
- View pay summaries per period (no editing)
- Finance Admin manages all rate changes (see TEACHER_RATE_MANAGEMENT.md)

---

## Authentication & Access

| Area | Detail |
|---|---|
| Auth provider | Supabase Auth |
| Login methods | Email + password, magic link |
| Account provisioning | Studio Admin creates teacher accounts |
| Session tokens | Configurable expiry (default: 7 days on mobile, 24h on web) |
| Role assignment | Studio Admin assigns role at account creation; changeable |
| Multi-tenant | All data scoped to `tenant_id`; teachers never see cross-tenant data |

---

## Data Model

### `teacher_profile`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | FK → Supabase auth.users |
| `tenant_id` | FK | Multi-tenant scope |
| `first_name` | string | |
| `last_name` | string | |
| `email` | string | |
| `phone` | string | |
| `teacher_type` | enum | lead / assistant / substitute / contractor_1099 / admin_only |
| `employment_type` | enum | w2 / 1099 |
| `is_active` | boolean | |
| `hire_date` | date | |
| `bio` | text | optional; used in public-facing studio directory |
| `headshot_url` | string | optional |
| `created_at` | datetime | |
| `updated_at` | datetime | |

---

## Roles & Permissions Matrix

| Feature | Lead | Assistant | Sub | 1099 | Finance Admin | Studio Manager | Studio Admin | Super Admin |
|---|---|---|---|---|---|---|---|---|
| View own schedule | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| View student roster | ✓ | Assigned | Assigned | — | — | ✓ | ✓ | ✓ |
| Mark attendance | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ |
| Submit timesheet | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| View own rates | ✓ W-2 | ✓ W-2 | — | — | ✓ | — | ✓ | ✓ |
| Edit regular rates | — | — | — | — | ✓ | — | ✓ | ✓ |
| Edit assistant rates | — | — | — | — | Finance Lead only | — | — | ✓ |
| Approve timesheets | — | — | — | — | ✓ | — | ✓ | ✓ |
| View all timesheets | — | — | — | — | ✓ | ✓ (read) | ✓ | ✓ |
| View all reports | — | — | — | — | ✓ | ✓ (read) | ✓ | ✓ |
| Manage announcements | — | — | — | — | — | — | ✓ | ✓ |
| Assign substitutes | — | — | — | — | — | — | ✓ | ✓ |
| Receive absence flags | — | — | — | — | — | ✓ | — | ✓ (always) |
| Override any approval | — | — | — | — | — | — | — | ✓ |

> **Super Admin:** Amanda holds the Super Admin role. She receives all flagged alerts (frequent absences, coverage failures, unresolved billing). She cannot be locked out of the system. There is exactly one Super Admin per tenant.

---

## Open Questions
- [ ] Will assistant teachers have their own login or share a lead teacher's account?
- [ ] Is there a "Studio Director" role distinct from "Studio Admin" (referenced in TEACHER_ANNOUNCEMENTS.md)?
- [ ] Should the teacher portal be accessible from the same subdomain as the parent portal, or a separate subdomain?
- [ ] Does Amanda want teachers to have visibility into class enrollment counts?
