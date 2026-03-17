# COMMUNICATIONS.md
# Ballet Academy and Movement — Platform Module Specification
# Communications, Messaging & Staff Visibility

**Version:** 2.0
**Status:** Spec — Authoritative
**Author:** Derek Shaw / Green Lyzard
**Replaces:** COMMUNICATIONS_AND_STAFF_VISIBILITY.md (v1), any prior messaging spec
**Related Modules:**
- CLAUDE.md
- DATABASE_SCHEMA.md
- CALENDAR_AND_SCHEDULING.md
- CASTING_AND_REHEARSAL.md
- ATTENDANCE.md
- INTEGRATIONS.md (Quo SMS, Resend email)
- ANGELINA_AND_CLAUDE_API.md

---

## Guiding Principle: The Bible

Every parent, student, and teacher should be trained — through consistent
experience — to treat this platform as the single source of truth for
everything related to BAM. Class schedules, announcements, rehearsal notes,
costume reminders, performance call times, teacher messages, payment receipts:
all of it lives here.

When something important happens, parents should not be looking at a text
thread, digging through their email, or asking another parent in the parking
lot. They should open the app and find the answer immediately.

This is only achievable if the communications layer is reliable, fast,
and beautiful enough that it becomes habitual. Every design decision
in this module should be evaluated against one question: does this make
parents more likely to check here first?

---

## 1. Communication Architecture Overview

### 1.1 Channel Types

The platform supports five distinct communication surfaces. Each has a
different purpose and a different set of participants. They are unified
in the super admin view but presented appropriately in role-specific views.

| Surface | Purpose | Initiated By |
|---|---|---|
| **Groups** | Class and production-based group messaging with message boards, announcements, and embedded events | Auto-created on activation |
| **Direct Messages** | 1:1 messaging between any two platform members | Any authenticated user |
| **Studio Announcements** | Studio-wide broadcast from admin to all families, all teachers, or targeted segments | Admin / super_admin only |
| **Email Threads** | Inbound and outbound email correspondence (parents emailing the studio) | Parents / admin |
| **SMS Threads** | Text message conversations via Quo | Admin / super_admin only (outbound) |

### 1.2 Channel Subtypes

Groups are further broken down by subtype:

| Subtype | Auto-Created When | Members |
|---|---|---|
| `class_group` | Class `status` → `'active'` | Teacher + parents of enrolled students |
| `production_group` | Production `is_published` → `true` | All cast parents + teachers involved |
| `admin_group` | Manually by admin | Any combination of staff |
| `parent_group` | Admin-enabled feature (Phase 3) | Parents within a class group, opt-in |
| `student_group` | Admin-enabled feature (Phase 4) | Students 13+ within a class, monitored |

### 1.3 The Unified Admin View

Every communication surface — in-app groups, DMs, email threads, SMS threads,
Angelina chat logs, lead conversations — is visible to super_admin in a single
aggregated inbox at `/admin/communications`. This is not a list of isolated
tools. It is one feed, organized by recency, filterable by surface type,
participant, and group. Nothing is hidden from super_admin.

### 1.4 Angelina Integration

Angelina participates in communications in two modes:

**Mode 1 — Parent-Facing (public chatbot)**
Angelina converses with prospective and current families on the public website
and in the parent portal. All conversations are logged as `chat_sessions` and
surfaced in the admin communications view. Angelina can be configured by
admin to respond within a parent's group thread.

**Mode 2 — Staff Consultation (admin-only)**
Any super_admin or admin can open a private "Ask Angelina" thread from
any communication record — an email thread, a parent complaint, a tricky
situation. Angelina reads the full conversation history and advises:
"Here's how I'd suggest responding to this parent." These consultation
threads are admin-only and never visible to parents.

---

## 2. Groups: The Core Communication Surface

Groups are the Band-equivalent experience in this platform. They are the
primary place where ongoing studio communication happens — not email blasts,
not text chains. Each group has:

- A **message thread** (real-time chat, like Band's chat tab)
- A **message board** (threaded posts — announcements, rehearsal notes, costume
  reminders, event recaps — like Band's posts tab)
- An **events tab** (group-specific calendar events pulled from the scheduling module)
- A **members list** (role-aware, with group admin assignment)
- A **pinned announcement** (one pinned post always visible at top)
- A **group icon** (auto-generated from class/production, or custom uploaded by admin)

### 2.1 Message Thread vs. Message Board

These are distinct features within every group. Both live under the same
group — but they serve different purposes and have different behaviors.

**Message Thread (Chat)**
- Real-time, chronological
- Short messages, quick exchanges
- "Did you see the schedule change?" / "What time does rehearsal end?"
- Appears in unread badge count
- Parents and teachers both post (role-permissioned)
- No threading/replies depth beyond one level

**Message Board (Posts)**
- Long-form posts with titles
- Threaded comments per post
- Used for: rehearsal notes, costume information, performance logistics,
  class observations, event recaps, important reminders
- Posts can include attachments (Phase 2), embedded video (Phase 3)
- Only teachers and admins can create new posts by default
  (configurable: admin can grant post creation to parents in a group)
- Any member can comment on a post
- Posts are searchable by title and body content
- Posts can be pinned (one per group)

**Why this distinction matters:**
A parent looking for "what to bring to dress rehearsal" should find a
well-organized post — not scroll through 200 chat messages. The board is
the reference layer. The thread is the conversation layer.

### 2.2 Events Tab

Each group has an events tab showing upcoming events relevant to that group.
Events are pulled from the scheduling module (`schedule_instances`) filtered
to the group's associated class or production. They are read-only in this view.
Admin can add a group-specific note to any event (visible in the group only).

Events shown in group tabs:
- Regular class sessions (for class groups)
- Rehearsals (for production groups and class groups with rehearsals)
- Performances
- Studio closures affecting this group

Parents can add any event to their personal calendar directly from the
events tab (Google, Apple, download ICS).

### 2.3 Auto-Created Groups

**Class Groups**

Trigger: `classes.status` changes to `'active'`

Members auto-added:
- Teacher (`classes.teacher_id`) → added as group `admin`
- All parents of enrolled students — resolved via:
  `enrollments.student_id` → `students.parent_id` → `profiles.id`
  (only enrollments where `enrollments.status = 'active'`)

Group name: `{class.name}` (e.g. "Ballet II — Fall 2025")
Group icon: auto-generated initials from class name; replaceable by admin

When a new student enrolls in an active class:
- Their parent is automatically added to the class group

When a student drops:
- Their parent is removed from the class group
- A system message is posted: "A student has left this class."
  (no name — privacy)

**Production Groups**

Trigger: `productions.is_published` changes to `true`

Members auto-added:
- All teachers involved in the production (via production_dances → dances
  → class → teacher_id)
- All parents of cast students — resolved via:
  `production_dances.dance_id` → join to casting records → student →
  `students.parent_id` → `profiles.id`
- Super_admin and admin always added

Group name: `{productions.name}` (e.g. "The Nutcracker 2025")

### 2.4 Manually Created Groups

Admins can create groups manually for any purpose:
- All-staff groups
- Specific cohort groups ("Advanced Students Parents 2025")
- Event-specific groups ("Nutcracker Parent Volunteers")
- Administrative working groups

Manual groups support all the same features as auto-created groups.
Manual groups do not auto-add members — admin selects members individually
or from a class/enrollment filter.

---

## 3. Direct Messages

Any authenticated user can start a direct message with any other authenticated
user within the same tenant. DMs support:
- Real-time chat (same realtime subscription as group threads)
- Message threading (reply to a specific message)
- Soft delete (sender can delete within 15 minutes)
- Edit (sender can edit, marked as "edited")

**Teacher DM restriction:**
When a parent initiates a DM with a teacher (or vice versa), the message
arrives in the teacher's DM inbox. However, the teacher cannot see the
parent's email address, phone number, or any contact data. The DM is the
only contact channel teachers have with parents. This is enforced at the
data layer — the DM record contains `profile_id` references, and teacher
queries never join to `profiles.email` or `profiles.phone`.

Super_admin can view all DMs in the unified admin inbox.

---

## 4. Studio Announcements

Studio-wide announcements are push communications from admin to defined
recipient groups. They are not conversations — they are broadcasts. Recipients
cannot reply to an announcement (they can be directed to a group thread
or DM to respond).

Announcements are sent via:
- **In-app notification** (push to all active sessions and devices)
- **Email** (via Resend, using the branded email template system)
- **SMS** (via Quo, for time-sensitive announcements only — opt-in by parents)

### 4.1 Recipient Targeting

Admin can target announcements to:
- All families (all active parents)
- All teachers
- All staff (teachers + admin)
- By class (all parents in a specific class)
- By enrollment status (enrolled / trial / waitlist)
- By season
- Custom manual selection

### 4.2 Announcement Record

Every announcement is stored as a `studio_announcements` record and appears:
- In each recipient's notifications panel
- In the admin communications unified view
- In each recipient's group's events/posts tab (if class-targeted)

### 4.3 Announcement Scheduling

Announcements can be scheduled for future delivery (e.g. send Monday at 8am).
Scheduled announcements are held in `pending` status and dispatched by a
Vercel cron job.

---

## 5. Email Threads

Inbound email to `dance@bamsocal.com` (or any configured studio address)
is captured in `communication_threads` + `communication_messages`. This
system already exists in the database and is preserved as-is.

### 5.1 Existing Schema (preserved)

`communication_threads` — one record per email conversation thread
`communication_messages` — each individual email (inbound + outbound)

These tables are the source of truth for email. They are surfaced in:
- The admin communications unified view
- The admin leads pipeline (if the thread is linked to a lead)

### 5.2 Email → In-App Linking

When a parent sends an email AND has a platform account, the system
attempts to match the sender email to `profiles.email`. If matched:
- The email thread is linked to the profile
- Admin can see the parent's enrollment history alongside the email thread
- Admin can initiate a DM from the email thread view

### 5.3 Email Outbound

Admin can reply to email threads from within the platform. Replies are sent
via Resend using the studio's branded email templates. Replies are stored
as `communication_messages` records with `direction = 'outbound'`.

---

## 6. SMS Threads (via Quo)

SMS is a separate communication surface — it is not the same as in-app
messaging. SMS is for reaching parents who may not have the app open.

### 6.1 Quo Integration

The platform uses Quo (formerly OpenPhone) as the SMS provider. Credentials
are stored in `tenant_integrations` (encrypted). The studio's Quo number
(`(949) 229-0846`) is the sending number for all SMS.

Inbound SMS from parents arrives at the Quo webhook endpoint
(`/api/webhooks/quo`) and is stored in `sms_threads` + `sms_messages`.

### 6.2 SMS Use Cases

| Use Case | Triggered By | Recipients |
|---|---|---|
| Class cancellation notification | Approval of a cancellation change request | All enrolled parents |
| Reminder — class today | Automated cron (configurable per tenant) | Opted-in parents |
| Trial class reminder | Day before a trial booking | Trial parent |
| Custom blast | Admin composing in platform | Admin-selected recipients |
| Inbound reply | Parent texts the studio number | Routed to admin SMS inbox |

### 6.3 SMS Opt-In

Parents opt in to SMS during onboarding. SMS preference is stored on
`profiles` (a `sms_opt_in` boolean field — to be added in this migration).
Admin can override per-parent.

### 6.4 SMS Schema

```sql
sms_threads (
  id uuid PK,
  tenant_id uuid NOT NULL,
  profile_id uuid REFERENCES profiles(id),  -- null if unmatched number
  phone_number text NOT NULL,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now()
)

sms_messages (
  id uuid PK,
  tenant_id uuid NOT NULL,
  thread_id uuid REFERENCES sms_threads(id),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  quo_message_id text,           -- Quo's own message ID for dedup
  sent_by uuid REFERENCES profiles(id),  -- null if inbound
  status text DEFAULT 'delivered', -- sent | delivered | failed
  created_at timestamptz DEFAULT now()
)
```

---

## 7. The Unified Admin View (`/admin/communications`)

This is the command center. Every communication surface in a single,
searchable, filterable view. Super admin can see everything. Admin can
see everything except admin-only Angelina consultations from other admins.

### 7.1 Surface Filter

The unified view can be filtered to show:
- All surfaces (default)
- In-app groups only
- Direct messages only
- Email threads only
- SMS threads only
- Angelina chat logs only

### 7.2 Layout

Left panel: list of all threads/channels sorted by `last_message_at` desc,
with surface type badge (In-App / Email / SMS / Angelina) and unread count.

Right panel: selected thread/channel rendered in full — messages, member list,
post board depending on surface type.

### 7.3 Admin Actions From Unified View

From any thread in the unified view, admin can:
- Reply (appropriate to surface — in-app message, email reply, or SMS)
- Add a note (internal, never sent to parent)
- Link to a profile or student record
- Start an Angelina consultation ("Ask Angelina about this")
- Archive the thread
- Flag for follow-up with a due date

### 7.4 Angelina Consultation Mode

From any communication record, super_admin or admin can click
"Ask Angelina" which opens a private consultation panel. Angelina
receives the full thread context plus a system prompt:

```
You are advising an administrator at Ballet Academy and Movement.
You have been given a communication record below.
Suggest how the studio should respond — tone, content, and
any follow-up actions. Keep your advice warm, professional,
and aligned with Amanda Cobb's communication style.
[Thread content injected here]
```

The admin can then ask follow-up questions ("should we offer a refund?",
"how do we tell this parent their child isn't ready to advance?").
Angelina's responses are stored in `angelina_admin_consultations` — never
visible to parents.

---

## 8. Search

Full-text search across all communication surfaces. Available to admin
in the unified view, and available to individual users within their
accessible channels.

### 8.1 Searchable Content

| Content | Who Can Search |
|---|---|
| Group chat messages | Group members |
| Group board posts + comments | Group members |
| Group event titles/notes | Group members |
| DM messages | Participants only |
| Email thread subjects + body | Admin only |
| SMS thread bodies | Admin only |
| Angelina chat logs | Admin only |
| Studio announcements | All (in their notifications history) |

### 8.2 Search Implementation

Search is implemented using Postgres full-text search (`tsvector`/`tsquery`).
Each searchable table gets a generated `search_vector` column updated by trigger.

Admin search hits all surfaces. User search is scoped to their membership.
Results are ranked by recency and relevance and grouped by surface type.

---

## 9. Notifications & Delivery

### 9.1 Notification Types

| Type | Delivery | Description |
|---|---|---|
| `new_message` | In-app badge + push | New message in a group or DM |
| `new_post` | In-app badge + email (daily digest) | New board post in a group |
| `new_comment` | In-app badge | Comment on a post you participated in |
| `announcement` | In-app + email + SMS (if opted in) | Studio announcement |
| `mention` | In-app + email | @mentioned in any message or post |
| `event_reminder` | In-app + email | Upcoming event in a subscribed group |
| `schedule_change` | In-app + email + SMS | Class cancelled, time changed |

### 9.2 Parent Notification Preferences

Parents can configure per-group notification preferences:
- All messages
- Mentions only
- Posts only (no chat)
- Muted (no notifications, can still read)

Studio announcements cannot be muted — they always deliver in-app.
Email/SMS for announcements can be toggled off by the parent.

### 9.3 Delivery Stack

| Channel | Provider | Use Case |
|---|---|---|
| In-app realtime | Supabase Realtime | Immediate message delivery |
| Email | Resend | Posts, announcements, digests, schedule changes |
| SMS | Quo | Time-sensitive announcements, cancellations, reminders |
| Marketing email | Klaviyo | Lead nurture, enrollment campaigns (not communications) |

Klaviyo is NOT used for operational communications. It is strictly for
marketing: lead nurture, enrollment campaigns, re-engagement. Operational
communications (class updates, rehearsal notes, schedule changes) all go
through Resend and Quo.

---

## 10. Participant Layers & Permissions

### 10.1 Role Access Matrix

| Feature | super_admin | admin | teacher | parent | student (13+) |
|---|---|---|---|---|---|
| Create studio announcement | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create group manually | ✅ | ✅ | ❌ | ❌ | ❌ |
| Post to group board | ✅ | ✅ | Own groups ✅ | ❌ (Phase 3: opt-in) | ❌ |
| Comment on board post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send group chat message | ✅ | ✅ | Own groups ✅ | Own groups ✅ | Own groups ✅ (Phase 4) |
| Pin announcement | ✅ | ✅ | Own groups ✅ | ❌ | ❌ |
| Send DM | ✅ | ✅ | ✅ (no contact data) | ✅ | Phase 4 |
| Reply to email thread | ✅ | ✅ | ❌ | ❌ | ❌ |
| Send SMS | ✅ | ✅ | ❌ | ❌ | ❌ |
| View unified admin inbox | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Angelina chat logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ask Angelina (consultation) | ✅ | ✅ | ❌ | ❌ | ❌ |
| View other teachers' students | ❌ | ✅ | ❌ | ❌ | ❌ |
| See parent contact info | ✅ | ✅ | ❌ | ❌ | ❌ |
| Moderate student group | ✅ | ✅ | Own groups ✅ | ❌ | ❌ |

### 10.2 The Contact Firewall

Teachers communicate with parents **only through the platform**. They never
see a parent's email address or phone number — not in DMs, not in group member
lists, not in roster views. This is enforced at three levels:

1. **RLS** — `profiles.email` and `profiles.phone` are excluded from all
   teacher-role queries at the database level
2. **Query layer** — all teacher API routes strip contact fields before
   returning data
3. **UI layer** — no teacher-facing component renders email or phone

A teacher who tries to access parent contact info gets a 403 at the database,
not a hidden UI element. The protection is structural, not cosmetic.

This protects BAM from student poaching — a teacher cannot use platform data
to build a contact list for a private studio.

### 10.3 Parent-to-Parent Chat (Phase 3)

By default, parents in a group cannot message each other — they can only
message the teacher or admin. In Phase 3, admin can enable parent-to-parent
chat within a specific class group. When enabled:
- Parents can see other parents' display names in the group
- Parents can send messages in the group chat visible to all members
- Parents can DM each other within the platform (no contact data exposed)
- All parent-to-parent messages are visible to teacher and admin
- Admin can disable at any time, which archives all parent chat history

Parent-to-parent chat is opt-in per group, not a platform-wide setting.

### 10.4 Student Safe Space (Phase 4)

For students 13 and older, admin can enable a student group within a class.
The student group is a monitored environment:
- Students can message each other and the teacher
- All messages are visible to the teacher (group admin) and all platform admins
- Content moderation rules are enforced (profanity filter, configurable)
- Parents of students 13–17 can see their child's messages (toggle in parent portal)
- If a message is flagged by the moderation filter, teacher and admin are notified
  immediately
- Students cannot see other students' contact information
- Students cannot DM each other outside of the group context (Phase 4)

The student group is explicitly framed to parents and students as a
moderated, school-like environment — not a private messaging app.

---

## 11. Database Schema

### 11.1 Tables to Preserve (existing, do not modify)

```
communication_threads   — email thread records
communication_messages  — individual email messages (inbound/outbound)
```

These continue to serve the email CRM surface. Do not add columns or
change existing columns. New fields (like profile linking) are added
via a separate join table.

### 11.2 Tables to Drop and Replace

```
message_threads   — DROP (empty, replaced by channels)
messages          — DROP (empty, replaced by channel_messages)
```

Both are confirmed empty. Drop them in the migration before creating
the new schema to avoid naming conflicts.

### 11.3 New Tables

```sql
-- ─────────────────────────────────────────────
-- CHANNELS (replaces message_threads)
-- ─────────────────────────────────────────────
CREATE TABLE channels (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  type              text NOT NULL CHECK (type IN (
                      'class_group',
                      'production_group',
                      'admin_group',
                      'parent_group',
                      'student_group',
                      'direct_message',
                      'announcement',
                      'general'
                    )),
  icon_url          text,
  is_archived       boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Linked objects (nullable — only set for auto-created channels)
  class_id          uuid REFERENCES classes(id) ON DELETE SET NULL,
  production_id     uuid REFERENCES productions(id) ON DELETE SET NULL,
  -- Denormalized for sidebar sort
  last_message_at   timestamptz,
  -- Pinned board post (set by admin/teacher)
  pinned_post_id    uuid,  -- FK added after channel_posts table
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- CHANNEL MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE channel_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz,
  is_muted      boolean NOT NULL DEFAULT false,
  UNIQUE (channel_id, profile_id)
);

-- ─────────────────────────────────────────────
-- CHANNEL MESSAGES (chat thread)
-- ─────────────────────────────────────────────
CREATE TABLE channel_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                  CHECK (message_type IN ('text', 'system')),
  reply_to_id   uuid REFERENCES channel_messages(id) ON DELETE SET NULL,
  edited_at     timestamptz,
  deleted_at    timestamptz,  -- soft delete
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
                  to_tsvector('english', coalesce(content, ''))
                ) STORED
);

-- ─────────────────────────────────────────────
-- CHANNEL POSTS (message board)
-- ─────────────────────────────────────────────
CREATE TABLE channel_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id     uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title          text NOT NULL,
  body           text NOT NULL,
  is_pinned      boolean NOT NULL DEFAULT false,
  is_announcement boolean NOT NULL DEFAULT false,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  search_vector  tsvector GENERATED ALWAYS AS (
                   to_tsvector('english',
                     coalesce(title, '') || ' ' || coalesce(body, ''))
                 ) STORED
);

-- ─────────────────────────────────────────────
-- CHANNEL POST COMMENTS
-- ─────────────────────────────────────────────
CREATE TABLE channel_post_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES channel_posts(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content     text NOT NULL,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz
);

-- ─────────────────────────────────────────────
-- SMS THREADS
-- ─────────────────────────────────────────────
CREATE TABLE sms_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  phone_number    text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- SMS MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE sms_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id      uuid NOT NULL REFERENCES sms_threads(id) ON DELETE CASCADE,
  direction      text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body           text NOT NULL,
  quo_message_id text UNIQUE,
  sent_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'delivered'
                   CHECK (status IN ('sent', 'delivered', 'failed')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- STUDIO ANNOUNCEMENTS
-- ─────────────────────────────────────────────
CREATE TABLE studio_announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text NOT NULL,
  author_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Targeting
  target_type     text NOT NULL DEFAULT 'all_families'
                    CHECK (target_type IN (
                      'all_families', 'all_teachers', 'all_staff',
                      'class', 'custom'
                    )),
  target_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  target_profile_ids uuid[],  -- for custom targeting
  -- Delivery channels
  send_in_app     boolean NOT NULL DEFAULT true,
  send_email      boolean NOT NULL DEFAULT true,
  send_sms        boolean NOT NULL DEFAULT false,
  -- Scheduling
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'sent')),
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ANGELINA ADMIN CONSULTATIONS
-- (private — never visible to parents)
-- ─────────────────────────────────────────────
CREATE TABLE angelina_admin_consultations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- What communication context this consultation is about
  context_type     text CHECK (context_type IN (
                     'channel_message', 'email_thread',
                     'sms_thread', 'lead', 'general'
                   )),
  context_id       uuid,  -- ID of the relevant record
  messages         jsonb NOT NULL DEFAULT '[]',
  -- [{role: 'user'|'assistant', content: string, timestamp: ISO}]
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now()
);

-- Add SMS opt-in to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;
```

### 11.4 Indexes

```sql
-- channels
CREATE INDEX idx_channels_tenant       ON channels(tenant_id);
CREATE INDEX idx_channels_class        ON channels(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_channels_production   ON channels(production_id) WHERE production_id IS NOT NULL;
CREATE INDEX idx_channels_last_message ON channels(tenant_id, last_message_at DESC NULLS LAST);

-- channel_members
CREATE INDEX idx_channel_members_profile  ON channel_members(profile_id);
CREATE INDEX idx_channel_members_channel  ON channel_members(channel_id);

-- channel_messages
CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id, created_at DESC);
CREATE INDEX idx_channel_messages_search  ON channel_messages USING GIN(search_vector);

-- channel_posts
CREATE INDEX idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);
CREATE INDEX idx_channel_posts_pinned  ON channel_posts(channel_id) WHERE is_pinned = true;
CREATE INDEX idx_channel_posts_search  ON channel_posts USING GIN(search_vector);

-- channel_post_comments
CREATE INDEX idx_post_comments_post ON channel_post_comments(post_id, created_at ASC);

-- sms
CREATE INDEX idx_sms_threads_tenant  ON sms_threads(tenant_id);
CREATE INDEX idx_sms_threads_profile ON sms_threads(profile_id);
CREATE INDEX idx_sms_messages_thread ON sms_messages(thread_id, created_at DESC);

-- studio_announcements
CREATE INDEX idx_announcements_tenant ON studio_announcements(tenant_id, created_at DESC);
```

### 11.5 FK from channels → channel_posts (pinned post)

```sql
ALTER TABLE channels
  ADD CONSTRAINT fk_channels_pinned_post
  FOREIGN KEY (pinned_post_id)
  REFERENCES channel_posts(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
```

---

## 12. Triggers

### 12.1 Update channels.last_message_at on new message

```sql
CREATE OR REPLACE FUNCTION fn_update_channel_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE channels
    SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_channel_message_inserted
  AFTER INSERT ON channel_messages
  FOR EACH ROW EXECUTE FUNCTION fn_update_channel_last_message();
```

### 12.2 Auto-create class_group channel

**Note on parent resolution:**
`enrollments` has no `parent_profile_id`. Parents are resolved via:
`enrollments.student_id` → `students.parent_id` → `profiles.id`

```sql
CREATE OR REPLACE FUNCTION fn_auto_create_class_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  IF (OLD.status IS DISTINCT FROM 'active') AND (NEW.status = 'active') THEN
    IF EXISTS (SELECT 1 FROM channels WHERE class_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    INSERT INTO channels (tenant_id, name, type, class_id)
    -- Note: classes has no tenant_id column — use profile_roles to get tenant
    -- from teacher, or rely on application layer to pass tenant_id
    -- This trigger is best completed in the application layer via server action
    -- See: src/lib/communications/auto-channels.ts
    VALUES (
      (SELECT pr.tenant_id FROM profile_roles pr
       WHERE pr.user_id = NEW.teacher_id
         AND pr.is_active = true LIMIT 1),
      NEW.name,
      'class_group',
      NEW.id
    )
    RETURNING id INTO v_channel_id;

    -- Add teacher as channel admin
    IF NEW.teacher_id IS NOT NULL THEN
      INSERT INTO channel_members (channel_id, profile_id, role)
      VALUES (v_channel_id, NEW.teacher_id, 'admin')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Add parents of enrolled students
    -- enrollments → students.parent_id chain
    INSERT INTO channel_members (channel_id, profile_id, role)
    SELECT DISTINCT v_channel_id, s.parent_id, 'member'
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.class_id = NEW.id
      AND e.status = 'active'
      AND s.parent_id IS NOT NULL
    ON CONFLICT DO NOTHING;

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_class_active_create_channel
  AFTER UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_class_channel();
```

### 12.3 Auto-create production_group channel

**Note:** `productions` uses `is_published boolean`, not a `status` column.
**Note:** `production_dances` has no `student_id` — students are linked via
dances → casting records. The application layer handles complex member
resolution. The trigger creates the channel; the server action populates members.

```sql
CREATE OR REPLACE FUNCTION fn_auto_create_production_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  IF (OLD.is_published = false) AND (NEW.is_published = true) THEN
    IF EXISTS (SELECT 1 FROM channels WHERE production_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- productions has no tenant_id — resolved via application layer
    -- This trigger creates the shell; server action populates members
    INSERT INTO channels (tenant_id, name, type, production_id)
    VALUES (
      NEW.tenant_id,   -- productions DOES have tenant_id per schema
      NEW.name,
      'production_group',
      NEW.id
    )
    RETURNING id INTO v_channel_id;

    -- Member population handled by server action:
    -- src/lib/communications/auto-channels.ts → populateProductionChannel()

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_production_published_create_channel
  AFTER UPDATE ON productions
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_production_channel();
```

### 12.4 Auto-add parent when student enrolls in active class

```sql
CREATE OR REPLACE FUNCTION fn_add_parent_to_class_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_channel_id uuid;
  v_parent_id  uuid;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT id INTO v_channel_id FROM channels
    WHERE class_id = NEW.class_id AND type = 'class_group' LIMIT 1;

    SELECT parent_id INTO v_parent_id FROM students WHERE id = NEW.student_id;

    IF v_channel_id IS NOT NULL AND v_parent_id IS NOT NULL THEN
      INSERT INTO channel_members (channel_id, profile_id, role)
      VALUES (v_channel_id, v_parent_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- If dropping, remove parent (only if they have no other children in same class)
  IF NEW.status IN ('dropped', 'cancelled') AND OLD.status = 'active' THEN
    SELECT id INTO v_channel_id FROM channels
    WHERE class_id = NEW.class_id AND type = 'class_group' LIMIT 1;

    SELECT parent_id INTO v_parent_id FROM students WHERE id = NEW.student_id;

    IF v_channel_id IS NOT NULL AND v_parent_id IS NOT NULL THEN
      -- Only remove if no other active siblings in same class
      IF NOT EXISTS (
        SELECT 1 FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE e.class_id = NEW.class_id
          AND e.status = 'active'
          AND s.parent_id = v_parent_id
          AND e.id != NEW.id
      ) THEN
        DELETE FROM channel_members
        WHERE channel_id = v_channel_id AND profile_id = v_parent_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollment_sync_channel_member
  AFTER UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_add_parent_to_class_channel();

CREATE TRIGGER trg_enrollment_insert_sync_channel_member
  AFTER INSERT ON enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_add_parent_to_class_channel();
```

### 12.5 get_or_create_dm_channel function

```sql
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(
  p_tenant_id  uuid,
  p_profile_a  uuid,
  p_profile_b  uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  SELECT c.id INTO v_channel_id
  FROM channels c
  JOIN channel_members cm1 ON cm1.channel_id = c.id AND cm1.profile_id = p_profile_a
  JOIN channel_members cm2 ON cm2.channel_id = c.id AND cm2.profile_id = p_profile_b
  WHERE c.tenant_id = p_tenant_id AND c.type = 'direct_message'
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO channels (tenant_id, name, type)
    VALUES (p_tenant_id, 'Direct Message', 'direct_message')
    RETURNING id INTO v_channel_id;

    INSERT INTO channel_members (channel_id, profile_id, role) VALUES
      (v_channel_id, p_profile_a, 'owner'),
      (v_channel_id, p_profile_b, 'member');
  END IF;

  RETURN v_channel_id;
END;
$$;
```

---

## 13. RLS Policies

### 13.1 Channels

```sql
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- Members see their channels
CREATE POLICY "channel_members_can_view"
  ON channels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channels.id
        AND cm.profile_id = auth.uid()
    )
  );

-- Admins see all tenant channels
CREATE POLICY "admins_view_all_channels"
  ON channels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = channels.tenant_id
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
  );

-- Admins create channels
CREATE POLICY "admins_create_channels"
  ON channels FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = channels.tenant_id
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
  );

-- Admins and channel owners update channels
CREATE POLICY "admins_update_channels"
  ON channels FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = channels.tenant_id
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channels.id
        AND cm.profile_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );
```

### 13.2 Channel Messages

```sql
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Members read messages (non-deleted)
CREATE POLICY "members_read_messages"
  ON channel_messages FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.profile_id = auth.uid()
    )
  );

-- Admins read all
CREATE POLICY "admins_read_all_messages"
  ON channel_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN profile_roles pr ON pr.tenant_id = c.tenant_id
      WHERE c.id = channel_messages.channel_id
        AND pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
  );

-- Members send messages to their channels
CREATE POLICY "members_send_messages"
  ON channel_messages FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.profile_id = auth.uid()
    )
  );

-- Senders edit own messages
CREATE POLICY "senders_edit_own"
  ON channel_messages FOR UPDATE USING (
    sender_id = auth.uid() AND deleted_at IS NULL
  );
```

### 13.3 Channel Posts

```sql
ALTER TABLE channel_posts ENABLE ROW LEVEL SECURITY;

-- Members read posts
CREATE POLICY "members_read_posts"
  ON channel_posts FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_posts.channel_id
        AND cm.profile_id = auth.uid()
    )
  );

-- Only channel admins and platform admins can create posts
-- (configurable: admin can grant to parents via channel settings)
CREATE POLICY "admins_and_channel_admins_create_posts"
  ON channel_posts FOR INSERT WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.channel_id = channel_posts.channel_id
          AND cm.profile_id = auth.uid()
          AND cm.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM channels c
        JOIN profile_roles pr ON pr.tenant_id = c.tenant_id
        WHERE c.id = channel_posts.channel_id
          AND pr.user_id = auth.uid()
          AND pr.role IN ('admin', 'super_admin')
          AND pr.is_active = true
      )
    )
  );
```

### 13.4 SMS and Angelina Consultations (admin only)

```sql
ALTER TABLE sms_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE angelina_admin_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can see SMS data
CREATE POLICY "admins_only_sms_threads"
  ON sms_threads FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = sms_threads.tenant_id
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
  );

CREATE POLICY "admins_only_sms_messages"
  ON sms_messages FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sms_threads st
      JOIN profile_roles pr ON pr.tenant_id = st.tenant_id
      WHERE st.id = sms_messages.thread_id
        AND pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'super_admin')
        AND pr.is_active = true
    )
  );

-- Angelina consultations — admin who created them only
-- (super_admin can see all)
CREATE POLICY "admin_own_consultations"
  ON angelina_admin_consultations FOR ALL USING (
    admin_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = angelina_admin_consultations.tenant_id
        AND pr.role = 'super_admin'
        AND pr.is_active = true
    )
  );
```

---

## 14. Supabase Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE channels;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE studio_announcements;
```

---

## 15. Tenant Scoping Note

**`profiles` has no `tenant_id` column.** Tenant scoping for profiles is
done exclusively through `profile_roles`:

```sql
-- Pattern for all admin-scoped queries:
SELECT p.*
FROM profiles p
JOIN profile_roles pr ON pr.user_id = p.id
WHERE pr.tenant_id = '[tenant_uuid]'
  AND pr.is_active = true

-- Pattern for full name (profiles has no full_name column):
SELECT
  p.id,
  p.first_name || ' ' || p.last_name AS full_name,
  p.avatar_url,
  pr.role
FROM profiles p
JOIN profile_roles pr ON pr.user_id = p.id
WHERE pr.tenant_id = '[tenant_uuid]'
```

This pattern must be used in every query that needs to scope users to
a tenant or display a user's full name. No component or API route should
reference `profiles.full_name` or `profiles.tenant_id` — neither column exists.

---

## 16. UI Screens

### 16.1 Parent Portal

`/communications` — Sidebar (channels grouped by type) + selected channel view.

Each channel view has three tabs:
- **Chat** — real-time message thread
- **Board** — message board posts + comments
- **Events** — upcoming events for this group

`/communications/announcements` — Read-only list of all studio announcements
received. Searchable. Replaces the need to scroll email for "what did the
studio say?"

### 16.2 Teacher Portal

`/teacher/communications` — Same layout as parent, scoped to teacher's groups.
Teacher can post to board and chat in their own groups.

No contact data visible anywhere in teacher communications UI.

### 16.3 Admin Portal

`/admin/communications` — Unified inbox (all surfaces).
- Left: thread list with surface type badge, sorted by recency
- Right: selected thread rendered in full
- Top bar: surface filter, search bar, "New Announcement" button

`/admin/communications/sms` — SMS-only inbox view.
`/admin/communications/email` — Email thread inbox (communication_threads).
`/admin/communications/angelina` — Angelina chat log view.
`/admin/communications/announcements` — Announcement history + compose.

---

## 17. Build Order

### Phase 1 — Foundation (this build)
- [ ] Drop `message_threads` and `messages` tables (confirmed empty)
- [ ] Migrate: `channels`, `channel_members`, `channel_messages`,
      `channel_posts`, `channel_post_comments`
- [ ] Migrate: `sms_threads`, `sms_messages`
- [ ] Migrate: `studio_announcements`
- [ ] Migrate: `angelina_admin_consultations`
- [ ] Add `sms_opt_in` to `profiles`
- [ ] All triggers and RLS policies above
- [ ] Supabase Realtime publications
- [ ] `get_or_create_dm_channel` RPC
- [ ] Basic in-app chat UI (channel sidebar + chat thread + message input)
- [ ] Admin unified inbox `/admin/communications`

### Phase 2 — Full Group Experience
- [ ] Channel board (posts + comments)
- [ ] Events tab per group (pulls from schedule_instances)
- [ ] Group icon upload
- [ ] Pinned post / announcement banner
- [ ] Full-text search (channel_messages + channel_posts)
- [ ] Studio announcement composer + delivery
- [ ] Email thread view in admin unified inbox
- [ ] SMS inbox in admin unified inbox
- [ ] Angelina consultation mode (admin-only)

### Phase 3 — SMS + Parent Chat
- [ ] Quo inbound webhook + SMS thread UI
- [ ] Outbound SMS (schedule changes, cancellations)
- [ ] Parent-to-parent chat (admin-enabled per group)
- [ ] Parent notification preferences UI
- [ ] Email → profile matching

### Phase 4 — Student Safe Space
- [ ] Student group type with moderation layer
- [ ] Content moderation filter
- [ ] Parent visibility toggle for student messages
- [ ] Moderation alert system

---

## 18. Cross-Module Dependencies

| This Module | Depends On | For |
|---|---|---|
| Communications | `classes` (teacher_id, status) | Auto-create class groups |
| Communications | `enrollments` + `students` (parent_id) | Populate class group members |
| Communications | `productions` (is_published) | Auto-create production groups |
| Communications | `profile_roles` (tenant_id, role) | Tenant scoping, permission checks |
| Communications | `profiles` (first_name, last_name) | Display names — concatenated |
| Communications | CALENDAR_AND_SCHEDULING.md | Events tab in group view |
| Communications | INTEGRATIONS.md (Quo) | SMS send/receive |
| Communications | INTEGRATIONS.md (Resend) | Email delivery for announcements |
| Communications | ANGELINA_AND_CLAUDE_API.md | Admin consultation mode |
| Communications | ATTENDANCE.md | Trial attended → follow-up trigger |

---

## 19. What This Replaces

This spec supersedes and absorbs:
- `COMMUNICATIONS_AND_STAFF_VISIBILITY.md` v1 (the contact firewall rules
  are preserved and strengthened here in Section 10.2)
- Any prior in-app messaging spec referencing `message_threads` or `messages`

The `chat_sessions`, `leads`, and `lead_activities` tables defined in
COMMUNICATIONS_AND_STAFF_VISIBILITY.md v1 are **not** part of this module —
they belong to the lead/CRM module and remain unchanged.

---

*This spec must be read by Claude Code in full before any communications
migration, component, or API route is built or modified.*

*Last updated: March 2026 | Ballet Academy and Movement*
