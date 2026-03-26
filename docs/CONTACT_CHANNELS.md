# CONTACT_CHANNELS.md
# Ballet Academy and Movement — Contact Channels Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

A profile (parent, teacher, student) may have multiple email addresses
and multiple phone numbers. The platform must:

- Store all contact methods per profile without labeling them (no "work" / "home")
- Let the user designate exactly ONE primary email and ONE primary phone
- Only ever send communications to the primary designated channel
- Track opt-in / opt-out status per channel and per communication type
- Sync opt-in/out status bidirectionally with Klaviyo (email) and Quo (SMS)
- Surface Quo call logs and SMS threads in the admin communications view
- Enforce TCPA compliance for all SMS — never send to opted-out numbers
- Support "STOP" / "START" auto-handling via Quo webhook

Cross-references:
- COMMUNICATIONS.md — messaging architecture
- REGISTRATION_AND_ONBOARDING.md — phone/email capture at signup
- INTEGRATIONS.md — Klaviyo and Quo adapter pattern

---

## 2. Data Model

### 2.1 contact_channels table

```sql
CREATE TABLE public.contact_channels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  channel_type        TEXT NOT NULL CHECK (channel_type IN ('email', 'sms', 'phone')),
  value               TEXT NOT NULL,     -- email address OR E.164 phone (+19495551234)

  is_primary          BOOLEAN NOT NULL DEFAULT false,
  -- Only one primary per profile per channel_type enforced by partial unique index

  -- Email opt-in/out
  email_opt_in        BOOLEAN,           -- null = unknown, true = opted in, false = opted out
  email_opted_in_at   TIMESTAMPTZ,
  email_opted_out_at  TIMESTAMPTZ,
  email_opt_source    TEXT,              -- 'registration', 'klaviyo_webhook', 'manual', 'import'

  -- SMS opt-in/out (TCPA)
  sms_opt_in          BOOLEAN,           -- null = unknown/pending, true = opted in, false = opted out
  sms_opted_in_at     TIMESTAMPTZ,
  sms_opted_out_at    TIMESTAMPTZ,
  sms_opt_source      TEXT,              -- 'registration', 'quo_stop', 'quo_start', 'manual', 'import'

  -- Sync tracking
  klaviyo_subscriber_id   TEXT,          -- Klaviyo profile ID for this email
  klaviyo_synced_at        TIMESTAMPTZ,
  quo_contact_id           TEXT,         -- Quo contact ID for this phone
  quo_synced_at            TIMESTAMPTZ,

  -- Source tracking
  source              TEXT NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('registration', 'import', 'manual', 'self_service', 'quo_sync')),
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  verified_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one primary per profile per channel type
CREATE UNIQUE INDEX idx_contact_channels_primary
  ON public.contact_channels (profile_id, channel_type)
  WHERE is_primary = true;

-- Fast lookup by value (for webhook matching)
CREATE INDEX idx_contact_channels_value   ON public.contact_channels(value);
CREATE INDEX idx_contact_channels_profile ON public.contact_channels(profile_id);
CREATE INDEX idx_contact_channels_tenant  ON public.contact_channels(tenant_id);
```

### 2.2 quo_call_logs table

Stores Quo call history so calls appear in the admin communications view
alongside SMS threads — giving a complete contact history per profile.

```sql
CREATE TABLE public.quo_call_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES profiles(id),   -- null if unmatched number
  quo_call_id         TEXT NOT NULL UNIQUE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number         TEXT NOT NULL,
  to_number           TEXT NOT NULL,
  status              TEXT,              -- completed, missed, voicemail, busy, failed
  duration_seconds    INTEGER,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  recording_url       TEXT,             -- Quo recording URL (if enabled)
  transcript          TEXT,             -- future: Quo transcription
  notes               TEXT,             -- admin can add notes to call log
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quo_call_logs_profile ON public.quo_call_logs(profile_id);
CREATE INDEX idx_quo_call_logs_tenant  ON public.quo_call_logs(tenant_id);
```

### 2.3 sms_threads table

Links inbound/outbound SMS messages to a profile for display in the
admin communications view.

