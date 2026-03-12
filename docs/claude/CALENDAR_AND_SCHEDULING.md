# CALENDAR_AND_SCHEDULING.md
# Ballet Academy and Movement — Platform Module Spec
# Module: Calendar, Scheduling & Resource Management

**Version:** 1.0  
**Status:** Spec — Not Yet Built  
**Author:** Derek Shaw / Green Lyzard  
**Related Modules:**
- REGISTRATION_AND_ONBOARDING.md
- SCHEDULING_AND_LMS.md
- CASTING_AND_REHEARSAL.md
- COMMUNICATIONS_AND_STAFF_VISIBILITY.md
- M4_TEACHER_HOUR_LOGGING.md

---

## 1. Module Purpose

The Calendar & Scheduling module is the operational core of the BAM platform. Every class, rehearsal, private lesson, trial class, room booking, cancellation, and performance event flows through this module. It is the single source of truth for:

- What is happening, when, where, and with whom
- Who needs to be notified of changes
- Who is responsible for approving changes before notifications are sent
- Where minors are at all times while in BAM's care
- How studio resources (rooms, teachers) are utilized and monetized

This module feeds: parent communications, teacher scheduling, student attendance tracking, financial reporting, lead conversion, and the public-facing WordPress schedule widget.

---

## 2. Core Concepts & Definitions

### 2.1 Schedule Template vs. Schedule Instance

**Schedule Template** — The recurring weekly pattern for a season. Defines:
- Class name, type, level
- Day of week + start/end time
- Assigned teacher
- Room assignment
- Age range, capacity
- Whether trial enrollment is allowed
- Season association

**Schedule Instance** — What actually happens on a specific date. Generated from the template but can diverge:
- A class may be cancelled on a specific date
- A substitute teacher may be assigned
- A room may change
- A rehearsal may be added that is not in the template

The system always renders instances, not templates, for parent-facing views. Templates are admin tools for setting up seasons.

### 2.2 Event Types

| Type | Description | Visible To |
|---|---|---|
| `class` | Regular weekly class | All roles |
| `trial_class` | Open enrollment trial session | All roles (with trial badge) |
| `rehearsal` | Production rehearsal (links to casting module) | Students in cast + all staff |
| `private_lesson` | 1:1 teacher/student session | Assigned student/parent + all staff |
| `performance` | Recital, Nutcracker, spring show | All roles |
| `room_block` | Room reserved (no class — admin/maintenance) | Admin/staff only |
| `teacher_absence` | Teacher unavailable (blocks private bookings) | Admin/staff only |
| `studio_closure` | Holiday or full closure | All roles |

### 2.3 Approval States

Every change to a published schedule instance passes through:

```
draft → pending_approval → approved → published → [notified]
```

- **draft** — Created but not submitted for review
- **pending_approval** — Submitted; awaiting approval from designated approver(s)
- **approved** — Approved; not yet pushed to external calendars or notifications
- **published** — Live on platform; synced to subscribed calendars
- **notified** — All affected parties have received notifications

Cancellations and new additions require approval before any external notification is sent.

### 2.4 Roles & Permissions

| Role | Can Create | Can Approve | Receives Notifications |
|---|---|---|---|
| `super_admin` (Amanda, Cara) | ✓ | ✓ | All changes in studio |
| `admin` (front desk) | ✓ | ✓ (delegated) | All changes in studio |
| `teacher` | Draft only | ✗ | Own classes + their students |
| `parent` | ✗ | ✗ | Their child's enrolled classes |
| `student` (14+) | ✗ | ✗ | Their own enrolled classes |

