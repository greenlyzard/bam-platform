 # COMMUNICATIONS.md
# Ballet Academy and Movement — Communications Module Spec
# Version: 2.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026 — full vision clarified

---

## 1. Overview

The Communications Module is the BAM platform's unified messaging hub.
It replaces BAND as the primary communication system for the studio.

**Core architecture:** Groups span all three channels simultaneously —
in-app chat, SMS, and email. A group is not tied to one channel; it is
a unified conversation that delivers to members across whichever
surfaces they use. All three surfaces converge into a single thread view.

**Key distinctions from BAND:**
- App-to-app chat is native (like BAND), but groups also reach members
  via SMS and email without requiring them to use the app
- Admins and Amanda can use Angelina AI to draft and send communications
  across any channel — but only after explicit human confirmation
- Full moderation tooling: delete, archive, mute, ban, flag
- Archived threads preserve visibility by role (not hard deleted)

Cross-references:
- SAAS.md — multi-tenant adapter pattern
- INTEGRATIONS.md — Quo/Twilio SMS, Resend email
- REGISTRATION_AND_ONBOARDING.md — welcome message triggers
- SCHEDULING_AND_LMS.md — class reminder triggers
- TEACHER_TIME_ATTENDANCE.md — private lesson scheduling
- CHATBOT_AND_LEAD_CAPTURE.md — Angelina AI assistant

---

## 2. Communication Surfaces

### 2.1 In-App Chat (Primary)
Native real-time messaging within the portal and mobile app.
Works app-to-app, exactly like BAND.

Available to:
- Super Admin, Studio Admin, Studio Manager
- Approved Teachers
- Parents of enrolled students
- Admitted/enrolled students (age-appropriate channels only)

### 2.2 SMS (via Quo or Twilio adapter)
- Outbound: group or admin message → delivered via SMS to member's phone
- Inbound: SMS replies → ingested via webhook → appear in the same thread
- Parents who don't use the app can participate via SMS with no login required
- All SMS activity is visible in the unified thread

### 2.3 Email (via Resend)
- Broadcast-style: announcements, newsletters, reminders
- Delivered to group members' email addresses
- Email replies are captured in the admin inbox (not threaded back into group)
- Email is primarily outbound at the group level

### 2.4 Unified Thread View
All three surfaces for a given group or DM are displayed in a single
thread in the portal. Each message is tagged with its delivery channel:

  💬 In-app
  📱 SMS
  ✉️ Email

---

## 3. Groups

### 3.1 What a Group Is
A Group is a named conversation container. It is not bound to a single
channel — it is a unified communication space that can reach members
via chat, SMS, and/or email simultaneously.

Examples:
- "Nutcracker Cast A" → chat + SMS for rehearsal updates
- "Petites — Fall 2025" → chat + email for weekly reminders
- "All Families" → SMS + email for studio-wide announcements

### 3.2 Group Modes
| Mode | Who Can Post | Use Case |
|---|---|---|
| Announcement | Admin / Teacher only | Class updates, reminders, studio news |
| Discussion | All members (moderated) | Cast communication, parent Q&A |

### 3.3 Group Creation
- Auto-created: when a class or production is activated in the system
- Manual: Admin creates custom groups as needed
- Only Admin or Super Admin can create or dissolve groups

### 3.4 Delivery Configuration Per Group
Each group has a configurable delivery setting:
- Chat only
- Chat + SMS
- Chat + Email
- All three

---

## 4. Membership & Access

### 4.1 Who Can Join Groups
| Role | Default Access | Added By |
|---|---|---|
| Super Admin | Auto-member of all groups | System |
| Studio Admin | Auto-member of all groups | System |
| Studio Manager | Auto-member of all groups | System |
| Teacher | Auto-added to their class groups | System / Admin |
| Parent | Added by Admin or approved request | Admin |
| Student | Added by Admin (age-appropriate only) | Admin |

### 4.2 Membership Rules
- Only Admin or Super Admin can add or remove members
- Parents cannot add themselves or other parents
- Teachers cannot add or remove members
- Parents may request to join a group; Admin approves or denies

### 4.3 Cross-Role Visibility
| Role | Sees |
|---|---|
| Parent | Only groups they belong to |
| Teacher | Their assigned groups + DMs they're part of |
| Studio Admin / Manager | All groups and all DMs across the tenant |
| Super Admin | Everything across all tenants |

---

## 5. Moderation

