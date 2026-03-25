# PRIVATE_LESSONS.md
# Ballet Academy and Movement — Private Lesson System Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

Private lessons at BAM are currently managed via Band (a group calendar app).
This module replaces Band with a native private lesson system that:

- Replicates the familiar Band scheduling workflow for teachers
- Adds parent visibility (currently zero in Band)
- Adds billing automation via the credit/point system
- Shows the full market value of sessions where Amanda or teachers
  contribute discounted or free time — so parents appreciate BAM's value
- Supports open-slot self-booking by approved parents
- Syncs to Google Calendar, Apple Calendar, and Outlook

Cross-references:
- BILLING_AND_CREDITS.md — credit/point system, bundle packs, split billing
- SCHEDULING_AND_LMS.md — class sessions, studio resources
- COMMUNICATIONS_PRIVATE_FEED.md — teacher feed notifications
- ANGELINA.md — voice/text dictation for private logging

---

## 2. Private Session Types

| Type | Students | Description |
|---|---|---|
| Solo | 1 | One student, one teacher |
| Duet | 2 | Two students, cost split by default |
| Small group | 3–6 | Multiple students, cost split equally by default |
| Pilates | 1–4 | Pilates-specific session, different point cost |
| Hybrid | 1+ | Mixed session (e.g. 30 min ballet + 30 min Pilates) |

---

## 3. Scheduling — Who Can Create Privates

### 3.1 Teacher Self-Service (Primary)
Teachers create privates directly from their portal — same flow as Band,
but structured. This is the most common creation path.

### 3.2 Admin
Admin can create privates on behalf of any teacher for any student.

### 3.3 Angelina Dictation
Teachers dictate to Angelina via voice or text:
"Angelina, I have a private with Morgan tomorrow at 3pm in studio 1,
one hour. Split billing with Izzy."
Angelina extracts: students, time, studio, duration, billing split,
confirms with teacher, and creates the session.

### 3.4 Parent Self-Booking (Open Slots)
A teacher can publish open availability slots on their calendar.
Admin must approve the teacher for parent self-booking.
Only admin-approved parent/student combinations can book with that teacher.

Flow:
1. Teacher publishes open slots in Teacher Portal → My Availability
2. Admin enables self-booking for specific teacher: Admin → Teachers → [Name] → Allow parent booking
3. Admin sets which students/families are approved to book with this teacher
4. Approved parent sees "Book a Private" on their portal for that teacher
5. Parent selects open slot, selects student, confirms
6. Teacher receives notification and can confirm or decline within 2 hours
7. If not responded: auto-confirms (configurable per teacher)
8. Once confirmed: both parties receive calendar invite, billing triggers

```sql
CREATE TABLE teacher_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  teacher_id      UUID NOT NULL REFERENCES profiles(id),
  day_of_week     INTEGER,           -- 0=Sun, 1=Mon...6=Sat (recurring)
  specific_date   DATE,              -- for one-off slots
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_recurring    BOOLEAN DEFAULT false,
  slot_type       TEXT DEFAULT 'private' CHECK (slot_type IN (
                    'private', 'pilates', 'any'
                  )),
  max_students    INTEGER DEFAULT 1,
  is_published    BOOLEAN DEFAULT false,  -- visible to approved parents
  is_booked       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teacher_booking_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  teacher_id      UUID NOT NULL REFERENCES profiles(id),
  family_id       UUID NOT NULL REFERENCES families(id),
  student_ids     UUID[],            -- specific students approved (null = all family students)
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT
);
```

---

## 4. Private Session Data Model

