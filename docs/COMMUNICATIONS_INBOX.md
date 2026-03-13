# COMMUNICATIONS_INBOX.md
# Ballet Academy and Movement — Platform Specification
# Communications Inbox Module

---

## 1. Purpose

The Communications Inbox is the unified message center for the BAM platform. It captures:

- **Inbound replies** to any platform-sent email (registration, announcements, teacher communications, billing, ticketing)
- **Direct messages** initiated by parents, students, or staff through the portal
- **Outbound messages** sent by admins and teachers through the platform

Every message is threaded to a **family profile** or **staff profile**, giving Studio Admins a complete communication history for any person in the system.

This spec is a dependency of `EMAIL_TEMPLATES.md`, which states: "All replies to platform emails are logged to the family or lead profile."

---

## 2. Scope

This spec covers:

- Inbound reply capture (email reply-to routing)
- Inbox UI for Admin, Manager, and Teacher roles
- Thread view and compose
- Tagging, flagging, assignment
- Profile threading (family / lead / staff)
- Notifications
- Permissions and access control
- Database schema

This spec does **not** cover:
- SMS (future module)
- Push notifications (covered in Ticketing and Rehearsal specs)
- The Email Template editor (covered in `EMAIL_TEMPLATES.md`)

---

## 3. Reply Capture Architecture

### 3.1 How Replies Are Routed

Every platform-sent email uses a unique reply-to address in the format:

```
reply+{thread_token}@mail.balletacademyandmovement.com
```

The `thread_token` is a short unique identifier generated per message thread.

When a recipient replies to any platform email, the reply is delivered to this address and processed by an inbound email webhook (Resend inbound, or a forwarding rule to `/api/communications/inbound`).

The webhook:
1. Parses the `thread_token` from the reply-to address
2. Looks up the corresponding thread in `communication_threads`
3. Appends the reply as a new message in `communication_messages`
4. Links it to the sender's `family_id`, `lead_id`, or `user_id`
5. Marks the thread as **unread** and triggers an admin notification

### 3.2 Sender Matching

On inbound parse, the system attempts to match the sender email to an existing profile in this order:

1. `families.email`
2. `leads.email`
3. `user_profiles.email` (staff, teachers)
4. If no match: create an **unmatched message** record, flagged for manual review

### 3.3 Thread Token Generation

```
thread_token = base62(sha256(message_id + tenant_id + timestamp)[0:8])
```

Tokens are stored in `communication_threads.reply_token` (unique, indexed).

### 3.4 Supported Inbound Email Providers

- **Resend** (current platform email provider) — inbound webhook at `/api/communications/inbound`
- Future: support additional providers via the platform's pluggable integration layer

---

## 4. Thread Model

A **thread** represents a continuous conversation between the studio and one contact (family, lead, or staff member).

### Thread Types

| Type | Description |
|---|---|
| `reply` | Started by a parent replying to a platform email |
| `direct` | Started by an admin or teacher composing a new message |
| `inquiry` | Started via the Angelina AI chatbot lead capture |
| `system` | Auto-generated for billing issues, waitlist updates, etc. |

### Thread States

| State | Description |
|---|---|
| `open` | Active, unresolved |
| `resolved` | Marked done by staff |
| `spam` | Flagged as spam, removed from main inbox |
| `archived` | Closed and archived |

### Thread Priority

| Priority | Description |
|---|---|
| `normal` | Default |
| `flagged` | Manually flagged for follow-up |
| `urgent` | Manually elevated by staff |

---

## 5. Inbox UI

### 5.1 Location in Nav

Under the **COMMUNICATIONS** nav group:

```
COMMUNICATIONS
  ├── Inbox                  ← this module
  ├── Announcements
  ├── Email Templates
  └── Angelina AI
```

### 5.2 Inbox List View

Three-column layout (desktop). Mobile collapses to single column.

**Left column — Filters / Folders:**
- All Messages
- Unread
- Flagged
- Assigned to Me
- Unmatched (admin only)
- ── Folders ──
- Families
- Leads
- Staff
- System

**Center column — Thread List:**

Each row shows:
- Avatar (family photo or initials)
- Contact name
- Message preview (first 80 chars)
- Time/date stamp
- Unread badge (if unread)
- Flag icon (if flagged)
- Assigned-to avatar (if assigned)
- Thread type badge (`reply`, `direct`, `inquiry`, `system`)

Sort options: Newest first (default), Oldest first, Unread first, Flagged first

**Right column — Thread Detail:**

Opens when a thread is selected. Shows full conversation history, compose area at bottom.

### 5.3 Thread Detail View

