# Communications Module — Claude Code Context

## Two Messaging Systems

The platform has two separate messaging systems with different tables and purposes.

### 1. Admin Inbox (unified staff inbox)

Tables: `communication_threads`, `communication_messages`, `communication_attachments`, `communication_thread_reads`

- Admin/teacher-facing unified inbox at `/admin/communications/inbox`
- Threads are linked to families, leads, or staff via `family_id`, `lead_id`, `staff_user_id`
- Messages have `direction` (inbound/outbound/system), `body_html`, `body_text`
- Thread tokens enable email reply-to routing
- Teachers see only threads assigned to them (`assigned_to`)

**Lib files:** `lib/communications/thread.ts` (token generation, getOrCreateThread, appendMessage)

### 2. Parent Portal P2P Messaging

Tables: `message_threads`, `messages`

- Parent/teacher direct messaging within the portal
- `message_threads` uses `participant_ids` (uuid array) for membership
- `messages` has `body` (text only), `sender_id`, `read_at`
- Teachers cannot see parent last names (privacy rule in code)

**API routes:** `app/api/communications/messages/route.ts`, `app/api/communications/messages/[threadId]/route.ts`

### 3. Announcements

Tables: `announcements`, `announcement_recipients`

- Admin broadcasts to parents/teachers/classes/seasons
- Recipients resolved via `profile_roles` table (tenant-scoped)
- Delivery via Resend (email) and/or in-app

**Lib files:** `lib/communications/send-announcement.ts`

### 4. Class Reminders

Tables: `class_reminders`

- Automated 24hr reminders via `schedule_instances`
- Parent emails resolved via `enrollments` -> `students.parent_id` -> `profiles.email`
- Idempotent (checks `class_reminders` to avoid duplicates)

**Lib files:** `lib/communications/send-reminders.ts`

---

## Schema Quick Reference

```
communication_threads: id, tenant_id, thread_token, subject, thread_type, state, priority, channel,
                       family_id, lead_id, staff_user_id, contact_name, contact_email,
                       assigned_to, created_by, unread_count, message_count, last_message_at

communication_messages: id, tenant_id, thread_id, direction, sender_id, sender_name, sender_email,
                        subject, body_html, body_text, matched, message_id_header, in_reply_to,
                        template_slug, created_at

message_threads: id, tenant_id, subject, participant_ids (uuid[]), class_id, last_message_at

messages: id, tenant_id, thread_id, sender_id, body, read_at, created_at

announcements: id, tenant_id, created_by, title, body_html, audience, audience_filter,
               channel, status, sent_at, recipient_count

announcement_recipients: id, announcement_id, profile_id, email, status, sent_at, read_at
```

---

## Query Patterns

### Tenant Scoping

Use `profile_roles` table (not `profiles.role`) for tenant-scoped queries:

```ts
const { data: roles } = await supabase
  .from("profile_roles")
  .select("user_id")
  .eq("tenant_id", tenantId)
  .eq("role", "parent")
  .eq("is_active", true);
```

### Auth Checks

`requireAuth()` from `lib/auth/guards.ts` returns `AuthUser` with `role`, `roles`, `firstName`, `lastName`, `email`, `tenantId`. Do not query `profiles.role` separately for auth checks.

### Parent Resolution (from classes)

Use `enrollments` -> `students.parent_id` join:

```ts
const { data: enrollments } = await supabase
  .from("enrollments")
  .select("student_id, students(parent_id)")
  .in("class_id", classIds)
  .in("status", ["active", "trial"]);
```

### Name Fields

The `profiles` table uses `first_name` and `last_name` (not `full_name`). Concatenate:

```ts
const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
```

---

## Cross-References

- Full spec: `docs/COMMUNICATIONS.md`
- Inbox spec: `docs/COMMUNICATIONS_INBOX.md`
- Staff visibility: `docs/COMMUNICATIONS_AND_STAFF_VISIBILITY.md`
- RBAC tables: `supabase/migrations/20260314000002_create_rbac_tables.sql`
- Auth guards: `lib/auth/guards.ts`
- Types: `types/communications.ts`
