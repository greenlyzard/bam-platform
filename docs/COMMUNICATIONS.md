# COMMUNICATIONS.md
# Ballet Academy and Movement — Communications Module Spec
# Version: 1.0 | Status: Draft | Owner: Derek Shaw (Green Lyzard)

---

## 1. Overview

The Communications Module is the BAM platform's internal messaging and
notification system. It replaces BAND as the primary channel for group
communication between studio staff, parents, and students.

All outbound SMS routes through a pluggable SMS adapter (Quo or Twilio),
configured per tenant in the Integrations module. In-app messaging is
native to the portal. All channels converge in a single Admin inbox.

Cross-references:
- SAAS.md — multi-tenant adapter pattern
- REGISTRATION_AND_ONBOARDING.md — welcome message triggers
- SCHEDULING_AND_LMS.md — class reminder triggers
- TEACHER_TIME_ATTENDANCE.md — private lesson scheduling triggers
- INTEGRATIONS.md — SMS provider configuration

---

## 2. Core Concepts

### 2.1 Channels
Every conversation in the platform belongs to a Channel. There are two
channel types:

**Group Channel**
- Named group (e.g., "Nutcracker Cast A", "Petites Class — Fall 2025")
- Multiple members: teachers, parents, students, admins
- Admin-controlled membership (add/remove requires Admin or Super Admin)
- Announcement mode: admins post, members read-only
- Discussion mode: all members can post

**Direct Channel (DM)**
- 1:1 or small group (up to 10 participants)
- Initiated by Admin/Teacher or parent
- Parents can DM teachers; teachers can DM parents
- Admins can view all DMs within their tenant

### 2.2 Message Types
- `text` — plain text
- `image` — photo/attachment (MMS via SMS adapter or in-app upload)
- `system` — automated platform message (class reminder, payment receipt, etc.)
- `scheduling_request` — private lesson request thread (see Section 6)

### 2.3 SMS Sync
Outbound messages sent from portal → delivered via SMS adapter to parent's phone.
Inbound SMS replies from parent's phone → received by Quo/Twilio webhook →
ingested into the portal conversation thread.
The parent experience: they receive and reply to texts normally. The portal
experience: all SMS is visible in the conversation thread alongside in-app messages.

---

## 3. Data Model

```sql
-- Channels
channels (
  id uuid PK,
  tenant_id uuid FK tenants,
  channel_type enum('group', 'direct'),
  name text,                          -- null for direct channels
  description text,
  is_announcement_only boolean default false,
  is_archived boolean default false,
  linked_class_id uuid FK classes nullable,   -- auto-created per class
  linked_production_id uuid FK productions nullable,
  created_by uuid FK users,
  created_at timestamptz,
  updated_at timestamptz
)

-- Channel membership
channel_members (
  id uuid PK,
  channel_id uuid FK channels,
  tenant_id uuid FK tenants,
  user_id uuid FK users,
  role enum('admin', 'member'),        -- admin can manage membership
  joined_at timestamptz,
  muted_until timestamptz nullable,
  last_read_at timestamptz
)

-- Messages
messages (
  id uuid PK,
  channel_id uuid FK channels,
  tenant_id uuid FK tenants,
  sender_id uuid FK users nullable,    -- null for system messages
  message_type enum('text','image','system','scheduling_request'),
  body text,
  attachment_url text nullable,
  sms_message_id text nullable,        -- Quo/Twilio message ID for sent SMS
  sms_direction enum('inbound','outbound') nullable,
  sms_from text nullable,              -- phone number for inbound
  is_deleted boolean default false,
  deleted_at timestamptz nullable,
  created_at timestamptz,
  updated_at timestamptz
)

-- SMS contact mapping (maps parent phone → portal user)
sms_contact_map (
  id uuid PK,
  tenant_id uuid FK tenants,
  phone_e164 text,                     -- e.g. +19492290846
  user_id uuid FK users nullable,      -- null if unmatched
  quo_contact_id text nullable,
  created_at timestamptz
)

-- Scheduling requests (private lessons via message thread)
private_lesson_requests (
  id uuid PK,
  channel_id uuid FK channels,         -- DM thread it lives in
  tenant_id uuid FK tenants,
  requested_by uuid FK users,          -- parent
  student_id uuid FK students,
  teacher_id uuid FK users,
  proposed_times jsonb,                -- array of {date, start, end}
  confirmed_time timestamptz nullable,
  status enum('pending','confirmed','declined','cancelled'),
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
```

---

## 4. SMS Adapter (Pluggable)

