# Communications Hub — Band-Style Spec

**Status:** Ready for implementation  
**Phase:** 2 — Operations  
**Replaces:** Band app (BAM PRIVATES group)  
**Decision Log Date:** April 9, 2026  
**Reference:** COMMUNICATIONS.md, COMMUNICATIONS_INBOX.md, CONTACT_CHANNELS.md

---

## 1. Overview

The communications hub replaces Band as the primary coordination tool for BAM. Every group — classes, productions, privates, studio-wide — has its own feed with announcements, events, and optional chat. Parents, teachers, and admin all use the platform instead of Band, text, and email for studio communication.

Key principle: **One platform, zero missed messages.** Every communication that happens outside the platform (text to teacher, email about absence) should eventually flow through or be captured in the platform.

---

## 2. Group Types

| Group Type | Auto-Created | Members | Chat Default |
|---|---|---|---|
| `class` | Yes — per enrolled class | Enrolled parents + teacher + admin | Broadcast only |
| `production` | Yes — per production/show | Cast students' parents + teachers + admin | Two-way (configurable) |
| `privates` | Yes — one BAM PRIVATES group | All parents with active privates + all teachers + admin | Broadcast only |
| `private_session` | Optional — per individual private | That student's parent + assigned teacher + admin | Two-way |
| `studio_wide` | Yes — one per tenant | All active families + all staff | Broadcast only |
| `custom` | Manual — admin creates | Admin-defined | Admin-defined |

---

## 3. Group Feed

Each group has a feed — the central surface. Modeled on Band's home feed.

### 3.1 Feed Post Types

| Type | Who Can Post | Auto-Created |
|---|---|---|
| `announcement` | Admin, Super Admin, Teacher (in their classes) | No |
| `event` | Admin, Super Admin, Teacher (in their classes) | Yes — when private session or class event is created |
| `absence_notice` | System only (after parent confirms absence) | Yes |
| `schedule_change` | Admin, Super Admin | Yes — when class is cancelled/rescheduled |
| `file` | Admin, Super Admin, Teacher | No |
| `poll` | Admin, Super Admin | No |

### 3.2 Auto-Event Posts

When a private session is created or updated, the system auto-posts to the relevant group:

**BAM PRIVATES group post:**
```
🩰 New Private Session
Scout Williams — Studio 1
Thursday Apr 9 · 10:00 AM
Coach Pie
```

Privacy rule: if admin has set a student's privates as non-visible, their name is replaced with "Private Reservation" in the group feed. Studio calendar always shows "Private Reservation" and teacher name (never student name publicly).

### 3.3 Feed Display

- Newest posts at top
- Each post shows: author avatar, name, role badge, timestamp, view count
- Reactions: emoji reactions (like Band) — no text reply unless chat is enabled
- File attachments: PDF, image, video link
- Events embedded as cards with date/time/location

---

## 4. Chat Modes

Every group has a chat mode configured by admin. **Two modes:**

### 4.1 Broadcast Only (default for most groups)

- Admin and teachers can post to the feed
- Parents can read and react (emoji only)
- No text input field shown for parents
- Instead: a banner at top of chat reads:
  > "This group is in announcement mode. To reach the teacher, tap below."
  > [Message Teacher] [Contact Admin]

Those two buttons open a direct message thread — parent ↔ teacher or parent ↔ admin — not visible to the group.

### 4.2 Two-Way Chat (configurable per group)

- All members can post messages
- Useful for rehearsals, productions where parents have questions
- Admin can switch any group between modes at any time
- Mode change takes effect immediately — no notification pushed to parents

---

## 5. Absence System

This is the most important operational feature. Currently absences come in via text/call/email/Studio Pro — all fragmented. The platform unifies them.

### 5.1 Parent-Initiated Absence (Primary Flow)

Parent opens the portal → taps "Report Absence":

```
Step 1: Select student (if multiple children)
Step 2: System shows upcoming classes for that student this week:
  ○ Ballet Level 3B — Tuesday 4:30pm
  ○ Pointe Prep — Thursday 6:00pm
  ○ Company Rehearsal — Saturday 10:00am
Step 3: Parent selects the class(es) they'll miss
Step 4: Optional note: "She has a doctor appointment"
Step 5: Confirm → system processes absence
```

### 5.2 AI-Assisted Absence Detection (Secondary Flow)

When a parent emails, texts, or messages about an absence, the AI classifier detects it and confirms with the parent:

**Email/SMS detected absence:**
> "Hi! It looks like you're letting us know Sofia will miss class. Which class should we mark her absent for?"
> [Ballet Level 3B — Tue 4:30pm] [Pointe Prep — Thu 6:00pm]

Parent taps one button — absence is confirmed. No back-and-forth.

**If parent free-forms in chat:**
> Parent: "Sofia won't be there tomorrow"
> Angelina: "Got it! Which class should I mark her absent for? [Ballet Level 3B — Tuesday 4:30pm]"
> Parent: taps the card
> Angelina: "Done — your teacher has been notified. See you next week! 🩰"

### 5.3 Absence Routing

When an absence is confirmed:

1. **Teacher notification** — in-app push: "Sofia Martinez will be absent from Ballet Level 3B on Tuesday. Note: doctor appointment"
2. **Admin notification** — in-app notification (not push unless admin has enabled push for absences)
3. **Attendance roster** — student pre-marked as `excused` for that class session
4. **Override available** — teacher can change to `present` if the student shows up anyway (with a note)
5. **Parent confirmation** — auto-reply: "We've let your teacher know Sofia will be absent Tuesday. See you next time!"
6. **Group feed** — absence is NOT posted to the class group feed — it's private between parent, teacher, and admin only

### 5.4 Absence Visibility Rules

| Who | Can See |
|---|---|
| Admin / Super Admin | All absences for all classes |
| Teacher | Absences for their classes only |
| Parent | Their own child's absences only |
| Other parents | Never |

---

## 6. Privates — Visibility and Groups

### 6.1 BAM PRIVATES Group (Default)

One group for all active private session families. Shows:
- All upcoming private sessions as event cards in the feed
- Default: student name visible (social proof — parents see other families are booking privates)
- Admin can toggle per-student: if set to private, their sessions show as "Private Reservation" with teacher name only

### 6.2 Private Group Visibility Toggle

Admin → Student Profile → Privacy Settings:
- "Show private sessions in group feed" — toggle (default: ON)
- When OFF: student's privates show as "Private Reservation" in BAM PRIVATES feed and on studio calendar

### 6.3 Individual Private Session Threads (Optional)

When admin creates a private session, they can optionally create a dedicated thread:
- Members: parent + assigned teacher + admin
- Two-way chat enabled
- Used for: scheduling changes, session notes, invoicing questions
- Separate from the BAM PRIVATES group

---

## 7. Studio Calendar Integration

The studio calendar reflects all group events:

- **Classes** — show with class name, teacher, room
- **Private sessions** — show as "Private Reservation — [Teacher Name]" (never student name on public-facing calendar)
- **Rehearsals/Productions** — show with production name and cast info
- **Closures** — show as studio closed

Parents see only events relevant to their enrolled classes and private sessions. Teachers see their own schedule. Admin sees everything.

---

## 8. Quiet Hours

Notifications are suppressed between configurable quiet hours. BAM default: 9:00 PM – 8:00 AM.

- Push notifications queued and delivered at 8:00 AM
- SMS never sent during quiet hours (TCPA compliance)
- In-app messages delivered immediately (user can check whenever)
- Urgent messages (cancellation, emergency) bypass quiet hours — admin-flagged

---

## 9. Notification Routing Rules

| Event | Teacher | Admin | Affected Parent | Group |
|---|---|---|---|---|
| Absence confirmed | ✅ Push | ✅ In-app | ✅ Confirmation | ❌ |
| Private session created | ✅ In-app | ✅ In-app | ✅ Push | ✅ BAM PRIVATES feed |
| Class cancelled | ✅ Push | ✅ In-app | ✅ Push + SMS | ✅ Class feed |
| New announcement | ✅ In-app | — | ✅ Push | ✅ Group feed |
| Schedule change | ✅ Push | ✅ Push | ✅ Push + SMS | ✅ Group feed |
| Direct message | ✅ Push | ✅ Push | ✅ Push | ❌ |
| Cancellation risk detected | — | ✅ URGENT push | — | ❌ |

---

## 10. Admin Group Management

### Settings → Groups

- List of all groups with member count, chat mode, last activity
- Create custom group
- Add/remove members
- Toggle chat mode (broadcast ↔ two-way)
- Toggle privates visibility per student
- Archive group (hides from all members, preserves history)

### Group Member Control

- Admin can add parents to any group manually
- Admin can remove parents from any group
- Teacher can see their group members but cannot add/remove
- Parents cannot add other parents

