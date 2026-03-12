# BAM Platform — Performance & Competition Cost Tracking Module

**Status:** Spec Complete  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_TIME_ATTENDANCE.md, TEACHER_RATE_MANAGEMENT.md, SCHEDULING_AND_LMS.md

---

## Overview

Amanda needs to know the true labor cost of each production (Nutcracker, spring recital, showcases) and each competition event. This module defines how rehearsal and performance event entries on teacher timesheets are tagged to specific productions and competitions, and how those costs are surfaced in reporting.

No new work is required from teachers — they simply tag their timesheet entries to the relevant production or competition when logging hours. The reporting module aggregates those entries into per-production and per-competition cost summaries.

---

## Productions

A **production** is any staged performance event: The Nutcracker, the spring recital, a showcase, a parent observation event with staging, etc.

Productions are created and managed by Studio Admin or Super Admin in the Admin calendar. Once a production exists, teachers can tag timesheet entries to it.

### Production Record

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `name` | string | e.g., "The Nutcracker 2025", "Spring Showcase 2026" |
| `production_type` | enum | nutcracker / spring_recital / showcase / parent_observation / other |
| `school_year` | string | e.g., "2025–2026" |
| `rehearsal_start_date` | date | First rehearsal date |
| `performance_dates` | date array | All performance event dates |
| `is_active` | boolean | Active = teachers can tag entries to this production |
| `notes` | text | |

### What Gets Tagged to a Production

| Entry Type | Tag Required? | When |
|---|---|---|
| Rehearsal | ✓ Required | Any session labeled as rehearsal for this show |
| Performance Event | ✓ Required | The actual show date(s); teacher supervision, warm-up, backstage |
| Administration | Optional | Costume coordination, production planning meetings |
| Training | No | Not production-specific |

---

## Competitions

A **competition** is any off-site or on-site competition event where BAM students compete and teachers supervise, choreograph, or accompany.

### Competition Record

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `name` | string | e.g., "YAGP SoCal 2026", "Youth America Grand Prix Regionals" |
| `competition_type` | enum | yagp / regional / national / local_showcase / other |
| `school_year` | string | |
| `event_dates` | date array | All competition dates |
| `location` | string | Venue and city |
| `is_active` | boolean | |
| `notes` | text | |

### What Gets Tagged to a Competition

| Entry Type | Tag Required? | When |
|---|---|---|
| Competition Supervision | ✓ Required | Teacher accompanies students at competition venue |
| Rehearsal (competition prep) | Optional | Rehearsals specifically for competition pieces |
| Administration | Optional | Competition registration, travel coordination |

---

## Teacher Timesheet Entry — Production/Competition Tag

When a teacher logs or reviews a rehearsal, performance, or competition entry on their timesheet:

- A **production dropdown** appears for rehearsal and performance entry types (required)
- A **competition dropdown** appears for competition entry types (required)
- Dropdown lists only active productions/competitions for the current school year
- If manually entering (not auto-populated from schedule), teacher selects from dropdown
- If auto-populated from a scheduled rehearsal or performance session, the `production_id` carries over automatically from the session record

---

## Cost Reports

### Report 1 — Production Cost Summary

**Location:** Admin → Reports → Productions → [Production Name]

| Teacher | Role | Rehearsal Hours | Performance Hours | Admin Hours | Total Hours | Rate | Total Cost |
|---|---|---|---|---|---|---|---|
| Lauryn M. | Lead | 12.0h | 3.0h | 0.5h | 15.5h | $[rate] | $[total] |
| Pi W. | Assistant | 8.0h | 3.0h | 0 | 11.0h | $[rate] | $[total] |
| Amanda | Lead | 20.0h | 3.0h | 2.0h | 25.0h | $[rate] | $[total] |
| **TOTAL** | | computed | computed | computed | computed | — | **$[total]** |

- Rows: one per teacher with any entries tagged to this production
- Cost = hours × rate snapshot from timesheet entries (not live rate)
- Approved timesheets only (draft/submitted entries shown as "pending" with projected cost)
- Export to CSV

### Report 2 — All Productions Cost Summary (School Year)

**Location:** Admin → Reports → Productions

| Production | Rehearsal Hours | Performance Hours | # Teachers | Total Cost |
|---|---|---|---|---|
| Nutcracker 2025 | 180h | 18h | 8 | $[total] |
| Spring Showcase 2026 | 90h | 6h | 6 | $[total] |
| **TOTAL** | computed | computed | — | **$[total]** |

### Report 3 — Competition Cost Summary

**Location:** Admin → Reports → Competitions → [Competition Name]

| Teacher | Supervision Hours | Prep Rehearsal Hours | Admin Hours | Total Hours | Rate | Total Cost |
|---|---|---|---|---|---|---|
| Lauryn M. | 8.0h | 4.0h | 0.5h | 12.5h | $[rate] | $[total] |
| **TOTAL** | computed | computed | computed | computed | — | **$[total]** |

### Report 4 — All Competitions Cost Summary (School Year)

| Competition | # Events | # Teachers | Total Hours | Total Cost |
|---|---|---|---|---|
| YAGP SoCal 2026 | 2 days | 3 | 36h | $[total] |
| **TOTAL** | — | — | computed | **$[total]** |

---

## Admin Dashboard Widgets

### Production Cost Widget
- Active productions with running cost total (approved hours only) vs. projected (all submitted)
- Alert if a production is within 2 weeks and has pending unsubmitted timesheets from assigned teachers

### Competition Cost Widget
- Upcoming competitions with estimated cost based on scheduled teacher hours

---

## Data Model Additions

These fields are added to `timesheet_entry` (already defined in TEACHER_TIME_ATTENDANCE.md):

| Field | Type | Notes |
|---|---|---|
| `production_id` | FK → production | Required for rehearsal / performance_event entries |
| `competition_id` | FK → competition | Required for competition entries |

Full table definitions for `production` and `competition` are above in this file.

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_TIME_ATTENDANCE.md** | `production_id` and `competition_id` fields on `timesheet_entry`; approved timesheet data drives cost totals |
| **TEACHER_RATE_MANAGEMENT.md** | Rate snapshots on entries used for cost calculation |
| **SCHEDULING_AND_LMS.md** | Rehearsal and performance sessions carry `production_id` and auto-populate on timesheet |

---

## Open Questions
- [ ] Should production cost reports be visible to Finance Admin only, or also to Studio Manager?
- [ ] Should there be a production budget field so Amanda can set a target and see actual vs. budget?
- [ ] For competition travel days, is there a per diem or travel expense component beyond hourly pay?
- [ ] Should the Nutcracker be tracked as a single production or broken out by cast (e.g., Cast A / Cast B rehearsal costs separately)?