```sql
CREATE TABLE private_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  session_type        TEXT NOT NULL CHECK (session_type IN (
                        'solo', 'duet', 'group', 'pilates', 'hybrid'
                      )),

  -- Scheduling
  session_date        DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  duration_minutes    INTEGER,
  studio              TEXT,              -- "Studio 1", "Studio 2", "Studio 3"
  location_notes      TEXT,

  -- Students
  student_ids         UUID[] NOT NULL,   -- one or more

  -- Teachers (supports multiple teachers per session)
  primary_teacher_id  UUID NOT NULL REFERENCES profiles(id),
  co_teacher_ids      UUID[],            -- additional teachers

  -- Billing
  session_rate        NUMERIC(10,2),     -- full market rate for session
  billing_model       TEXT NOT NULL DEFAULT 'split_equal' CHECK (billing_model IN (
                        'split_equal',   -- divide equally among students
                        'split_custom',  -- custom percentage per student
                        'full_per_student', -- each student pays full rate
                        'comp',          -- no charge
                        'bundle'         -- deduct from credit pack
                      )),
  billing_status      TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN (
                        'pending', 'billed', 'paid', 'waived', 'partial'
                      )),

  -- Value display (for parent appreciation view)
  market_rate         NUMERIC(10,2),     -- what this session would normally cost
  studio_contribution NUMERIC(10,2),     -- difference between market_rate and session_rate
  contribution_note   TEXT,              -- e.g. "Amanda is teaching this session at a reduced rate"

  -- Recurrence
  is_recurring        BOOLEAN DEFAULT false,
  recurrence_rule     TEXT,              -- rrule string (e.g. FREQ=WEEKLY;BYDAY=WE)
  recurrence_parent_id UUID REFERENCES private_sessions(id), -- links instances to parent

  -- Status
  status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                        'scheduled', 'confirmed', 'completed',
                        'cancelled', 'no_show', 'rescheduled'
                      )),
  cancellation_reason TEXT,
  cancelled_by        UUID REFERENCES profiles(id),
  cancelled_at        TIMESTAMPTZ,

  -- Booking source
  booking_source      TEXT NOT NULL DEFAULT 'teacher' CHECK (booking_source IN (
                        'teacher',       -- teacher created in portal
                        'admin',         -- admin created
                        'parent',        -- parent booked open slot
                        'angelina'       -- Angelina dictation
                      )),
  availability_slot_id UUID REFERENCES teacher_availability(id),

  -- Notes
  session_notes       TEXT,             -- teacher notes (internal)
  parent_visible_notes TEXT,            -- shown to parents

  -- Calendar sync
  google_event_id     TEXT,
  ical_uid            TEXT,

  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Billing Split Model

### 5.1 Per-Student Billing Records

Each student in a private session has their own billing record:

```sql
CREATE TABLE private_session_billing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  session_id        UUID NOT NULL REFERENCES private_sessions(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id),
  family_id         UUID NOT NULL REFERENCES families(id),

  -- What they owe
  split_percentage  NUMERIC(5,2),       -- e.g. 50.00 for 50%
  amount_owed       NUMERIC(10,2),      -- calculated from session_rate × split_percentage
  points_owed       NUMERIC(10,2),      -- credit points to deduct

  -- What market value was (for appreciation display)
  market_value      NUMERIC(10,2),      -- their share of full market rate
  studio_contribution NUMERIC(10,2),    -- market_value - amount_owed (BAM's contribution)

  -- Teacher contribution per student (if teacher is discounting their rate)
  teacher_contribution NUMERIC(10,2),
  teacher_contribution_note TEXT,

  -- Payment status
  billing_status    TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN (
                      'pending', 'billed', 'paid', 'waived', 'deducted_from_pack'
                    )),
  payment_method    TEXT CHECK (payment_method IN (
                      'card', 'cash', 'credit_pack', 'comp'
                    )),
  paid_at           TIMESTAMPTZ,
  transaction_id    TEXT,
  credit_transaction_id UUID REFERENCES credit_transactions(id),

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, student_id)
);
```

### 5.2 Split Calculation Logic

**Equal split (default):**
```
amount_per_student = session_rate / number_of_students
points_per_student = amount_per_student / credit_rate
```

**Custom split:**
Admin or teacher sets `split_percentage` per student manually.
System validates percentages sum to 100%.

**Multiple teachers:**
If a session has co-teachers, each teacher's rate contribution is tracked
separately. One teacher may charge their standard rate; Amanda may waive
hers entirely. The system records:
- Total market rate (all teachers at standard rates)
- Actual charge to families (after teacher discounts)
- Studio/teacher contribution (difference)

### 5.3 Bundle Pack Deduction
If a student has an active credit pack that covers private lessons:
1. System checks `credit_accounts` for sufficient balance
2. Deducts `points_owed` from the pack
3. Creates `credit_transaction` record with type = 'charge'
4. Sets `billing_status = 'deducted_from_pack'`
5. Parent portal shows: "Deducted from your 10-class pack — 7 remaining"

---

## 6. Amanda's Value Display

When Amanda (or any teacher) teaches a session at a reduced rate or free,
the parent-facing view shows the full value of what they received:

**Example display on parent portal:**
```
Private Session — Wednesday March 25
Studio 1 · 1:00 PM – 2:00 PM · 60 min

