# REGISTRATION_AND_ONBOARDING.md
# Ballet Academy and Movement — Registration & Onboarding Spec
# Version: 2.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026

---

## 1. Overview

Registration at BAM is not a single flow — it is a set of distinct
experiences based on who is registering and what they already know
about the studio. The system must feel effortless for every user type
while preserving Amanda's ability to control placement, quality, and
culture.

Cross-references:
- BILLING.md — fees, tuition, proration, payment processing
- SCHEDULING_AND_LMS.md — class records, enrollment counts, trial eligibility
- COMMUNICATIONS.md — welcome sequences, Angelina follow-up
- CHATBOT_AND_LEAD_CAPTURE.md — Angelina conversation flows
- MARKETING_INTEGRATIONS.md — audience sync on registration events

---

## 2. User Types & Their Experiences

| User Type | Path | Key Difference |
|---|---|---|
| New family (child student) | Discovery → Survey → Trial → Register | AI-guided placement, trial first |
| New adult student | Discovery → Light survey → Register | Can go straight to registration |
| Existing family re-enrolling | Portal → Review placement → Confirm → Pay | Previous level + annual eval drives placement |
| Admin enrolling a student | Admin → Select student → Select class → Enroll | Direct enrollment, no wizard |
| Walk-in / phone inquiry | Angelina or Admin creates lead record | Captured, nurtured into registration |

---

## 3. New Family — Primary Flow

### 3.1 Entry Points
New families can enter registration from multiple places:
- Website chatbot (Angelina)
- Website "Enroll Now" button
- Direct URL from ad campaign
- QR code from in-studio or printed marketing

### 3.2 Path A — Angelina Chat-Guided (default for website visitors)
1. Angelina greets visitor, asks about their child (age, experience,
   goals, schedule)
2. Based on responses, Angelina recommends 1–3 classes
3. For trial-eligible classes: "Would you like to book a free trial?"
4. For non-level or beginner classes: "Ready to register now?" —
   can bypass trial entirely
5. Parent enters contact info → lead record created in CRM
6. If trial: trial session booked, confirmation sent
7. If direct registration: flows into enrollment wizard (Section 3.4)

### 3.3 Path B — Intake Survey → AI Recommendation → Trial/Register
For parents who prefer self-service over chat:
1. Parent fills out intake survey:
   - Child's name and date of birth
   - Prior dance experience (none / some / trained)
   - Goals (fun & confidence / serious training / both)
   - Schedule availability (days/times)
   - How they heard about BAM
2. AI (Angelina API) processes survey + compares to available classes
3. AI returns 1–3 recommended classes with reasoning
   ("Based on Maya's age and no prior experience, we recommend...")
4. Parent sees recommendation card per class:
   - Simple name, days/times, teacher, room
   - Trial available badge (if eligible)
   - "Book Trial" or "Register Now" CTA
5. Parent selects their path

### 3.4 Path C — Straight Registration (beginner / non-level classes)
For classes where trial is not required or where parent already knows
what they want:
1. Parent browses available classes filtered by:
   - Age of child
   - Day/time preference
   - Class type
2. Selects class → enrollment wizard:
   - Step 1: Student info (name, DOB, any health/allergy notes)
   - Step 2: Parent/guardian info
   - Step 3: Emergency contacts + approved stream contacts
   - Step 4: Registration fee payment (unless waived)
   - Step 5: Confirm enrollment
3. Confirmation email + welcome sequence triggers in Klaviyo

### 3.5 Trial Class Rules
- One free trial per student — enforced by system (checks student email/DOB)
- Second trial requires Super Admin approval (Amanda)
- Trial student appears on session roster tagged [TRIAL]
- Trial session is not charged
- Trial does NOT require registration fee — fee is due only on full enrollment
- After trial: Angelina sends follow-up sequence (see Section 3.6)
- If `trial_requires_approval = true` on the class: Admin reviews and
  confirms the trial booking before parent receives confirmation

### 3.6 Post-Trial Follow-Up (Angelina Sequence)
Triggered automatically after trial session attendance is confirmed:

| Timing | Action |
|---|---|
| Same day (after class) | Angelina sends warm follow-up: "How did Maya enjoy her class today?" |
| Day 2 | Email: what to expect in the full program, Amanda's philosophy |
| Day 4 | SMS or in-app: "Ready to save Maya's spot? Registration is open." |
| Day 7 | Final follow-up: limited spots note if class is near capacity |
| Day 14 | Admin task created: "Trial student [name] has not registered — follow up" |

---

## 4. Existing Student Re-Enrollment

### 4.1 Placement Logic
Existing students are NOT placed manually by Amanda for every student
every year. The system uses a structured progression:

1. **Previous level** is the baseline — a student in Ballet II is
   assumed to continue in Ballet II unless changed
2. **Annual evaluation** (conducted by teacher near year end) can
   recommend advancement, hold, or level change
3. **AI recommendation** — Amanda can prompt Angelina in bulk:
   "Based on this year's evaluations and attendance, recommend
   class placements for all returning students for Fall 2026"
4. Angelina outputs a draft placement list showing:
   - Student name
   - Current class / level
   - Recommended class / level for next year
   - Reasoning (evaluation score, attendance rate, teacher note)
   - Confidence level (high / medium / needs review)
5. Amanda reviews the draft list, adjusts individual placements,
   and approves in bulk or one by one
6. Once Amanda approves: parent receives placement notification
   in portal and via email
7. Parent confirms enrollment and pays registration fee

### 4.2 Annual Evaluation
Teachers complete evaluations per student near year end:

```sql
student_evaluations (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  student_id        uuid FK users,
  class_id          uuid FK classes,
  evaluator_id      uuid FK users,        -- teacher
  school_year       text,                 -- "2025-2026"
  technical_score   integer,              -- 1-5
  musicality_score  integer,
  performance_score integer,
  attendance_rate   numeric,              -- computed from session_attendance
  teacher_notes     text,
  recommended_level text,                 -- from BALLET_DOMAIN.md taxonomy
  recommended_class_ids uuid[],          -- specific classes for next year
  approved_by       uuid FK users,        -- Amanda
  approved_at       timestamptz,
  created_at        timestamptz default now()
)
```

### 4.3 Angelina Bulk Placement
Amanda opens Admin → Enrollment → Class Placement and types:
"Place all returning students for Fall 2026 based on this year's
evaluations. Prioritize retention. Flag anyone who needs a level
change discussion."

Angelina:
- Reads all evaluations for the current school year
- Reads each student's attendance record
- Reads current class schedules for next year
- Outputs a draft placement table (list + calendar view)
- Flags students needing discussion with reason
- Outputs room utilization model (is Studio A overbooked on Mondays?)

Amanda reviews, adjusts, approves. System sends notifications.

### 4.4 Early Access Window
Returning families get a registration window before the public:
- Admin sets: early access open date, early access close date,
  public open date
- Early access families may also receive earlybird pricing
  (discounted registration fee or tuition — Admin configures)
- System enforces: returning families can only enroll during their
  window; new families cannot register until public open date

```sql
enrollment_windows (
  id                    uuid PK,
  tenant_id             uuid FK tenants,
  school_year           text,
  returning_open_at     timestamptz,
  returning_close_at    timestamptz,
  public_open_at        timestamptz,
  public_close_at       timestamptz nullable,
  earlybird_discount_type text,           -- 'percent' or 'amount'
  earlybird_discount_value numeric(10,2),
  earlybird_applies_to  text,             -- 'registration_fee' or 'first_month'
  created_by            uuid FK users,
  created_at            timestamptz default now()
)
```

---

## 5. Adult Student Self-Registration

Adult students (18+) enrolling themselves:
1. Light intake: name, goals, schedule preference, any injuries/limitations
2. AI recommends classes appropriate for adults
3. Can go straight to registration — no trial required (but trial available
   if the class is trial-eligible)
4. Billing is under their own account (not a family/parent account)
5. Same enrollment wizard as Path C (Section 3.4)

---

## 6. Admin Direct Enrollment

