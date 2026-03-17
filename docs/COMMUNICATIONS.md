# COMMUNICATIONS.md
# Ballet Academy and Movement — Communications Module Spec
# Version: 2.1 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026 — BAND 27.0 competitive analysis + monitoring framework added

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
- Native billing, enrollment, and studio management context embedded
  in communications — BAND has none of this

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
- Outbound: group or admin message delivered via SMS to member's phone
- Inbound: SMS replies ingested via webhook, appear in the same thread
- Parents who don't use the app can participate via SMS with no login required
- All SMS activity is visible in the unified thread

### 2.3 Email (via Resend)
- Broadcast-style: announcements, newsletters, reminders
- Delivered to group members' email addresses
- Email replies captured in admin inbox (not threaded back into group)
- Email is primarily outbound at the group level

### 2.4 Unified Thread View
All three surfaces for a given group or DM displayed in a single thread.
Each message tagged with its delivery channel:

  💬 In-app  📱 SMS  ✉️ Email

---

## 3. Groups

### 3.1 What a Group Is
A Group is a named conversation container. Not bound to a single channel —
a unified communication space that reaches members via chat, SMS, and/or
email simultaneously.

### 3.2 Group Modes
| Mode | Who Can Post | Use Case |
|---|---|---|
| Announcement | Admin / Teacher only | Class updates, reminders, studio news |
| Discussion | All members (moderated) | Cast communication, parent Q&A |

### 3.3 Group Creation
- Auto-created when a class or production is activated
- Manual: Admin creates custom groups as needed
- Only Admin or Super Admin can create or dissolve groups

### 3.4 Delivery Configuration Per Group
- Chat only
- Chat + SMS
- Chat + Email
- All three

### 3.5 Group Features
- **Custom icon and cover image** — set at creation or edited later;
  sub-brand groups auto-populate with sub-brand icon
- **Quick Announcement** — Admin pins a short message at the top of the group,
  visible to all members immediately on open; supports scheduled appearance date
- **@Everyone mention** — Admin or Teacher tags all members to trigger push
  notification to every member; no member cap (BAND caps at 100)
- **Repost** — any message with attachments can be reposted to the same or a
  different group without recreating content; originating message logged for audit
- **Auto-archive date** — group archives automatically on a configurable date;
  follows same role-based visibility rules as manual archive

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
- Soft delete only — content never hard deleted from the database
- Deleted messages display "[Message removed by moderator]" to members
- Original content preserved in DB, visible to Admin and above
- Deletion logged: deleted_by, deleted_at, original_body preserved

### 5.3 Thread Archiving
When Admin archives a thread:
- Thread disappears from main group feed for all members
- Post-archive visibility by role:
  - Super Admin / Studio Admin: full thread, read-only
  - Studio Manager: full thread, read-only
  - Teacher (participated): own messages + direct replies only
  - Teacher (did not participate): no access
  - Parent (participated): own messages only
  - Parent (did not participate): no access
  - Students: no access to archived threads
- Archive action logged with optional Admin note
- Thread can be unarchived by Admin or Super Admin

### 5.4 Flagging System
- Any member can flag a message as inappropriate
- Flagged messages appear in Admin inbox under "Flagged" view
- Flag is anonymous to other members; only Admin sees who flagged
- Admin actions: dismiss, delete message, remove member, mute, escalate

### 5.5 Muting
- Admin mutes a member within a specific group for a set duration
- Muted member can read but cannot post
- Muted member sees their mute status and expiry time
- Mute expires automatically or can be lifted by Admin

---

## 6. Angelina AI — Communication Assistant

### 6.1 Access
Super Admin and Studio Admin ONLY. Teachers, parents, and students
cannot use AI drafting.

### 6.2 What Angelina Can Do
- Draft SMS, in-app chat broadcast, or email announcement
- Suggest delivery channel and recipient groups
- Recommend @Everyone or Quick Announcement based on urgency
- Draft Quick Announcements on Admin instruction

### 6.3 Workflow — No Auto-Send, Ever
1. Admin opens Communications → New Broadcast
2. Admin provides natural language instruction to Angelina
3. Angelina generates draft, suggested channel(s), recipient group(s), format
4. Admin sees preview of exactly what recipients will receive
5. Admin edits inline if needed
6. Admin clicks Send — explicit confirmation required every time
7. System logs: sent_by, drafted_by_ai, original_instruction, channel(s),
   recipient group(s), recipient count, timestamp

### 6.4 Hard Rules
- Angelina cannot trigger any send action autonomously
- Angelina cannot read or summarize DMs between users
- Angelina cannot access flagged message content
- Every AI-drafted message labeled in log as "drafted by Angelina"

---

## 7. Admin Aggregated Inbox

Location: `/admin/communications`

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

**Inbound SMS matching:**
1. Inbound SMS arrives at Quo/Twilio webhook
2. System checks `sms_contact_map` for phone number
3. If matched → posts to family's thread
4. If unmatched → "Unknown Contact" conversation created; Admin links or creates

---

## 8. Private Lesson Scheduling via Messaging

