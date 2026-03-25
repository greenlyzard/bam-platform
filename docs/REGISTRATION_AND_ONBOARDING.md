# REGISTRATION_AND_ONBOARDING.md
# Ballet Academy and Movement — Registration & Onboarding Spec
# Version: 3.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026 — added trial abuse detection, front-desk suppression,
# Angelina-personalized onboarding, and cross-references to BILLING_AND_CREDITS.md

---

## 1. Overview

Registration at BAM is not a single flow — it is a set of distinct
experiences based on who is registering and what they already know
about the studio. The system must feel effortless for every user type
while preserving Amanda's ability to control placement, quality, and
culture.

Cross-references:
- BILLING_AND_CREDITS.md — fees, tuition, credit/bundle system, proration
- SCHEDULING_AND_LMS.md — class records, point_cost, trial eligibility
- COMMUNICATIONS.md — welcome sequences, Angelina follow-up
- CHATBOT_AND_LEAD_CAPTURE.md — Angelina conversation flows
- STUDENT_EVALUATIONS.md — annual evaluation driving re-enrollment placement

---

## 2. User Types & Their Experiences

| User Type | Path | Key Difference |
|---|---|---|
| New family (child student) | Discovery → Survey → Trial → Register | AI-guided placement, trial first |
| New adult student | Discovery → Light survey → Register | Can go straight to registration |
| Existing family re-enrolling | Portal → Review placement → Confirm → Pay | Previous level + annual eval drives placement |
| Admin enrolling a student | Admin → Select student → Select class → Enroll | Direct enrollment, no wizard |
| Walk-in / phone inquiry | Angelina or Admin creates lead record | Captured, nurtured into registration |
| Advanced dancer / transfer | Assessment flow → Amanda approval | Level placement requires Amanda review |

---

## 3. New Family — Primary Flow

### 3.1 Entry Points
- Website chatbot (Angelina)
- Website "Enroll Now" button
- Direct URL from ad campaign
- QR code from in-studio or printed marketing

### 3.2 Path A — Angelina Chat-Guided (default for website visitors)
1. Angelina greets visitor, asks about their child (age, experience, goals, schedule)
2. Based on responses, Angelina recommends 1–3 classes
3. For trial-eligible classes: "Would you like to book a free trial?"
4. For non-level or beginner classes: "Ready to register now?" — can bypass trial
5. Parent enters contact info → lead record created
6. If trial: trial session booked, confirmation sent
7. If direct registration: flows into enrollment wizard (Section 3.4)

### 3.3 Path B — Intake Survey → AI Recommendation → Trial/Register
1. Parent fills intake survey: child name/DOB, prior dance experience, goals, schedule availability, referral source
2. Angelina processes survey → recommends 1–3 classes with reasoning
3. Parent sees recommendation card per class: name, days/times, teacher, trial badge if eligible
4. Parent selects their path (trial or register now)

### 3.4 Path C — Straight Registration
1. Parent browses classes filtered by age / day / type
2. Selects class → enrollment wizard:
   - Step 1: Student info (name, DOB, health/allergy notes)
   - Step 2: Parent/guardian info
   - Step 3: Emergency contacts + stream contacts
   - Step 4: Registration fee payment (unless waived)
   - Step 5: Confirm enrollment
3. Confirmation email + onboarding sequence triggers

### 3.5 Advanced Dancer / Transfer Student Path
Students arriving with prior training at another studio may not fit the
standard beginner flow. The system must accommodate this:

1. During intake survey or Angelina chat, if experience = "trained at another studio"
   or "serious training background":
   - System flags as `placement_review_required = true`
   - Angelina: "Because of your prior training, we'd like Amanda to personally
     review your placement. Would you like to schedule a brief assessment class?"
2. Admin task created: "Advanced dancer inquiry — [student name], age [X],
   prior experience: [description]. Review and recommend class."
3. Amanda (or designated teacher) reviews and sets recommended class
4. Parent notified via portal + email: "We've reviewed [student]'s background
   and recommend [class name]. Here's how to register."
5. System bypasses standard age-gating for this student; placement overrides
   the default recommendation

```sql
-- Additional fields on students table:
placement_review_required   BOOLEAN DEFAULT false,
placement_reviewed_by       UUID REFERENCES profiles(id),
placement_reviewed_at       TIMESTAMPTZ,
placement_review_notes      TEXT,
prior_studio                TEXT,
prior_training_years        INTEGER,
```

