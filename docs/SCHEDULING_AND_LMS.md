# SCHEDULING_AND_LMS.md
# Ballet Academy and Movement — Scheduling & Learning Management System
# Version: 2.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026 — full vision consolidated

---

## 1. Overview

The Schedule is the central hub of the BAM platform. Nearly every other
module is downstream of it: timesheets auto-populate from sessions,
parent portals display class info, registrations attach to classes,
communications channels are auto-created per class, and curriculum
progress is tracked against sessions.

This spec covers:
- The Class entity and its four-layer naming system
- Class types: regular, rehearsal, performance, competition, private
- Session generation (recurring + exceptions)
- Student check-in per session
- Substitute teacher workflow
- Calendar sync and cancellation push
- Curriculum and skill linkage (LMS layer)

Cross-references:
- TEACHER_SCHEDULE_INTEGRATION.md — teacher calendar and timesheet auto-population
- TEACHER_TIME_ATTENDANCE.md — pay rates and timesheet entry types
- TEACHER_SUBSTITUTE_COVERAGE.md — substitute assignment workflow
- REGISTRATION_AND_ONBOARDING.md — enrollment attaches to classes
- COMMUNICATIONS.md — auto-channel creation per class
- BALLET_DOMAIN.md — curriculum levels, skill taxonomy, badge naming
- PERFORMANCE_COMPETITION_COSTS.md — rehearsal/performance cost tracking
- SAAS.md — all records scoped by tenant_id

---

## 2. Class Entity

A Class is the master record. It is not a single event — it is the
container that defines what is taught, who teaches it, who is enrolled,
and how sessions recur over the school year.

### 2.1 Four-Layer Naming System

Every class has four distinct name fields, each serving a different
audience and context:

| Field | Purpose | Example |
|---|---|---|
| `full_name` | Official internal name; includes all levels | "Ballet I / Ballet II — Technique — Monday 4:30pm" |
| `short_name` | Internal shorthand for staff and schedules | "Ballet I-II Tech Mon 4:30" |
| `simple_name` | Parent- and public-facing marketing name | "Ballet for Ages 6–9" |
| `display_name` | System default for UI labels; falls back to short_name if not set | "Ballet Technique — Monday" |

**Rules:**
- `full_name` is required; all others can be auto-generated from it
  but should be manually reviewed by Admin before publishing
- `simple_name` should never include level codes (Ballet I, II, etc.);
  it is marketing language for parents who don't know the level system
- `full_name` supports multi-level classes (e.g., combined Ballet I / II)

### 2.2 Full Class Schema

```sql
classes (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,

  -- Naming (four-layer system)
  full_name           text NOT NULL,       -- "Ballet I/II Technique — Mon 4:30pm"
  short_name          text,                -- "Bal I-II Tech Mon 4:30"
  simple_name         text,                -- "Ballet for Ages 6–9"
  display_name        text,                -- falls back to short_name

  -- Description
  short_description   text,                -- 1–2 sentences; used in cards/previews
  long_description    text,                -- full detail; used on class page, registration

  -- Classification
  class_type          text NOT NULL CHECK (class_type IN (
                        'regular',         -- weekly technique class
                        'rehearsal',       -- tied to a production
                        'performance',     -- the actual show/event
                        'competition',     -- competition event or prep
                        'private',         -- private lesson (1:1 or small group)
                        'workshop',        -- one-time or short series
                        'intensive'        -- summer or holiday intensive
                      )),
  program_division    text CHECK (program_division IN (
                        'petites',         -- ages 3–5
                        'company',         -- ages 6–12 technique
                        'advanced',        -- pre-professional
                        'adult',           -- adult classes
                        'competitive',     -- competition track
                        'other'
                      )),

  -- Levels (multi-level support)
  levels              text[],              -- ['Ballet I', 'Ballet II'] — from BALLET_DOMAIN.md taxonomy
  min_age             integer,             -- minimum recommended age
  max_age             integer,             -- maximum recommended age (null = no cap)

  -- Schedule window
  start_date          date NOT NULL,       -- first day of class (e.g., Sept 9 for fall)
  end_date            date NOT NULL,       -- last day of class (e.g., June 6 for spring)

  -- Location
  room                text,               -- "Studio A", "Studio B", "Main Stage"
  location_notes      text,               -- e.g., "use back entrance for Nutcracker rehearsals"

  -- Staff
  lead_teacher_id     uuid FK users,
  assistant_teacher_ids uuid[],           -- array of user IDs

  -- Enrollment
  max_enrollment      integer,            -- class capacity
  min_enrollment      integer,            -- minimum to run (below this → at risk)
  enrollment_count    integer default 0,  -- maintained by trigger

  -- Linked production (for rehearsal/performance class types)
  production_id       uuid FK productions nullable,

  -- Curriculum linkage (LMS)
  curriculum_stage_id uuid FK curriculum_stages nullable,
  skill_ids           uuid[],             -- skills targeted in this class

  -- Status
  status              text default 'draft' CHECK (status IN (
                        'draft',          -- not yet published
                        'active',         -- currently enrolling / running
                        'cancelled',      -- cancelled class
                        'completed'       -- school year ended
                      )),
  is_published        boolean default false,   -- visible on parent portal
  is_open_enrollment  boolean default true,    -- accepting new students

  -- Display
  color_code          text,               -- hex color for calendar display
  cover_image_url     text,               -- class card image

  -- Metadata
  created_by          uuid FK users,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
)
```