Teacher: Amanda Cobb

Full session value:     $150.00
Your rate today:         $75.00
BAM contribution:        $75.00  ← highlighted in lavender

"Amanda is personally investing in [student name]'s development."
```

**How this is calculated:**
- `market_rate` = what this session would cost at standard rates
- `session_rate` = what the family is actually being charged
- `studio_contribution` = `market_rate - session_rate`
- This is displayed whenever `studio_contribution > 0`

**Admin controls:**
- Admin sets `market_rate` per teacher per session type in Teacher Settings
- Teacher can set a custom rate at session creation (override)
- `contribution_note` field allows a custom message per session
  (e.g. "Amanda is gifting this session as part of the performance season")
- Toggle: show/hide contribution display per tenant (default: show)

```sql
CREATE TABLE teacher_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  teacher_id      UUID NOT NULL REFERENCES profiles(id),
  session_type    TEXT NOT NULL,          -- solo, duet, group, pilates
  market_rate_60  NUMERIC(10,2),          -- 60-minute market rate
  market_rate_45  NUMERIC(10,2),
  market_rate_30  NUMERIC(10,2),
  standard_rate_60 NUMERIC(10,2),         -- what BAM normally charges families
  standard_rate_45 NUMERIC(10,2),
  standard_rate_30 NUMERIC(10,2),
  point_cost      INTEGER DEFAULT 2,      -- points per session (from BILLING spec)
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Teacher Feed Notifications

Replicating Band's group notification model — all teachers see a feed post
when a new private is created.

**On session creation:**
- Feed post created in the BAM Privates channel (Communications module)
- Format: "[Student first name] [session type] [studio] — [date] [time]"
- If recurring: "(recurring)" appended
- Created by: teacher who scheduled it (or "Admin" if admin-created)