### 4.1 Interface
All SMS operations go through `src/lib/sms/adapter.ts`. Never call
Quo or Twilio SDKs directly from application code.

```typescript
interface SMSAdapter {
  sendMessage(params: {
    to: string          // E.164 phone number
    body: string
    fromNumberId?: string  // uses tenant default if omitted
  }): Promise<{ messageId: string }>

  getMessages(params: {
    phoneNumberId: string
    since?: Date
  }): Promise<InboundMessage[]>

  getPhoneNumbers(): Promise<PhoneNumber[]>
}
```

### 4.2 Supported Providers

**Quo (formerly OpenPhone)**
- Auth: API key
- Base URL: `https://api.openphone.com/v1`
- Required credentials: `api_key`, `phone_number_id`
- Webhook: inbound messages POST to `/api/webhooks/quo`
- MMS: not supported via API (SMS only)
- A2P 10DLC registration required for US numbers

**Twilio**
- Auth: Account SID + Auth Token
- Required credentials: `account_sid`, `auth_token`, `from_number`
- Webhook: inbound messages POST to `/api/webhooks/twilio`
- MMS: supported

**Stub**
- Used in development / when no SMS provider configured
- Logs to console, returns fake messageId
- Never throws — graceful no-op

### 4.3 Provider Selection
The adapter reads `tenant_integrations` for the current tenant's
configured SMS provider and instantiates the correct implementation.

```typescript
// src/lib/sms/adapter.ts
export async function getSMSAdapter(tenantId: string): Promise<SMSAdapter> {
  const config = await getTenantSMSConfig(tenantId)
  switch (config?.provider) {
    case 'quo':     return new QuoAdapter(config.credentials)
    case 'twilio':  return new TwilioAdapter(config.credentials)
    default:        return new StubAdapter()
  }
}
```

---

## 5. Integrations Module (Admin Settings)

The Integrations module lives at `/admin/settings/integrations` and allows
Super Admin or Studio Admin to connect third-party services per tenant.

### 5.1 Integration Cards
Each integration displays as a card with:
- Provider logo + name
- Status badge (Connected / Not Connected / Error)
- Connect / Disconnect / Reconfigure button

### 5.2 Integration Categories

**Phone & SMS**
- Quo (formerly OpenPhone) — API key + phone number selection
- Twilio — Account SID + Auth Token + from number

**Email**
- Resend — API key + from address (default: platform Resend account)
- Custom SMTP — host, port, username, password

**Payments**
- Stripe — publishable key + secret key (see SAAS.md)
- PayPal — client ID + client secret (stub)
- Authorize.net — API login ID + transaction key (stub)

**Website**
- WordPress — site URL + application password (for content sync)
- Custom embed — embed code snippet for chatbot widget

**CRM / Marketing**
- Klaviyo — API key + list ID
- Zapier — webhook URL

**Video**
- Cloudflare Stream — API token + account ID

### 5.3 Data Model

```sql
tenant_integrations (
  id uuid PK,
  tenant_id uuid FK tenants,
  integration_type enum(
    'sms_quo', 'sms_twilio',
    'email_resend', 'email_smtp',
    'payment_stripe', 'payment_paypal', 'payment_authorizenet',
    'marketing_klaviyo', 'marketing_zapier',
    'video_cloudflare', 'cms_wordpress'
  ),
  is_active boolean default false,
  encrypted_credentials jsonb,         -- AES-256 encrypted at rest
  metadata jsonb,                      -- non-sensitive config (phone number IDs, etc.)
  last_verified_at timestamptz nullable,
  error_message text nullable,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(tenant_id, integration_type)  -- one record per integration type per tenant
)
```

### 5.4 Credential Security
- Credentials are AES-256 encrypted before storing in `encrypted_credentials`
- Encryption key stored in Vercel env var `INTEGRATION_ENCRYPTION_KEY`
- Never returned to frontend — only decrypted server-side at adapter instantiation
- Connection test runs on save to verify credentials before storing

### 5.5 Quo Setup Flow (UI)
1. Admin clicks "Connect" on Quo card
2. Modal opens: "Enter your Quo API key"
   - Link to: my.quo.com/settings/api
3. Admin pastes API key → clicks "Fetch Phone Numbers"
4. Platform calls Quo API → returns list of phone numbers
5. Admin selects which number to use as studio number
6. Platform saves encrypted credentials + phone number ID to `tenant_integrations`
7. Status badge → Connected ✅
8. Webhook URL shown: `https://portal.[domain]/api/webhooks/quo`
   - Admin must add this in Quo → Settings → Webhooks

