---
> ⚠️ **DEPRECATED — DO NOT IMPLEMENT FROM THIS SPEC**
>
> This document references tables, columns, or architectural decisions that 
> conflict with the live database or current canonical specs. Last verified 
> against live DB on 2026-04-29.
>
> **Issue:** Says roles live in `profiles.role`. Live DB and root CLAUDE.md require `profile_roles` table.
>
> **Canonical replacement:** docs/RBAC_AND_PERMISSIONS.md
>
> See `docs/_AUDIT_2026_04_29.md` for full audit findings.
> See `docs/_INDEX.md` for the current canonical doc map.

---

# ROLE_BASED_NAV_AND_ACCESS.md
# Ballet Academy and Movement — Portal Access Control Spec
# Status: Ready to build
# Related: PORTAL_FEATURES.md, ANGELINA_AND_CLAUDE_API.md

---

## 1. Problem Statement

The current admin portal renders the same navigation and modules regardless of the
authenticated user's role. A teacher logging in sees admin-level controls. A parent
may see teacher or admin modules. This creates security risk, confusion, and a broken
user experience.

This spec defines:
- Exactly which routes each role can access
- What the nav looks like per role
- How role is determined at runtime
- How unauthorized access is blocked at both the UI and API layer

---

## 2. Role Definitions

Roles are stored in `profiles.role` (Supabase). The full set:

| Role         | Description                                      |
|--------------|--------------------------------------------------|
| super_admin  | Amanda + Cara — full access including settings   |
| admin        | Studio manager — full access except system config|
| teacher      | Instructors — their classes, students, hours only|
| parent       | Families — their children and enrollment only    |

> Note: `public` is not an authenticated role — it hits the widget/chatbot only.

---

## 3. Route Access Matrix

### Admin Routes (`/admin/*`)
| Route                        | super_admin | admin | teacher | parent |
|------------------------------|-------------|-------|---------|--------|
| /admin/dashboard             | ✅          | ✅    | ❌      | ❌     |
| /admin/calendar              | ✅          | ✅    | ❌      | ❌     |
| /admin/schedule-embeds       | ✅          | ✅    | ❌      | ❌     |
| /admin/teachers              | ✅          | ✅    | ❌      | ❌     |
| /admin/teachers/[id]/substitutes | ✅      | ✅    | ❌      | ❌     |
| /admin/substitute-requests   | ✅          | ✅    | ❌      | ❌     |
| /admin/students              | ✅          | ✅    | ❌      | ❌     |
| /admin/enrollment            | ✅          | ✅    | ❌      | ❌     |
| /admin/billing               | ✅          | ✅    | ❌      | ❌     |
| /admin/angelina              | ✅          | ✅    | ❌      | ❌     |
| /admin/chat                  | ✅          | ✅    | ❌      | ❌     |
| /admin/settings              | ✅          | ❌    | ❌      | ❌     |
| /admin/onboarding            | ✅          | ✅    | ❌      | ❌     |

### Teacher Routes (`/teach/*`)
| Route                        | super_admin | admin | teacher | parent |
|------------------------------|-------------|-------|---------|--------|
| /teach/dashboard             | ✅          | ✅    | ✅      | ❌     |
| /teach/schedule              | ✅          | ✅    | ✅      | ❌     |
| /teach/students              | ✅          | ✅    | ✅      | ❌     |
| /teach/hours                 | ✅          | ✅    | ✅      | ❌     |
| /teach/report-absence        | ✅          | ✅    | ✅      | ❌     |
| /teach/substitute-requests   | ✅          | ✅    | ✅      | ❌     |
| /teach/chat                  | ✅          | ✅    | ✅      | ❌     |

### Parent Routes (`/portal/*`)
| Route                        | super_admin | admin | teacher | parent |
|------------------------------|-------------|-------|---------|--------|
| /portal/dashboard            | ✅          | ✅    | ❌      | ✅     |
| /portal/children             | ✅          | ✅    | ❌      | ✅     |
| /portal/schedule             | ✅          | ✅    | ❌      | ✅     |
| /portal/enrollment           | ✅          | ✅    | ❌      | ✅     |
| /portal/billing              | ✅          | ✅    | ❌      | ✅     |
| /portal/chat                 | ✅          | ✅    | ❌      | ✅     |

---

## 4. Navigation Per Role

### super_admin / admin Nav
```
Dashboard
Calendar
Students
Enrollment
Teachers
  └── Substitute Requests
Billing
Angelina (AI)
  └── Conversations
  └── Leads
Settings (super_admin only)
```

### teacher Nav
```
My Dashboard
My Schedule
My Students
Log Hours
Report Absence
Substitute Requests
Chat (Angelina)
```

### parent Nav
```
My Dashboard
My Children
Schedule
Enrollment
Billing
Chat (Angelina)
```

---

## 5. How Role Is Determined

### Server-Side (layouts and API routes)
```typescript
// lib/auth/getSessionWithRole.ts
import { createClient } from '@/lib/supabase/server'

export async function getSessionWithRole() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, tenant_id')
    .eq('id', user.id)
    .single()

  return { user, profile }
}
```

