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

The live database has a single `teacher_rate_cards` table that consolidates 
what an earlier draft of this spec split across three tables. Per-teacher, 
per-session-type rate cards with built-in cancellation policy.

### `teacher_rate_cards`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | FK → tenants | |
| `teacher_id` | FK → profiles | |
| `session_type` | text | Maps to rate categories below |
| `market_rate_60` | numeric | Market (premium) rate for 60-minute session |
| `market_rate_45` | numeric | Market rate for 45-minute session |
| `market_rate_30` | numeric | Market rate for 30-minute session |
| `standard_rate_60` | numeric | Standard (discounted/internal) rate for 60-minute session |
| `standard_rate_45` | numeric | Standard rate for 45-minute session |
| `standard_rate_30` | numeric | Standard rate for 30-minute session |
| `point_cost` | integer | Cost in unlimited-plan points (default 2) |
| `cancellation_notice_hours` | integer | Hours of notice required for free cancel (default 24) |
| `late_cancel_charge_pct` | numeric | % charged for late cancel (default 100.00) |
| `no_show_charge_pct` | numeric | % charged for no-show (default 100.00) |
| `cancellation_policy_note` | text | Free-form override note |
| `is_active` | boolean | Inactive rate cards hidden but preserved |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Session type values
The `session_type` column drives which rate category applies. Categories 
correspond to the rate keys defined earlier in this doc:

- `regular_class_lead`, `regular_class_assistant`
- `discounted_class_lead`, `discounted_class_assistant`
- `private`, `discounted_private`
- `admin`, `bonus`
- `performance`, `competition`

### Discounted vs. standard rates
The `market_rate_*` columns hold the premium rate; `standard_rate_*` hold 
the discounted/internal rate. When a class or session is flagged 
discounted (e.g., `is_discounted` on the timesheet entry), the system 
reads `standard_rate_*` instead of `market_rate_*`.

### Rate change history
This table does not store effective dates per row. Rate changes are 
captured in `payroll_change_log` (which logs every modification with 
who/when/old-value/new-value). Historical timesheet entries are never 
retroactively repriced — they store the rate amount that was applied 
at submission time on the entry itself.

### 1099 / substitute rate handling
1099 substitutes do not need a `teacher_rate_cards` row. Their rate is 
entered directly on the timesheet entry by Finance Admin or Super Admin.

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