Admin can enroll any student in any class directly:
- Admin → Schedule → Classes → [Class] → Enrolled Students → Add Student
- Search existing students or create new student record
- Select enrollment type: Full / Trial / Audit (observe only)
- Set billing override if needed (scholarship, comp, custom rate)
- Enrollment is immediate — no payment wizard required
- System still generates billing record; Finance Admin processes payment

---

## 7. Family Account Structure

One family account can hold multiple student profiles.
Billing is consolidated under the family account.

```sql
families (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  primary_contact_id uuid FK users,     -- parent/guardian account
  family_name     text,                 -- "The Johnson Family"
  billing_email   text,
  billing_phone   text,
  stripe_customer_id text,              -- or adapter equivalent
  account_credit  numeric(10,2) default 0, -- studio credit balance
  notes           text,                 -- internal Admin notes
  created_at      timestamptz default now()
)

students (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  family_id       uuid FK families,
  user_id         uuid FK users nullable, -- if student has portal login
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  date_of_birth   date NOT NULL,
  gender          text,
  medical_notes   text,
  allergy_notes   text,
  photo_consent   boolean default false,
  stream_consent  boolean default false,
  approved_stream_contacts jsonb,       -- [{name, relationship, phone, email}]
  current_level   text,                 -- from BALLET_DOMAIN.md taxonomy
  trial_used      boolean default false,
  trial_approved_override boolean default false, -- Amanda approved 2nd trial
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)

enrollments (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  student_id      uuid FK students,
  family_id       uuid FK families,
  class_id        uuid FK classes,
  enrollment_type text CHECK IN ('full','trial','audit','comp'),
  status          text CHECK IN ('active','dropped','completed',
                    'suspended','pending_payment'),
  enrolled_at     timestamptz,
  enrolled_by     uuid FK users,
  drop_date       date nullable,
  drop_reason     text nullable,
  drop_approved_by uuid FK users nullable,
  cancellation_notice_date date nullable, -- 30-day notice start
  billing_override boolean default false,
  override_amount numeric(10,2) nullable,
  override_reason text nullable,
  override_by     uuid FK users nullable,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

---

## 8. Cancellation & Drop Policy

- **30-day written notice required** to cancel enrollment
- No mid-month refund unless overridden by Finance Admin or above
- Future credit (applied to family account balance) is available
  at Admin discretion
- Cancellation notice date is logged; system calculates final billing date
- Override (waive notice period) requires Finance Admin or above
- When a student is dropped:
  1. `enrollments.status` → 'dropped'
  2. `enrollments.drop_date` logged
  3. Future tuition charges cancelled in billing system
  4. If mid-month: no refund generated unless override applied
  5. Admin task created: "Student [name] dropped [class] — confirm
     final billing and any credit to apply"

---

## 9. AI Learning from Enrollment History

The system accumulates enrollment, attendance, advancement, and
retention data year over year. Angelina uses this to:

### 9.1 Placement Intelligence
- Which students advanced? What were their attendance rates?
- Which level transitions had the highest retention?
- Which class combinations correlate with long-term retention?

### 9.2 Schedule Optimization
When Amanda asks Angelina to model next year's schedule:
- "Which classes are consistently underenrolled? Should we consolidate?"
- "Studio A is booked 6 days a week — what can move to Studio B?"
- "If we add a Wednesday Petites class, how many students might fill it
  based on inquiry patterns?"

### 9.3 AI Data Inputs for Recommendations
| Signal | Weight |
|---|---|
| Student's current level | High |
| Annual evaluation scores | High |
| Attendance rate this year | High |
| Teacher recommendation | High |
| Number of years enrolled | Medium |
| Classes dropped in prior years | Medium |
| Trial → enrollment conversion pattern | Medium |
| Parent-stated goals (from intake survey) | Medium |

### 9.4 Output Formats
Angelina outputs placement and schedule recommendations in:
- **List view** — table of students, current class, recommended class
- **Calendar/grid view** — draft schedule by day/time/room
- **Flagged list** — students needing Admin discussion
- **Room utilization model** — occupancy % per room per time slot

---

## 10. Phase Implementation Order

### Phase 1 — Core Registration
- [ ] Family + student + enrollment tables
- [ ] Enrollment wizard (Path C — straight registration)
- [ ] Admin direct enrollment
- [ ] Trial class booking with [TRIAL] roster tag
- [ ] Registration fee payment integration (BILLING.md)
- [ ] Welcome email trigger on enrollment confirm

### Phase 2 — New Family Flow
- [ ] Intake survey → AI class recommendation
- [ ] Angelina post-trial follow-up sequence
- [ ] Lead record creation for unconverted inquiries
- [ ] Enrollment windows (early access + earlybird pricing)

### Phase 3 — Re-Enrollment & AI Placement
- [ ] Annual evaluation form for teachers
- [ ] Angelina bulk placement prompt + draft output
- [ ] List view + calendar view for placement draft
- [ ] Amanda approval flow → parent notification
- [ ] AI learning model (enrollment history analysis)

### Phase 4 — Advanced
- [ ] Schedule optimization modeling
- [ ] Room utilization dashboard
- [ ] Retention prediction per student
- [ ] Marketing audience sync on enrollment events (MARKETING_INTEGRATIONS.md)

---

## 11. Policy Decisions (Resolved)

### Student Portal Access — Any Age, Admin-Approved
- Students of any age can have their own portal login
- Access requires explicit Admin approval (not automatic)
- A parent submits the request or Admin creates it directly
- Student portal is a restricted view — content is age/role appropriate:
  - Young students (e.g., under 10): view their dances, performance
    videos, badges earned. Read-only. No messaging.
  - Older students (10–17): schedule view, class videos, badges,
    limited communications (class channels only, no DMs with teachers)
  - Adult students (18+): full student portal equivalent to parent view
    for their own account
- Parent account retains full visibility into their child's portal
  activity at all times
- Admin can revoke student portal access at any time
- Student login is separate credentials from parent login
- On a shared family device: student can log into their own account
  without accessing parent's account or billing information

```sql
-- Additional fields on students table:
portal_access_enabled     boolean default false,
portal_access_approved_by uuid FK users nullable,
portal_access_approved_at timestamptz nullable,
portal_access_level       text CHECK IN (
                            'view_only',      -- dances, videos, badges
                            'standard',       -- + schedule, class channels
                            'full'            -- adult students
                          ) default 'view_only',