```sql
CREATE TABLE public.sms_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES profiles(id),   -- null if unmatched
  contact_channel_id  UUID REFERENCES public.contact_channels(id),
  phone_number        TEXT NOT NULL,     -- E.164
  last_message_at     TIMESTAMPTZ,
  last_message_body   TEXT,
  unread_count        INTEGER NOT NULL DEFAULT 0,
  is_matched          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sms_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id           UUID NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
  quo_message_id      TEXT UNIQUE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body                TEXT NOT NULL,
  status              TEXT,              -- sent, delivered, failed, received
  sent_by             UUID REFERENCES profiles(id),   -- for outbound: which admin sent it
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.4 unmatched_sms table

Inbound SMS from numbers not matched to any profile.

```sql
CREATE TABLE public.unmatched_sms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number         TEXT NOT NULL,
  body                TEXT NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved            BOOLEAN NOT NULL DEFAULT false,
  resolved_by         UUID REFERENCES profiles(id),
  resolved_at         TIMESTAMPTZ,
  resolution          TEXT CHECK (resolution IN ('matched', 'ignored', 'created_profile'))
);
```

---

## 3. Primary Channel Rules

### 3.1 Email Primary
- A profile can have 1–5 email addresses
- Exactly one must be marked is_primary = true for channel_type = 'email'
- All platform emails (Resend, notifications) go ONLY to the primary email
- Klaviyo is synced ONLY with the primary email
- If primary is changed, old Klaviyo record is unsubscribed; new one is subscribed
- On first registration: the sign-up email becomes primary automatically

### 3.2 Phone Primary
- A profile can have 1–3 phone numbers
- Exactly one must be marked is_primary = true for channel_type = 'sms'
- All platform SMS go ONLY to the primary phone
- Quo is synced ONLY with the primary phone
- Phone channel_type = 'phone' is for call log matching only (no SMS)

### 3.3 Changing Primary
- User can change primary from their profile settings
- Admin can change primary from admin profile view
- Changing primary triggers:
  1. Old primary: is_primary = false
  2. New primary: is_primary = true
  3. Klaviyo sync update if email changed
  4. Notification to user: "Your primary email has been updated to [email]"

---

## 4. Opt-In / Opt-Out

### 4.1 Email Opt-In
- Default on registration: email_opt_in = true for marketing channels
- Transactional emails (billing, receipts, security) always send regardless of opt-in
- Marketing/announcement emails respect email_opt_in
- Klaviyo webhook → opted_out → sets email_opt_in = false on matching channel
- Admin can manually set opt-in status

### 4.2 SMS Opt-In (TCPA Compliance)
- SMS opt-in must be explicit — never assumed
- Registration flow: checkbox "I agree to receive text messages from Ballet Academy and Movement. Message and data rates may apply. Reply STOP to unsubscribe."
- Checking the box: sets sms_opt_in = true, sms_opted_in_at = now()
- Default: sms_opt_in = null (unknown) — platform will NOT send SMS until confirmed

**STOP / START handling (via Quo webhook):**
- Inbound "STOP" message → sms_opt_in = false, sms_opted_out_at = now(), source = 'quo_stop'
- Inbound "START" or "UNSTOP" message → sms_opt_in = true, sms_opted_in_at = now(), source = 'quo_start'
- These are handled in /api/webhooks/quo BEFORE any message matching logic
- Platform sends auto-reply to STOP: "You have been unsubscribed from Ballet Academy and Movement texts. Reply START to resubscribe."
- Platform sends auto-reply to START: "You have been resubscribed to Ballet Academy and Movement texts."

### 4.3 Pre-Send Check
Every call to sendNotification() and getSMSAdapter().sendMessage() must
check opt-in status before sending:

```typescript
// Before every SMS send:
const channel = await getPrimaryChannel(userId, 'sms')
if (!channel || channel.sms_opt_in !== true) {
  return { skipped: true, reason: 'not_opted_in' }
}

