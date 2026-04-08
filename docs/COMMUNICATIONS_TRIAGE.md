# Communications Triage & Classification — Spec

**Status:** Ready for implementation  
**Phase:** 2 — Operations  
**Extends:** COMMUNICATIONS_INBOX.md, CONTACT_CHANNELS.md  
**Decision Log Date:** April 8, 2026

---

## What This Doc Covers

The existing COMMUNICATIONS_INBOX.md covers the inbox UI, thread model, and 
sender matching. This doc covers the layer BEFORE messages reach the inbox:

- How inbound messages are classified (inquiry vs spam vs wrong number)
- When to auto-create a lead vs wait for admin review
- How Gmail replies from dance@bamsocal.com get captured in the platform
- What the triage UI looks like for admin
- How to keep the DB clean

---

## 1. Inbound Channels

| Channel | Address / Number | Auto-Responder | Captured In Platform |
|---|---|---|---|
| Email | dance@bamsocal.com | No | Yes — via Resend inbound webhook |
| SMS | Studio Quo number | Yes — already configured in Quo | Yes — via Quo webhook |
| Gmail replies | dance@bamsocal.com (sent from Gmail) | No | Yes — via Gmail forwarding rule |

---

## 2. Classification Logic

Every inbound message — email or SMS — runs through a classifier before 
being stored. The classifier assigns one of three labels:

| Label | Meaning | Action |
|---|---|---|
| `inquiry` | Likely a real parent or student inquiry | Auto-create lead + thread |
| `review` | Ambiguous — could be real, could be spam | Store in Unmatched, notify admin |
| `spam` | Clear spam signals | Discard or store silently, no notification |

### 2.1 Inquiry Signals (any one = `inquiry`)

- Message body mentions: class, ballet, dance, teacher, enrollment, 
  registration, trial, schedule, tuition, payment, performance, 
  competition, Nutcracker, recital, audition, costume
- Sender name is a real-looking name (not "noreply", "info@", "admin@")
- Message contains a child's name or age reference
- Message contains a question mark (asking something)
- SMS from a number that has texted the studio before (returning contact)

### 2.2 Spam Signals (two or more = `spam`)

- Subject contains: "SEO", "marketing", "loan", "investment", "crypto", 
  "casino", "pills", "congratulations you've won", "unsubscribe"
- Sender domain is a known bulk sender (sendgrid.net, mailchimp.com, etc.)
- Body contains more than 3 external links
- No sender name (email from noreply@, donotreply@, bounce@)
- Body is over 2000 characters with no question and no name
- SMS body is fewer than 5 words with a link

### 2.3 Review (everything else)

Anything that doesn't clearly match inquiry or spam signals goes to `review`.
Admin sees these in the Unmatched folder with a "Needs Review" badge.
Admin gets ONE notification per batch (not per message) — max once per hour.

---

## 3. Auto-Lead Creation Rules

When classifier returns `inquiry` AND sender is not already in the DB:

1. Create a `leads` record:
   - `pipeline_stage`: `inquiry`
   - `source`: `email` or `sms`
   - `first_name` + `last_name`: parsed from sender name
   - `email` or `phone`: from message sender
   - `intake_form_data`: extracted signals (child name/age if mentioned)
   - `notes`: first 500 chars of message body
   - `status`: `new`

2. Create a `communication_thread` linked to the lead

3. Notify admin in-app: "New inquiry from [name] — added to pipeline"

4. Lead appears in Enrollment Pipeline at `Inquiry` stage immediately

When classifier returns `inquiry` AND sender IS already in the DB:
- Match to existing family/lead/profile per COMMUNICATIONS_INBOX.md Section 3.2
- Append to existing thread
- No new lead created

When classifier returns `review`:
- Store message with `matched = false`
- Add to Unmatched folder
- No lead created until admin manually approves

When classifier returns `spam`:
- Store with `is_spam = true` (for audit purposes — never delete)
- Never shown in main inbox or unmatched folder
- Admin can access via Settings → Spam Log if needed

---

## 4. Gmail Capture (Critical Gap)

Amanda and Cara sometimes reply to dance@bamsocal.com from the Gmail 
interface directly. These replies must be captured in the platform even 
though they didn't go through Resend.

### Solution: Gmail Forwarding Rule

Set up a Gmail forwarding rule in the dance@bamsocal.com account:
- Forward all incoming mail to: `inbound@mail.balletacademyandmovement.com`
- This hits the existing Resend inbound webhook
- The inbound webhook processes it identically to any other inbound email
- Thread matching works via the `reply+{token}@` reply-to header if present,
  or via sender email matching if not

### Gmail Sent Mail Capture

Replies sent FROM Gmail (not through the platform) are harder to capture 
automatically. Two options:

**Option A — BCC capture (recommended for now)**
- Admin adds `log@mail.balletacademyandmovement.com` as BCC on Gmail replies
- Platform receives the BCC, matches to thread, logs as outbound message
- Amanda and Cara do this manually — it becomes habit