1. Admin or Parent initiates DM with teacher
2. "Request Private Lesson" card: student name, 3 proposed slots, notes
3. Teacher confirms or proposes alternate
4. System creates lesson record + confirmation SMS to parent +
   calendar entry for teacher + draft timesheet entry

---

## 9. Notification Preferences

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
  id                   uuid PK default gen_random_uuid(),
  tenant_id            uuid FK tenants NOT NULL,
  channel_type         text CHECK (channel_type IN ('group','direct','broadcast')),
  name                 text,
  description          text,
  icon_url             text nullable,
  cover_image_url      text nullable,
  quick_announcement   text nullable,
  quick_announcement_scheduled_at timestamptz nullable,
  is_announcement_only boolean default false,
  is_archived          boolean default false,
  archived_at          timestamptz,
  archived_by          uuid FK users,
  archive_reason       text,
  auto_archive_date    date nullable,
  linked_class_id      uuid FK classes nullable,
  linked_production_id uuid FK productions nullable,
  delivery_channels    text[] default '{chat}',
  created_by           uuid FK users,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
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
  id                  uuid PK default gen_random_uuid(),
  channel_id          uuid FK channels NOT NULL,
  tenant_id           uuid FK tenants NOT NULL,
  sender_id           uuid FK users nullable,
  message_type        text CHECK (message_type IN
                        ('text','image','system','scheduling_request','broadcast','repost')),
  body                text,
  attachment_url      text nullable,
  repost_of           uuid FK messages nullable,
  is_everyone_mention boolean default false,
  delivery_channel    text CHECK (delivery_channel IN ('chat','sms','email')),
  sms_message_id      text nullable,
  sms_direction       text CHECK (sms_direction IN ('inbound','outbound')) nullable,
  is_deleted          boolean default false,
  deleted_at          timestamptz nullable,
  deleted_by          uuid FK users nullable,
  original_body       text nullable,
  is_flagged          boolean default false,
  flagged_by          uuid FK users nullable,
  flagged_at          timestamptz nullable,
  drafted_by_ai       boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
)

