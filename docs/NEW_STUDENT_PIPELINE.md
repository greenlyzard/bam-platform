# New Student Pipeline — Addendum to ENROLLMENT_AND_PLACEMENT.md

**Status:** Ready for implementation  
**Appended:** April 7, 2026  
**Adds to:** ENROLLMENT_AND_PLACEMENT.md Section 4 onward  
**Cross-references verified against:** ENROLLMENT_FLOW_SPEC.md, ENROLLMENT_POLICY.md, ENROLLMENT_QUIZ_SPEC.md, CHATBOT_AND_LEAD_CAPTURE.md, COMMUNICATIONS_INBOX.md

---

## What Was Already Covered (Do Not Duplicate)

| Topic | Source File |
|---|---|
| Trial booking wizard Steps 0–7 | ENROLLMENT_FLOW_SPEC.md |
| `trial_eligible` flag per class | ENROLLMENT_POLICY.md |
| One trial per season, second needs Super Admin approval | ENROLLMENT_POLICY.md |
| Post-trial follow-up email sequence | ENROLLMENT_FLOW_SPEC.md Section 5 |
| Intermediate/advanced quiz branch | ENROLLMENT_QUIZ_SPEC.md Branch B |
| Admin pre-placement + parent cart | ENROLLMENT_AND_PLACEMENT.md Sections 2–3 |
| Communication thread capture | COMMUNICATIONS_INBOX.md |

---

## Section 4 — New Student Pipeline (CRM Kanban View)

### 4.1 Pipeline Stages

Every new student (no prior BAM enrollment) enters the pipeline at `Inquiry` and moves through stages as actions are completed. Amanda sees all students across all stages in a Kanban view at `/admin/enrollment/pipeline`.

```
Inquiry
  → Trial Requested
    → Trial Scheduled
      → Trial Attended
        → Evaluation Requested      ← advanced/intermediate students only
          → Evaluation Scheduled
            → Placement Recommended
              → Contract Pending
                → Enrolled
```

Dead-end stages (can happen at any point):
- `Waitlisted` — class is full, student on waitlist
- `Lost` — no response, family chose another studio, withdrew

### 4.2 Stage Definitions

| Stage | Trigger | Who Acts Next |
|---|---|---|
| `inquiry` | Lead created (Angelina, form, phone, walk-in) | Admin follows up |
| `trial_requested` | Parent requests trial via portal or chatbot | Admin schedules |
| `trial_scheduled` | Admin confirms trial date + class | Parent attends |
| `trial_attended` | Admin marks trial complete | Admin decides next step |
| `evaluation_requested` | Student/parent requests evaluation OR admin flags as needing placement assessment | Admin schedules eval |
| `evaluation_scheduled` | Admin sets evaluation date with teacher | Student attends |
| `placement_recommended` | Admin or teacher sets recommended classes after trial/eval | Parent reviews cart |
| `contract_pending` | Parent has opened checkout but not completed signing/payment | Parent completes |
| `enrolled` | Payment processed + contracts signed | Studio onboards |

### 4.3 Kanban UI — `/admin/enrollment/pipeline`

**Layout:** One column per stage. Cards show:
- Student name + age
- Guardian name
- Days in current stage (urgency indicator — amber at 3 days, red at 7 days)
- Source badge (Angelina / Form / Phone / Walk-in / Referral)
- Class of interest
- Quick action button per stage (e.g. "Schedule Trial", "Mark Attended", "Recommend Classes")

**Filters:**
- Season
- Source
- Days in stage
- Assigned admin

**Amanda's view:** Sees every card across every stage. Can drag cards between stages manually if needed (with confirmation). Can click any card to open the full student lead record with complete communication history.

---

## Section 5 — Class Display Logic for New Students

### 5.1 Unassessed Beginner (No Prior Dance or Age 3–7)

Shows only classes where `trial_eligible = true`.

CTA on class card: **"Book a Free Trial"**

No evaluation step — goes directly into Trial Requested stage.

### 5.2 Unassessed Intermediate/Advanced (Prior Experience, Age 8+)

Shows classes at the estimated level range from quiz answers. Classes marked `trial_eligible = true` show **"Book a Free Trial"**. Classes NOT trial-eligible (advanced levels, Company, Pointe) show **"Request Placement Evaluation"** instead.

When "Request Placement Evaluation" is clicked:
- Lead moves to `evaluation_requested` stage
- Admin notified immediately: "New evaluation request from [name], age X, [experience description]"
- Parent sees: "Thank you — we'll reach out within 24 hours to schedule your evaluation with Miss Amanda"
- Communication thread opened (linked to lead record in COMMUNICATIONS_INBOX)

### 5.3 Returning BAM Student (Prior Enrollment in DB)

System auto-detects returning students by matching: email address OR (first name + last name + date of birth). When a match is found:

- Parent is prompted: "Welcome back! We found Sofia's record from [Season]. Would you like to pick up where you left off?"
- Shows classes Amanda has recommended (from pre-placement if staged, or from last season's level)
- CTA: **"Enroll Now"** — no trial needed, no evaluation needed
- Amanda can override: mark a returning student as needing evaluation (e.g. long absence, level re-assessment)

**Auto-recognition rules:**
- Gap < 1 season: auto-recognize, pre-approve for same or next level
- Gap 1–2 seasons: auto-recognize, flag for Amanda to confirm level before showing recommendations
- Gap > 2 seasons: auto-recognize as returning but treat as new student for placement purposes — show evaluation request path

---

## Section 6 — Evaluation Flow

### 6.1 Who Schedules

Amanda (or admin) schedules evaluations — parents do not self-book from a calendar. This preserves Amanda's control over her time and ensures the right teacher is assigned.

Flow:
1. Admin receives evaluation request notification
2. Admin opens lead record → clicks "Schedule Evaluation"
3. Selects: date, time, teacher (defaults to Amanda), studio room
4. System sends parent confirmation: "Your evaluation is scheduled for [Day, Date] at [Time] with [Teacher]. Please arrive 5 minutes early."
5. Lead moves to `evaluation_scheduled`
6. Communication thread updated with scheduling confirmation

### 6.2 After Evaluation

Teacher (or Amanda) marks evaluation complete and enters:
- Recommended level
- Placement notes (internal — not shown to parent)
- Recommended classes (pulled from available class catalog)

Lead moves to `placement_recommended`. Parent receives notification: "We have class recommendations ready for Sofia — log in to review and enroll."

Parent lands in the pre-placement cart flow (same as Section 2 of ENROLLMENT_AND_PLACEMENT.md) with recommended classes pre-loaded.

### 6.3 Evaluation Communication Thread

Every evaluation request creates a `communication_thread` record (type: `inquiry`, linked to `lead_id`). All subsequent messages — admin replies, scheduling confirmations, follow-ups — are appended to this thread and visible in COMMUNICATIONS_INBOX.

This means:
- Admin never misses a message even if it comes via email reply
- Amanda can see the full conversation history when she opens any lead card
- No communication happens outside the platform (dance@bamsocal.com replies are captured via inbound webhook per COMMUNICATIONS_INBOX.md)

---

## Section 7 — DB Additions Required

### 7.1 Additions to `leads` Table

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'inquiry'
    CHECK (pipeline_stage IN (
      'inquiry','trial_requested','trial_scheduled','trial_attended',
      'evaluation_requested','evaluation_scheduled','placement_recommended',
      'contract_pending','enrolled','waitlisted','lost'
    )),
  ADD COLUMN IF NOT EXISTS intake_form_data jsonb DEFAULT '{}',
    -- stores quiz answers: child_age, experience_level, disciplines, preferred_days
  ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid REFERENCES profiles(id),
    -- teacher assigned for evaluation
  ADD COLUMN IF NOT EXISTS evaluation_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS evaluation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS placement_notes text,
    -- internal notes after evaluation, not shown to parent
  ADD COLUMN IF NOT EXISTS recommended_class_ids uuid[] DEFAULT '{}',
    -- classes recommended after evaluation
  ADD COLUMN IF NOT EXISTS returning_student_id uuid REFERENCES students(id),
    -- populated when auto-matched to existing student record
  ADD COLUMN IF NOT EXISTS days_in_stage integer GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (now() - updated_at))::integer
  ) STORED,
  ADD COLUMN IF NOT EXISTS communication_thread_id uuid REFERENCES communication_threads(id);
    -- linked inbox thread for this lead
```

### 7.2 `trial_history` Connection to Pipeline

`trial_history` already exists in the live DB with:
- `student_id`, `class_id`, `enrollment_id`
- `trial_date`, `outcome` (pending_conversion / converted / declined / no_show / expired)

Add the missing link to leads:
```sql
ALTER TABLE trial_history
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id);
```

This connects the trial record back to the pipeline so admin can see trial outcome on the Kanban card.

### 7.3 New `evaluation_requests` Table

```sql
CREATE TABLE IF NOT EXISTS evaluation_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  lead_id               uuid REFERENCES leads(id),
  student_id            uuid REFERENCES students(id),
    -- populated for returning students
  requested_by          uuid REFERENCES profiles(id),
    -- guardian or admin who initiated
  request_type          text NOT NULL DEFAULT 'placement'
    CHECK (request_type IN ('placement','level_advancement','re_assessment')),
  experience_description text,
    -- free text from parent: "4 years at another studio, working on pirouettes"
  assigned_teacher_id   uuid REFERENCES profiles(id),
  scheduled_at          timestamptz,
  completed_at          timestamptz,
  recommended_level     text,
  placement_notes       text,
  status                text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','scheduled','completed','cancelled','no_show')),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_requests_lead    ON evaluation_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_eval_requests_tenant  ON evaluation_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_requests_status  ON evaluation_requests(status);
```

---

## Section 8 — Decisions Log (New Student Pipeline)

| # | Decision |
|---|---|
| 1 | Kanban pipeline at `/admin/enrollment/pipeline` — Amanda sees all new students across all stages |
| 2 | Pipeline stages: Inquiry → Trial Requested → Trial Scheduled → Trial Attended → Evaluation Requested → Evaluation Scheduled → Placement Recommended → Contract Pending → Enrolled |
| 3 | Cards show days-in-stage with amber (3 days) and red (7 days) urgency indicators |
| 4 | Beginner students (age 3–7, no experience): see trial-eligible classes only, CTA = "Book a Free Trial" |
| 5 | Intermediate/advanced students: see full level range, non-trial-eligible classes show "Request Placement Evaluation" instead |
| 6 | Evaluation scheduling: Amanda picks the time — parents do not self-book |
| 7 | Every evaluation request creates a communication_thread linked to the lead record |
| 8 | dance@bamsocal.com replies captured via inbound webhook — nothing missed outside platform |
| 9 | Returning student auto-detection: match on email OR (first name + last name + DOB) |
| 10 | Gap < 1 season: auto pre-approve same/next level. Gap 1–2 seasons: flag for Amanda. Gap > 2 seasons: treat as new for placement |
| 11 | `leads.pipeline_stage` replaces the existing `status` field for new student tracking |
| 12 | `trial_history.lead_id` FK added to connect trial outcomes back to the pipeline |
| 13 | Evaluation request creates `evaluation_requests` record — separate from student_evaluations (which are for existing enrolled students) |
| 14 | After evaluation: admin enters recommended classes → parent lands in pre-placement cart (same flow as Section 2 of ENROLLMENT_AND_PLACEMENT.md) |
