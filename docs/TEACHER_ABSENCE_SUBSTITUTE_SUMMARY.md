# BAM Platform — Teacher Absence & Substitute Summary Module

**Status:** Spec Updated — v2  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_SUBSTITUTE_COVERAGE.md, TEACHER_TIME_ATTENDANCE.md, TEACHER_PORTAL.md, TEACHER_SCHEDULE_INTEGRATION.md

---

## Overview

Provides structured reporting on teacher absences and substitution activity across the studio. Data surfaces in two places: the Studio Admin/Super Admin dashboard (studio-wide view) and each teacher's own portal (personal view). No new data collection required — all reports are computed from existing `absence_records`, `substitute_requests`, `substitute_alerts`, `schedule_instances`, and `timesheet_entries` tables.

---

## School Year Configuration

The school year date range is **tenant-configurable** — Super Admin sets the start and end date in Studio Settings each year. There is no hardcoded Aug 1 – Jul 31 assumption.

| Setting | Location | Who Sets It |
|---|---|---|
| School year start date | Admin → Studio Settings → School Year | Super Admin |
| School year end date | Admin → Studio Settings → School Year | Super Admin |
| Current school year label | e.g., "2025–2026" | Auto-generated from dates |

All reports filter by the selected school year using these tenant-configured dates.

---

## Report Audiences

| Audience | Access Level | What They See |
|---|---|---|
| Super Admin (Amanda) | Full + receives all flags | All teachers, all data, all alerts |
| Studio Admin | Full | All teachers, all data |
| Studio Manager | Full read | All teachers; no edit access |
| Finance Admin | Full | Same as Studio Admin; cross-reference with payroll |
| Lead Teacher | Own data only | Personal absence history and sub sessions given/received |
| Assistant / Sub / 1099 | Own data only | Sub sessions worked |

---

## Absence Flags — Routing

When a pattern flag is triggered (see Report 2 below), notifications are sent to:

- **Super Admin (Amanda)** — always
- **Studio Manager** — always
- **Studio Admin** — if not the same account as Studio Manager

Flags are informational, not disciplinary. They surface patterns for Amanda and the Studio Manager to address in conversation, not in the system.

---

## Report 1 — Studio-Wide Absence Summary

**Location:** Admin → Reports → Absences

### Filters
- School year (default: current configured school year)
- Date range
- Teacher (all or specific)
- Program/division
- Reason category

### Summary Table

| Teacher | Assigned Sessions | Absences | Absence Rate | Last Absence | Common Reason |
|---|---|---|---|---|---|
| Lauryn M. | 48 | 3 | 6.3% | Mar 7, 2026 | Personal |

- Sortable by any column
- Amber highlight: absence rate > 10%
- Red highlight: absence rate > 20%
- Thresholds configurable by Super Admin in Studio Settings

### Monthly Trend Chart
Bar chart: absences by month across school year. Overlays:
- Production/performance schedule (flag clustering near Nutcracker, spring show, etc.)
- School holiday calendar (flag clustering around breaks)

### Absence Reason Breakdown
Donut chart: distribution of `reason_category` values for the selected filter set.

### Session Impact Summary

| Metric | Value |
|---|---|
| Total absences (studio-wide) | computed |
| Covered by substitute | computed |
| Covered by Amanda | computed |
| Cancelled — no sub found | computed |
| Coverage success rate | computed % |

---

## Report 2 — Individual Teacher Absence History

**Location:** Admin → Staff → [Teacher] → Absence History  
**Also visible to:** Teacher (own data) in Teacher Portal → My Record

### Per-Teacher Summary

| Field | Value |
|---|---|
| School year | configured school year |
| Total sessions assigned | count |
| Total absences | count |
| Absence rate | % |
| Sessions covered by sub | count |
| Sessions covered by Amanda | count |
| Sessions cancelled | count |

### Absence Log (chronological)

| Date | Class | Program | Reason | Sub Assigned | Outcome | Notes |
|---|---|---|---|---|---|---|
| 2026-03-07 | Petites Fri 10am | Petites | Personal | Lauryn M. | Covered ✓ | "Notified 2 hrs before" |
| 2025-11-22 | Petites Fri 10am | Petites | Emergency | — | Cancelled ✗ | "No available sub; parents notified" |

- **Notes column:** populated from `absence_records.parent_note` and `substitute_requests.reason`; visible to Admin and Super Admin only
- Export to CSV

### Pattern Flags (Auto-Generated, Admin/Super Admin Only)

| Flag | Trigger |
|---|---|
| Frequent absences on same weekday | ≥ 3 absences on the same day of week in a rolling 90-day window |
| Pre-holiday clustering | ≥ 2 absences in the 3 days before any configured holiday |
| Repeated same-class absences | ≥ 2 absences for the same specific class in one school year |
| Elevated absence rate | Absence rate exceeds the Studio Settings threshold (default 10%) |
| Consecutive absences | 2+ absences on consecutive scheduled teaching days |

**On flag trigger:** Notification sent to Studio Manager and Super Admin (Amanda) via email. Flag is also displayed as a badge on the teacher's profile in the Admin view. Flags are never shown to the teacher in their own portal.

---