broadcasts (
  id                  uuid PK default gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  created_by          uuid FK users NOT NULL,
  drafted_by_ai       boolean default false,
  ai_instruction      text nullable,
  subject             text nullable,
  body                text NOT NULL,
  delivery_channels   text[],
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
- Matches sender phone → `sms_contact_map` → user → channel
- Creates message record + triggers Supabase Realtime broadcast

### POST /api/webhooks/twilio
- Same flow; validates using Twilio signature header

---

## 12. Phase Implementation Order

### Phase 1
- [ ] channels, channel_members, messages tables + RLS policies
- [ ] Basic in-app chat UI for groups and DMs
- [ ] Supabase Realtime subscription (live message delivery)
- [ ] Auto-channel creation on class or production activation
- [ ] Admin aggregated inbox (basic)
- [ ] Quick Announcement with scheduled appearance date
- [ ] Group icon and cover image support

### Phase 2
- [ ] Quo + Twilio webhook inbound ingestion
- [ ] SMS sync into unified thread view
- [ ] Soft delete with "[removed]" placeholder
- [ ] Thread archiving with role-based post-archive visibility
- [ ] Auto-archive date on group channels
- [ ] Flagging system + admin flagged inbox view
- [ ] Mute functionality
- [ ] @Everyone mention (push to all members, no member cap)
- [ ] Repost with attachments (same or cross-group)

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
- [ ] Student-facing age-appropriate channels
- [ ] Read receipts per message
- [ ] Scheduled send (queue message for future delivery)

---

## 13. Competitive Intelligence — BAND

### 13.1 Why BAND is the Primary Comparison

BAND (Naver Corp.) is the current platform used by the studio for
group communication. BAM must achieve feature parity before studios
will transition. BAND's release cadence informs this roadmap directly.

### 13.2 BAND Feature Tracker (Last reviewed: March 2026 v27.0.2)

| BAND Feature | BAM Status | BAM Advantage |
|---|---|---|
| Group chat (in-app) | ✅ Phase 1 | + SMS + email in one thread |
| @Everyone mention (100-member cap) | ✅ Phase 2 | No member cap |
| Quick Announcement | ✅ Phase 1 | + Scheduled appearance date |
| Custom group icon | ✅ Phase 1 | Auto-populated from sub-brand |
| Repost with attachments | ✅ Phase 2 | + Cross-group repost |
| Push notifications | ✅ Phase 4 | Role-filtered |
| Notices pinned at top of posts tab | ✅ Phase 1 | Integrated with Quick Announcement |
| Mark All as Read | ✅ Phase 1 | |
| Send notification to non-openers | ✅ Phase 3 | Via SMS fallback |
| SMS/Email to non-app members | ✅ Core differentiator | Not in BAND |
| Unified inbox (all channels) | ✅ Core differentiator | Not in BAND |
| AI message drafting | ✅ Core differentiator | Not in BAND |
| Studio management context | ✅ Core differentiator | Not in BAND |
| Soft delete with audit trail | ✅ Core differentiator | BAND deletes permanently |
| Role-based post-archive visibility | ✅ Core differentiator | Not in BAND |
| Auto-archive on date | ✅ Phase 2 | Not in BAND |
| Private lesson scheduling card | ✅ Phase 3 | Not in BAND |
| Read receipts per message | ✅ Phase 4 | BAND group-level only |
| Scheduled send | ✅ Phase 4 | Not in BAND |

### 13.3 BAND 27.0 Feature Response Log

| Feature | BAM Response | Notes |
|---|---|---|
| @Everyone (100-member cap) | Match + Extend | No cap; available to teachers too |
| Quick Announcement | Match + Extend | Add scheduled appearance date |
| Custom group icon | Match + Extend | Sub-brand auto-populate |
| Repost with attachments | Match + Extend | Cross-group repost + audit trail |

---

## 14. Competitive Monitoring Framework

### 14.1 Platforms to Monitor

| Platform | Relevance | Cadence |
|---|---|---|
| BAND (Naver Corp.) | Primary replacement | Monthly |
| ParentSquare / Remind | Education parent comms | Monthly |
| ClassDojo | Youth activity comms | Monthly |
| Jackrabbit | Dance studio management | Monthly |
| Studio Pro | Current operational system | Monthly |
| GroupMe | Parent group comms | Quarterly |
| Seesaw | Student-family comms | Quarterly |
| TutuTix | Dance; ticketing adjacent | Quarterly |
| MindBody | Fitness/wellness | Quarterly |

### 14.2 Monthly Review Checklist (First Monday of Each Month)

1. Check app store release notes for each monitored platform
2. Search "[platform] new features [month year]"
3. Check product blogs and press releases
4. Review AppStore reviews and Reddit discussions
5. Update Feature Tracker in Section 13.2
6. Log any features requiring roadmap response in Section 14.3

### 14.3 Feature Response Protocol

| Response | Meaning |
|---|---|
| Match | Table stakes — add to nearest phase |
| Match + Extend | Valuable; BAM can do it better |
| Watch | Interesting; monitor adoption |
| No Action | Irrelevant to dance studio context |

### 14.4 Angelina-Powered Monitoring (Phase 4)

Weekly Angelina prompt: "Search for new feature releases from BAND,
ClassDojo, ParentSquare, and Jackrabbit this week. Summarize any
changes relevant to the BAM Communications Module."

Output: Formatted update in admin "Competitive Intelligence Feed."
Admin marks items: Roadmap Candidate / Watching / No Action.
Roadmap Candidates auto-populate the phase backlog.

---

## 15. Future Feature Roadmap (Beyond Phase 4)

| Feature | Priority |
|---|---|
| Scheduled send | High |
| Read receipts per message | High |
| Delivery confirmation per SMS/email | High |
| Teacher-only channel (separate from parent channels) | High |
| Event RSVP card in group chat | High |
| @role mentions (@teachers, @cast-a) | Medium |
| Polls and voting within group | Medium |
| Competitive Intelligence Feed (Angelina-powered) | Medium |
| Video message in group chat | Medium |
| Announcement channel embedded on studio website | Medium |
| Cross-tenant broadcast (multi-location studios) | Medium |
| Message reactions (emoji) | Low |
| Voice messages | Low |
| Parent-to-parent opt-in chat (carpool, costume swap) | Low |

---

## 16. Open Questions

- Should parents be able to initiate DMs with teachers directly?
- Should SMS replies from unknown numbers auto-create a portal account?
- Minimum age for student in-app chat access?
- Should teachers see a preview when Angelina drafts a message to their group?
- Can parents export their own message history (CCPA consideration)?
- Should multiple SMS numbers per tenant be supported?

---

## 17. Policy Decisions (Resolved)

### Parent ↔ Teacher Direct Messaging
Parents CAN initiate DMs with teachers directly. All teacher-parent
communication must go through the platform. Admin can view all
teacher-parent DMs.

### Unknown SMS Senders
Create temporary "guest contact" record. Admin links to existing family,
converts to formal account, or marks as spam. All message history
preserved on merge.

### Message Retention Policy
Default: 12 months. "Retain Indefinitely" flag available per message,
thread, or channel. Purge is soft-delete only. Legal hold via
tenant-wide retention freeze by Super Admin.

### Student Access to Group Channels
Students never auto-added. All student membership by explicit Admin
invite. Students cannot initiate DMs.

### Group Channel Configuration
Number of channels per production determined by Admin per production.
Each channel has: name, description, icon, cover image, date live,
auto-archive date.

### Teacher Visibility into Peer DMs
Default OFF. Studio Admin can toggle "Teacher Cross-Visibility" per
class. All affected teachers are notified when enabled.

### Parent Communication Channel Preferences
Parents may opt out of SMS or email but must have at least one channel
enabled. Admin can override preferences for safety alerts and
studio closures.

---

*Last updated: March 2026 — v2.1*
*Next competitive review: April 2026 (first Monday)*
*Update when policy decisions are resolved, phases ship, or competitor features are released.*