// Before every marketing email send:
const channel = await getPrimaryChannel(userId, 'email')
if (!channel || channel.email_opt_in === false) {
  return { skipped: true, reason: 'opted_out' }
}
```

---

## 5. Klaviyo Sync

### 5.1 What syncs to Klaviyo
- Primary email address only
- First name, last name, phone (primary)
- email_opt_in status
- Profile properties: role (parent/teacher/student), tenant_id

### 5.2 Sync triggers
- New profile created → create Klaviyo profile
- Primary email changed → update Klaviyo profile
- Email opt-out → unsubscribe in Klaviyo
- Email opt-in → resubscribe in Klaviyo

### 5.3 Klaviyo → Platform sync (webhook)
- Klaviyo profile.unsubscribed event → find contact_channel by email → set email_opt_in = false
- Klaviyo profile.subscribed event → set email_opt_in = true

### 5.4 Sync job
- Nightly: reconcile all profiles against Klaviyo to catch drift
- Log mismatches to a sync_errors table for admin review

---

## 6. Quo Sync

### 6.1 What syncs to Quo
- Primary phone number (E.164 format)
- First name, last name
- sms_opt_in status

### 6.2 Quo webhook events handled
- message.received → inbound SMS → match to profile → create sms_message
- call.completed → call log entry → match to profile → create quo_call_log
- message.received with body = "STOP" → opt-out
- message.received with body = "START" → opt-in

### 6.3 Call log sync
- Quo API: GET /v1/calls (poll nightly or via webhook)
- Creates quo_call_log record per call
- Matches from_number or to_number to contact_channels.value
- If matched: links to profile_id
- If unmatched: profile_id = null, surfaces in admin unmatched queue

### 6.4 Admin communications view
- "All" tab shows: channel messages, DMs, SMS threads, AND call logs
- Call log entries show: direction badge, duration, from/to, timestamp, notes field
- Admin can add notes to any call log entry
- SMS thread shows full message history in a Band-style chat UI

---

## 7. Profile Settings UI

### 7.1 Parent / Teacher self-service (portal settings)
Path: /portal/settings/contact or /teach/settings/contact

- List of email addresses with:
  - Primary badge on current primary
  - "Make Primary" button on non-primary emails
  - "Remove" button (cannot remove if only one email)
  - "+ Add Email" button (max 5)
  - Email opt-in toggle for marketing communications

- List of phone numbers with:
  - Primary badge
  - "Make Primary" button
  - "Remove" button
  - SMS opt-in status (read-only, auto-managed via STOP/START)
  - "+ Add Phone" button (max 3)

### 7.2 Admin view
Path: /admin/profiles/[id]/contact

- Same as self-service but admin can:
  - Edit any field
  - Override opt-in status with a reason note (logged to payroll_change_log pattern)
  - See full sync status: Klaviyo synced_at, Quo synced_at
  - Manually trigger resync to Klaviyo or Quo

---

## 8. Registration / Onboarding Integration

On the registration flow (REGISTRATION_AND_ONBOARDING.md):

Step: Contact Information
- Email (required) — becomes primary, email_opt_in = true
- Secondary email (optional) — stored as non-primary
- Mobile phone (required for SMS features) — becomes primary
  - Checkbox: "Yes, send me text message updates" → sms_opt_in = true
  - Required legal text: "Message and data rates may apply. Reply STOP at any time to unsubscribe."
- Secondary phone (optional)

All captured values inserted into contact_channels on registration completion.

---

## 9. Studio Pro Import Considerations

When importing parents from Studio Pro:
- Each parent may have 1-2 emails in DSP — import all, mark first as primary
- Phone numbers in DSP are in local format — normalize to E.164 on import
- sms_opt_in = null for all imported contacts (unknown consent)
- Admin must run an opt-in campaign before sending SMS to imported contacts
- email_opt_in = true for imported contacts (assumed — prior relationship)

---

## 10. Build Priority

Phase 1 (before Studio Pro import):
- contact_channels table + migration
- sms_threads + sms_messages + unmatched_sms tables
- quo_call_logs table
- Pre-send opt-in check in sendNotification()
- STOP/START handling in Quo webhook

Phase 2 (alongside registration):
- Self-service contact settings UI (/portal/settings/contact)
- Registration flow integration
- Klaviyo sync on primary email create/change/optout

Phase 3 (after Studio Pro import):
- Admin contact view (/admin/profiles/[id]/contact)
- Nightly Klaviyo reconciliation job
- Quo call log sync
- Admin communications view with call logs + SMS threads

---

## 11. Key Constraints

- NEVER send SMS to a number where sms_opt_in !== true
- NEVER send marketing email where email_opt_in === false
- NEVER send duplicate messages to non-primary channels
- ALWAYS handle STOP before any other webhook processing
- ALWAYS store phone numbers in E.164 format (+1XXXXXXXXXX)
- ALWAYS normalize phone numbers on insert (strip formatting)