**Approval delegation rules:**
- Amanda and Cara are always notified of any pending approval
- Front desk (admin) may approve routine changes (substitute teacher, room swap)
- Only super_admin may approve cancellations affecting more than 5 students
- Only super_admin may approve changes to performance events

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Season definition
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, -- e.g. "Fall 2025", "Spring 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  registration_open BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schedule template (recurring weekly pattern)
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  teacher_id UUID REFERENCES teachers(id),
  room_id UUID REFERENCES rooms(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_trial_eligible BOOLEAN DEFAULT false,
  max_capacity INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schedule instance (what actually happens on a specific date)
CREATE TABLE schedule_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID REFERENCES schedule_templates(id), -- NULL if ad hoc
  class_id UUID REFERENCES classes(id),
  teacher_id UUID REFERENCES teachers(id),
  room_id UUID REFERENCES rooms(id),
  event_type TEXT NOT NULL DEFAULT 'class',
  -- CHECK: event_type IN ('class','trial_class','rehearsal','private_lesson',
  --   'performance','room_block','teacher_absence','studio_closure')
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  -- CHECK: status IN ('draft','pending_approval','approved','published','cancelled','notified')
  cancellation_reason TEXT,
  substitute_teacher_id UUID REFERENCES teachers(id),
  notes TEXT,
  approval_status TEXT DEFAULT 'approved',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  ical_uid TEXT UNIQUE, -- stable UID for calendar sync
  is_trial_eligible BOOLEAN DEFAULT false,
  production_id UUID REFERENCES productions(id), -- links to casting module
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rooms / spaces
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, -- e.g. "Studio A", "Studio B", "Waiting Area"
  capacity INT,
  is_bookable BOOLEAN DEFAULT true, -- can teachers book for privates?
  hourly_rate_private NUMERIC(10,2), -- private lesson rate for this room
  notes TEXT
);

-- Calendar subscriptions (per user, per scope)
CREATE TABLE calendar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_token TEXT UNIQUE NOT NULL, -- used in ICS URL
  scope JSONB NOT NULL,
  -- scope example: {"event_types": ["class","rehearsal"], "student_ids": ["uuid"]}
  provider TEXT, -- 'google', 'apple', 'outlook', 'ics'
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Change requests (approval queue)
CREATE TABLE schedule_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  instance_id UUID NOT NULL REFERENCES schedule_instances(id),
  change_type TEXT NOT NULL,
  -- CHECK: change_type IN ('cancellation','teacher_change','room_change',
  --   'time_change','add_instance','note_update')
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  previous_state JSONB NOT NULL, -- snapshot before change
  proposed_state JSONB NOT NULL, -- snapshot after change
  approval_status TEXT DEFAULT 'pending',
  -- CHECK: approval_status IN ('pending','approved','rejected')
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notifications_sent BOOLEAN DEFAULT false
);

-- Approver prompts (task queue for approvers)
CREATE TABLE approval_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  change_request_id UUID NOT NULL REFERENCES schedule_change_requests(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  -- CHECK: status IN ('pending','completed','dismissed')
  prompted_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  prompt_channel TEXT[], -- e.g. ['email', 'platform', 'sms']
  reminder_count INT DEFAULT 0
);
```

### 3.2 Widget Embed Configuration Table

```sql
-- Admin-configured embed presets
CREATE TABLE schedule_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, -- e.g. "Homepage Schedule", "Toddlers Page"
  embed_token TEXT UNIQUE NOT NULL, -- used in iframe src
  -- Filter defaults (what the embed shows by default)
  default_season_id UUID REFERENCES seasons(id),
  default_days INT[], -- [1,2,3,4,5,6] = Mon-Sat
  default_levels TEXT[],
  default_class_types TEXT[],
  default_age_min INT,
  default_age_max INT,
  default_teacher_id UUID REFERENCES teachers(id),
  show_trials_only BOOLEAN DEFAULT false,
  show_rehearsals BOOLEAN DEFAULT false,
  -- Parent-facing filter visibility (what parents are allowed to change)
  allow_filter_season BOOLEAN DEFAULT false,
  allow_filter_day BOOLEAN DEFAULT true,
  allow_filter_level BOOLEAN DEFAULT true,
  allow_filter_age BOOLEAN DEFAULT true,
  allow_filter_class_type BOOLEAN DEFAULT true,
  allow_filter_teacher BOOLEAN DEFAULT false,
  allow_filter_trial BOOLEAN DEFAULT true,
  allow_filter_rehearsal BOOLEAN DEFAULT false,
  -- Display options
  display_mode TEXT DEFAULT 'week', -- 'week' | 'list' | 'day'
  show_teacher BOOLEAN DEFAULT true,
  show_room BOOLEAN DEFAULT false,
  show_capacity BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Approval & Notification Workflow

### 4.1 Change Request Flow