**Example feed posts (matching Band's current naming):**
- "Gillies solo Studio 2 — Wed Mar 25 1:30–2:30 PM"
- "Coco Kimbley solo Studio 3 — Wed Mar 25 2:30–3:00 PM (Deborah)"
- "Kaya private Studio 1 / Pilates last 30 — Wed Mar 25 2:30–4:00 PM (recurring)"
- "Coco K & Evie S duet Studio 3 — Wed Mar 25 3:00–3:30 PM (recurring)"

**Who sees the feed:**
- All teachers with access to the BAM Privates channel
- Admin
- Parents do NOT see this feed (they have their own notification — see Section 8)

---

## 8. Parent Notifications

Parents currently have zero visibility into when their child's private
is scheduled (all managed in Band without parent access). This changes.

**When a private is created or confirmed:**
- Parent receives in-app notification: "A private lesson has been scheduled
  for [student name] on [date] at [time] in [studio]."
- Email notification with session details
- Calendar invite sent to parent's connected calendar

**Parent portal view:**
- Student profile → Schedule tab shows upcoming privates alongside regular classes
- Each private shows: date, time, studio, teacher, session type, billing status
- If bundle pack: shows remaining credits
- If studio contribution: shows the value display (Section 6)

**Parent cancellation:**
- Parent can request cancellation from portal (subject to cancellation policy)
- Cancellation request goes to teacher for confirmation
- Late cancellation (< 24 hours): full charge may apply (configurable per teacher)

---

## 9. Calendar Sync

All private sessions sync to external calendars.

**What syncs:**
- Session date, time, studio
- Teacher name
- Student first name only (privacy)
- Session type

**Calendar categories:**
- All privates appear under "BAM Privates" calendar category
- Matches current Band calendar naming convention
- Color-coded teal (matching teacher portal color from SCHEDULING spec)

**Sync targets:**
- Google Calendar (OAuth per user)
- Apple Calendar / iCal (subscribe URL per user)
- Outlook (iCal feed)

**Who gets calendar events:**
| Role | Gets calendar event |
|---|---|
| Primary teacher | Yes |
| Co-teachers | Yes |
| Admin | Yes (if opted in) |
| Parent | Yes (on confirmation) |
| Student (if portal access) | Yes |

---

## 10. Recurring Private Management

### 10.1 Creating a Recurring Series
When creating a recurring private:
1. Teacher sets recurrence pattern: weekly / bi-weekly / custom
2. System generates all instances from start date to end of season
3. Each instance is a separate `private_sessions` row linked by `recurrence_parent_id`
4. Billing fires per-session (not in advance) unless a bundle pack is active

### 10.2 Editing a Recurring Series
Teacher/admin can:
- Edit this session only (detach from series)
- Edit this and all future sessions
- Cancel this session only
- Cancel entire remaining series

### 10.3 Bundle Pack + Recurring
If a student purchases a 10-session pack for recurring privates:
- Each session automatically deducts from the pack
- When pack runs low (2 sessions remaining): parent notified to purchase more
- If pack runs out mid-series: system creates invoice for remaining sessions
  at standard rate

---

## 11. Teacher Portal — Privates Interface

### 11.1 My Privates View
- Calendar view showing all their private sessions (week/month)
- List view sorted by date
- Quick create button: "+ New Private"

### 11.2 Create Private Form
Fields:
1. Student(s) — search and multi-select
2. Date and time
3. Duration — 30 / 45 / 60 / 90 min / custom
4. Studio — Studio 1 / Studio 2 / Studio 3 / Other
5. Session type — Solo / Duet / Group / Pilates / Hybrid
6. Co-teacher(s) — optional, multi-select
7. Recurring — toggle + pattern selector
8. Billing:
   - Rate (auto-populated from rate card, editable)
   - Split method (equal / custom)
   - If custom: percentage per student
   - Bundle pack check (auto-shown if student has active pack)
9. Notes (internal)
10. Parent-visible notes (optional)
11. Suppress parent notification toggle (for admin convenience)

### 11.3 Session Detail View
Shows:
- All session info
- Billing status per student
- Bundle pack remaining credits (if applicable)
- Studio contribution display (if applicable)
- Feed post that was generated
- Parent notification status

### 11.4 My Availability (Open Slots)
- Week view with time blocks
- Click to add open slot: time, duration, session type, max students
- Publish toggle (makes visible to approved parents)
- Booked slots shown as confirmed privates

---

## 12. Admin Private Management

### /admin/privates
- All privates across all teachers
- Filter: teacher, student, date range, status, billing status
- Quick stats: privates this week, pending billing, bundle packs active
- Export to CSV for payroll/billing review

### /admin/privates/rate-cards
- Set market rate and standard rate per teacher per session type
- Configure point_cost per teacher
- Enable/disable studio contribution display per teacher

### /admin/privates/booking-approvals
- Manage which parents are approved to self-book with which teachers
- Per-teacher, per-family, per-student granularity

---

## 13. Angelina — Private Lesson Dictation

Teachers can dictate privates to Angelina mid-stream:

**Example inputs:**
- "Angelina, schedule a private with Morgan tomorrow at 3pm, studio 1, one hour"
- "Angelina, I just finished a private with Izzy and Morgan — split billing between their families"
- "Angelina, cancel my private with Kaya on Thursday"
- "Angelina, make my Wednesday private with Ella recurring every week through June"

**Angelina extracts:**
- Student name(s) → matches to student records
- Date/time → resolves relative references ("tomorrow", "Thursday")
- Studio → infers from teacher's usual studio if ambiguous
- Duration → defaults to 60 min if not specified
- Billing split → equal by default, custom if specified
- Recurring → detects "every week", "recurring", etc.

**Angelina confirms before saving:**
"Got it — private with Morgan and Izzy in Studio 1, tomorrow 3:00–4:00 PM,
billing split 50/50. Shall I create this?"

**After teacher confirms:**
- Session created
- Feed post generated
- Parents notified
- Calendar invites sent

---

## 14. Reporting

### Teacher Reports
- My privates this month: count, total hours, total earnings
- Bundle pack usage by student
- Upcoming recurring sessions

### Admin / Finance Reports
- All privates by teacher: hours, revenue, contribution
- Studio contribution summary: total value contributed by Amanda/teachers
  vs total billed (shows BAM's investment in students)
- Bundle pack inventory: packs sold, credits remaining, expiring soon
- Unpaid private sessions

---

## 15. Phase Implementation Order

### Phase 1 — Core Private Scheduling
- [ ] private_sessions table
- [ ] private_session_billing table
- [ ] Teacher portal: create private form + my privates view
- [ ] Admin private management view
- [ ] Teacher feed notification on creation
- [ ] Parent notification on creation
- [ ] Google Calendar sync for private sessions
- [ ] iCal feed for private sessions

### Phase 2 — Billing Integration
- [ ] teacher_rate_cards table
- [ ] Studio contribution calculation + parent display
- [ ] Bundle pack auto-deduction at session creation
- [ ] Low pack balance notification to parent
- [ ] Invoice generation for non-pack sessions

### Phase 3 — Open Slot Booking
- [ ] teacher_availability table
- [ ] teacher_booking_approvals table
- [ ] Teacher publishes open slots
- [ ] Admin approves parents for self-booking
- [ ] Parent self-booking flow from portal
- [ ] Teacher confirmation / auto-confirm logic

### Phase 4 — Angelina Integration
- [ ] Natural language private creation via dictation
- [ ] Post-session billing logging via Angelina
- [ ] Cancellation and rescheduling via Angelina

### Phase 5 — Recurring + Advanced
- [ ] Recurring series management (edit one / edit all future)
- [ ] Bundle pack + recurring auto-deduction
- [ ] Reporting: studio contribution summary, bundle inventory
- [ ] Outlook calendar sync

---

## 16. Open Questions

- [ ] Cancellation policy per teacher — is it a flat 24-hour rule or
      configurable per teacher? (Recommend: configurable per teacher,
      set in rate card / teacher settings)
- [ ] When a co-teacher teaches at $0 (gifted session), does that
      teacher still get a timesheet entry showing $0, or is it excluded?
      (Recommend: yes — include at $0 so Amanda's contribution is tracked)
- [ ] Should parents be able to see the teacher's open availability
      before they're approved to book? (Recommend: no — availability
      only visible after admin grants approval)
- [ ] For hybrid sessions (e.g. 30 min ballet + 30 min Pilates) — is
      billing split by time segment at different point costs, or is one
      flat rate applied for the whole session?
      (Recommend: one flat rate set by teacher at session creation,
      with a note field for "30 min ballet / 30 min Pilates")
- [ ] Should the studio contribution display be visible to all parents
      by default, or only when the discount is above a threshold?
      (Recommend: show whenever contribution > $0, with Amanda's blessing)
