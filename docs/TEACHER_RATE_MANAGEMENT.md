---
> ⚠️ **DEPRECATED — DO NOT IMPLEMENT FROM THIS SPEC**
>
> This document references tables, columns, or architectural decisions that 
> conflict with the live database or current canonical specs. Last verified 
> against live DB on 2026-04-29.
>
> **Issue:** Defines `rate_definition` / `global_rate` / `teacher_rate` tables — none exist in DB. Live table is `teacher_rate_cards`.
>
> **Canonical replacement:** Pending reconciliation
>
> See `docs/_AUDIT_2026_04_29.md` for full audit findings.
> See `docs/_INDEX.md` for the current canonical doc map.

---

# BAM Platform — Teacher Rate Management Module

**Status:** Spec Updated — v2  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_PORTAL.md, TEACHER_TIME_ATTENDANCE.md, SAAS.md

---

## Overview

Manages all pay rate configurations for teaching staff. Rates are flexible, per-teacher, and per-entry-type. Finance Admin/Finance Lead and Super Admin (Amanda) are the only roles that can create or modify rates. W-2 teachers can view their own rates but cannot edit them. 1099/substitute teachers have simplified flat-rate handling.

---

## Rate Architecture

### Hierarchy (highest priority wins)
```
Entry-Level Override (Finance Admin or Super Admin only)
        ↓
Teacher Rate Profile (per-teacher, per-category)
        ↓
Global Default Rates (system-wide starting point)
```

### Global Default Rates
- Set by Super Admin or Finance Admin
- Apply to all teachers unless a teacher-specific rate overrides
- Stored per `tenant_id` — each studio has its own defaults

### Teacher Rate Profile
- Per-teacher rate records for each rate category
- Overrides global defaults for that teacher
- Maintains effective date history — changes are **not retroactive**

### Entry-Level Override
- Finance Admin or Super Admin can override the rate on any individual timesheet entry
- Override logged with user ID and timestamp; visible in audit trail

---

## Rate Categories

| Rate Key | Label | Who Sets It | Who It Applies To |
|---|---|---|---|
| `rate_regular_class` | Regular Class — Lead | Finance Admin / Super Admin | Lead teachers, standard group classes |
| `rate_discounted_class` | Discounted Class — Lead | Finance Admin / Super Admin | Lead teachers, classes flagged discounted |
| `rate_assistant_class` | Regular Class — Assistant | **Super Admin or Finance Lead only** | Assistant teachers, standard group classes |
| `rate_discounted_assistant_class` | Discounted Class — Assistant | **Super Admin or Finance Lead only** | Assistant teachers, classes flagged discounted |
| `rate_private` | Private Lesson | Finance Admin / Super Admin | W-2 teachers, standard privates |
| `rate_discounted_private` | Discounted Private | Finance Admin / Super Admin | W-2 teachers, privates flagged discounted |
| `rate_admin` | Administrative | Finance Admin / Super Admin | W-2 teachers, planning/meetings/training |
| `rate_bonus` | Bonus | Finance Admin / Super Admin | W-2 teachers; applied manually only |
| `rate_performance` | Performance / Recital / Rehearsal | Finance Admin / Super Admin | W-2 teachers; recitals, showcases, rehearsals |
| `rate_competition` | Competition | Finance Admin / Super Admin | W-2 teachers; competition supervision |

> **Assistant Teacher Rate:** The `rate_assistant_class` and `rate_discounted_assistant_class` keys are editable only by Super Admin (Amanda) or Finance Lead. This reflects the policy that assistant teacher compensation is Amanda's decision. The system enforces this by requiring the `super_admin` or `finance_lead` role to write to these rate keys.

### 1099 / Substitute Rate Handling
- No structured rate profile required
- Rate entered manually per timesheet entry or per session by Finance Admin or Super Admin
- Stored as `rate_amount` directly on the `timesheet_entry` record

---

## Rate Change Rules
- Changes take effect on the specified `effective_date`
- Historical timesheet entries for prior periods are **never altered**
- If a pay period spans a rate change date, the system applies the rate in effect on each session date
- Teacher notified via in-app notification when their rate profile changes
- Rate history exported with payroll export for audit

---

## Finance Admin UI — Rate Management

1. Navigate to **Staff → [Teacher Name] → Rate Profile**
2. View current rates by category with effective dates
3. Edit rate → enter new amount and effective date (defaults to today)
4. View full rate history per category (full audit log with who changed it)
5. Bulk-update global defaults (Super Admin only)

> **Note:** The assistant rate fields are grayed out for Finance Admin accounts that are not Finance Lead or Super Admin. They can see the values but cannot edit them.

---

## Data Model

### `rate_definition`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `rate_key` | string | System identifier |
| `label` | string | Human-readable |
| `description` | text | Optional |
| `edit_requires_role` | enum | finance_admin / finance_lead / super_admin | Some rate keys restricted |
| `is_active` | boolean | Inactive rates hidden from dropdowns |

### `global_rate`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `rate_key` | FK → rate_definition | |
| `rate_amount` | decimal | Per hour |
| `effective_date` | date | |
| `set_by` | FK → user | |

### `teacher_rate`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK | |
| `teacher_id` | FK → teacher_profile | |
| `rate_key` | FK → rate_definition | |
| `rate_amount` | decimal | Per hour |
| `effective_date` | date | |
| `set_by` | FK → user | Finance Admin, Finance Lead, or Super Admin |
| `notes` | text | Optional context for rate change |

---

## Integration Points

| Module | Integration |
|---|---|
| **TEACHER_TIME_ATTENDANCE.md** | Reads rate profile when calculating timesheet pay totals |
| **TEACHER_SCHEDULE_INTEGRATION.md** | Session `is_discounted` and `teacher_role` (lead/assistant) determine which rate key applies |
| **SAAS.md** | All rate records scoped by `tenant_id` |

---

## Open Questions
- [ ] Should there be a rate approval workflow (e.g., Finance Admin changes require Super Admin sign-off)?
- [ ] Do we need a trial-period rate that auto-steps after X months?
- [ ] Is the competition rate distinct from the performance rate, or should they share `rate_performance`?