**Header:**
- Contact name (links to family or lead profile)
- Contact email
- Thread subject
- State badge (Open / Resolved / Archived)
- Priority badge (Flagged / Urgent)
- Assign to dropdown
- Actions menu: Resolve, Archive, Mark Spam, Flag, Print

**Message List:**
- Each message shows:
  - Sender name + avatar
  - Direction indicator (inbound ← / outbound →)
  - Timestamp
  - Full message body (HTML rendered safely, no scripts)
  - "Sent via [email template name]" label for system-originated messages
  - Attachments list (if any)

**Compose Area:**
- Rich text editor (same component used in Email Templates)
- To: field (pre-filled, editable for direct threads)
- Subject: field (pre-filled for replies, editable for new threads)
- Send button
- Save as draft button
- Attach file button (images, PDFs only, max 10MB per file)

### 5.4 Compose New Thread

Accessible via **+ New Message** button at top of inbox.

Fields:
- To: (search families, leads, staff by name or email)
- Subject
- Message body
- Attach file

On send: creates a new `direct` thread, sends email via Resend using the studio's configured sender, logs to profile.

---

## 6. Profile Threading

Every thread is linked to a profile. Profile pages show a **Communications** tab.

### 6.1 Family Profile — Communications Tab

Shows all threads where the contact is a family member.

Displays:
- Thread subject
- Last message preview
- Date
- State badge
- Link to open thread in inbox

### 6.2 Lead Profile — Communications Tab

Same as family profile. Shows inquiry threads from Angelina AI and any follow-up direct messages.

### 6.3 Staff / Teacher Profile — Communications Tab

Shows threads where the contact is a teacher or staff member.

---

## 7. Unmatched Messages

When an inbound email cannot be matched to any profile:

- Message is stored in `communication_messages` with `matched = false`
- Appears in the **Unmatched** folder (admin only)
- Admin can:
  - Match to an existing family/lead/staff profile
  - Create a new lead from the message
  - Mark as spam

---

## 8. Notifications

### 8.1 New Inbound Reply

When a reply arrives:
- Thread is marked unread
- Assigned user (if any) receives an in-app notification and email notification
- If unassigned: all Admins receive in-app notification

### 8.2 New Direct Thread

When an admin sends a new direct message:
- Recipient receives email via Resend
- Thread created and visible in inbox

### 8.3 Assignment Notification

When a thread is assigned to a staff member:
- Assignee receives in-app notification: "You have been assigned a message from [Contact Name]"

### 8.4 Notification Preferences

Per user, under My Settings → Notifications:
- Email me when a new reply arrives (on/off)
- Email me when a thread is assigned to me (on/off)
- In-app notifications (always on)

---

## 9. Permissions

| Role | View Inbox | Compose | Assign | Resolve | Archive | View Unmatched |
|---|---|---|---|---|---|---|
| Super Admin | ✅ All tenants | ✅ | ✅ | ✅ | ✅ | ✅ |
| Studio Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ (self only) | ✅ | ✅ | ❌ |
| Teacher | Own threads only | ✅ (to assigned families) | ❌ | ❌ | ❌ | ❌ |
| Parent | ❌ (portal only) | ❌ (email reply only) | ❌ | ❌ | ❌ | ❌ |

**Teacher inbox scope:**
Teachers see only threads where they are the assigned staff member or where the message involves a student in their classes. They do not see the full studio inbox.

**Parent portal:**
Parents do not have an inbox UI. They reply via email. Those replies appear in the studio inbox.

A future parent portal messaging feature may be scoped separately.

---

## 10. Multi-Tenant Isolation

All inbox data is scoped to `tenant_id`. Threads, messages, and tokens from one tenant are never visible to another.

Super Admin can view any tenant's inbox via the platform admin tools.

---

## 11. Database Schema