---

## 3. Session Entity

A Session is a single occurrence of a Class. Sessions are generated
from the class's recurring schedule rules and represent actual events
on the calendar.

### 3.1 Session Schema

```sql
class_sessions (
  id                    uuid PK default gen_random_uuid(),
  tenant_id             uuid FK tenants NOT NULL,
  class_id              uuid FK classes NOT NULL,

  -- Scheduling
  session_date          date NOT NULL,
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  duration_minutes      integer,            -- computed from start/end

  -- Location (can differ from class default for this session)
  room                  text,
  location_notes        text,

  -- Staff (inherits from class; can be overridden per session)
  lead_teacher_id       uuid FK users,
  assistant_teacher_ids uuid[],
  substitute_teacher_id uuid FK users nullable,
  is_substitute_session boolean default false,

  -- Status
  status                text default 'scheduled' CHECK (status IN (
                          'scheduled',
                          'completed',
                          'cancelled',
                          'rescheduled'
                        )),
  is_cancelled          boolean default false,
  cancellation_reason   text,
  cancelled_at          timestamptz,
  cancelled_by          uuid FK users,

  -- Rescheduling
  rescheduled_from_id   uuid FK class_sessions nullable,
  rescheduled_to_id     uuid FK class_sessions nullable,

  -- Timesheet
  is_discounted         boolean default false,  -- triggers discounted pay rate
  timesheet_entries_generated boolean default false,

  -- Calendar sync
  google_event_id       text,              -- for Google Calendar push
  ical_uid              text,              -- for iCal/Apple Calendar
  calendar_synced_at    timestamptz,

  -- Notes
  session_notes         text,              -- admin/teacher notes for this session
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
)
```

### 3.2 Recurring Session Generation

When a class is activated:
1. Admin defines the recurrence rule:
   - Day(s) of week: Monday / Tuesday / etc. (multiple allowed)
   - Start time / End time
   - Frequency: weekly, bi-weekly, or custom
2. System generates all sessions between `start_date` and `end_date`
3. Exceptions (holidays, closures) can be applied to skip specific dates
4. Bulk-cancel a single date vs. cancel the entire series are distinct actions
5. Admin can add one-off sessions outside the recurrence pattern

---

## 4. Class Types in Detail

### 4.1 Regular Class
Standard weekly technique class. Generates recurring sessions.
Auto-populates teacher timesheets. Students are enrolled via registration.

### 4.2 Rehearsal
Tied to a Production record. Admin creates the production first, then
creates rehearsal classes linked to it. Can be cast-specific (Cast A only)
or full-cast. Sessions auto-populate teacher timesheets at rehearsal rate.
Rehearsal sessions can have attendance tracked per enrolled student.

### 4.3 Performance
The actual show event. A single session (or a small set of sessions for
multi-night shows). Tied to a Production. Teachers and students are
assigned explicitly. Generates timesheet entries at performance rate.

### 4.4 Competition
Single or multi-day event off-site. Admin enters the competition event,
assigns supervising teachers. Generates timesheet entries at competition
rate. Student participants tracked separately (see
PERFORMANCE_COMPETITION_COSTS.md).

### 4.5 Private Lesson
1:1 or small group instruction. Can be:
- Scheduled by teacher (manual entry in Teacher Portal)
- Scheduled via the Communications module DM request flow
- Created by Admin directly
Private sessions generate timesheet entries at private lesson rate and
trigger billing events for the student's family account.

### 4.6 Workshop / Intensive
One-time or short-run event with separate enrollment from regular classes.
Own start/end dates, own pricing, own enrollment. Same session/attendance
infrastructure as regular classes.

