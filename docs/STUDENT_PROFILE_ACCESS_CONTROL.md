# Student Profile — Access Control & Evaluations Spec

**Status:** Ready for implementation  
**Appended:** April 9, 2026  
**Extends:** STUDENT_PROFILE.md, STUDENT_PROFILE_ENHANCEMENT.md, PERMISSIONS_AUDIT.md  
**Decision Log Date:** April 9, 2026

---

## 1. Role System (Clarified)

The platform already has these roles in profile_roles:

| Role | Description | Key Permissions |
|---|---|---|
| `super_admin` | Derek, Amanda — full access to everything | Everything |
| `finance_admin` | Cara or designated finance person | Billing, payroll, invoices — no curriculum/eval write |
| `admin` | Studio admin staff | Most features except finance-only views |
| `studio_manager` | Day-to-day operations | Schedule, attendance, communications |
| `teacher` | Instructors | Own classes, own students, evaluations for their classes |
| `parent` | Guardians of enrolled students | Their own students only |
| `student` | Adult students (18+) | Their own profile only |

**Critical:** A user can hold MULTIPLE roles simultaneously via `profile_roles` junction table.
Examples:
- Cara = `admin` + `teacher` + future `parent`
- A parent who teaches = `teacher` + `parent`
- Amanda = `super_admin` + `teacher`

**The current `is_admin()` RLS helper is broken** — it only checks `admin` and `super_admin` 
but `requireAdmin()` accepts 5 roles. Per PERMISSIONS_AUDIT.md finding #1, 
`finance_admin`, `studio_admin`, `studio_manager` silently fail RLS.
This MUST be fixed before building finance features.

---

## 2. Student Profile Access Matrix

### Admin-Side Profile (`/admin/students/[id]`)

| Tab | super_admin | finance_admin | admin | studio_manager | teacher (own students) | teacher (other students) |
|---|---|---|---|---|---|---|
| Profile/Bio | ✅ | ✅ read | ✅ | ✅ read | ✅ read | ❌ |
| Skills | ✅ | ❌ | ✅ | ✅ | ✅ award | ❌ |
| Classes | ✅ | ✅ read | ✅ | ✅ | ✅ read | ❌ |
| Schedule | ✅ | ❌ | ✅ | ✅ | ✅ read | ❌ |
| Evaluations | ✅ | ❌ | ✅ | ✅ read | ✅ write/read | ❌ |
| Photos | ✅ | ❌ | ✅ | ✅ | ✅ read | ❌ |
| Documents | ✅ | ✅ read | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ✅ full | ✅ read | ❌ | ❌ | ❌ |
| Opportunities | ✅ full | ❌ | ✅ full | ✅ view | ✅ push to parent | ❌ |
| Contacts | ✅ | ❌ | ✅ | ✅ | ✅ read | ❌ |
| Social | ✅ | ❌ | ✅ | ✅ | ✅ read | ❌ |

### Parent Portal (`/portal/students/[id]`)

| Section | Parent/Guardian | Student under 18 | Student 18+ (own) |
|---|---|---|---|
| Profile/Bio | ✅ | ✅ | ✅ |
| Skills/Badges | ✅ (if visible_to_parents) | ✅ | ✅ |
| Schedule | ✅ | ✅ | ✅ |
| Evaluations | Summary version only | ❌ | ✅ full |
| Photos | ✅ | ✅ | ✅ |
| Documents | ✅ | ❌ | ✅ |
| Billing | ✅ | ❌ | ✅ (if adult/no parent) |
| Opportunities pushed | ✅ (if admin pushed) | ❌ | ✅ |
| Contacts | ✅ | ❌ | ✅ |
| Social | ✅ | ✅ | ✅ |

### Key Access Rules

1. **Teacher access to student profiles** — teacher can only see students 
   enrolled in their classes. "Own students" = students in classes where 
   `classes.teacher_id = auth.uid()` OR student is in `class_teachers` junction.

2. **Student 18+ billing** — if a student is 18+ AND has no guardian linked 
   (or is an adult self-account), they see the Billing tab. If they have 
   a parent/guardian, the parent sees billing and the student does not 
   (unless super_admin overrides).

3. **Opportunities push to parent** — admin OR teacher (for their own students) 
   can push an opportunity to the parent's portal. This creates a visible 
   card in the parent's portal dashboard. The parent sees a simplified version 
   (no internal notes, no revenue amounts).

4. **Finance_admin billing access** — finance_admin sees Billing tab across 
   ALL students/families. They do NOT see Evaluations, Skills, or curriculum data.

---

## 3. Opportunities — Push to Parent

When admin or teacher clicks "Push to Parent" on an opportunity:

1. Creates a `parent_opportunity_notifications` record
2. Parent sees a card in their portal dashboard:
   ```
   💜 A Message from Ballet Academy and Movement
   
   We think Sofia is ready to explore private lessons with Miss Amanda.
   Private lessons help students accelerate technique and prepare for 
   advanced levels.
   
   [Learn More] [Not Interested]
   ```