---

## 11. Database Schema Additions

```sql
-- Groups (the core Band equivalent)
CREATE TABLE IF NOT EXISTS communication_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  description     text,
  group_type      text NOT NULL
    CHECK (group_type IN ('class','production','privates','private_session','studio_wide','custom')),
  chat_mode       text NOT NULL DEFAULT 'broadcast'
    CHECK (chat_mode IN ('broadcast','two_way','disabled')),
  class_id        uuid REFERENCES classes(id),
  production_id   uuid REFERENCES productions(id),
  private_session_id uuid REFERENCES private_sessions(id),
  is_active       boolean DEFAULT true,
  quiet_hours_start time DEFAULT '21:00',
  quiet_hours_end   time DEFAULT '08:00',
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Group members
CREATE TABLE IF NOT EXISTS communication_group_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  group_id        uuid NOT NULL REFERENCES communication_groups(id),
  profile_id      uuid NOT NULL REFERENCES profiles(id),
  role            text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin','moderator','member')),
  can_post        boolean DEFAULT false,  -- overrides chat_mode for this member
  notifications_enabled boolean DEFAULT true,
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(group_id, profile_id)
);

-- Group feed posts
CREATE TABLE IF NOT EXISTS group_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  group_id        uuid NOT NULL REFERENCES communication_groups(id),
  author_id       uuid NOT NULL REFERENCES profiles(id),
  post_type       text NOT NULL
    CHECK (post_type IN ('announcement','event','absence_notice','schedule_change','file','poll')),
  content         text,
  metadata        jsonb DEFAULT '{}',
    -- for events: { event_date, start_time, end_time, location, session_id }
    -- for files: { file_url, file_name, file_size }
    -- for polls: { question, options[], closes_at }
  is_pinned       boolean DEFAULT false,
  view_count      integer DEFAULT 0,
  is_auto_generated boolean DEFAULT false,
  related_session_id uuid,
  related_class_id   uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Post reactions
CREATE TABLE IF NOT EXISTS group_post_reactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid NOT NULL REFERENCES group_posts(id),
  profile_id      uuid NOT NULL REFERENCES profiles(id),
  emoji           text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(post_id, profile_id, emoji)
);

-- Absence records
CREATE TABLE IF NOT EXISTS absence_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  class_id        uuid REFERENCES classes(id),
  schedule_instance_id uuid REFERENCES schedule_instances(id),
  absence_date    date NOT NULL,
  reported_by     uuid REFERENCES profiles(id),
  report_channel  text NOT NULL
    CHECK (report_channel IN ('portal','email','sms','chat','phone','manual')),
  parent_note     text,
  status          text NOT NULL DEFAULT 'excused'
    CHECK (status IN ('excused','unexcused','present_override')),
  override_by     uuid REFERENCES profiles(id),
  override_note   text,
  notified_teacher_at timestamptz,
  notified_admin_at   timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Student privacy settings
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS privates_visible_in_group boolean DEFAULT true;
```

---

## 12. Decisions Log

| # | Decision |
|---|---|
| 1 | One BAM PRIVATES group for all privates — with per-student visibility toggle |
| 2 | Private sessions show as "Private Reservation + teacher name" on studio calendar — never student name |
| 3 | Default: student privates ARE visible in group feed (social proof) — admin can hide per student |
| 4 | Individual private session threads are optional — admin decides at booking time |
| 5 | Broadcast mode: no input shown to parents — banner with [Message Teacher] and [Contact Admin] buttons |
| 6 | No notification pushed when chat mode changes — banner in chat explains it |
| 7 | Two-way chat configurable per group — rehearsals and productions may want it |
| 8 | Absence flow: parent selects class from list of their enrolled classes |
| 9 | AI detects absence in email/SMS/chat and confirms class selection with parent |
| 10 | Confirmed absence: teacher gets push, admin gets in-app, attendance pre-marked as excused |
| 11 | Absence NOT posted to group feed — private between parent/teacher/admin only |
| 12 | Override: teacher can mark as present if student shows up despite reported absence |
| 13 | Quiet hours: 9pm–8am default — push and SMS suppressed, in-app delivered immediately |
| 14 | Urgent messages (cancellation, emergency) bypass quiet hours |
| 15 | Admin controls group membership — teachers can see but not modify |
| 16 | Auto-posts created when: private session created, class cancelled, schedule changed |