### 5.1 Permission Matrix
| Action | Teacher | Studio Admin | Super Admin |
|---|---|---|---|
| Delete own message | ✅ | ✅ | ✅ |
| Delete any message in group | ❌ | ✅ | ✅ |
| Archive a thread | ❌ | ✅ | ✅ |
| Unarchive a thread | ❌ | ✅ | ✅ |
| Remove member from group | ❌ | ✅ | ✅ |
| Mute a member | ❌ | ✅ | ✅ |
| Ban a member from a group | ❌ | ✅ | ✅ |
| Flag a message for review | ✅ | ✅ | ✅ |
| View flagged messages | ❌ | ✅ | ✅ |
| View archived threads | own messages only | all | all |

### 5.2 Message Deletion
- **Soft delete only** — content is never hard deleted from the database
- Deleted messages display as "[Message removed by moderator]" to members
- Original content is preserved in the database and visible to Admin and above
- Deletion is logged: deleted_by, deleted_at, original_body preserved

### 5.3 Thread Archiving
When Admin archives a thread within a group:
- Thread disappears from the main group feed for all members
- **Post-archive visibility by role:**
  - Super Admin / Studio Admin: full thread, all messages, read-only
  - Studio Manager: full thread, read-only
  - Teacher (participated): their own messages and direct replies to them only
  - Teacher (did not participate): no access
  - Parent (participated): their own messages only
  - Parent (did not participate): no access
  - Students: no access to archived threads
- Archive action is logged with optional Admin note (reason)
- Thread can be unarchived by Admin or Super Admin

### 5.4 Flagging System
- Any member can flag a message as inappropriate
- Flagged messages appear in Admin inbox under "Flagged" view
- Flag is anonymous to other members; only Admin sees who flagged
- Admin actions on flagged message:
  - Dismiss flag (no action)
  - Delete message
  - Remove member from group
  - Mute member
  - Escalate to Super Admin

### 5.5 Muting
- Admin mutes a member within a specific group for a set duration
- Muted member can read but cannot post
- Muted member sees their mute status and expiry time
- Mute expires automatically or can be lifted by Admin

---

## 6. Angelina AI — Communication Assistant

### 6.1 Access
**Super Admin and Studio Admin ONLY.**
This includes Amanda Cobb in her role as studio owner.
Teachers, parents, and students cannot use AI drafting.

### 6.2 What Angelina Can Do
- Draft a text (SMS) message to a group or all families
- Draft an in-app chat broadcast
- Draft an email announcement with subject line
- Suggest the most appropriate delivery channel for the message type
- Recommend recipient groups based on the instruction context

### 6.3 Workflow — No Auto-Send, Ever
1. Admin opens Communications → New Broadcast
2. Admin types a natural language instruction to Angelina:
   - "Remind all Nutcracker families about costume pickup this Saturday at 10am"
   - "Let the Petites parents know class is cancelled tomorrow"
   - "Draft a spring recital announcement email for all studio families"
3. Angelina generates:
   - Draft message body
   - Suggested subject (if email)
   - Recommended delivery channel(s)
   - Recommended recipient group(s)
4. Admin sees a preview pane showing exactly what recipients will receive
5. Admin edits the draft inline if needed
6. Admin selects or adjusts: delivery channel(s) and recipient group(s)
7. Admin clicks **Send** — explicit confirmation required every time
8. System sends and logs:
   - Sent by: [Admin name]
   - Drafted by: Angelina AI
   - Original instruction preserved
   - Channel(s), recipient group(s), recipient count, timestamp

### 6.4 Hard Rules
- Angelina cannot trigger any send action autonomously
- Angelina cannot read or summarize DMs between users
- Angelina cannot access flagged message content
- Every AI-drafted message is labeled in the log as "drafted by Angelina"
- Amanda or an Admin must confirm every single outbound communication

---

## 7. Admin Aggregated Inbox

Location: `/admin/communications`

### 7.1 Inbox Views
| View | Contents |
|---|---|
| All | Every channel, sorted by most recent activity |
| Unread | Channels with unread messages |
| Flagged | Messages flagged for review |
| SMS | Inbound SMS conversations only |
| Groups | All group channels |
| Direct | All DMs |
| Archived | Archived threads (admin read-only) |
| Broadcasts | History of all sent broadcasts with delivery stats |

### 7.2 Inbound SMS Matching
1. Inbound SMS arrives at Quo/Twilio webhook
2. System checks `sms_contact_map` for the phone number
3. If matched → message posts to that family's thread in the correct group or DM
4. If unmatched → "Unknown Contact" conversation created
5. Admin prompted to link to existing family record or create new contact

---

## 8. Private Lesson Scheduling via Messaging