---

## 5. Student Check-In

### 5.1 Purpose
Check-in creates an authoritative attendance record for each session.
This is distinct from the teacher's timesheet — check-in is about
students; timesheet is about teacher pay.

### 5.2 Check-In Flow
1. Teacher opens their portal → Today's Sessions
2. Taps a session → Roster View
3. For each student: mark Present / Absent / Tardy / Excused Absence
4. Teacher submits attendance (locks check-in for that session)
5. Admin can override attendance after lock if needed

### 5.3 Check-In Schema

```sql
session_attendance (
  id              uuid PK default gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  session_id      uuid FK class_sessions NOT NULL,
  student_id      uuid FK users NOT NULL,
  status          text CHECK (status IN (
                    'present',
                    'absent',
                    'tardy',
                    'excused',
                    'not_enrolled'      -- catch-all for walk-ins or data issues
                  )),
  checked_in_at   timestamptz,
  checked_in_by   uuid FK users,        -- the teacher who took attendance
  notes           text,
  makeup_eligible boolean default false, -- flagged if absence triggers makeup class
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

### 5.4 Attendance Rules
- Attendance cannot be submitted for a future session date
- Once submitted, only Admin or Super Admin can override
- Unexcused absences above a configurable threshold trigger
  an Admin alert (threshold set in Admin Settings → Studio Config)
- Makeup class eligibility is flagged automatically for unexcused absences
  (see MAKEUP_POLICY.md for makeup rules)

### 5.5 Attendance Reports
- Admin: attendance rate per class, per student, per time period
- Teacher: their own class attendance summaries
- Parent: their child's attendance history in Parent Portal

---

## 6. Substitute Teacher Workflow

### 6.1 Trigger Points
A substitute is needed when:
- Teacher marks themselves absent for a session
- Admin proactively assigns a sub (teacher unavailable)

### 6.2 Assignment Flow
1. Teacher (or Admin) flags a session as needing coverage
2. Admin receives notification: "[Teacher] is absent for [Class] on [Date]"
3. Admin opens Admin → Schedule → Coverage Needed
4. Admin selects an available substitute from the teacher roster
5. Substitute receives:
   - In-app notification
   - SMS: "You've been assigned to cover [Class] on [Date] at [Time]. [Room]."
   - Calendar invite with session details
6. Substitute confirms or declines
7. If declined: Admin re-assigns to another teacher
8. On confirmation: session record updated with `substitute_teacher_id`

### 6.3 Timesheet Impact
- Absent teacher: session entry status → 'absent' (no pay for that session)
- Substitute teacher: new timesheet entry created at substitute rate
- Both updates happen automatically on sub confirmation

### 6.4 Parent Notification on Cancellation
If no substitute is found and session must be cancelled:
1. Admin marks session as cancelled with reason
2. System sends to all enrolled families via their preferred channel:
   - In-app notification
   - SMS (if enabled)
   - Email (if enabled)
   Message: "[Class Name] on [Date] has been cancelled. [Reason if provided.]
   You will be notified when a makeup class is scheduled."
3. Calendar event is updated (see Section 7)

Cross-reference: TEACHER_SUBSTITUTE_COVERAGE.md for full sub workflow detail.

---

## 7. Calendar Sync & Cancellation Push

### 7.1 Supported Calendar Platforms
- Google Calendar (OAuth, per user)
- Apple Calendar / iCal (iCal feed, subscribe-once URL)
- Outlook (iCal feed, subscribe-once URL)

### 7.2 Per-User Calendar Subscription
Each user (teacher, parent, admin) can connect their calendar:
- **Google Calendar:** OAuth flow in Portal → Settings → Calendar
  → "Connect Google Calendar" → selects which calendar to add events to
- **iCal/Apple/Outlook:** Portal generates a unique subscribe URL
  → user adds URL as a subscribed calendar → auto-updates

### 7.3 What Gets Pushed
| Event | Who Gets It | Contents |
|---|---|---|
| New class session | Enrolled families + assigned teachers | Class name, date, time, room, teacher |
| Session cancelled | Enrolled families + assigned teachers | Cancellation notice, reason if provided |
| Session rescheduled | Enrolled families + assigned teachers | New date/time, original date reference |
| Substitute assigned | Substitute teacher | Session details, class name, student count |
| Rehearsal added | Cast members' families + teachers | Production name, date, call time, location |
| Performance | All cast + families | Show name, date, call time, venue, dress code |
| Competition | Competing students' families + teachers | Event name, date, location, departure time |

### 7.4 Cancellation Push Behavior
When Admin cancels a session:
1. Database: `class_sessions.is_cancelled = true`, reason logged
2. Google Calendar: event updated with "[CANCELLED]" prefix in title,
   description updated with cancellation reason
3. iCal feed: session marked with `STATUS:CANCELLED` in the iCal spec
4. Push notification sent to all subscribers of that event
5. All actions logged in `calendar_sync_log` for audit

### 7.5 Calendar Sync Schema

```sql
user_calendar_connections (
  id                uuid PK default gen_random_uuid(),
  tenant_id         uuid FK tenants NOT NULL,
  user_id           uuid FK users NOT NULL,
  provider          text CHECK (provider IN ('google','ical','outlook')),
  google_calendar_id text nullable,
  google_refresh_token text nullable,     -- encrypted
  ical_feed_token   text,                 -- unique per user; in feed URL
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
)