### Role Guard Helper
```typescript
// lib/auth/requireRole.ts
import { redirect } from 'next/navigation'
import { getSessionWithRole } from './getSessionWithRole'

type Role = 'super_admin' | 'admin' | 'teacher' | 'parent'

export async function requireRole(allowed: Role[]) {
  const session = await getSessionWithRole()
  if (!session) redirect('/login')
  if (!allowed.includes(session.profile.role)) redirect('/unauthorized')
  return session
}
```

---

## 6. Layout Architecture

### Current Problem
There is likely a single layout wrapping all portal routes that renders the same
nav regardless of role. The fix is to use Next.js route group layouts, one per role.

### Target Structure
```
app/
  (admin)/
    layout.tsx          ← requireRole(['super_admin', 'admin'])
    admin/
      ...
  (teacher)/
    layout.tsx          ← requireRole(['super_admin', 'admin', 'teacher'])
    teach/
      ...
  (parent)/
    layout.tsx          ← requireRole(['super_admin', 'admin', 'parent'])
    portal/
      ...
```

Each layout.tsx:
1. Calls requireRole() — redirects if unauthorized
2. Renders the correct nav component for that role
3. Passes role context to children via a context provider

---

## 7. Nav Components

Create three separate nav components:

### components/layouts/admin-nav.tsx (already exists — audit and trim)
Should only render admin-appropriate links. Add super_admin-only gate for Settings.

### components/layouts/teacher-nav.tsx (already exists — audit)
Should only show teacher-facing routes. Remove any admin links.

### components/layouts/parent-nav.tsx (create new)
Clean, simple nav: Dashboard, My Children, Schedule, Enrollment, Billing, Chat.

---

## 8. Post-Login Redirect Logic

After login, redirect the user to the right dashboard based on their role:

```typescript
// app/(auth)/login/actions.ts (or wherever login redirect happens)
const roleRedirects: Record<string, string> = {
  super_admin: '/admin/dashboard',
  admin: '/admin/dashboard',
  teacher: '/teach/dashboard',
  parent: '/portal/dashboard',
}

redirect(roleRedirects[profile.role] ?? '/portal/dashboard')
```

---

## 9. Unauthorized Page

Create a simple page at `/unauthorized`:

```
app/
  unauthorized/
    page.tsx
```

Content: "You don't have permission to view this page."
Include a "Go to your dashboard" link that routes based on role.

---

## 10. API Route Protection

All API routes must also enforce role. Pattern:

```typescript
// app/api/admin/[anything]/route.ts
export async function GET(req: Request) {
  const session = await getSessionWithRole()
  if (!session || !['admin', 'super_admin'].includes(session.profile.role)) {
    return new Response('Unauthorized', { status: 403 })
  }
  // ... handler logic
}
```

This already partially exists via RLS in Supabase, but the API layer should enforce
it independently as a defense-in-depth measure.

---

## 11. Files to Create / Modify

### New Files
- `lib/auth/getSessionWithRole.ts`
- `lib/auth/requireRole.ts`
- `app/unauthorized/page.tsx`
- `components/layouts/parent-nav.tsx`
- `context/RoleContext.tsx` (optional — pass role to client components)

### Files to Modify
- `app/(admin)/layout.tsx` — add requireRole(['super_admin', 'admin'])
- `app/(teacher)/layout.tsx` — add requireRole(['super_admin', 'admin', 'teacher'])
- `app/(parent)/layout.tsx` — create or fix, add requireRole(['super_admin', 'admin', 'parent'])
- `components/layouts/admin-nav.tsx` — audit, add super_admin gate for Settings
- `components/layouts/teacher-nav.tsx` — audit, remove any admin links
- `app/(auth)/login/` — fix post-login redirect by role

---

## 12. Acceptance Criteria

Before this module is considered complete:

1. A teacher logging in lands on `/teach/dashboard` and cannot navigate to `/admin/*`
2. A parent logging in lands on `/portal/dashboard` and cannot see teacher or admin routes
3. Manually visiting `/admin/dashboard` as a parent returns redirect to `/unauthorized`
4. Admin and super_admin land on `/admin/dashboard`
5. super_admin sees Settings in nav; admin does not
6. All API routes return 403 for unauthorized roles (test with curl)
7. Post-login redirect works correctly for all 4 role types

---

## 13. Claude Code Prompt

Paste this into a fresh Claude Code session after Angelina is complete:

---

```
Read docs/claude/ROLE_BASED_NAV_AND_ACCESS.md carefully.

Then audit the current state of the codebase:
1. Read app/(admin)/layout.tsx, app/(teacher)/layout.tsx, app/(parent)/layout.tsx
2. Read components/layouts/admin-nav.tsx and teacher-nav.tsx
3. Read the login/auth flow to see where post-login redirect happens
4. Check profiles table schema in supabase/migrations

Then implement everything in the spec:
- lib/auth/getSessionWithRole.ts
- lib/auth/requireRole.ts
- app/unauthorized/page.tsx
- Fix all three layout.tsx files to call requireRole()
- Create parent-nav.tsx
- Fix post-login redirect by role
- Audit and clean admin-nav.tsx and teacher-nav.tsx

Run npx tsc --noEmit when done.
Commit with message: "feat: role-based navigation and portal access control"
```
