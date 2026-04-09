# Levels & Programs — Spec

**Status:** Ready for implementation  
**Phase:** 2 — Operations  
**Decision Log Date:** April 9, 2026  
**Lives in:** Settings → Levels & Programs

---

## 1. Overview

Two distinct concepts that are often confused:

**Levels** — technique progression tiers. Every class is assigned a level.
Every student is assigned a level. Admin-managed, ordered list, fully
dynamic per tenant.

**Programs** — company/team membership. A commitment tier with auditions,
contracts, rehearsal expectations. A student can be in a Program AND have
a regular Level simultaneously (e.g. Level 4C AND in Company).

---

## 2. Levels

### 2.1 Data Model

```sql
CREATE TABLE IF NOT EXISTS studio_levels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  description     text,
  age_min         integer,  -- minimum age in years (optional)
  age_max         integer,  -- maximum age in years (optional)
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  color_hex       text,     -- optional color for display
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);
```

### 2.2 Admin UI — Settings → Levels & Programs → Levels tab

- Drag-to-reorder list (same pattern as discipline settings)
- Each row: color swatch, level name, age range, active toggle, edit/delete
- [+ Add Level] button → inline form:
  - Level Name (required, text)
  - Description (optional)
  - Age Range Min (optional, number)
  - Age Range Max (optional, number)
  - Color (optional, color picker)
- Save → adds to list, reorders by sort_order
- Edit → same inline form
- Delete → confirm dialog, warns if any students or classes use this level

### 2.3 Level Assignment on Student Profile

- Profile tab → Level field becomes a dropdown
- Pulls from studio_levels WHERE tenant_id = current tenant AND is_active = true
- Ordered by sort_order
- Admin selects from dropdown, saves to students.current_level (name string)
- NOTE: students.current_level stores the NAME (text), not the UUID
  This preserves backward compatibility with imported data
  Future: migrate to FK once all data is clean

### 2.4 Level Assignment on Classes

- Class edit form → Level field becomes a dropdown from studio_levels
- Same pattern as student profile

---

## 3. Programs

### 3.1 What Programs Are

Programs are named groups with:
- Membership criteria (which levels can join)
- Commitment expectations (rehearsal requirements, contract)
- Audition requirement
- Custom name and description (changes year to year if needed)

Examples at BAM:
- Junior Company
- Studio Company  
- Company
- Competition Team

### 3.2 Data Model

```sql
CREATE TABLE IF NOT EXISTS studio_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  description     text,
  color_hex       text,
  requires_audition boolean NOT NULL DEFAULT false,
  has_contract    boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Which levels are eligible for this program
CREATE TABLE IF NOT EXISTS program_eligible_levels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES studio_programs(id) ON DELETE CASCADE,
  level_id        uuid NOT NULL REFERENCES studio_levels(id) ON DELETE CASCADE,
  UNIQUE(program_id, level_id)
);

-- Student program membership
CREATE TABLE IF NOT EXISTS student_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  program_id      uuid NOT NULL REFERENCES studio_programs(id),
  season_id       uuid REFERENCES seasons(id),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','audition_pending','withdrawn')),
  joined_at       date,
  left_at         date,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(student_id, program_id, season_id)
);
```

### 3.3 Admin UI — Settings → Levels & Programs → Programs tab

- List of programs with name, description, eligible levels badges, active toggle
- [+ Add Program] button → form:
  - Program Name (required)
  - Description (optional, textarea)
  - Color (optional)
  - Requires Audition (toggle)
  - Has Contract (toggle)
  - Eligible Levels (multi-select from studio_levels)
- Edit → same form
- Delete → confirm, warns if students are enrolled

### 3.4 Student Program Assignment

On the student profile — Programs section (in Profile tab or new Programs tab):

```
Programs
  ✦ Company                    [Active]     [Remove]
  + Add to Program
```

Admin clicks [+ Add to Program]:
- Dropdown of active studio_programs
- Season selector (current season default)
- Status (active / audition_pending)
- Optional notes
- [Add] button

Student can be in multiple programs simultaneously.

---

## 4. Settings Page Structure

**Settings → Levels & Programs**

Two tabs: Levels | Programs

This lives under Studio Settings alongside:
- Disciplines
- Class Types  
- Levels & Programs (NEW)

---

## 5. Student Profile Impact

### Hero section
- Currently shows: "Age 13 · Level 2 · Active"
- After: "Age 13 · Level 4C · Active" with optional program badge
  e.g. "Age 13 · Level 4C · Company · Active"

### Profile tab
- Level → dropdown from studio_levels (not free text)
- Programs section → list of current programs with add/remove

---

## 6. Classes Impact

- Class level field → dropdown from studio_levels
- Optionally: filter enrollment to only show eligible-level students

---

## 7. Build Priority

1. Migration — studio_levels, studio_programs, program_eligible_levels, student_programs
2. Settings page — Levels tab with CRUD + drag-to-reorder
3. Settings page — Programs tab with CRUD + eligible levels multi-select
4. Student profile — Level dropdown from DB + Programs section
5. Classes — Level dropdown from DB
6. Hero section — show program badge

---

## 8. Decisions Log

| # | Decision |
|---|---|
| 1 | Levels and Programs are separate concepts — student can have both simultaneously |
| 2 | Levels are fully dynamic per tenant — admin creates/edits/reorders |
| 3 | Level name stored as text on students.current_level for backward compatibility |
| 4 | Programs have eligible levels — admin selects which levels can join |
| 5 | Programs are per-season — student_programs has season_id |
| 6 | Settings → Levels & Programs page has two tabs: Levels and Programs |
| 7 | Drag-to-reorder on Levels (same pattern as Disciplines settings) |
| 8 | Student can be in multiple programs simultaneously |
| 9 | Junior Company, Studio Company, Company, Competition Team are BAM's initial programs |
| 10 | Level names to be defined with Amanda — seeded after her input |
