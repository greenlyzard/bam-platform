# BAM Platform — Notification System
# docs/NOTIFICATIONS.md
# Version 1.0 | March 2026

**Purpose:** Define the notification system architecture, database schema, delivery
layers, notification types, preference system, and mobile push infrastructure.
This spec is the source of truth for all notification work across web portal,
future iOS app, and future Android app.

---

## Architecture Overview

All notifications originate from a single source of truth — the `notifications`
table — and fan out to one or more delivery channels depending on notification
type and user preference.

```
Event occurs (attendance saved, invoice posted, class cancelled, etc.)
        │
        ▼
notifications table row inserted
        │
        ├── In-app (web portal)     → Supabase Realtime subscription
        ├── Push (mobile app)       → Expo Push → APNs (iOS) / FCM (Android)
        └── Email (transactional)   → Resend (already configured)
```

Delivery is always triggered server-side (API route or cron job). The client
never writes to notifications directly — it only reads and marks as read.

---

## Database Schema

### notifications

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  entity_type     text,               -- 'session' | 'invoice' | 'production' |
                                      -- 'announcement' | 'timesheet' | 'rehearsal'
  entity_id       uuid,               -- FK target for deep linking
  channel         text[] DEFAULT ARRAY['in_app'],
                                      -- ['in_app'] | ['in_app','push'] |
                                      -- ['in_app','push','email']
  read            boolean DEFAULT false,
  sent_push       boolean DEFAULT false,
  sent_email      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_profile_id_read_idx
  ON notifications(profile_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx
  ON notifications(tenant_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles can only read their own notifications
CREATE POLICY "profiles_read_own_notifications"
  ON notifications FOR SELECT
  USING (profile_id = auth.uid());

-- Only service role can insert (server-side only, never client)
-- No INSERT policy for authenticated role
```

### device_tokens

Required for mobile push notifications. Each device that installs the app
and grants push permission registers a token here.

```sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,
  platform        text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_profile_id_idx
  ON device_tokens(profile_id);

-- RLS: profiles can register and delete their own tokens only
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_manage_own_device_tokens"
  ON device_tokens FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
```

### notification_preferences

Controls which notification types a profile receives per channel.
Apple App Store **requires** in-app opt-out controls for each notification type.

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  profile_id          uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Parent preferences
  check_in            boolean DEFAULT true,
  announcements       boolean DEFAULT true,
  billing             boolean DEFAULT true,
  rehearsal_schedule  boolean DEFAULT true,
  class_reminder      boolean DEFAULT true,
  -- Admin / teacher preferences
  late_pickup         boolean DEFAULT true,   -- admin/front_desk only
  timesheet_reminder  boolean DEFAULT true,   -- teacher only
  attendance_summary  boolean DEFAULT true,   -- admin only
  -- Channel overrides
  push_enabled        boolean DEFAULT true,   -- master push toggle
  email_enabled       boolean DEFAULT true,   -- master email toggle
  updated_at          timestamptz DEFAULT now()
);

-- RLS: profiles manage their own preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_manage_own_preferences"
  ON notification_preferences FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
```

---

## Notification Types

All valid `type` values and their default delivery channels:

| Type | Title Template | Channel | Audience |
|---|---|---|---|
| `check_in` | "Emma checked in" | in_app, push | parent/guardian |
| `check_out` | "Emma checked out" | in_app, push | parent/guardian |
| `late_pickup` | "Late pickup alert" | in_app, push | admin, front_desk |
| `announcement` | Studio announcement | in_app, push, email | all |
| `class_reminder` | "Class tomorrow at 4pm" | in_app, push | parent/guardian |
| `billing_posted` | "Invoice ready" | in_app, push, email | billing contact |
| `billing_failed` | "Payment failed" | in_app, push, email | billing contact |
| `billing_receipt` | "Payment received" | in_app, email | billing contact |
| `rehearsal_update` | "Rehearsal schedule updated" | in_app, push | parent/guardian |
| `casting_assigned` | "Emma has been cast" | in_app, push, email | parent/guardian |
| `timesheet_reminder` | "Don't forget to log hours" | in_app, push | teacher |
| `attendance_summary` | "Yesterday's summary" | email | admin |
| `waitlist_promoted` | "Spot available!" | in_app, push, email | parent/guardian |
| `message_received` | "New message from Amanda" | in_app, push | all |
| `substitute_assigned` | "Sub confirmed for Monday" | in_app, push | teacher, admin |

---

## Server-Side Notification Helper

Create `lib/notifications.ts` as the single entry point for creating notifications
across the platform. No other file should write to the notifications table directly.

```typescript
// lib/notifications.ts

import { createClient } from '@/lib/supabase/server'
import { sendPushNotifications } from '@/lib/push'
import { sendEmail } from '@/lib/email'

export type NotificationType =
  | 'check_in' | 'check_out' | 'late_pickup'
  | 'announcement' | 'class_reminder'
  | 'billing_posted' | 'billing_failed' | 'billing_receipt'
  | 'rehearsal_update' | 'casting_assigned'
  | 'timesheet_reminder' | 'attendance_summary'
  | 'waitlist_promoted' | 'message_received' | 'substitute_assigned'

interface CreateNotificationParams {
  tenantId: string
  profileIds: string[]          // one or more recipients
  type: NotificationType
  title: string
  body: string
  entityType?: string
  entityId?: string
  channel?: ('in_app' | 'push' | 'email')[]
}

export async function createNotifications(params: CreateNotificationParams) {
  const supabase = createClient()
  const channel = params.channel ?? ['in_app']

  // 1. Insert notification rows (one per recipient)
  const rows = params.profileIds.map(profileId => ({
    tenant_id: params.tenantId,
    profile_id: profileId,
    type: params.type,
    title: params.title,
    body: params.body,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    channel,
  }))

  const { data: inserted, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select()

  if (error) {
    console.error('[notifications] insert error:', error)
    return
  }

  // 2. Fan out to push if requested
  if (channel.includes('push')) {
    await sendPushNotifications({
      profileIds: params.profileIds,
      tenantId: params.tenantId,
      title: params.title,
      body: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
    })
  }

  // 3. Email handled separately by cron or inline depending on type
  // (billing and announcements trigger email inline;
  //  attendance_summary is triggered by cron only)
}
```

---

## In-App Delivery (Web Portal)

The web portal subscribes to real-time notification inserts via Supabase Realtime.

### Bell icon component behavior
- Shows unread count badge (count of `read = false` rows for current profile)
- Dropdown lists last 20 notifications, newest first
- Clicking a notification marks it read and navigates to `entity_type/entity_id`
  deep link (e.g., session → `/admin/attendance/[sessionId]`)
- "Mark all read" button sets all `read = true` for the profile
- Notifications older than 90 days are not shown in dropdown (still in DB)

### Realtime subscription pattern (component)

```typescript
// Subscribe in a client component using useEffect
const supabase = createClient()

supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `profile_id=eq.${profileId}`,
  }, (payload) => {
    // Add to local state, increment badge count
    setNotifications(prev => [payload.new, ...prev])
    setUnreadCount(prev => prev + 1)
  })
  .subscribe()
```

---

## Mobile Push Delivery

### Technology choice: Expo Push Notifications

Expo acts as an abstraction layer over APNs (iOS) and FCM (Android).
One server-side API handles both platforms.

**Required accounts:**
- Expo account (free) — `npx expo login`
- Apple Developer account ($99/yr) — required for App Store
- Google Play Developer account ($25 one-time) — required for Play Store

**Required env vars (add to Vercel and .env.local):**
```
EXPO_ACCESS_TOKEN=            # from expo.dev account settings
```

### Push helper

```typescript
// lib/push.ts

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushParams {
  profileIds: string[]
  tenantId: string
  title: string
  body: string
  entityType?: string
  entityId?: string
}

export async function sendPushNotifications(params: PushParams) {
  const supabase = createClient()

  // Fetch device tokens for all recipients
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform, profile_id')
    .in('profile_id', params.profileIds)
    .eq('tenant_id', params.tenantId)

  if (!tokens?.length) return

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: params.title,
    body: params.body,
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
    },
    sound: 'default',
  }))

  // Expo accepts up to 100 messages per request — chunk if needed
  const chunks = chunkArray(messages, 100)

  for (const chunk of chunks) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(chunk),
    })
  }

  // Mark sent_push = true on notification rows
  await supabase
    .from('notifications')
    .update({ sent_push: true })
    .in('profile_id', params.profileIds)
    .eq('sent_push', false)
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size))
}
```

### Device token registration API route

The mobile app calls this on launch after requesting push permission.

```
POST /api/v1/device-tokens
Body: { token: string, platform: 'ios' | 'android' }
Auth: Bearer JWT (Supabase session)
```

Upserts on `token` column — if the same token re-registers, update `last_seen_at`.
Stale tokens (last_seen_at older than 90 days) should be purged by cron.

---

## Deep Linking (Mobile App)

When a push notification is tapped, the mobile app opens to the relevant screen.
Deep links are carried in the notification `data` payload as `entityType` + `entityId`.

### Entity → route mapping

| entityType | Mobile route | Web route |
|---|---|---|
| `session` | `/attendance/[id]` | `/admin/attendance/[id]` |
| `invoice` | `/billing/[id]` | `/admin/billing/[id]` |
| `production` | `/productions/[id]` | `/admin/productions/[id]` |
| `announcement` | `/announcements/[id]` | `/admin/communications/[id]` |
| `rehearsal` | `/rehearsals/[id]` | `/admin/productions/rehearsals/[id]` |

### Universal Links / App Links (required before App Store submission)

Two static files must be served from `portal.balletacademyandmovement.com`:

**iOS — apple-app-site-association**
```
GET /.well-known/apple-app-site-association
```
Served by Next.js route `app/.well-known/apple-app-site-association/route.ts`.
Contains app bundle ID — fill in when Apple Developer account is created.

**Android — assetlinks.json**
```
GET /.well-known/assetlinks.json
```
Served by Next.js route `app/.well-known/assetlinks.json/route.ts`.
Contains SHA-256 certificate fingerprint — fill in when Android app is built.

---

## API Versioning (Mobile Readiness)

All API routes consumed by the mobile app must be prefixed `/api/v1/`.
Web portal routes can continue using `/api/` but new routes written for
mobile-first features should use `/api/v1/` from the start.

**New routes to create under /api/v1/:**
- `POST /api/v1/device-tokens` — register push token
- `DELETE /api/v1/device-tokens` — unregister on logout
- `GET /api/v1/notifications` — paginated list for current profile
- `PATCH /api/v1/notifications/[id]/read` — mark single notification read
- `PATCH /api/v1/notifications/read-all` — mark all read
- `GET /api/v1/notification-preferences` — fetch preferences
- `PATCH /api/v1/notification-preferences` — update preferences

---

## COPPA Compliance Checklist

The platform serves children under 13. Apple and Google enforce COPPA
during App Store / Play Store review.

| Requirement | Status | Notes |
|---|---|---|
| No behavioral advertising to minors | 🔴 Verify | Ensure no ad SDKs on child screens |
| No third-party tracking on child screens | 🔴 Verify | No Facebook Pixel, Google Analytics on student-facing pages |
| Parental consent at registration | ✅ Handled | Parent registers on behalf of child |
| Data deletion available | 🔴 Build | "Delete my account" must remove all PII — wire to Supabase Auth delete |
| Privacy policy covers minors | 🔴 Legal | Update privacy policy before App Store submission |
| App Store age rating | 🔴 Submit | Set to 4+ with parental controls disclosure |

---

## Notification Preferences UI

Required by Apple App Store review. Must be accessible from profile settings.

**Route:** `/settings/notifications` (web) | `/settings/notifications` (mobile)

**UI:** Toggle list grouped by category:

```
Class & Attendance
  [✅] Student check-in alerts
  [✅] Class reminders

Studio Updates
  [✅] Announcements
  [✅] Rehearsal schedule changes
  [✅] Casting updates

Billing
  [✅] Invoice notifications
  [✅] Payment receipts
  [✅] Payment failures

Push Notifications        ← master toggle
  [✅] Enable push notifications
```

Teachers also see:
```
Teacher Tools
  [✅] Timesheet reminders
  [✅] Substitute assignments
```

Admins also see:
```
Admin Alerts
  [✅] Late pickup alerts
  [✅] Daily attendance summary
```

---

## Cron Jobs Requiring Notification System

These cron jobs depend on notifications being built first.
See `docs/ATTENDANCE.md` for full cron specs.

| Cron | Schedule | Notification types created |
|---|---|---|
| `/api/cron/attendance-summary` | 9am Pacific daily | `attendance_summary` (email only) |
| `/api/cron/late-pickup-check` | Every 5 minutes | `late_pickup` (in_app + push) |
| `/api/cron/device-token-cleanup` | Weekly Sunday 2am | No notification — deletes stale tokens |
| `/api/cron/class-reminder` | Day before class | `class_reminder` (in_app + push) |

---

## Implementation Order

Build in this sequence to avoid blocking the attendance bridge patch:

1. **Migration** — `notifications`, `device_tokens`, `notification_preferences` tables
2. **`lib/notifications.ts`** — server-side helper
3. **`lib/push.ts`** — Expo push helper (can be stubbed until mobile app exists)
4. **`/api/v1/notifications` routes** — read, mark read
5. **Bell icon component** — Realtime subscription, unread badge, dropdown
6. **`/settings/notifications` page** — preference toggles
7. **Wire attendance bridge** — Features 4 and 5 now have a real table to write to
8. **`/api/v1/device-tokens` route** — ready for mobile app when built

---

## Environment Variables Required

```bash
# Already configured
RESEND_API_KEY=                    # transactional email

# Add now
EXPO_ACCESS_TOKEN=                 # Expo push — get from expo.dev
CRON_SECRET=                       # Random string, protects cron routes

# Add when mobile app is built
# APPLE_BUNDLE_ID=
# ANDROID_PACKAGE_NAME=
```

---

*Last updated: March 2026 | Green Lyzard / Ballet Academy and Movement*