```
Teacher or admin creates a schedule change (cancel class, add rehearsal, swap room)
    ↓
System creates schedule_change_request record (status: pending)
    ↓
System creates approval_task records for all designated approvers
    ↓
Approvers receive in-platform prompt + email notification:
  "A schedule change requires your approval. [View & Approve]"
    ↓
First qualifying approver reviews and approves or rejects
    ↓
  IF APPROVED:
    - schedule_instance is updated
    - change_request status → approved
    - All other open approval_tasks → completed
    - Amanda + Cara receive completion notification:
      "Schedule change approved by [name]. [View Change]"
    - Affected parents/students/teachers receive push notification
    - Subscribed calendars receive updated ICS event (delete + add)
    
  IF REJECTED:
    - change_request status → rejected
    - Requesting user notified with rejection reason
    - No external notifications sent
    - No calendar updates
```

### 4.2 Approver Prompts

Approvers are prompted via:
1. **In-platform notification badge** — appears in nav for all admin/super_admin roles
2. **Email** — sent immediately on change request creation
3. **SMS (Twilio)** — for cancellations affecting 3+ students (configurable threshold)
4. **Reminder** — if not actioned within 2 hours, reminder sent via email

Prompt content for cancellation example:
```
⚠️ Approval Required: Class Cancellation

Tuesday 4:00 PM — Beginner Ballet (Ages 6–8)
Teacher: Sarah M.
Students enrolled: 8
Reason submitted: Teacher illness

[Approve & Notify Parents] [Reject] [View Details]
```

### 4.3 Completion Notification to Amanda / Cara

After any approval action (approve or reject), super_admins receive:
```
✓ Schedule Change Actioned

"Tuesday 4:00 PM Beginner Ballet" cancellation was APPROVED
Approved by: Front Desk (Jessica)
8 parent notifications queued for delivery.

[View Schedule] [Undo Approval]
```

Undo window: 15 minutes before notifications are dispatched.

### 4.4 Parent/Student Notification Content

After approval, affected parties receive (via their configured channels: email, SMS, push):

**Cancellation:**
```
Class Cancelled — Tuesday, March 18

Beginner Ballet (4:00–4:45 PM) has been cancelled.
Reason: [if provided by admin]

Your next class: Tuesday, March 25 at 4:00 PM
Questions? Reply to this message or call (949) 229-0846
```

**New Rehearsal Added:**
```
Rehearsal Scheduled — Saturday, March 22

Nutcracker Rehearsal has been added to the schedule.
Time: 10:00 AM – 12:00 PM | Studio A
Attending: [Student Name]

Add to your calendar: [Google] [Apple] [Download ICS]
```

---

## 5. Calendar Views

### 5.1 View Modes

All calendar views support the same filter set. Views are available to all authenticated roles (content filtered by role permissions).

| View | Description | Primary Use |
|---|---|---|
| **Month** | Grid month calendar, event dots/bars | Overview, performance planning |
| **Week** | 7-column time grid, full day display | Teacher scheduling, room management |
| **Day** | Single day time grid | Front desk, day-of operations |
| **List** | Scrollable chronological list | Parents, mobile users |
| **Agenda** | Compact list grouped by day | Student/parent portal |

### 5.2 Filters (All Views)

All views share a consistent filter bar:

| Filter | Type | Options |
|---|---|---|
| Season | Dropdown | All active seasons |
| Date range | Date picker | Default: current week/month |
| Day of week | Multi-select pills | Mon Tue Wed Thu Fri Sat Sun |
| Event type | Multi-select pills | Class, Trial Class, Rehearsal, Performance, Private |
| Level | Multi-select pills | Pulled from DB |
| Class type | Multi-select pills | Ballet, Jazz, Contemporary, Musical Theatre, etc. |
| Age range | Dual slider | 0–18 |
| Teacher | Dropdown | All teachers (role-gated: teachers see self only) |
| Room | Dropdown | Admin/staff only |
| Status | Toggle | Published / Cancelled / All (admin only) |

### 5.3 Color Coding by Level

Used in calendar views and print exports:

| Level | Color |
|---|---|
| Petite (Ages 3–4) | Soft pink `#F4C6D4` |
| Pre-Ballet (Ages 5–6) | Lavender `#D4C6F4` |
| Beginner | Light purple `#B8A9E0` |
| Intermediate | Medium purple `#9C8BBF` |
| Advanced | Deep plum `#6B5B9E` |
| Open / Adult | Sage green `#A8C5A0` |
| Rehearsal | Gold `#E8C96B` |
| Performance | Champagne `#F0E0C0` |
| Trial Class | Teal accent `#7EC8C8` |
| Private Lesson | Warm coral `#E8A896` |

### 5.4 Class Type Icons

Used in print exports and calendar event labels. Thin outline SVG icons:

| Type | Icon concept |
|---|---|
| Ballet | Pointe shoe |
| Jazz | Character shoe |
| Contemporary | Abstract movement figure |
| Musical Theatre | Theatre masks |
| Rehearsal | Music stand |
| Performance | Stage curtain |
| Private | Single figure |

---

## 6. Schedule Widget (Embed System)

### 6.1 Widget Architecture

The widget lives at `/widget/schedule/[embed_token]` in the Next.js app. It is designed to be embedded via iframe on WordPress and any other website.

```
WordPress page
  └── <iframe src="https://portal.balletacademyandmovement.com/widget/schedule/[token]">
        └── Next.js widget route
              └── Reads embed config from DB by token
              └── Fetches schedule instances filtered by embed defaults
              └── Renders filter bar (only showing filters admin enabled)
              └── Parent adjusts visible filters
              └── URL params update (no reload)
```

### 6.2 Embed Token System

Each embed has a unique opaque token (`abc123xyz`). The token is:
- Not guessable (UUID-derived)
- Tied to a tenant (multi-tenant safe)
- Configurable without changing the WordPress iframe src
- Revocable (admin can rotate token)

WordPress embed code format:
```html
<iframe 
  src="https://portal.balletacademyandmovement.com/widget/schedule/abc123xyz"
  width="100%"
  height="700"
  frameborder="0"
  style="border:none; border-radius: 8px;"
  title="Class Schedule — Ballet Academy and Movement"
></iframe>
```

### 6.3 Admin Embed Generator (`/admin/schedule-embeds`)

Admin UI for creating and managing embeds:

1. **Create Embed** — Name it (e.g. "Homepage", "Toddlers Page", "Adult Classes")
2. **Set Filter Defaults** — What the embed shows on load
3. **Set Filter Permissions** — Which filters parents are allowed to change
4. **Preview** — Live iframe preview in admin
5. **Copy Code** — One-click copy of iframe HTML
6. **Manage** — List all active embeds, edit, deactivate, rotate token

### 6.4 Widget Display Modes

The widget supports three display modes, set by embed config or URL param:

- `?mode=week` — Classes grouped by day of week (default)
- `?mode=list` — Chronological list
- `?mode=print` — Print-optimized layout (see Section 7)

### 6.5 Widget Filter Bar Behavior

- Filters not enabled by admin are hidden entirely (not just disabled)
- Active filter state is encoded in URL params (shareable)
- Filter state is preserved if parent shares or bookmarks the URL
- Season filter defaults to current active season
- "No results" state: friendly message + CTA to contact studio

---

## 7. Print & Export

### 7.1 Print Mode

Triggered by:
- URL param `?mode=print`
- "Print Schedule" button (visible to authenticated admin/teacher roles only)
- Direct navigation to `/widget/schedule/[token]?mode=print`

Print mode renders:
- BAM logo (top left)
- Season name + date range (top right)
- "Ballet Academy and Movement" header, centered
- Filter summary line (e.g. "Showing: Fall 2025 · All Levels · Monday–Saturday")
- Classes in table format per day: **Time | Class Name | Age Range | Level | Teacher | Room**
- Color-coded row backgrounds by level (see Section 5.3)
- Class type icon in Class Name column
- Page break between days if content overflows
- Footer on each page: `balletacademyandmovement.com · (949) 229-0846 · dance@bamsocal.com`
- Cancelled classes shown with strikethrough (if "show cancelled" is enabled)

Print CSS:
- Strip all decorative backgrounds and shadows (`@media print`)
- Preserve level row color coding (use `color-adjust: exact`)
- Font: Cormorant Garamond headings, system serif body
- Margin: 0.75in all sides
- Orientation: landscape preferred (auto-detected)

### 7.2 Export Formats