### 5.6 Twilio Setup Flow (UI)
1. Admin clicks "Connect" on Twilio card
2. Modal: Account SID + Auth Token + From Number
3. Platform validates credentials via Twilio API
4. Saves encrypted, shows Connected ✅
5. Webhook URL: `https://portal.[domain]/api/webhooks/twilio`

---

## 6. Group Channel Management

### 6.1 Auto-Created Channels
The platform automatically creates group channels for:
- Each active class (linked_class_id) — teacher + enrolled students' parents
- Each production (linked_production_id) — cast members' parents + directors
- Each school year — all-studio announcements channel

Auto-channels are created when:
- A class is activated (status → active)
- A production is created
- A new school year is created

### 6.2 Manual Channels
Admins can create ad-hoc group channels for any purpose:
- Study groups, carpool coordination, costume committees, etc.
- Admin sets name, description, announcement vs discussion mode

### 6.3 Membership Management
- Only Admin or Super Admin can add/remove members
- Parents can request to join (Admin approves)
- Teachers auto-added to their class channels
- Students' primary parent/guardian auto-added to class channels
- Admins are auto-members of all channels in their tenant

### 6.4 Permissions Matrix

| Action | Parent | Teacher | Studio Admin | Super Admin |
|---|---|---|---|---|
| View channels they belong to | ✅ | ✅ | ✅ | ✅ |
| Post in discussion channel | ✅ | ✅ | ✅ | ✅ |
| Post in announcement channel | ❌ | ❌ | ✅ | ✅ |
| Create DM | ✅ | ✅ | ✅ | ✅ |
| Create group channel | ❌ | ❌ | ✅ | ✅ |
| Add/remove members | ❌ | ❌ | ✅ | ✅ |
| View all channels (admin inbox) | ❌ | ❌ | ✅ | ✅ |
| Archive channel | ❌ | ❌ | ✅ | ✅ |
| Delete message | own only | own only | ✅ | ✅ |

---

## 7. Admin Aggregated Inbox

### 7.1 Overview
Admins and Super Admins have access to a unified Communications Hub at
`/admin/communications` that aggregates:
- All group channel activity
- All DMs between any portal users
- All inbound/outbound SMS (synced from Quo/Twilio)
- Unread counts per channel
- Flagged messages

### 7.2 Inbox Views
- **All** — every channel and DM, sorted by most recent activity
- **Unread** — channels with unread messages
- **SMS** — inbound SMS conversations only
- **Groups** — group channels only
- **Direct** — DMs only
- **Flagged** — messages flagged for review

### 7.3 SMS Conversation Matching
When an inbound SMS arrives:
1. Look up `sms_contact_map` for the sender's phone number
2. If matched → post to that user's DM channel with the studio
3. If unmatched → create an "Unknown Contact" conversation, prompt admin to link to a family record

---

## 8. Private Lesson Scheduling via Messaging

### 8.1 Current State (BAND)
Currently, private lessons are scheduled informally through BAND group
messages between parents, teachers, and Amanda.

### 8.2 Target State (Portal)
Private lesson requests are initiated through a structured DM flow:

1. Parent opens DM with teacher (or Admin initiates on parent's behalf)
2. Parent taps "Request Private Lesson" button in DM thread
3. A `scheduling_request` card appears in the thread with:
   - Student name
   - 3 proposed time slots (parent selects from teacher's availability)
   - Notes field
4. Teacher receives notification (in-app + SMS)
5. Teacher taps "Confirm" on one of the proposed times
6. System creates a `private_lesson_request` record + triggers:
   - Confirmation SMS to parent
   - Entry in teacher's calendar
   - Draft timesheet entry (pending teacher confirmation of attendance)
7. If teacher proposes alternate time → counter-proposal card in thread
8. Admin can view all pending/confirmed private requests in Admin inbox

### 8.3 SMS Notifications for Private Lessons
- Parent confirmation: "Your private lesson for [Student] with [Teacher]
  is confirmed for [Date] at [Time]. Reply CANCEL to cancel."
- 24hr reminder: "Reminder: Private lesson tomorrow at [Time] at Ballet
  Academy and Movement."
- Teacher reminder: in-app notification only (teachers use portal)

---

## 9. Email Template Editor (Admin Settings)

### 9.1 Overview
All transactional emails sent via Resend use templates stored in
`email_templates`. Admins can edit header, footer, and body per
email type via a rich text editor in Admin Settings.

### 9.2 Email Types

| Template Key | Trigger | Editable Fields |
|---|---|---|
| `welcome` | New family registration | Subject, body |
| `email_confirmation` | Signup confirmation | Subject, body |
| `password_reset` | Password reset request | Subject, body |
| `class_reminder` | 24hr before class | Subject, body, reminder timing |
| `enrollment_confirmation` | After enrollment | Subject, body |
| `payment_receipt` | After payment | Subject, body |
| `private_lesson_confirmed` | Private lesson booked | Subject, body |
| `performance_announcement` | Production announcement | Subject, body |
| `newsletter` | Manual send | Subject, body, header image |

### 9.3 Global Template Wrapper
All emails share a global wrapper (header + footer) configurable in
Admin Settings → Communications → Email Branding:
- Header: studio logo + studio name
- Footer: studio address, phone, unsubscribe link
- Primary color (used for buttons, accents) — defaults to `#9C8BBF`

### 9.4 Data Model

```sql
email_templates (
  id uuid PK,
  tenant_id uuid FK tenants,
  template_key text,                  -- matches enum above
  subject text,
  body_html text,                     -- rich text / HTML
  body_text text,                     -- plain text fallback
  is_active boolean default true,
  updated_by uuid FK users,
  updated_at timestamptz,
  UNIQUE(tenant_id, template_key)
)

email_branding (
  id uuid PK,
  tenant_id uuid FK tenants,
  header_logo_url text,
  footer_address text,
  footer_phone text,
  primary_color text default '#9C8BBF',
  updated_at timestamptz
)
```

---

## 10. Webhook Handlers

### 10.1 Quo Webhook
`POST /api/webhooks/quo`
- Validates signature using `QUO_WEBHOOK_SECRET` (set in Quo → Webhooks)
- Parses inbound message event
- Looks up sender in `sms_contact_map`
- Creates/updates message record in appropriate channel
- Triggers real-time update via Supabase Realtime

### 10.2 Twilio Webhook
`POST /api/webhooks/twilio`
- Validates Twilio signature
- Same ingestion flow as Quo

---

## 11. Real-Time Updates

The portal uses Supabase Realtime to push new messages to connected clients
without polling. Each portal session subscribes to:
- Their channel memberships (filtered by `tenant_id` + `channel_id`)
- Unread count updates

---

## 12. Notifications

### 12.1 In-App
- Bell icon in portal nav shows unread count
- Clicking opens notification drawer with recent activity

### 12.2 SMS (outbound)
- Class reminders (configurable: 24hr, 1hr before)
- Private lesson confirmations and reminders
- Performance announcements
- Payment receipts
- All SMS sent via SMS adapter (Quo or Twilio per tenant)

### 12.3 Email
- Same triggers as SMS, routed via Resend
- Parents can set preference: SMS only, email only, or both

### 12.4 Notification Preferences (per user)
```sql
notification_preferences (
  user_id uuid FK users,
  tenant_id uuid FK tenants,
  sms_enabled boolean default true,
  email_enabled boolean default true,
  in_app_enabled boolean default true,
  class_reminders boolean default true,
  performance_announcements boolean default true,
  payment_receipts boolean default true,
  private_lesson_reminders boolean default true,
  updated_at timestamptz
)
```

---

## 13. Phase Implementation Order

### Phase 1 (MVP — current sprint)
- [ ] `tenant_integrations` table + encryption utility
- [ ] Integrations page UI (cards only, no logic yet)
- [ ] Quo adapter (send SMS only)
- [ ] Twilio adapter (send SMS only, stub)
- [ ] Class reminder SMS trigger (uses adapter)
- [ ] Vercel env vars: QUO_API_KEY, QUO_PHONE_NUMBER_ID

### Phase 2
- [ ] Quo/Twilio webhook ingestion
- [ ] `channels`, `messages`, `channel_members` tables
- [ ] Auto-channel creation on class activation
- [ ] Group channel UI
- [ ] Admin aggregated inbox (basic)

### Phase 3
- [ ] DM channels
- [ ] Private lesson scheduling request flow
- [ ] SMS ↔ portal conversation sync
- [ ] sms_contact_map matching

### Phase 4
- [ ] Email template editor in Admin Settings
- [ ] Email branding (global header/footer)
- [ ] Notification preferences UI
- [ ] Real-time updates via Supabase Realtime

---

## 14. Open Questions

- Should parents be able to initiate DMs with teachers directly, or
  only through admin-created channels?
- Should SMS replies from parents automatically create a portal account
  if one doesn't exist?
- What is the retention policy for message history?
- Should group channels be visible to students (age-appropriate)?
- For Nutcracker: one channel per cast, or one channel for all casts?
- Should teachers see other teachers' DMs with parents in the same class?
- Can parents opt out of SMS and use email only for all communications?