```

### Emergency Contacts vs. Approved Stream Contacts
Both contact lists are tied to the **family record** (not individual
students). This means one family maintains one set of contacts shared
across all their enrolled students.

However, **stream contact authorization is scoped per student** —
Grandma can be approved to receive stream alerts for Maya's Nutcracker
performance but not for her younger sibling who isn't performing yet.

**Emergency Contacts (family-level)**
- People to call if a student is injured, ill, or needs to be picked up
- Not notified about livestreams
- Visible to teachers and Admin during class sessions
- Required minimum: 1 emergency contact beyond primary parent

**Approved Stream Contacts (family-level list, student-level authorization)**
- People authorized to receive livestream alert notifications
- Separate from emergency contacts entirely
- Primary parent is included by default (can be removed)
- Additional contacts added by primary parent or Admin
- Each contact specifies which students they're authorized for
- Notification channels per contact: in-app, SMS, email (their preference)

```sql
family_contacts (
  id                  uuid PK,
  tenant_id           uuid FK tenants,
  family_id           uuid FK families,
  contact_type        text CHECK IN ('emergency','stream','both'),
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  relationship        text,               -- "Grandmother", "Aunt", etc.
  phone               text,
  email               text,
  has_portal_account  boolean default false,
  user_id             uuid FK users nullable, -- if they have a portal login
  notify_via_sms      boolean default true,
  notify_via_email    boolean default true,
  notify_via_app      boolean default false,
  is_primary          boolean default false,
  -- Stream authorization is per-student (stored as array of student IDs)
  stream_authorized_student_ids uuid[],   -- which students they get alerts for
  created_by          uuid FK users,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
)
```

**Rules:**
- Emergency contacts: visible to teachers during check-in
- Stream contacts: only used by the livestream alert system
- Admin can view and edit both lists
- Primary parent can add/edit stream contacts for their own family
- Teachers cannot see stream contact lists
- A contact with `contact_type = 'both'` appears on both lists