## Report 3 — Substitution Summary (Studio-Wide)

**Location:** Admin → Reports → Substitutions

### Summary Table

| Teacher | Times Subbed | Programs Covered | Avg Confirm Time | Decline Rate | Last Sub |
|---|---|---|---|---|---|
| Lauryn M. | 7 | Petites, Company | 22 min | 0% | Mar 11, 2026 |
| Amanda | 1 | Company | — | — | Feb 14, 2026 |

- Amanda appears in this table when she has covered a class as substitute
- Decline rate and confirm time tracked for reliability reporting

### Coverage Resolution Summary

| Resolution | Count | % |
|---|---|---|
| Sub confirmed within 2 hours | computed | computed |
| Sub confirmed 2–24 hrs before class | computed | computed |
| Amanda covered | computed | computed |
| Cancelled — no sub | computed | computed |

### Program Coverage Map

Matrix: programs (rows) × teachers (columns), showing times each teacher has covered each program. Helps Amanda identify confident coverage for each program.

---

## Report 4 — Individual Teacher Substitution History

**Location:** Admin → Staff → [Teacher] → Substitution History  
**Also visible to:** Teacher (own data) in Teacher Portal → My Record

### Sub Sessions Given (this teacher covered for someone else)

| Date | Class | Program | Hours | Confirmed In | Pay | Notes |
|---|---|---|---|---|---|---|
| 2026-03-11 | Company Tue 3:30pm | Company | 1.0h | 18 min | $[rate] | "Sub for Campbell" |

- **Notes** visible to teacher; sourced from `substitute_requests.reason`
- **"For whom"** — the absent teacher's name is **NOT** shown to the substitute teacher (privacy). They see only the class name and program. Admin and Super Admin see the full detail.

### Sub Sessions Received (someone covered this teacher's class)

| Date | Class | Covered By | Program | Outcome | Notes |
|---|---|---|---|---|---|
| 2026-03-07 | Petites Fri 10am | Lauryn M. | Petites | Covered ✓ | "Covered on short notice" |
| 2025-11-22 | Petites Fri 10am | — | Petites | Cancelled ✗ | "No sub available" |

- **Notes** visible to teacher; confirms their class was handled
- Teachers see first name only of substitute; Admin/Super Admin see full name

---

## Report 5 — Year-End Summary

**Location:** Admin → Reports → Year-End Summary (lives in portal; not emailed automatically)  
**Access:** Studio Admin, Finance Admin, Studio Manager, Super Admin

### Per-Teacher Annual Record

| Field | Value |
|---|---|
| Teacher | name |
| School year | configured label |
| Total sessions assigned | count |
| Sessions confirmed present | count |
| Total absences | count |
| Absence rate | % |
| Covered by sub | count |
| Covered by Amanda | count |
| Cancelled | count |
| Sub sessions given | count |
| Total hours logged | sum from timesheet |
| Total private lessons taught | count |
| Private lessons fully billed | count |
| Private lessons waived | count |

> **Evaluations are out of scope for this module.** Year-end evaluations will be addressed in a separate Evaluation Module (future phase).

### Export
- Download CSV (one row per teacher, all columns)
- Filter by school year
- Print-friendly view available

---

## Data Sources (No New Tables)

| Data Point | Source |
|---|---|
| Absences | `absence_records` |
| Coverage requests | `substitute_requests` |
| Outreach attempts | `substitute_alerts` |
| Coverage outcome | `substitute_requests.status` + `schedule_instances.status` |
| Confirm time | `substitute_alerts.responded_at` − `substitute_alerts.alert_sent_at` |
| Assigned sessions | `schedule_instances` (teacher_id, substitute_teacher_id) |
| Hours | `timesheet_entries` |
| Sub authorizations | `substitute_authorizations` |
| Sub eligibility | `teacher_sub_eligibility` |
| Notes on absence | `absence_records.parent_note`, `override_note` |
| Notes on coverage | `substitute_requests.reason`, `substitute_alerts` response data |
| Amanda coverage | `substitute_requests` where `filled_by` = Amanda's user ID |

All reports computed server-side as PostgreSQL aggregates. No aggregation in the browser.

---

## Admin Dashboard Widgets

### Absence Alert Widget (Admin Dashboard)
- Absences reported this week
- Sessions currently needing coverage (no sub assigned)
- Link → Coverage view

### Substitution Reliability Widget
- Top 3 most reliable subs (fastest confirm + lowest decline rate)
- "Available now" indicator (not currently scheduled)

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_SUBSTITUTE_COVERAGE.md** | Primary data source |
| **TEACHER_TIME_ATTENDANCE.md** | Hours and private billing for year-end summary |
| **TEACHER_SCHEDULE_INTEGRATION.md** | Assigned session records |
| **TEACHER_PORTAL.md** | Teacher's personal view |
| **TEACHER_RATE_MANAGEMENT.md** | Sub pay rates in substitution history |

---

## Open Questions
- [ ] What are the exact school year start/end dates? (Amanda to configure in Studio Settings at launch)
- [ ] Should year-end summary be auto-generated and available on a specific date (e.g., July 31)?
- [ ] Should pattern flag notifications include the specific flag detail or just a link to the teacher's record?