```sql
-- Thread container
CREATE TABLE communication_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  reply_token   TEXT UNIQUE,                    -- used for reply-to routing
  subject       TEXT,
  thread_type   TEXT NOT NULL DEFAULT 'direct', -- reply | direct | inquiry | system
  state         TEXT NOT NULL DEFAULT 'open',   -- open | resolved | spam | archived
  priority      TEXT NOT NULL DEFAULT 'normal', -- normal | flagged | urgent
  -- contact linkage (one of these will be set)
  family_id     UUID REFERENCES families(id),
  lead_id       UUID REFERENCES leads(id),
  staff_user_id UUID REFERENCES user_profiles(id),
  -- assignment
  assigned_to   UUID REFERENCES user_profiles(id),
  -- metadata
  last_message_at TIMESTAMPTZ,
  unread_count    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual messages within a thread
CREATE TABLE communication_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  thread_id     UUID NOT NULL REFERENCES communication_threads(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL,                  -- inbound | outbound
  sender_name   TEXT,
  sender_email  TEXT,
  sender_user_id UUID REFERENCES user_profiles(id),
  body_html     TEXT,
  body_text     TEXT,
  matched       BOOLEAN NOT NULL DEFAULT true,  -- false = unmatched inbound
  -- origin tracking
  email_template_id UUID REFERENCES email_templates(id),
  resend_message_id TEXT,                       -- Resend delivery ID
  -- timestamps
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments
CREATE TABLE communication_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES communication_messages(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INT,
  storage_path TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Thread read receipts (per staff user)
CREATE TABLE communication_thread_reads (
  thread_id   UUID NOT NULL REFERENCES communication_threads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Indexes
CREATE INDEX idx_comm_threads_tenant      ON communication_threads(tenant_id);
CREATE INDEX idx_comm_threads_family      ON communication_threads(family_id);
CREATE INDEX idx_comm_threads_lead        ON communication_threads(lead_id);
CREATE INDEX idx_comm_threads_assigned    ON communication_threads(assigned_to);
CREATE INDEX idx_comm_threads_reply_token ON communication_threads(reply_token);
CREATE INDEX idx_comm_messages_thread     ON communication_messages(thread_id);
CREATE INDEX idx_comm_messages_unmatched  ON communication_messages(tenant_id) WHERE matched = false;
```

---

## 12. API Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/communications/threads` | List threads (paginated, filterable) | Admin+ |
| POST | `/api/communications/threads` | Create new direct thread | Admin+ |
| GET | `/api/communications/threads/[id]` | Get thread + messages | Admin+ |
| PATCH | `/api/communications/threads/[id]` | Update state, priority, assignment | Admin+ |
| POST | `/api/communications/threads/[id]/messages` | Send reply in thread | Admin+ |
| POST | `/api/communications/inbound` | Inbound email webhook (Resend) | Webhook secret |
| PATCH | `/api/communications/messages/[id]/match` | Match unmatched message to profile | Admin+ |

---

## 13. Integration Points

### 13.1 EMAIL_TEMPLATES.md
All emails sent via the template system automatically set the `reply-to` header to the thread-specific reply address. The `email_template_id` is stored on the outbound message for traceability.

### 13.2 Angelina AI (Chatbot)
When Angelina captures a lead inquiry, a thread of type `inquiry` is created and linked to the lead profile. The inquiry appears in the inbox for admin follow-up.

### 13.3 Family / Lead Profiles
Communications tab on each profile pulls threads by `family_id` or `lead_id`.

### 13.4 Registration
Confirmation and welcome emails sent during registration create outbound messages in the family's thread history.

### 13.5 Ticketing
Order confirmation and comp notification emails are logged as outbound system messages.

---

## 14. Future Scope (Not This Build)

- **Parent portal messaging UI** — parents compose and receive messages inside the portal (not just via email)
- **SMS threading** — inbound/outbound SMS logged to same thread model
- **Bulk messaging** — send to a class roster, production cast, or segment
- **Auto-responder rules** — e.g., auto-reply to inquiries outside business hours
- **AI triage** — Angelina suggests response drafts for flagged threads

---

## 15. Build Notes for Claude Code

When building this module, reference these files first:

```
docs/EMAIL_TEMPLATES.md
docs/ROLES_AND_PERMISSIONS.md
docs/COMMUNICATIONS_INBOX.md   ← this file
```

Key implementation notes:

1. **Inbound webhook security** — verify Resend webhook signature using `RESEND_WEBHOOK_SECRET` env var before processing any inbound payload.

2. **Reply-to header injection** — the email send utility in `lib/email/send.ts` must be updated to accept an optional `threadToken` parameter and inject the `reply-to` header accordingly.

3. **Thread token generation** — generate on first outbound send, store on `communication_threads`. Reuse on all subsequent messages in the same thread.

4. **Unread counts** — maintain `communication_threads.unread_count` via trigger or on message insert. Decrement on thread open by a staff user (update `communication_thread_reads`).

5. **RLS policies** — threads and messages must enforce `tenant_id` equality. Teacher access must additionally filter by `assigned_to = auth.uid()` or student-in-class join.

6. **File storage** — attachments go to Supabase Storage bucket `communications/{tenant_id}/{message_id}/{filename}`. Generate signed URLs for display, expire after 24 hours.

7. **HTML sanitization** — all inbound HTML bodies must be sanitized (strip scripts, iframes, event handlers) before storage and before rendering in the UI. Use `DOMPurify` or server-side equivalent.
