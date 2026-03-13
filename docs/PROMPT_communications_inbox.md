# Claude Code Prompt — Communications Inbox

---

## Instructions

Read these files in full before writing any code:

```
docs/claude/COMMUNICATIONS_INBOX.md
docs/claude/EMAIL_TEMPLATES.md
docs/claude/ROLES_AND_PERMISSIONS.md
CLAUDE.md
```

Then build the Communications Inbox module as described below. Commit in logical parts. Do not rush — get each part right before moving to the next.

---

## What to Build

### Part 1 — Database Migration

Create a Supabase migration file at:
`supabase/migrations/{timestamp}_create_communications_inbox.sql`

Include all tables from the spec:

- `communication_threads`
- `communication_messages`
- `communication_attachments`
- `communication_thread_reads`

Include all indexes from the spec.

Add RLS policies:
- All tables: `tenant_id = (select tenant_id from user_profiles where id = auth.uid())`
- Teachers: `communication_threads` additionally requires `assigned_to = auth.uid()` OR a join confirming the family has a student in one of their classes
- Service role bypass for the inbound webhook

---

### Part 2 — Reply-To Threading Infrastructure

Update `lib/email/send.ts`:

- Add an optional `threadToken` parameter to the send function signature
- If `threadToken` is provided, inject a `reply-to` header:
  `reply+{threadToken}@mail.balletacademyandmovement.com`
- If no `threadToken`, send without reply-to (existing behavior unchanged)

Create `lib/communications/thread.ts`:

- `generateThreadToken(messageId: string, tenantId: string): string`
  — deterministic base62 hash, 8 characters, unique per message
- `getOrCreateThread(params): Promise<Thread>`
  — looks up thread by token, creates if not found
- `appendMessage(threadId: string, message: MessageInsert): Promise<Message>`
  — inserts to `communication_messages`, updates `last_message_at` and `unread_count` on the thread

---

### Part 3 — Inbound Webhook

Create `app/api/communications/inbound/route.ts`:

- Method: POST
- Verify Resend webhook signature using `RESEND_WEBHOOK_SECRET` env var
  — reject with 401 if signature invalid
- Parse inbound email payload:
  - Extract `to` address to get `thread_token` from `reply+{token}@...` format
  - Extract `from` name and email
  - Extract `subject`, `html`, `text`
- Sanitize HTML body — strip all script tags, iframe tags, on* event attributes before storing
- Match sender to profile:
  1. `families.email`
  2. `leads.email`
  3. `user_profiles.email`
  4. If no match: store with `matched = false`
- Insert into `communication_messages` with `direction = 'inbound'`
- Update thread: increment `unread_count`, set `last_message_at`, set state to `open` if it was `resolved`
- Trigger notification to assigned user or all admins (insert to `notifications` table if it exists, otherwise log)
- Return 200

---

### Part 4 — API Routes

Create `app/api/communications/threads/route.ts`:

**GET** — list threads
- Query params: `state`, `priority`, `type`, `assigned_to`, `family_id`, `lead_id`, `unmatched`, `page`, `limit`
- Default: open threads, newest first, limit 50
- Returns threads with last message preview, unread count, contact info
- Auth: Admin, Manager, Teacher (teacher sees own assigned only)

**POST** — create new direct thread
- Body: `{ to_email, to_name, subject, body_html, family_id?, lead_id?, staff_user_id? }`
- Generates thread token
- Creates thread with `thread_type = 'direct'`
- Sends email via `lib/email/send.ts` with reply-to header injected
- Inserts outbound message record
- Auth: Admin, Manager, Teacher

Create `app/api/communications/threads/[id]/route.ts`:

**GET** — get thread with all messages
- Returns thread metadata + messages array, ordered oldest first
- Marks thread as read for current user (upsert to `communication_thread_reads`)
- Decrements `unread_count` to 0 for this user
- Auth: Admin, Manager, Teacher (scoped)

**PATCH** — update thread
- Accepts: `state`, `priority`, `assigned_to`
- Auth: Admin, Manager (assign self), Teacher (cannot patch)

Create `app/api/communications/threads/[id]/messages/route.ts`:

**POST** — send reply in thread
- Body: `{ body_html, body_text? }`
- Sends email to thread contact via `lib/email/send.ts` with reply-to injected
- Inserts outbound message
- Updates thread `last_message_at`
- Auth: Admin, Manager, Teacher (assigned only)

Create `app/api/communications/messages/[id]/match/route.ts`:

**PATCH** — match unmatched message to a profile
- Body: `{ family_id?, lead_id?, staff_user_id?, create_lead?: boolean, sender_name?: string, sender_email?: string }`
- Sets `matched = true` on message
- Updates thread contact linkage
- If `create_lead = true`: creates new lead record from sender info
- Auth: Admin only

---

### Part 5 — Inbox UI

Create `app/(admin)/admin/communications/inbox/page.tsx`:

Three-column layout matching the spec:

**Left column — Folder sidebar:**
- All Messages (default)
- Unread
- Flagged
- Assigned to Me
- Unmatched (Admin only — hidden from Manager and Teacher)
- Divider
- Families
- Leads
- Staff
- System

Each folder shows unread count badge.

**Center column — Thread list:**
- Fetches from GET `/api/communications/threads` with active folder filter
- Each row: avatar (initials if no photo), contact name, message preview (80 chars), timestamp, unread badge, flag icon, assigned-to avatar, type badge
- Clicking a row opens thread in right column and marks as read
- Unread threads have bold contact name + lavender left border
- "New Message" button at top of column

**Right column — Thread detail:**

Header:
- Contact name (links to family or lead profile page)
- Contact email
- State badge (color coded: open=green, resolved=gray, archived=gray, spam=red)
- Priority badge (flagged=amber, urgent=red)
- Assign to dropdown (staff list, clears to unassigned)
- Actions dropdown: Resolve, Archive, Mark Spam, Flag / Unflag

Message list:
- Oldest first
- Each message: sender avatar, sender name, direction arrow (← inbound / → outbound), timestamp, body (rendered HTML, sanitized), template label if system-originated
- System messages (type=system) rendered with a subtle gray background

Compose area (bottom):
- Simple rich text area (not the full block editor — just bold, italic, link, bullet list)
- Send button (primary)
- Save Draft button (secondary)

Empty state (no thread selected):
- Centered lavender icon, "Select a conversation to get started"

Mobile:
- Single column
- Folder sidebar behind hamburger
- Thread list is the default view
- Thread detail is a full-screen slide-in panel

---

### Part 6 — Compose New Thread Modal

Triggered by "New Message" button in inbox.

Fields:
- To: typeahead search — searches families, leads, and staff by name or email
  — shows result type (Family / Lead / Staff) in dropdown
- Subject
- Message body (same simple rich text)
- Send button

On send: POST to `/api/communications/threads`, close modal, open new thread in right column.

---

### Part 7 — Profile Communications Tab

Add a **Communications** tab to:

**Family profile page** (`app/(admin)/admin/families/[id]/page.tsx` or similar):
- Tab label: "Communications"
- Lists all threads where `family_id` matches
- Each row: subject, last message preview, date, state badge, link to open in inbox

**Lead profile page** (if it exists):
- Same pattern with `lead_id`

If profile pages don't have a tab system yet, add a simple card section at the bottom of the profile page with the heading "Communications" and the thread list.

---

### Part 8 — Nav Registration

Add **Inbox** to the COMMUNICATIONS nav group in `components/layouts/admin-nav.tsx`:

```
COMMUNICATIONS
  ├── Inbox          href: /admin/communications/inbox
  ├── Announcements
  ├── Email Templates
  └── Angelina AI
```

Add the module to `platform_modules` table in the migration:
```sql
INSERT INTO platform_modules (key, label, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible)
VALUES ('communications_inbox', 'Inbox', 'communications', 'inbox', '/admin/communications/inbox', 1, true, true, true);
```

---

### Part 9 — Unmatched Message Review UI

On the Inbox page, when the **Unmatched** folder is selected (Admin only):

- List shows all messages where `matched = false`
- Each row shows: sender email, subject, received time, message preview
- Clicking opens a match panel (not full thread detail):
  - Shows full message body
  - "Match to Profile" button: opens typeahead to find family/lead/staff
  - "Create New Lead" button: pre-fills lead name + email from sender
  - "Mark as Spam" button
- After matching: thread moves to appropriate folder, disappears from Unmatched

---

## Commit Strategy

Commit after each part:

```
feat(comms): Part 1 - communications inbox migration
feat(comms): Part 2 - reply-to threading infrastructure
feat(comms): Part 3 - inbound email webhook
feat(comms): Part 4 - communications API routes
feat(comms): Part 5 - inbox UI (three-column layout)
feat(comms): Part 6 - compose new thread modal
feat(comms): Part 7 - profile communications tab
feat(comms): Part 8 - nav registration and module entry
feat(comms): Part 9 - unmatched message review UI
```

---

## Environment Variables Required

Verify these exist in `.env.local` and Vercel before running:

- `RESEND_WEBHOOK_SECRET` — Resend inbound webhook signing secret
- `RESEND_API_KEY` — already set
- `NEXT_PUBLIC_APP_URL` — needed for constructing reply-to domain

If `RESEND_WEBHOOK_SECRET` is not set, log a warning but do not crash — the webhook should return 401 gracefully.

---

## Do Not

- Do not build the full Email Template block editor in this session
- Do not build SMS threading
- Do not build bulk messaging
- Do not build parent portal messaging UI
- Do not touch any existing auth, registration, or casting code

---

## When Done

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
npx next build 2>&1 | tail -20
```

Fix any TypeScript errors before final commit. Then push:
```bash
git push origin main
```

Remind Derek to run `npx supabase db push` in a separate terminal to apply the migration.