### 8.1 Flow
1. Admin or Parent initiates DM with teacher
2. Tapping "Request Private Lesson" in DM thread opens structured card:
   - Student name
   - Up to 3 proposed time slots (from teacher's availability)
   - Notes field
3. Teacher receives in-app notification + SMS
4. Teacher confirms one slot or proposes alternate
5. System creates confirmed lesson record and triggers:
   - Confirmation SMS to parent
   - Calendar entry for teacher
   - Draft timesheet entry
6. Admin sees all private lesson requests in admin inbox

---

## 9. Notification Preferences

Users control which channels they receive notifications on:

```sql
notification_preferences (
  user_id            uuid FK users,
  tenant_id          uuid FK tenants,
  sms_enabled        boolean default true,
  email_enabled      boolean default true,
  in_app_enabled     boolean default true,
  class_reminders    boolean default true,
  group_messages     boolean default true,
  direct_messages    boolean default true,
  performance_announcements boolean default true,
  payment_receipts   boolean default true,
  private_lesson_reminders boolean default true,
  updated_at         timestamptz
)
```

---

## 10. Data Model

```sql
channels (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  channel_type        text CHECK (channel_type IN ('group','direct','broadcast')),
  name                text,
  description         text,
  is_announcement_only boolean default false,
  is_archived         boolean default false,
  archived_at         timestamptz,
  archived_by         uuid FK users,
  archive_reason      text,
  linked_class_id     uuid FK classes nullable,
  linked_production_id uuid FK productions nullable,
  delivery_channels   text[] default '{chat}',  -- ['chat','sms','email']
  created_by          uuid FK users,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
)

channel_members (
  id           uuid PK default gen_random_uuid(),
  channel_id   uuid FK channels NOT NULL,
  tenant_id    uuid FK tenants NOT NULL,
  user_id      uuid FK users NOT NULL,
  role         text CHECK (role IN ('admin','member')),
  joined_at    timestamptz default now(),
  muted_until  timestamptz nullable,
  is_banned    boolean default false,
  last_read_at timestamptz
)

messages (
  id               uuid PK default gen_random_uuid(),
  channel_id       uuid FK channels NOT NULL,
  tenant_id        uuid FK tenants NOT NULL,
  sender_id        uuid FK users nullable,   -- null for system messages
  message_type     text CHECK (message_type IN
                     ('text','image','system','scheduling_request','broadcast')),
  body             text,
  attachment_url   text nullable,
  delivery_channel text CHECK (delivery_channel IN ('chat','sms','email')),
  sms_message_id   text nullable,            -- Quo/Twilio message ID
  sms_direction    text CHECK (sms_direction IN ('inbound','outbound')) nullable,
  is_deleted       boolean default false,
  deleted_at       timestamptz nullable,
  deleted_by       uuid FK users nullable,
  original_body    text nullable,            -- preserved on soft delete
  is_flagged       boolean default false,
  flagged_by       uuid FK users nullable,
  flagged_at       timestamptz nullable,
  drafted_by_ai    boolean default false,    -- true if Angelina drafted
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
)

broadcasts (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  created_by          uuid FK users NOT NULL,
  drafted_by_ai       boolean default false,
  ai_instruction      text nullable,          -- the prompt Admin gave Angelina
  subject             text nullable,          -- for email broadcasts
  body                text NOT NULL,
  delivery_channels   text[],                 -- ['sms','email','chat']
  recipient_group_ids uuid[],
  recipient_count     integer,
  status              text CHECK (status IN
                        ('draft','confirmed','sending','sent','failed')),
  sent_at             timestamptz nullable,
  created_at          timestamptz default now()
)

sms_contact_map (
  id          uuid PK default gen_random_uuid(),
  tenant_id   uuid FK tenants NOT NULL,
  phone_e164  text NOT NULL,
  user_id     uuid FK users nullable,
  created_at  timestamptz default now()
)
```

---

## 11. Webhook Handlers

### POST /api/webhooks/quo
- Validates HMAC signature using `QUO_WEBHOOK_SECRET`
- Parses inbound message event
- Matches sender phone → `sms_contact_map` → user → channel
- Creates message record
- Triggers Supabase Realtime broadcast

### POST /api/webhooks/twilio
- Same flow; validates using Twilio signature header

---

## 12. Phase Implementation Order

### Phase 1
- [ ] channels, channel_members, messages tables + RLS policies
- [ ] Basic in-app chat UI for groups and DMs
- [ ] Supabase Realtime subscription (live message delivery)
- [ ] Auto-channel creation on class or production activation
- [ ] Admin aggregated inbox (basic, unfiltered)

### Phase 2
- [ ] Quo + Twilio webhook inbound ingestion
- [ ] SMS sync into unified thread view
- [ ] Soft delete with "[removed]" placeholder
- [ ] Thread archiving with role-based post-archive visibility
- [ ] Flagging system + admin flagged inbox view
- [ ] Mute functionality

### Phase 3
- [ ] Angelina AI drafting (Admin / Super Admin only)
- [ ] Broadcast system (chat + SMS + email, Admin confirms)
- [ ] Broadcast history log with delivery stats
- [ ] Private lesson scheduling request card in DMs
- [ ] Notification preferences UI

### Phase 4
- [ ] Email template editor (Admin Settings → Communications)
- [ ] Global email header/footer branding
- [ ] Mobile app push notifications (Expo integration)
- [ ] Student-facing age-appropriate channels with restricted access

---

## 13. Open Questions

- Should parents be able to initiate DMs with teachers directly,
  or only through admin-created channels?
- Should SMS replies from unknown numbers auto-create a portal
  account, or remain as unlinked "unknown contacts"?
- What is the message retention policy for student accounts
  (COPPA compliance consideration)?
- Minimum age for student in-app chat access?
- Should teachers receive a heads-up (FYI) when Angelina drafts
  a message going to their group before it sends?
- Nutcracker: one group per cast, or one group with cast-specific threads?
- Can parents export their own message history (CCPA consideration)?
- Should multiple SMS numbers per tenant be supported
  (e.g., one for admin, one for teacher-facing)?

---

## 14. Policy Decisions (Resolved)

### Parent ↔ Teacher Direct Messaging
Parents CAN initiate DMs with teachers directly.
Studio policy: ALL teacher-parent communication must go through the
platform. No personal phone numbers, no external apps. This is enforced
by making the platform the canonical communication channel and training
teachers accordingly. Admin can view all teacher-parent DMs.

### Unknown SMS Senders (No Account Match)
When an inbound SMS arrives from a phone number not in the database:
1. Create a temporary "guest contact" record (not a full user account)
2. Assign a provisional conversation in the admin inbox
3. Tag as "Unmatched SMS Lead"
4. Admin can:
   a. Link to an existing family record (merges conversation history)
   b. Convert to a formal account (triggers onboarding invite)
   c. Mark as spam and block
Guest contacts are treated like CRM lead records — they are visible
in the admin inbox and in a future "Leads" view. Full account merge
preserves all message history under the resolved user record.

### Message Retention Policy
- Default retention: 12 months from message creation date
- Exception: any message, thread, or entire channel can be flagged
  "Retain Indefinitely" by Admin or Super Admin
- Retain Indefinitely flag prevents automated purge
- Purge is soft-delete only (record remains in DB, flagged as purged,
  not returned in any query)
- Legal hold: Super Admin can apply tenant-wide retention freeze
- Applies to: messages, broadcast logs, archived threads, sms_contact_map

### Student Access to Group Channels
- Students are never auto-added to any channel
- All student channel membership is by explicit Admin invite only
- Admin or Super Admin creates and controls all student-accessible channels
- Age-appropriate gating is Admin-enforced, not system-automated
- Students cannot initiate DMs with teachers or other students
  unless Admin creates that channel

### Group Channel Configuration (Nutcracker and all productions)
- Number of channels per production (e.g., one per cast vs. one combined)
  is determined by Admin or Super Admin on a per-production basis
- Each group channel has the following configurable metadata:
  - Name (e.g., "Nutcracker 2026 — Cast A")
  - Description
  - Cover image
  - Date created
  - Date live (the date the channel becomes visible to members)
  - Auto-archive date (the channel automatically archives on this date)
- Auto-archiving keeps the channel list clean without manual Admin action
- Auto-archived channels follow the same role-based visibility rules
  as manually archived channels (see Section 5.3)

### Teacher Visibility into Peer DMs (Same Class)
- By default: teachers do NOT see other teachers' DMs with parents
- Studio Admin can toggle "Teacher Cross-Visibility" on a per-class basis:
  - OFF (default): each teacher sees only their own DMs
  - ON: all teachers assigned to that class can see all parent DMs
    within that class context
- This setting is visible to all affected teachers when enabled
  (no silent surveillance — transparency is required)
- Super Admin and Studio Admin always see all DMs regardless of setting

### Parent Communication Channel Preferences
- Parents can opt out of SMS and use email only
- Parents can opt out of email and use in-app chat + SMS only
- Parents cannot opt out of in-app notifications entirely
  (platform is the canonical communication record)
- At minimum, parents must have ONE channel enabled for:
  class reminders, payment receipts, performance announcements
- Preference UI is in the Parent Portal → Settings → Notifications
- Admin can see each family's preference settings
- Admin can override preferences for emergency/urgent communications
  (safety alerts, studio closures — these always send on all enabled channels)