| Format | Description | Available To |
|---|---|---|
| **Print (browser)** | `window.print()` with print CSS | Admin, Teacher |
| **PDF download** | Server-generated PDF via headless render | Admin, Teacher |
| **ICS (calendar file)** | Download .ics for manual import | All roles |
| **CSV** | Spreadsheet of schedule data | Admin only |
| **ICS subscription URL** | Live-updating calendar feed | All roles (scoped) |

---

## 8. Calendar Sync (Two-Way)

### 8.1 ICS Subscription Feed

Every authenticated user can subscribe to a personalized ICS feed:

**URL pattern:**
```
https://portal.balletacademyandmovement.com/api/calendar/[subscription_token].ics
```

**Feed scope per role:**
- **Parent** — All classes their child/children are enrolled in, performances, studio closures
- **Student (14+)** — Own classes + rehearsals + performances
- **Teacher** — All classes they are assigned to, their own private lessons, rehearsals
- **Admin/Super Admin** — Full studio calendar (all event types)

**Sync behavior:**
- Feed is regenerated on each request (always current)
- Events use stable `ical_uid` values so calendar apps update existing events rather than duplicating
- Cancelled events are sent with `STATUS:CANCELLED` so they are removed from subscribed calendars
- New events are added on next sync (calendar apps typically sync every 15–60 min)

### 8.2 Supported Calendar Providers

| Provider | Method | Notes |
|---|---|---|
| Google Calendar | Subscribe to URL | "Add by URL" in Google Calendar settings |
| Apple Calendar | Subscribe to URL | "File > New Calendar Subscription" |
| Outlook | Subscribe to URL | "Add calendar > Subscribe from web" |
| Any ICS-compatible app | Subscribe or download | Universal .ics format |

Platform provides step-by-step instructions for each provider in the parent/teacher portal.

### 8.3 Event Sync Notifications

When a subscribed event changes (cancellation, time change, room change):

1. Platform updates the ICS feed immediately
2. Calendar apps pick up the change on their next sync cycle (15–60 min)
3. Platform also sends direct notification (email/SMS/push) so parents don't have to wait for calendar sync

### 8.4 Subscription Management UI

In parent/teacher portal under "My Calendar":
- Subscribe button → shows provider-specific instructions
- Copy subscription URL
- View what's included in their feed
- Revoke and regenerate subscription token
- Choose notification preferences (email, SMS, push) for schedule changes

---

## 9. Minor Accountability & Safety

### 9.1 Accountability Requirement

Because Ballet Academy and Movement works exclusively with minors, the system must maintain a clear record of:
- Which students are currently in the building
- Which teacher is responsible for each student
- When a student is expected to be released and to whom

### 9.2 Check-In / Check-Out

**Check-in:**
- Front desk marks student as present when they arrive (simple tap/click on class roster)
- Teacher can also mark present from their class view
- Parents receive confirmation: "Your child has been checked in to Beginner Ballet at 4:00 PM"

**Check-out:**
- Teacher or front desk marks class as ended / students released
- Parent notified: "Class has ended. [Student] is ready for pickup."
- System records actual end time (vs scheduled end time)

**Late pickup:**
- If class ends and student not picked up within 10 minutes, front desk receives alert
- Configurable escalation: front desk → Amanda/Cara

### 9.3 Emergency Roster