---

## 4. Trial Class System

### 4.1 Trial Eligibility (Per Class)
Trial class eligibility is explicitly configured per class by Admin.
No class is trial-eligible by default.

```sql
-- On the classes table:
trial_eligible          BOOLEAN DEFAULT false,
trial_requires_approval BOOLEAN DEFAULT false,
trial_max_per_session   INTEGER DEFAULT 2,
trial_notes             TEXT,
```

### 4.2 Trial Rules
- **One free trial per student per class** — enforced system-wide
- System checks `trial_history` table across all seasons, not just current
- A second trial for the same class requires Super Admin (Amanda) approval
- Trial does NOT require registration fee — fee due only on full enrollment
- Trial student appears on session roster tagged as [TRIAL]
- Trial `point_cost` = 0 (free, does not deduct credits)

### 4.3 Trial Abuse Detection

**What counts as abuse:**
- Same student attempting to trial the same class a second time (any season)
- Same family attempting to trial the same class for multiple children
  sequentially without enrolling any of them
- Email/phone/DOB pattern matching across multiple "new" accounts

**Detection logic:**
```sql
CREATE TABLE trial_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  class_id        UUID NOT NULL REFERENCES classes(id),
  session_id      UUID REFERENCES class_sessions(id),
  trial_date      DATE NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN (
                    'pending_conversion', -- trial attended, no action yet
                    'converted',          -- enrolled after trial
                    'declined',           -- parent declined to enroll
                    'no_show',            -- booked but did not attend
                    'enrolled_front_desk' -- enrolled in person; suppress emails
                  )),
  outcome_set_by  UUID REFERENCES profiles(id),
  outcome_set_at  TIMESTAMPTZ,
  abuse_flag      BOOLEAN DEFAULT false,
  abuse_reason    TEXT,
  override_approved_by UUID REFERENCES profiles(id), -- Super Admin override
  override_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

**At trial booking:**
1. System checks `trial_history` for `student_id + class_id` regardless of season
2. If prior trial exists and outcome ≠ `converted`:
   - If `outcome = 'enrolled_front_desk'`: allow, no flag (they did enroll)
   - Otherwise: block with message to admin: "This student has already trialed
     this class on [date]. A second trial requires Amanda's approval."
3. Admin can submit Super Admin approval request with reason
4. Super Admin (Amanda) approves or denies from Admin → Trials → Pending Approvals
5. If approved: `override_approved_by` set, trial booked, abuse_flag = true logged

**Family pattern detection:**
If 3+ students from the same family_id have trialed the same class without
any converting to enrolled, system creates an Admin task:
"⚠️ Multiple trial attempts from [Family Name] without enrollment.
Review before approving additional trials."

### 4.4 Front-Desk Enrollment Suppression
When a student enrolls at the front desk after a trial (in person or
by phone), the admin or front desk must mark the trial outcome to prevent
duplicate follow-up emails.

**How to mark:**
- Admin opens Admin → Trials → [Student Name]
- Sets `outcome = 'enrolled_front_desk'`
- Optionally notes which class they enrolled in

**Effect:**
- All pending trial follow-up emails and Klaviyo sequences are suppressed
- Angelina follow-up sequence is cancelled
- No "Ready to save your spot?" SMS sent
- Admin task for unconverted trial is closed automatically

**Angelina also checks before sending:**
Before each step in the trial follow-up sequence, Angelina checks
`trial_history.outcome` for that student:
- If `outcome = 'enrolled_front_desk'` or `'converted'`: skip/cancel remaining sequence
- If `outcome = 'no_show'`: send modified message acknowledging they missed the trial

### 4.5 Post-Trial Follow-Up Sequence (Angelina)

Triggered after trial session attendance is confirmed as `present`:

| Timing | Action | Suppressed if |
|---|---|---|
| Same day (after class) | Angelina sends warm follow-up in chat | outcome = enrolled_front_desk or converted |
| Day 2 | Email: what to expect in full program, Amanda's philosophy | Same |
| Day 4 | SMS or in-app: "Ready to save [name]'s spot?" | Same |
| Day 7 | Final follow-up: limited spots note if class near capacity | Same |
| Day 14 | Admin task: "Trial student [name] unconverted — follow up" | Outcome set to any |

If trial was `no_show`:
- Day 1: Email: "We missed you! Would you like to reschedule your trial?"
- Day 5: Final reschedule offer
- Day 10: Admin task: "Trial no-show [name] — follow up or close"

---

## 5. Angelina-Personalized Onboarding

### 5.1 Overview
When a student enrolls for the first time (not trial), Angelina generates
a personalized onboarding email sequence based on the student's profile.
This replaces generic template emails.

### 5.2 Personalization Inputs

| Input | Source | Example Use |
|---|---|---|
| Student first name | students.first_name | "Welcome, Lily!" |
| Student age | students.date_of_birth | "Ages 6–8 in Level 1..." |
| Dance level / program | enrollments → classes.levels | "Your first class is Level 1 Ballet..." |
| Class name | classes.simple_name | "Ballet for Ages 6–9" |
| Teacher name | class_teachers → profiles | "Your teacher is Miss Amanda" |
| Season name | seasons.name | "Spring 2026 season" |
| Key season dates | seasons.start_date, end_date, performance_dates | "The spring recital is June 14" |
| Disciplines enrolled | classes.discipline_tag | Ballet-specific vs jazz-specific content |
| Is new student | trial_history.outcome OR first_enrollment | Welcome vs returning language |
| Prior studio | students.prior_studio | "Transferring from another studio?" section |

### 5.3 Email Sequence

All emails are Angelina-generated and reviewed by admin before send.
Admin can edit any generated email before approving or can approve as-is.

**Email 1 — Welcome (Day 0, sent at enrollment confirmation)**

Subject: "Welcome to Ballet Academy and Movement, [first name]!"

Content generated by Angelina includes:
- Personalized welcome referencing class name and teacher
- "What to expect at your first class" — age-appropriate language
  - Ages 3–5: playful, reassuring ("You'll dance, sing, and make new friends!")
  - Ages 6–10: encouraging ("Here's what your Level 1 class looks like...")
  - Ages 11+: informative, slightly more technical ("Level 3B focuses on...")
  - Adults: professional, peer tone
- Studio address and parking
- What to wear (dress code specific to class type)
- What to bring

**Email 2 — Studio Policies (Day 1)**

Subject: "Everything you need to know before your first class"

Content:
- Tardiness and absence policy
- Dress code with links to approved vendors
- Photo/video policy
- Studio entry procedures
- Contact info for questions

**Email 3 — Season Overview (Day 3)**

Subject: "What's coming up this season at the studio"

Content (Angelina pulls from current season record):
- Season dates (start, end)
- Performance dates (Nutcracker dates, spring recital, etc.)
- Any upcoming events relevant to this student's program
- Link to parent portal to view full schedule

**Email 4 — Parent Portal Walkthrough (Day 5)**

Subject: "Your parent portal is ready — here's how to use it"

Content:
- Link to portal
- Key features: schedule, attendance, communications, billing
- How to contact teacher via the portal

**Email 5 — 30-Day Check-In (Day 30)**

Subject: "How are things going for [student name]?"

Content generated by Angelina:
- Check-in on how the first month went
- Any evaluations or notes available (if teacher has added any)
- Upsell: relevant additional classes if student is enrolled in only one
  (e.g., if enrolled in ballet only, suggest jazz or conditioning)
- Link to book a private lesson if interested

### 5.4 Suppression Rules

| Condition | Action |
|---|---|
| Student already received onboarding this season | Skip all emails |
| Trial outcome = `enrolled_front_desk` | Skip emails 1–2; send email 3+ with modified tone |
| Re-enrolling returning student (was enrolled prior season) | Skip emails 1–2; send email 3 (season overview) only |
| Student unenrolls within 3 days of enrollment | Cancel remaining sequence |
| Admin marks `suppress_onboarding = true` on enrollment | Cancel all emails |

```sql
-- Additional field on enrollments table:
suppress_onboarding     BOOLEAN DEFAULT false,
onboarding_sequence_id  TEXT,    -- Klaviyo sequence ID for cancellation
onboarding_sent_at      TIMESTAMPTZ,
```

### 5.5 Admin Review Interface
Before any Angelina-generated onboarding email sends:
- Admin sees a preview in Admin → Enrollment → Onboarding Queue
- Each pending email shows: student name, email number, generated content, send time
- Admin can: Approve as-is | Edit and approve | Skip this email | Cancel all
- If not reviewed within 2 hours: email sends automatically (configurable)
- Amanda can configure auto-approve = true per email number in settings

---

## 6. Existing Student Re-Enrollment

### 6.1 Placement Logic
1. Previous level is the baseline
2. Annual evaluation (teacher-completed near year end) recommends next level
3. AI bulk placement: Amanda prompts Angelina to draft placements for all returning students
4. Amanda reviews draft list, adjusts, approves
5. Parent receives placement notification; confirms and pays registration fee

### 6.2 Annual Evaluation
See `docs/STUDENT_EVALUATIONS.md` for the full evaluation system spec.
The evaluation produces a `placement_next_season` recommendation used here.

### 6.3 Angelina Bulk Placement Prompt
Amanda opens Admin → Enrollment → Class Placement and types:
"Place all returning students for Fall 2026 based on this year's evaluations.
Prioritize retention. Flag anyone who needs a level change discussion."

Angelina reads evaluations, attendance records, and class schedules,
then outputs a draft placement table with confidence levels and flags.

### 6.4 Early Access Window

```sql
CREATE TABLE enrollment_windows (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  school_year               TEXT NOT NULL,
  returning_open_at         TIMESTAMPTZ NOT NULL,
  returning_close_at        TIMESTAMPTZ NOT NULL,
  public_open_at            TIMESTAMPTZ NOT NULL,
  public_close_at           TIMESTAMPTZ,
  earlybird_discount_type   TEXT CHECK (earlybird_discount_type IN ('percent', 'amount')),
  earlybird_discount_value  NUMERIC(10,2),
  earlybird_applies_to      TEXT CHECK (earlybird_applies_to IN (
                              'registration_fee', 'first_month'
                            )),
  created_by                UUID REFERENCES profiles(id),
  created_at                TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Adult Student Self-Registration

Adults (18+) enrolling themselves:
1. Light intake: name, goals, schedule, injuries/limitations
2. AI recommends adult-appropriate classes
3. Can go straight to registration — trial available if class is trial-eligible
4. Billing is under their own account (not a family/parent account)
5. Same enrollment wizard as Path C

---

## 8. Admin Direct Enrollment

Admin can enroll any student directly from:
- Admin → Students → [Student] → Profile → Add to Class
- Admin → Classes → [Class] → Enrolled Students → Add Student

At enrollment, system:
1. Shows billing plan check (unlimited? credits? per-class?)
2. Admin selects enrollment_type: paid / trial / comp / staff / bundle
3. Admin can override billing plan
4. Enrollment is immediate — payment handled separately
5. System generates billing record; Finance Admin processes payment
6. Onboarding sequence can be suppressed via checkbox: "Student already onboarded"

---

## 9. "Add to Class" Modal (Admin-Side)

When admin adds a student to a class from the student profile:

**Step 1 — Class selection:**
- Search/filter classes
- Shows: class name, day/time, capacity remaining, trial eligibility

**Step 2 — Billing plan check (automatic):**
System shows one of:
- ✅ "Covered by unlimited plan — no charge"
- 🎟 "Student has [N] credits — this class costs [X] points. [N–X] remaining."
- 💳 "No plan or credits. Charge: $[X]. Select payment method."

**Step 3 — Enrollment type selection:**
- Full enrollment
- Trial (if class is trial-eligible and student has not trialed before)
- Comp (Finance Admin+ only)
- Staff (Finance Admin+ only)

**Step 4 — Confirm:**
- Summary: student name, class, billing impact, type
- "Suppress onboarding emails" checkbox
- Confirm button

---

## 10. Family Account Structure

```sql
CREATE TABLE families (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  primary_contact_id  UUID REFERENCES profiles(id),
  family_name         TEXT,
  billing_email       TEXT,
  billing_phone       TEXT,
  stripe_customer_id  TEXT,
  account_credit      NUMERIC(10,2) DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL REFERENCES tenants(id),
  family_id                     UUID NOT NULL REFERENCES families(id),
  user_id                       UUID REFERENCES profiles(id),
  first_name                    TEXT NOT NULL,
  last_name                     TEXT NOT NULL,
  date_of_birth                 DATE NOT NULL,
  gender                        TEXT,
  medical_notes                 TEXT,
  allergy_notes                 TEXT,
  photo_consent                 BOOLEAN DEFAULT false,
  stream_consent                BOOLEAN DEFAULT false,
  approved_stream_contacts      JSONB,
  current_level                 TEXT,
  prior_studio                  TEXT,
  prior_training_years          INTEGER,
  placement_review_required     BOOLEAN DEFAULT false,
  placement_reviewed_by         UUID REFERENCES profiles(id),
  placement_reviewed_at         TIMESTAMPTZ,
  placement_review_notes        TEXT,
  trial_used                    BOOLEAN DEFAULT false,       -- legacy field, use trial_history
  trial_approved_override       BOOLEAN DEFAULT false,
  portal_access_enabled         BOOLEAN DEFAULT false,
  portal_access_approved_by     UUID REFERENCES profiles(id),
  portal_access_approved_at     TIMESTAMPTZ,
  portal_access_level           TEXT DEFAULT 'view_only' CHECK (portal_access_level IN (
                                  'view_only', 'standard', 'full'
                                )),
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);
```

---

## 11. Cancellation & Drop Policy

- **30-day written notice required**
- No mid-month refund unless overridden by Finance Admin+
- Future credit (to family account) at Admin discretion
- When dropped:
  1. `enrollments.status` → 'dropped'
  2. Future tuition charges cancelled
  3. Admin task created: "Student [name] dropped [class] — confirm final billing"

---

## 12. Enrollments Table (Authoritative Schema)

```sql
CREATE TABLE enrollments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  student_id                UUID NOT NULL REFERENCES students(id),
  family_id                 UUID NOT NULL REFERENCES families(id),
  class_id                  UUID NOT NULL REFERENCES classes(id),
  enrollment_type           TEXT NOT NULL DEFAULT 'full' CHECK (enrollment_type IN (
                              'full', 'trial', 'audit', 'comp', 'staff'
                            )),
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                              'active', 'dropped', 'completed',
                              'suspended', 'pending_payment', 'waitlisted'
                            )),
  billing_plan_type         TEXT CHECK (billing_plan_type IN (
                              'per_class', 'bundle', 'unlimited', 'comp', 'staff'
                            )),
  enrolled_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by               UUID REFERENCES profiles(id),
  drop_date                 DATE,
  drop_reason               TEXT,
  drop_approved_by          UUID REFERENCES profiles(id),
  cancellation_notice_date  DATE,
  billing_override          BOOLEAN DEFAULT false,
  override_amount           NUMERIC(10,2),
  override_reason           TEXT,
  override_by               UUID REFERENCES profiles(id),
  suppress_onboarding       BOOLEAN DEFAULT false,
  onboarding_sequence_id    TEXT,
  onboarding_sent_at        TIMESTAMPTZ,
  proration_method          TEXT CHECK (proration_method IN (
                              'per_class', 'daily', 'split', 'custom', 'none'
                            )),
  prorated_amount           NUMERIC(10,2),
  proration_override        BOOLEAN DEFAULT false,
  proration_override_by     UUID REFERENCES profiles(id),
  proration_override_reason TEXT,
  stripe_payment_intent_id  TEXT,
  amount_paid_cents         INTEGER,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);
```

---

## 13. Phase Implementation Order

### Phase 1 — Core Registration
- [ ] Family + student + enrollment tables
- [ ] Enrollment wizard (Path C — straight registration)
- [ ] Admin direct enrollment with billing plan check modal
- [ ] Trial class booking with roster tag + trial_history table
- [ ] Registration fee payment (BILLING_AND_CREDITS.md Phase 1)
- [ ] Welcome email trigger on enrollment confirm

### Phase 2 — Trial System & Abuse Detection
- [ ] trial_history table
- [ ] Trial abuse detection logic
- [ ] Front-desk enrollment suppression (outcome = enrolled_front_desk)
- [ ] Post-trial follow-up sequence (Angelina) with suppression checks
- [ ] Super Admin approval for second trials
- [ ] Family pattern detection (3+ unconverted trials)

### Phase 3 — Angelina-Personalized Onboarding
- [ ] Onboarding email generation via Angelina API
- [ ] Admin review queue for generated emails
- [ ] Suppression rules engine
- [ ] Advanced dancer / transfer student path
- [ ] 30-day check-in + upsell email

### Phase 4 — Re-Enrollment & AI Placement
- [ ] Annual evaluation → placement pipeline (see STUDENT_EVALUATIONS.md)
- [ ] Angelina bulk placement prompt + draft output
- [ ] Amanda approval flow → parent notification
- [ ] Enrollment windows with early access + earlybird pricing

### Phase 5 — Advanced
- [ ] Schedule optimization modeling
- [ ] Retention prediction per student
- [ ] Marketing audience sync on enrollment events