3. Parent can click "Learn More" → links to booking a trial private or 
   contacting the studio
4. Parent clicking "Not Interested" logs the dismissal (admin sees this)
5. Admin sees on the opportunity card: "Pushed to parent — Apr 9, 2026"

The parent-facing version NEVER shows:
- Revenue amounts or bundle upgrade costs
- Internal notes
- Attendance percentages or specific flags

---

## 4. Evaluations Spec

### 4.1 Who Writes Evaluations
- **Teacher** — writes evaluations for students in their own classes only
- **Admin / Super Admin** — can write evaluations for any student
- **Finance Admin** — cannot write or read evaluations

### 4.2 Evaluation Structure

Two types:

**Type 1 — Structured Evaluation (curriculum-linked)**
Uses the active season curriculum as the template. Teacher rates each skill:
- N = Not Yet
- S = Sometimes  
- E = Exceeds Expectations

Plus free-text sections:
- Strengths
- Areas for growth
- Goals for next season
- Overall recommendation (advance / stay / needs support)

**Type 2 — Quick Note / Progress Note**
Free text only. No structured scoring.
Used for: mid-season check-ins, injury notes, behavioral observations.

### 4.3 Evaluation Visibility

| Audience | Sees | Does NOT See |
|---|---|---|
| Admin / Super Admin | Full evaluation including all notes | — |
| Teacher (own student) | Full evaluation they wrote | Other teachers' evaluations |
| Teacher (other student) | ❌ | Everything |
| Parent / Guardian | Summary version (no individual skill scores, no internal notes) | Individual N/S/E scores, internal teacher notes |
| Student under 18 | ❌ | Everything |
| Student 18+ | Full evaluation | — |
| Finance Admin | ❌ | Everything |

**Parent summary version shows:**
- Date of evaluation
- Overall recommendation (advance / stay / needs support) — softened language
- Strengths paragraph (teacher-written, knowing parent will see it)
- Goals paragraph (teacher-written, knowing parent will see it)
- Does NOT show: individual skill scores, internal observations

**Admin controls whether an evaluation is shared with parent:**
Toggle: "Share with parent" — default OFF. 
Teacher writes evaluation, admin reviews, then flips to shared.

### 4.4 Evaluation UI on Student Profile

**Admin Evaluations tab:**
- List of all evaluations: date, type, author, status (draft/shared/archived)
- Click → full evaluation detail
- [+ New Evaluation] button → opens evaluation form
- Form pre-populates with active season curriculum skills for student's level

**Parent portal Evaluations section:**
- Only shows evaluations where share_with_parent = true
- Shows summary version only
- "Miss Amanda evaluated Sofia on [date]" with softened summary

---

## 5. Fix Required Before Finance Features

The `is_admin()` RLS helper MUST be updated to include `finance_admin` 
before the Billing tab is built. Per PERMISSIONS_AUDIT.md Section 5:

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid()
    AND role IN (
      'admin', 'super_admin', 'studio_admin', 
      'studio_manager', 'finance_admin'
    )
    AND is_active = true
  )
$$;
```

This should be in a migration before the Billing tab is deployed.

---

## 6. DB Additions

```sql
-- Parent opportunity notifications (pushed opportunities)
CREATE TABLE IF NOT EXISTS parent_opportunity_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  opportunity_id  uuid NOT NULL REFERENCES student_opportunities(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  parent_id       uuid NOT NULL REFERENCES profiles(id),
  pushed_by       uuid NOT NULL REFERENCES profiles(id),
  pushed_at       timestamptz NOT NULL DEFAULT now(),
  parent_viewed_at timestamptz,
  parent_action   text CHECK (parent_action IN ('interested','not_interested','ignored')),
  parent_acted_at timestamptz,
  message_override text  -- optional custom message from admin
);

-- Add share_with_parent to student_evaluations
ALTER TABLE student_evaluations
  ADD COLUMN IF NOT EXISTS share_with_parent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS evaluation_type text DEFAULT 'structured'
    CHECK (evaluation_type IN ('structured','quick_note'));
```

---

## 7. Decisions Log

| # | Decision |
|---|---|
| 1 | Users can hold multiple roles simultaneously via profile_roles junction |
| 2 | Teacher can push opportunities to parent for their own students |
| 3 | Admin can push opportunities to parent for any student |
| 4 | Parent-facing opportunity card never shows revenue amounts or internal notes |
| 5 | Student 18+ sees billing if adult self-account OR no guardian linked |
| 6 | finance_admin sees billing across all families but NOT evaluations or curriculum |
| 7 | Teacher writes evaluations for own students only |
| 8 | Admin reviews evaluation before sharing with parent — share_with_parent default OFF |
| 9 | Parent sees summary version of evaluation only — no individual N/S/E scores |
| 10 | Student under 18 never sees evaluations |
| 11 | is_admin() RLS helper must include finance_admin before billing tab is deployed |
| 12 | Evaluation types: structured (curriculum-linked N/S/E) and quick_note (free text) |