From any class instance view, admin/teacher can export:
- **Emergency roster** — student name, parent name, parent phone, emergency contact, medical notes
- Available as quick-print or download
- Accessible offline (cached in teacher's device)

### 9.4 Substitute Teacher Protocol

When a substitute is assigned (via change request approval):
1. Substitute teacher receives class roster with all student contact info
2. Substitute receives emergency protocol documentation
3. Parents are notified: "Your child's class on [date] will be taught by [substitute name]."
4. Amanda/Cara are notified of the substitution

---

## 10. Resource Scheduling (Rooms & Privates)

### 10.1 Room Management

Each room has:
- Name, capacity, bookable status
- Hourly rate for private lessons (if applicable)
- Visual color in room calendar view
- Notes (e.g. "Has barre", "No mirrors", "Sprung floor")

Room calendar view (admin only):
- Week view showing room utilization by hour
- Blocks in color by event type
- Gap detection — shows available windows for private bookings
- Utilization percentage per week

### 10.2 Private Lesson Booking

**Who can initiate:**
- Teachers may request a private for an existing student
- Admin may create a private lesson directly
- Parents may request via portal (requires admin approval)

**Booking flow:**
1. Teacher or admin selects student, desired date/time range
2. System checks room availability + teacher availability
3. Available slots displayed
4. Booking submitted → approval task created for admin
5. On approval: event created, both teacher and parent notified, added to calendars
6. Cancellation: same approval workflow as regular class cancellation

**Private lesson rates:**
- Teachers earn at a higher rate for privates (configured per teacher in teacher profile)
- Private lesson hours feed into M4 Teacher Hour Logging module (separate pay rate flag)
- Financial summary shows group hours vs. private hours per teacher per pay period

### 10.3 Room Availability for Privates

Admin can view a "Room Availability" widget:
- Filtered by date range
- Shows all rooms in a horizontal time grid
- Available blocks shown in green
- Booked blocks color-coded by event type
- One-click to create a private booking from an open block

---

## 11. Trial Class Integration (Lead Funnel)

### 11.1 Trial Class Events

When an event is marked `is_trial_eligible = true`:
- It appears in the public widget with a "Trial Available" badge
- A "Book a Trial" CTA is shown on the class card
- Clicking CTA routes to the registration/enrollment module's trial booking flow

### 11.2 Trial → Enrolled Conversion Tracking

The calendar module emits events to the communications module at:
- **Trial booked** → triggers welcome sequence in Klaviyo
- **Trial attended** (marked present) → triggers follow-up sequence
- **Trial no-show** → triggers re-engagement sequence
- **Trial converted to enrolled** → triggers onboarding sequence, removes from lead funnel

These touchpoints are defined in COMMUNICATIONS_AND_STAFF_VISIBILITY.md and triggered via the platform's internal event bus.

### 11.3 Recruitment Touch Points Triggered by Calendar

| Calendar Event | Recruitment Action |
|---|---|
| Parent views schedule widget | Lead event captured (Klaviyo) |
| Parent clicks "Book a Trial" | Lead created in CRM |
| Trial class added to schedule | Klaviyo campaign trigger: "Trial classes now available" |
| Class near capacity | Klaviyo trigger: "Only 2 spots left in [class]" urgency email |
| New season published | Klaviyo campaign: "Fall enrollment is now open" |
| Studio closure / break end | Klaviyo trigger: "We're back — re-enrollment open" |

---

## 12. Admin UI Screens

### `/admin/calendar`
Full studio calendar. All views (month/week/day/list). All filters. All event types. Ability to click any event to view/edit details, submit change request, view roster, print emergency roster.

### `/admin/schedule-templates`
Manage recurring weekly patterns per season. Bulk create instances from template for a date range. Preview generated instances before publishing.

### `/admin/schedule-instances`
List of all specific-date events. Filter by date range, status, event type. Manage cancellations and change requests from here.

### `/admin/schedule-change-requests`
Approval queue. Pending requests listed with proposed change, affected students count, requesting user. Approve / Reject with optional note.

### `/admin/schedule-embeds`
Create and manage WordPress iframe embeds. Set defaults and filter permissions per embed. Live preview + copy code.

### `/admin/rooms`
Room management. View utilization calendar. Manage private lesson availability.

### `/admin/calendar-subscriptions`
View all active ICS subscriptions. Revoke if needed.

---

## 13. Teacher UI Screens

### `/teacher/calendar`
Teacher's own schedule. Week and list views. Own classes only + all rehearsals. Can view class rosters. Can submit change requests (draft only — requires admin approval). Can view room availability for private bookings.

### `/teacher/classes/[instance_id]/roster`
Class roster for a specific instance. Check-in/check-out. Emergency contact view. Export emergency roster.

---

## 14. Parent/Student Portal UI

### `/portal/calendar`
Parent's personalized calendar. Shows all enrolled classes for all children. Month/week/list views. Event detail shows class info, teacher, room (if shared), and any schedule change notes. Subscribe to ICS feed.

### `/portal/schedule`
Simplified list view. Grouped by week. Upcoming classes only (not past). CTA to re-enroll if a class is ending.

---

## 15. API Endpoints

```
GET  /api/widget/schedule/[token]         — Public schedule data for embed
GET  /api/calendar/[subscription_token].ics — ICS feed for calendar sync
POST /api/admin/schedule-change-requests   — Submit a change request
GET  /api/admin/approval-tasks             — Pending approvals for current user
POST /api/admin/approval-tasks/[id]/approve — Approve a change
POST /api/admin/approval-tasks/[id]/reject  — Reject a change
GET  /api/admin/rooms/availability          — Room availability query
POST /api/admin/private-lessons             — Create a private lesson booking
POST /api/portal/trial-bookings             — Parent books a trial class
GET  /api/portal/calendar/[user_id]         — Authenticated user's event feed
```

---

## 16. Notification Matrix

| Event | Amanda/Cara | Admin/Front Desk | Teacher | Parent | Student |
|---|---|---|---|---|---|
| Change request submitted | ✓ (prompt) | ✓ (prompt) | — | — | — |
| Change request approved | ✓ (complete) | ✓ (if they didn't approve) | If affects them | ✓ | If 14+ |
| Change request rejected | ✓ | ✓ | ✓ (requester) | — | — |
| Class cancelled | ✓ | ✓ | ✓ | ✓ | If 14+ |
| Sub teacher assigned | ✓ | ✓ | ✓ (the sub) | ✓ | — |
| Rehearsal added | ✓ | ✓ | ✓ | ✓ (cast students) | If 14+ |
| Private lesson booked | — | ✓ | ✓ | ✓ | — |
| Trial class booked | — | ✓ | ✓ | ✓ (confirmation) | — |
| Trial attended | — | ✓ | — | Follow-up email | — |
| Student late pickup | ✓ (escalation) | ✓ (immediate) | ✓ | ✓ (reminder) | — |
| New season published | — | ✓ | ✓ | ✓ (enrollment open) | — |
| Studio closure | ✓ | ✓ | ✓ | ✓ | If 14+ |

---

## 17. White-Label Considerations

As this platform is designed to be white-labeled for other dance studios:

- All calendar functionality is tenant-scoped via `tenant_id`
- Room names, level names, class types are configurable per tenant
- Color coding palette is configurable per tenant (defaults to BAM brand colors)
- Approval chain roles are configurable per tenant (some studios may not have a "Cara" role)
- ICS feed domain uses tenant's custom domain if configured
- Embed widget respects tenant's brand tokens (colors, fonts, logo)

---

## 18. Development Phases

### Phase 1 — Foundation (build first)
- Database schema (all tables above)
- Schedule template CRUD
- Schedule instance generation from templates
- Basic admin calendar view (week + list)
- Change request + approval workflow
- ICS subscription feed (read-only, no two-way sync)

### Phase 2 — Widget & Embeds
- Schedule widget route + layout
- Embed config admin UI
- Filter system (all 8 filters)
- Print mode
- WordPress integration guide

### Phase 3 — Notifications & Sync
- Approval prompt notifications (email + in-platform)
- Post-approval parent/student notifications
- Calendar sync change propagation
- Twilio SMS for cancellations

### Phase 4 — Resources & Accountability
- Room management + availability calendar
- Private lesson booking flow
- Check-in / check-out
- Emergency roster export
- Late pickup alerts

### Phase 5 — Lead Funnel Integration
- Trial class CTA on widget
- Klaviyo event triggers from calendar actions
- Recruitment touch point automation
- Conversion tracking (trial → enrolled)

---

## 19. Cross-Module Dependencies

| This Module | Depends On | For |
|---|---|---|
| Calendar | `classes` table | Class name, type, level, age range |
| Calendar | `teachers` table | Teacher assignment, private rates |
| Calendar | `seasons` table | Season filter, enrollment windows |
| Calendar | `productions` table | Rehearsal event linking |
| Calendar | `casting` table | Which students attend which rehearsal |
| Calendar | `enrollments` table | Which parents/students to notify |
| Calendar | `users` / `roles` | Permission gating, notification routing |
| Calendar | Communications module | Notification delivery (email, SMS, push) |
| Calendar | Klaviyo integration | Lead funnel triggers |
| Calendar | M4 Teacher Hours | Private lesson hours at elevated rate |

---

*This spec must be read by Claude Code before any calendar-related migrations, components, or API routes are built. Do not build any part of this module without reading this document in full.*

*Last updated: 2026-03-11*