calendar_sync_log (
  id              uuid PK default gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  session_id      uuid FK class_sessions NOT NULL,
  user_id         uuid FK users NOT NULL,
  provider        text,
  action          text,                   -- 'created','updated','cancelled','deleted'
  status          text,                   -- 'success','failed','pending'
  error_message   text nullable,
  synced_at       timestamptz default now()
)
```

---

## 8. Curriculum & Skill Linkage (LMS Layer)

### 8.1 Overview
Each class can be linked to one or more curriculum stages and a set
of target skills. This creates the learning progression layer on top
of the scheduling layer.

Cross-reference: BALLET_DOMAIN.md for the full curriculum level taxonomy,
skill taxonomy, and badge naming conventions.

### 8.2 Curriculum Stages

```sql
curriculum_stages (
  id              uuid PK default gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  name            text NOT NULL,          -- "Pre-Ballet", "Ballet I", "Ballet II"
  code            text,                   -- "PRE", "B1", "B2"
  description     text,
  min_age         integer,
  max_age         integer,
  sequence_order  integer,                -- 1, 2, 3... for progression display
  color_code      text,                   -- for visual level indicators
  created_at      timestamptz default now()
)
```

### 8.3 Skills

```sql
skills (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  curriculum_stage_id uuid FK curriculum_stages,
  name                text NOT NULL,      -- "Pliés in first position"
  description         text,
  skill_category      text,               -- 'technique','musicality','performance','strength'
  sequence_order      integer,
  badge_name          text nullable,      -- if this skill has a badge (from BALLET_DOMAIN.md)
  badge_image_url     text nullable,
  created_at          timestamptz default now()
)
```

### 8.4 Student Skill Progress

```sql
student_skill_progress (
  id              uuid PK default gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  student_id      uuid FK users NOT NULL,
  skill_id        uuid FK skills NOT NULL,
  class_id        uuid FK classes NOT NULL,
  status          text CHECK (status IN (
                    'introduced',         -- skill has been taught; student is learning
                    'developing',         -- student shows partial competency
                    'achieved',           -- teacher has marked skill as mastered
                    'badge_awarded'       -- badge issued for this skill
                  )),
  assessed_by     uuid FK users,          -- teacher who assessed
  assessed_at     timestamptz,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

### 8.5 Curriculum Sequence per Class
Each class has an ordered list of skills it covers across its sessions.
Admin or teacher defines the sequence for the class at the start of the year.
Over time, teacher marks skills as introduced/achieved per student.

```sql
class_skill_sequence (
  id              uuid PK default gen_random_uuid(),
  class_id        uuid FK classes NOT NULL,
  skill_id        uuid FK skills NOT NULL,
  planned_session_number integer,         -- e.g., "introduce this in session 4"
  created_at      timestamptz default now()
)
```

---

## 9. Admin Schedule Builder — UI Spec

Location: `/admin/schedule`

### 9.1 Views
- **Calendar View** — week/month grid; color-coded by class type and program division
- **List View** — tabular; filterable by teacher, day, class type, status
- **Coverage View** — sessions with no confirmed teacher (needs coverage highlighted)
- **Conflict View** — detects double-booked teachers or rooms

### 9.2 Class Management Actions
- Create new class (form: all fields in Section 2.2)
- Edit class details
- Duplicate a class (new term, same structure)
- Archive a class (end of year)
- Cancel a class (with optional reason; triggers parent notifications)

### 9.3 Session Management Actions
- View all sessions for a class
- Cancel a single session (vs. cancel full series)
- Reschedule a session (select new date/time; old session → rescheduled status)
- Add one-off session outside recurrence
- Assign substitute for a session
- Bulk-create sessions from recurrence rule

### 9.4 Quick Actions from Calendar
- Click session → session detail panel (teacher, enrolled count, room, status)
- Drag session → reschedule (Admin only)
- Right-click session → quick cancel / assign sub / send message to class

---

## 10. Teacher Portal — Schedule Views

### 10.1 My Schedule
- Calendar view: daily / weekly / monthly
- Tap session → open session detail

### 10.2 Session Detail (Teacher View)
- Class name, date, time, room
- Student roster with check-in controls
- Notes field
- "Mark Absent" button → triggers substitute request
- Session status badge

### 10.3 Color Coding for Teachers
| Type | Color |
|---|---|
| Regular class | Lavender (brand primary) |
| Private lesson | Teal |
| Rehearsal | Gold |
| Performance | Deep purple |
| Competition | Coral |
| Substitute assignment | Orange |
| Admin block | Light grey |
| Cancelled | Strikethrough / muted |

---

## 11. Phase Implementation Order

### Phase 1 — Core Schedule (Build now)
- [ ] `classes` table with all fields from Section 2.2
- [ ] `class_sessions` table with all fields from Section 3.1
- [ ] Recurring session generation (weekly recurrence, exceptions)
- [ ] Admin Schedule Builder UI: create class, generate sessions, calendar view
- [ ] Teacher portal: My Schedule calendar view + session detail
- [ ] Session check-in: teacher marks attendance per student per session
- [ ] `session_attendance` table
- [ ] Timesheet auto-population triggered by session creation

### Phase 2 — Substitute & Cancellation
- [ ] Substitute assignment workflow (Admin assigns, sub confirms)
- [ ] Cancellation flow with parent notification
- [ ] Session rescheduling
- [ ] Coverage View in admin calendar

### Phase 3 — Calendar Sync
- [ ] iCal feed per user (subscribe URL)
- [ ] Google Calendar OAuth connection
- [ ] Cancellation and reschedule push to connected calendars
- [ ] `user_calendar_connections` and `calendar_sync_log` tables

### Phase 4 — LMS / Curriculum
- [ ] `curriculum_stages`, `skills`, `class_skill_sequence` tables
- [ ] Populate from BALLET_DOMAIN.md taxonomy
- [ ] Student skill progress tracking (teacher marks skills per student)
- [ ] Badge award system
- [ ] Parent portal: student progress view

---

## 12. Open Questions

- [ ] For multi-day competitions, does each competition day generate a
  separate session or is it one multi-day block?
- [ ] Can parents see the full class roster (other students' names) or
  only their own child's schedule?
- [ ] Should there be a "class at risk" notification when enrollment
  drops below min_enrollment threshold?
- [ ] iCal feed: should it include all of a user's classes in one feed,
  or separate feeds per class?
- [ ] Should cancelled sessions generate a makeup class automatically
  or require Admin to create the makeup manually?
- [ ] For Nutcracker: are rehearsals separate class records linked to
  the production, or sessions within one "Nutcracker Rehearsal" class?
- [ ] Can parents opt into Google Calendar sync, or is the iCal
  subscribe link sufficient for the app launch?
- [ ] Cancellation pay policy: if a session is cancelled with < X hours
  notice, does the lead teacher still receive pay?

---

## 13. Trial Class Eligibility

### 13.1 Per-Class Trial Configuration
Trial class eligibility is not assumed by class level — it is explicitly
configured per class by Admin. Any class type can be marked trial-eligible
including intermediate and non-level classes at Admin's discretion.

```sql
-- Additional fields on the classes table:
trial_eligible          boolean default false,
trial_requires_approval boolean default false,  -- Admin approves each trial request
trial_max_per_class     integer default 2,       -- max trial students per session
trial_notes             text,                    -- internal note (e.g., "OK for mixed levels")
```

### 13.2 Pilates and Gyrotonic — Trial Rules
- Pilates and Gyrotonic classes have `trial_eligible = false` by default
- This is a system default, not a hardcoded restriction
- Admin can enable trial eligibility for these classes when running
  a promotion (see Section 14 — Promotions)
- When a promotion enables trials for Pilates/Gyrotonic, the class
  `trial_eligible` flag is toggled for the promotion period and
  automatically reverts when the promotion expires

### 13.3 Trial Class Flow
1. Parent selects a trial-eligible class during onboarding or from website
2. System checks: `trial_eligible = true` and session has room
   (`enrollment_count < max_enrollment`)
3. If `trial_requires_approval`: Admin receives request, approves/denies
4. If auto-approved: parent receives confirmation + calendar invite
5. Trial student appears on session roster tagged as [TRIAL]
6. Teacher sees trial status on check-in roster
7. After trial session: Angelina sends follow-up sequence
   (see REGISTRATION_AND_ONBOARDING.md — trial conversion flow)

---

## 14. Class Bundles & Promotions

### 14.1 Bundles
A Bundle is a pre-packaged set of classes sold together at a defined price.

Examples:
- "Fall Starter Pack" — 4 Petites classes + 1 trial observation
- "Technique + Conditioning" — Ballet II + Pilates (10-class bundle)
- "Summer Intensive Bundle" — intensive + 2 private lessons

```sql
class_bundles (
  id                uuid PK default gen_random_uuid(),
  tenant_id         uuid FK tenants NOT NULL,
  name              text NOT NULL,
  description       text,
  bundle_type       text CHECK (bundle_type IN (
                      'class_pack',       -- X sessions of one class type
                      'multi_class',      -- specific classes combined
                      'mixed'             -- classes + privates + other
                    )),
  class_ids         uuid[],               -- which classes are included
  session_count     integer,              -- total sessions in bundle
  price             numeric(10,2),
  compare_price     numeric(10,2),        -- original price (for "save X%" display)
  is_active         boolean default true,
  valid_from        date,
  valid_until       date,                 -- null = no expiry
  max_purchases     integer nullable,     -- null = unlimited
  purchase_count    integer default 0,    -- maintained by trigger
  created_by        uuid FK users,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
)
```

### 14.2 Promotions
A Promotion applies a rule (discount, trial unlock, free session) to
one or more classes or bundles for a defined period.

```sql
promotions (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  name                text NOT NULL,
  description         text,
  promo_code          text nullable,       -- if code-based; null = automatic
  promotion_type      text CHECK (promotion_type IN (
                        'percent_off',     -- X% off class/bundle price
                        'amount_off',      -- $X off
                        'free_trial',      -- unlocks trial for normally closed classes
                        'free_session',    -- first session free
                        'bundle_discount'  -- discount on a bundle
                      )),
  discount_value      numeric(10,2),       -- percent or amount depending on type
  applies_to          text CHECK (applies_to IN (
                        'all_classes',
                        'specific_classes',
                        'specific_bundles',
                        'class_type'       -- e.g., all 'pilates' classes
                      )),
  target_class_ids    uuid[],              -- if applies_to = specific_classes
  target_bundle_ids   uuid[],             -- if applies_to = specific_bundles
  target_class_type   text,               -- if applies_to = class_type
  unlocks_trial       boolean default false, -- true = enables trial_eligible for targets
  valid_from          timestamptz,
  valid_until         timestamptz,         -- null = no expiry
  max_redemptions     integer nullable,    -- null = unlimited
  redemption_count    integer default 0,
  is_active           boolean default true,
  created_by          uuid FK users,
  created_at          timestamptz default now()
)
```

### 14.3 Promotion + Trial Interaction
When a promotion has `unlocks_trial = true`:
- System temporarily sets `trial_eligible = true` on all target classes
  for the promotion period
- On promotion expiry (`valid_until` passed), system reverts
  `trial_eligible = false` on those classes
- All trial sessions booked under the promotion are honored even
  after the promotion expires
- Admin receives notification 3 days before promotion expiry

---

## 15. Front Desk Check-In (Future Phase)

### 15.1 Vision
A tablet or kiosk at the studio entrance where students or parents
can check in on arrival. This supplements teacher roster check-in
and provides real-time occupancy data.

### 15.2 Architecture Note
The check-in system must account for back-to-back classes:

**Back-to-back class detection:**
When a student has two or more classes consecutively (gap ≤ 15 minutes),
the front desk check-in for Class 1 is propagated as a check-in signal
for Class 2. The student does not need to physically check in again at
the desk between classes.

This logic must be surfaced to the AI attendance system (see Section 16)
so that the system does not flag a student as absent from Class 2 when
they were physically present and already checked in for Class 1.

```sql
-- Additional fields to add to session_attendance when front desk is built:
checkin_source  text CHECK (checkin_source IN (
                  'teacher_roster',     -- teacher marked in portal
                  'front_desk',         -- physical check-in at kiosk
                  'propagated',         -- auto-carried from adjacent class
                  'ai_inferred'         -- AI resolved based on context
                )),
propagated_from_session_id  uuid FK class_sessions nullable,
```

### 15.3 Back-to-Back Class Flag on Class Record
```sql
-- Additional field on classes table:
back_to_back_class_ids  uuid[],  -- classes this class directly precedes or follows
                                  -- Admin sets this during class creation
```

---

## 16. AI Attendance Intelligence

### 16.1 Purpose
Attendance accuracy is critical infrastructure — not just for records,
but because it directly gates the live stream alert system (Section 16.3).
Inaccurate attendance = wrong families notified = serious trust issue.

### 16.2 AI Attendance Logic Inputs
The AI attendance resolver considers the following signals in order:

| Priority | Signal | Source |
|---|---|---|
| 1 | Teacher roster check-in | Teacher portal submission |
| 2 | Front desk physical check-in | Kiosk (future) |
| 3 | Back-to-back class propagation | System-detected adjacency |
| 4 | Parent app location signal | Mobile app (optional, future) |
| 5 | Historical pattern | Student's attendance history |

When signals conflict (e.g., teacher marks absent but front desk
checked in), the system flags for Admin review rather than auto-resolving.

### 16.3 Live Stream Alert System (GameChanger Model)
When a class session is live-streamed:
1. Admin or teacher marks session as `is_livestreamed = true`
2. System checks confirmed attendance for that session
3. For each student marked Present:
   - Notify all approved family members on that student's account
   - Notification includes: stream link, student name, class name
   - Notification channels: in-app push, SMS (if enabled)
4. Approved family members = explicitly authorized contacts on the
   student's family profile (not just any parent — approved list)
5. Notifications are sent only AFTER attendance is confirmed and locked
   — not before, to prevent alerts going out for students who are absent

```sql
-- Additional fields on class_sessions:
is_livestreamed         boolean default false,
stream_url              text nullable,
stream_started_at       timestamptz nullable,
attendance_locked_at    timestamptz nullable,  -- when teacher locks attendance
livestream_alerts_sent  boolean default false,

-- On student accounts:
-- approved_stream_contacts stored on student profile (see REGISTRATION spec)
```

### 16.4 Approved Family Member List
Each student has an explicitly configured list of people authorized
to receive live stream alerts. This is separate from emergency contacts.

- Parent 1 (primary) — always included unless removed
- Parent 2 / guardian — opt-in
- Grandparent / other family — opt-in, added by primary parent
- Each approved contact has: name, relationship, phone, email, in-app account (optional)
- Admin can view and override approved contact lists

### 16.5 Alert Timing Rules
- Alerts are never sent before attendance is locked for that session
- If a class is back-to-back and uses propagated check-in, the
  propagated status counts as confirmed for alert purposes
- If attendance is not submitted within 30 minutes of session end time:
  Admin receives alert: "Attendance not submitted for [Class] — 
  livestream alerts cannot be sent"


---

## 17. Policy Decisions (Resolved)

### Multi-Day Competitions
Competition events are structured as a **Competition Record** (the parent
event) containing multiple **Competition Days** (child records), each of
which generates its own sessions. This is because schedules fluctuate
day-to-day at competitions and need to be managed independently.

Each Competition Day links to:
- Specific students (or student groups for group dances)
- Specific dances performed that day
- Associated music and costume records per dance

```sql
competitions (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  name              text,               -- "YAGP 2026 Regional"
  location          text,
  start_date        date,
  end_date          date,
  notes             text,
  created_at        timestamptz
)

competition_days (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  competition_id    uuid FK competitions,
  day_date          date,
  call_time         time,
  location_notes    text,               -- hall, stage, warm-up room
  notes             text
)

competition_entries (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  competition_day_id uuid FK competition_days,
  entry_type        text CHECK (entry_type IN ('solo','duet','group','ensemble')),
  dance_title       text,
  dance_style       text,               -- "Classical Variation", "Contemporary", etc.
  student_ids       uuid[],             -- one or more students in this entry
  music_file_url    text,               -- uploaded music track
  music_title       text,
  costume_ids       uuid[],             -- FK to costume records (future)
  costume_notes     text,
  performance_order integer,            -- order in day's schedule (may update as schedule changes)
  result            text,               -- score or placement after event
  notes             text,
  created_at        timestamptz
)
```

Each `competition_day` also generates a `class_session` record of type
`competition` so it appears on teacher calendars and auto-populates
timesheets. The `competition_entry` records are the detail layer linked
underneath.

---

### Parent Roster Visibility
- Parents **cannot** see the full class roster (other students' names)
- Parents can only see their own child's schedule and enrollment
- **Exception:** Published casting for performances and competitions
  is visible to all enrolled families once Admin publishes it
- Casting is explicitly published by Admin — it is not auto-revealed
- Casting display shows student first names only by default;
  Admin can configure full name display per production

---

### Class At-Risk Notification (Below Min Enrollment)
When a class's `enrollment_count` drops below `min_enrollment`:
1. System generates an internal Admin Task in the Admin Task Queue
2. Task reads: "⚠️ [Class Name] is below minimum enrollment
   ([X] enrolled, minimum is [Y]). Consider outreach."
3. Task includes quick-action buttons:
   - "Send recruitment message" → opens Communications → New Broadcast
     pre-filled with class details (Angelina can draft the message)
   - "Lower minimum" → edit class settings
   - "Cancel class" → cancel with parent notifications
4. Admin receives in-app notification immediately
5. If unresolved after 7 days, escalates to Super Admin

This also triggers when enrollment count drops mid-term (e.g., a student
withdraws from a class that was already at minimum).

---

### iCal Feeds — Separate Per Class
- Each class generates its own unique iCal subscribe URL
- Format: `/api/calendar/class/[classId]/[userToken].ics`
- Parents see a list of their enrolled classes in Portal → Calendar
  with a "Subscribe" button per class
- Teachers see their assigned classes with Subscribe buttons
- This allows a parent with two children in different classes to
  subscribe selectively, and to manage calendars by class name
  in their calendar app (each class shows as a separate calendar)

---

### Cancelled Sessions → Admin Task Queue (No Auto-Makeup)
When a session is cancelled:
1. Session marked cancelled in the database
2. Parent notifications sent (per Section 6.4)
3. System automatically creates an Admin Task:
   "📋 [Class Name] session on [Date] was cancelled.
   A makeup class may be needed — please review and schedule."
4. Task includes quick action: "Schedule Makeup" →
   opens new session creation form pre-filled with class details
5. Admin decides whether to create a makeup session, reschedule,
   or take no action and closes the task
6. Task appears in Admin Task Queue with priority: Normal
7. If no action taken within 14 days, task escalates to Studio Manager

---

### Nutcracker and All Productions — Dual Structure
Productions (Nutcracker, spring recital, competitions) use **both**:

**Option A — Rehearsal as a Class record:**
A class record of type `rehearsal` linked to the production.
This class has its own recurring sessions (e.g., every Saturday 10am–12pm),
enrolled students, and teacher assignments. Best for long-running
regular rehearsal schedules.

**Option B — Rehearsal as a Session within a class:**
Specific one-off rehearsal sessions added to an existing class record
(e.g., a special full-cast run-through added to the regular schedule).

Admin chooses which structure fits each rehearsal type. Both can coexist
for the same production. The production record is the parent that links them.

```sql
productions (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  name              text,               -- "The Nutcracker 2026"
  production_type   text CHECK (production_type IN (
                      'recital', 'nutcracker', 'spring_show',
                      'competition', 'workshop_performance', 'other'
                    )),
  description       text,
  performance_dates date[],             -- array of show dates
  venue             text,
  is_published      boolean default false,  -- controls casting visibility
  casting_published boolean default false,  -- separate from production visibility
  created_by        uuid FK users,
  created_at        timestamptz
)

-- classes.production_id FK → productions (already in schema)
-- class_sessions.production_id FK → productions (add to session schema)
```

---

### Google Calendar Sync at App Launch
- Google Calendar OAuth connection will be available at app launch
- iCal subscribe links are also available as the lower-friction option
- Parents and teachers can choose either or both
- Google Calendar OAuth is per-user in Portal → Settings → Calendar

---

### Late Cancellation Pay — Admin Discretion
Whether a teacher receives pay when a session is cancelled with short
notice is at Amanda's (Super Admin) discretion. The system must support
both outcomes without forcing a rule.

Implementation:
- When Admin cancels a session, a prompt appears:
  "Should [Teacher Name] receive pay for this cancelled session?"
  Options: **Yes — pay at regular rate** / **Yes — pay at reduced rate** /
  **No — do not pay** / **Decide later**
- "Decide later" creates an Admin Task flagged to Finance Admin
- The teacher's timesheet entry for that session is updated accordingly:
  - Yes (regular): `status = 'confirmed'`, full rate applied
  - Yes (reduced): `status = 'confirmed'`, custom rate field populated
  - No: `status = 'cancelled_no_pay'`, $0 entry
- Finance Admin can override this decision before payroll submission
- Super Admin (Amanda) can override any time