**Option B — Gmail API integration (future)**
- Connect dance@bamsocal.com Gmail via OAuth
- Poll sent mail every 15 minutes for new messages
- Match to threads and log automatically
- More reliable but requires OAuth setup and Gmail API credentials

**Decision: Start with Option A (BCC), build Option B in Phase 3.**

### BCC Capture Email Address

Create a dedicated inbound address for BCC capture:
`log@mail.balletacademyandmovement.com`

When the inbound webhook receives a message to this address:
- It's always an outbound message being logged (direction: `outbound`)
- Match sender to admin profile
- Match thread via In-Reply-To header or subject line
- Log as outbound message on the matched thread
- If no thread match: create a new thread tagged `external_sent`

---

## 5. SMS Triage

Quo already sends an auto-responder. Platform behavior:

**Unknown number texts studio:**
1. Quo auto-responder fires (already configured — don't change)
2. Platform receives inbound via Quo webhook
3. Classifier runs on message body
4. If `inquiry`: create lead + sms_thread, notify admin
5. If `review`: add to unmatched_sms, notify admin (batched)
6. If `spam`: store silently, no notification

**Known number texts studio (existing family/lead):**
1. Match to existing profile via phone number
2. Append to existing sms_thread
3. Notify assigned admin

**STOP received:**
- Handled first, before any classification (per CONTACT_CHANNELS.md Section 4.2)
- Sets `sms_opt_in = false` immediately
- No lead created

---

## 6. Triage UI — Unmatched Folder

Admin opens Inbox → Unmatched folder. Shows only `review` messages 
(not spam — those are filtered out).

Per message card:
- Sender name + email/phone
- Preview of message body (first 150 chars)
- Channel badge (Email / SMS)
- Received timestamp
- Classifier confidence note: "Possible inquiry — mentions 'class'"

**Actions per card:**
- **Create Lead** — creates lead record, moves message to Leads folder
- **Match to Existing** — typeahead search for family/lead/profile
- **Mark Spam** — moves to spam log, never shown again
- **Ignore** — dismisses without creating lead (for wrong numbers, etc.)

All actions are one click — no modal required for Create Lead or Mark Spam.
Match to Existing opens a small search popover.

**Admin notification for unmatched:**
- One push notification per hour maximum (not per message)
- "3 new messages need review in your inbox"
- Never spam the admin with individual notifications

---

## 7. DB Additions

```sql
-- Add spam flag to communication_messages
ALTER TABLE communication_messages
  ADD COLUMN IF NOT EXISTS is_spam boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS classifier_label text
    CHECK (classifier_label IN ('inquiry','review','spam')),
  ADD COLUMN IF NOT EXISTS classifier_signals jsonb DEFAULT '[]';
    -- array of signal strings that fired, for transparency

-- Add spam flag to unmatched_sms  
ALTER TABLE unmatched_sms
  ADD COLUMN IF NOT EXISTS classifier_label text
    CHECK (classifier_label IN ('inquiry','review','spam')),
  ADD COLUMN IF NOT EXISTS is_spam boolean DEFAULT false;

-- Spam log view (admin only, Settings → Spam Log)
CREATE INDEX IF NOT EXISTS idx_comm_messages_spam 
  ON communication_messages(tenant_id) WHERE is_spam = true;
```

---

## 8. Implementation Checklist

- [ ] Build classifier function `lib/communications/classify.ts`
- [ ] Wire classifier into Resend inbound webhook 
      (`app/api/communications/inbound/route.ts`)
- [ ] Wire classifier into Quo inbound webhook 
      (`app/api/webhooks/quo/route.ts`)
- [ ] Auto-lead creation when classifier = `inquiry`
- [ ] BCC capture address (`log@` inbound route)
- [ ] Gmail forwarding rule setup (manual — Derek configures in Gmail)
- [ ] Triage UI in Unmatched folder (one-click actions)
- [ ] Batched admin notification (max 1/hour)
- [ ] DB migration for classifier columns
- [ ] Spam log in Settings (read-only, admin only)

---

## 9. Decisions Log

| # | Decision |
|---|---|
| 1 | dance@bamsocal.com is primary inbound — all studio inquiries come here |
| 2 | Quo auto-responder already configured — platform does not change it |
| 3 | Three classifier labels: inquiry (auto-lead), review (admin triage), spam (silent) |
| 4 | Inquiry signals: class/teacher/payment/performance/competition keywords + questions |
| 5 | Auto-lead created immediately when classifier = inquiry + unknown sender |
| 6 | Spam stored silently for audit — never deleted, never shown in main inbox |
| 7 | Admin notified of unmatched messages max once per hour (batched) |
| 8 | Gmail replies captured via BCC to log@ address (Phase 1) |
| 9 | Gmail sent mail capture via Gmail API OAuth (Phase 3) |
| 10 | Enrollment Pipeline is the source of truth for new student onboarding journey |
| 11 | Platform inbox must stay clean — spam never reaches admin view |
| 12 | All classifier signals stored on message record for transparency/audit |
