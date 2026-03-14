# RBAC_AND_PERMISSIONS.md
# Ballet Academy and Movement — Role-Based Access Control Spec
# Status: Ready to build
# Related: ROLE_BASED_NAV_AND_ACCESS.md, SUPABASE_EMAIL_TEMPLATES.md

---

## 1. Overview

The BAM Platform uses a fully dynamic, tenant-configurable RBAC system. Each tenant
(studio) can define their own roles, assign granular permissions to those roles, and
assign one or more roles to each user profile.

System-level roles (super_admin, parent, student) are protected and cannot be
deleted or have their core permissions modified. All other roles are fully
customizable per tenant.

---

## 2. Core Principles

- A single user can hold multiple roles simultaneously
- Permissions are additive — a user gets the union of all permissions across all their roles
- Roles are tenant-scoped — a role defined at one studio does not exist at another
- System roles ship with every tenant as protected defaults
- Super admin always has all permissions regardless of role_permissions table
- Parent and student roles have fixed, non-editable permission sets
- All permission checks happen server-side; UI visibility is a reflection of server state

---

## 3. Database Schema

### 3.1 permissions table (system-defined, global)
Permissions are defined by the platform, not by tenants. Tenants assign them to roles.

```sql
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,  -- e.g. 'billing.view'
  label       text NOT NULL,         -- e.g. 'View Billing'
  category    text NOT NULL,         -- e.g. 'Billing'
  description text,
  created_at  timestamptz DEFAULT now()
);
```

### 3.2 roles table (tenant-defined)

```sql
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,         -- e.g. 'Front Desk', 'Rehearsal Director'
  description text,
  color       text,                  -- hex color for UI badge
  is_system   boolean DEFAULT false, -- true = cannot be deleted or renamed
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);
```

### 3.3 role_permissions table

```sql
CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

### 3.4 profile_roles table (replaces profiles.role column)

```sql
CREATE TABLE profile_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, role_id)
);
```

### 3.5 Migration: profiles.role column
The existing `profiles.role` column (user_role enum) should be:
1. Kept temporarily as a fallback during migration
2. Populated via profile_roles for all existing users
3. Deprecated and removed in a follow-up migration once RBAC is confirmed working

---

## 4. Permission Registry

All permissions shipped with the platform. These seed the permissions table.

### Students
| Key | Label |
|-----|-------|
| students.view | View Students |
| students.edit | Edit Student Records |
| students.notes | View/Add Student Notes |
| students.progress | View Progress Records |
| students.contact | View Student Contact Info |

### Parents
| Key | Label |
|-----|-------|
| parents.view | View Parent Profiles |
| parents.email.view | View Parent Email Addresses |
| parents.contact | View Parent Phone/Contact |
| parents.messages | Send Messages to Parents |

### Enrollment
| Key | Label |
|-----|-------|
| enrollment.view | View Enrollments |
| enrollment.edit | Edit Enrollments |
| enrollment.approve | Approve Enrollment Requests |
| enrollment.waitlist | Manage Waitlists |

### Billing & Finance
| Key | Label |
|-----|-------|
| billing.view | View Billing Records |
| billing.edit | Edit Billing Records |
| billing.refund | Issue Refunds |
| billing.reports | View Financial Reports |
| billing.export | Export Financial Data |

### Classes & Schedule
| Key | Label |
|-----|-------|
| classes.view | View Classes |
| classes.edit | Edit Classes |
| classes.create | Create Classes |
| schedule.view | View Full Schedule |
| schedule.edit | Edit Schedule |
| attendance.view | View Attendance |
| attendance.edit | Mark Attendance |

### Teachers
| Key | Label |
|-----|-------|
| teachers.view | View Teacher Profiles |
| teachers.edit | Edit Teacher Records |
| teachers.schedule | Manage Teacher Schedules |
| teachers.hours | View Teacher Hours |
| teachers.substitutes | Manage Substitute Requests |

### Casting & Productions
| Key | Label |
|-----|-------|
| casting.view | View Casting |
| casting.edit | Edit Casting |
| casting.approve | Approve/Publish Casting |
| productions.view | View Productions |
| productions.edit | Edit Productions |

### Communications
| Key | Label |
|-----|-------|
| communications.view | View Communications |
| communications.send | Send Communications |
| communications.announcements | Send Studio Announcements |

### Angelina AI
| Key | Label |
|-----|-------|
| angelina.view | View Angelina Conversations |
| angelina.configure | Configure Angelina Settings |
| angelina.toggle | Enable/Disable Angelina |

### Settings & Admin
| Key | Label |
|-----|-------|
| settings.view | View Studio Settings |
| settings.edit | Edit Studio Settings |
| roles.view | View Roles & Permissions |
| roles.edit | Edit Roles & Permissions |
| roles.assign | Assign Roles to Users |
| reports.view | View Reports |
| reports.export | Export Reports |

---

## 5. System Default Roles

These roles are seeded for every tenant on creation. `is_system = true` where noted.

### super_admin (is_system: true)
- All permissions always
- Cannot be deleted
- Cannot have permissions removed
- Only super_admin can assign super_admin to another user

### admin
- All permissions EXCEPT: roles.edit, settings.edit (those are super_admin only by default)
- Can be customized by super_admin
- Default for studio manager / front desk lead

### finance_admin
- billing.view, billing.edit, billing.refund, billing.reports, billing.export
- students.view, enrollment.view
- reports.view, reports.export

### teacher
- classes.view, schedule.view
- students.view (own classes only — enforced via RLS)
- attendance.view, attendance.edit (own classes only)
- casting.view, productions.view
- communications.send (to own class parents only)

### front_desk
- students.view, parents.view, parents.contact
- enrollment.view, enrollment.edit
- schedule.view, classes.view
- communications.send, communications.announcements
- billing.view

### parent (is_system: true)
- Fixed permissions — cannot be modified
- View own children's data only
- View own billing only
- View own enrollment only

### student (is_system: true)
- Fixed permissions — cannot be modified
- View own schedule only
- View own casting/roles only
- View own LMS content only

---

## 6. Permission Checking

### Server-side helper

```typescript
// lib/auth/permissions.ts

import { createClient } from '@/lib/supabase/server'

export async function getUserPermissions(userId: string, tenantId: string): Promise<Set<string>> {
  const supabase = createClient()

  // Check if super_admin first — return all permissions
  const { data: isSuperAdmin } = await supabase
    .from('profile_roles')
    .select('roles!inner(name)')
    .eq('profile_id', userId)
    .eq('tenant_id', tenantId)
    .eq('roles.name', 'super_admin')
    .single()

  if (isSuperAdmin) return new Set(['*']) // wildcard — all permissions

  // Get all permissions across all roles for this user
  const { data: perms } = await supabase
    .from('profile_roles')
    .select(`
      roles!inner(
        role_permissions!inner(
          permissions!inner(key)
        )
      )
    `)
    .eq('profile_id', userId)
    .eq('tenant_id', tenantId)

  const keys = new Set<string>()
  perms?.forEach(pr => {
    pr.roles?.role_permissions?.forEach((rp: any) => {
      keys.add(rp.permissions.key)
    })
  })

  return keys
}

export function hasPermission(userPerms: Set<string>, required: string): boolean {
  if (userPerms.has('*')) return true
  return userPerms.has(required)
}

export function hasAnyPermission(userPerms: Set<string>, required: string[]): boolean {
  if (userPerms.has('*')) return true
  return required.some(p => userPerms.has(p))
}
```

### Usage in API routes

```typescript
// app/api/billing/route.ts
export async function GET(req: Request) {
  const session = await getSessionWithRole()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const perms = await getUserPermissions(session.user.id, session.profile.tenant_id)
  if (!hasPermission(perms, 'billing.view')) {
    return new Response('Forbidden', { status: 403 })
  }

  // handler logic...
}
```

### Usage in components (client-side — passed from server)

```typescript
// Server component passes permissions down
// components/BillingCard.tsx
export function BillingCard({ permissions }: { permissions: string[] }) {
  const canEdit = permissions.includes('billing.edit') || permissions.includes('*')
  return (
    <div>
      {canEdit && <EditButton />}
    </div>
  )
}
```

---

## 7. Post-Login Redirect Logic

When a user has multiple roles, redirect priority order:

```typescript
const redirectPriority = [
  'super_admin',  → /admin/dashboard
  'admin',        → /admin/dashboard
  'finance_admin' → /admin/billing
  'teacher',      → /teach/dashboard
  'parent',       → /portal/dashboard
  'student',      → /learn/dashboard
]
```

The user lands on the dashboard for their highest-priority role. They can switch
context via a role switcher in the nav if they hold multiple roles.

---

## 8. Role Switcher UI

When a user holds multiple roles, show a role switcher in the top nav:

```
[👤 Amanda Cobb ▾]
  ✓ Admin View
    Teacher View
    Parent View
```

Switching context re-renders the nav and dashboard for that role without logging out.
The active role context is stored in a cookie (`active_role`) and read server-side.

---

## 9. Settings UI — Roles & Permissions Manager

### Location: /admin/settings/roles (super_admin only)

### Roles List Page
- Table of all roles for this tenant
- Columns: Role Name, Description, # Users, # Permissions, System (badge), Actions
- Actions: Edit, Clone, Delete (disabled for system roles)
- "Create Role" button

### Role Detail / Edit Page (/admin/settings/roles/[id])
- Role name (editable if not system)
- Description
- Color picker for badge
- Permission checkboxes grouped by category
- Each category is collapsible
- "Save Changes" button
- "Delete Role" button (disabled for system roles)

### Assign Roles to User
- From /admin/users/[id], show a "Roles" section
- Multi-select from all roles defined for this tenant
- Shows currently assigned roles as badges
- "Add Role" → dropdown of available roles
- "Remove" button on each assigned role badge
- Changes take effect immediately

---

## 10. Angelina Toggle (super_admin setting)

As part of this RBAC build, add an `angelina_enabled` boolean to tenant settings:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS angelina_enabled boolean DEFAULT true;
```

In /admin/settings (super_admin only):
- shadcn Switch component
- Label: "Enable Angelina AI Assistant"
- Subtext: "When disabled, the AI chat widget will be hidden for all users at this studio"
- Persists to tenants.angelina_enabled
- Chat widget component reads this before rendering — renders null if false
- This is a separate concern from the angelina.toggle permission

---

## 11. RLS Policies

All tables require RLS. Key patterns:

```sql
-- profile_roles: users can only see their own roles; super_admin sees all
CREATE POLICY "Users see own roles" ON profile_roles
  FOR SELECT USING (
    profile_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profile_roles pr
      JOIN roles r ON r.id = pr.role_id
      WHERE pr.profile_id = auth.uid()
      AND r.name = 'super_admin'
      AND pr.tenant_id = profile_roles.tenant_id
    )
  );

-- roles: tenant-scoped visibility
CREATE POLICY "Tenant roles visible to tenant members" ON roles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- permissions: globally readable (they're system-defined)
CREATE POLICY "Permissions are readable by all authenticated users" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## 12. Migration Plan

### Step 1: Create new tables
- permissions (seed with full registry)
- roles (seed system defaults per tenant)
- role_permissions (seed defaults)
- profile_roles (migrate from profiles.role)

### Step 2: Migrate existing profiles.role data
```sql
-- For each existing profile, create a profile_roles row
-- matching their current profiles.role value to the equivalent
-- new role in the roles table for their tenant
INSERT INTO profile_roles (profile_id, role_id, tenant_id)
SELECT
  p.id,
  r.id,
  p.tenant_id
FROM profiles p
JOIN roles r ON r.name = p.role::text AND r.tenant_id = p.tenant_id
WHERE p.tenant_id IS NOT NULL;
```

### Step 3: Update all permission checks
- Replace `profile.role === 'admin'` checks with `hasPermission(perms, 'x.y')`
- Update all API routes
- Update all layout requireRole() calls to use permissions instead

### Step 4: Deploy settings UI
- Roles list page
- Role edit page
- User role assignment UI

### Step 5: Deprecate profiles.role
- Keep column for 30 days as fallback
- Remove in follow-up migration

---

## 13. Files to Create / Modify

### New Files
- `supabase/migrations/011_rbac_permissions.sql`
- `supabase/seed/permissions.sql` (full permissions registry)
- `supabase/seed/default_roles.sql` (system roles per tenant)
- `lib/auth/permissions.ts`
- `app/admin/settings/roles/page.tsx`
- `app/admin/settings/roles/[id]/page.tsx`
- `components/rbac/RoleBadge.tsx`
- `components/rbac/PermissionCheckbox.tsx`
- `components/rbac/RoleSwitcher.tsx`
- `components/rbac/RoleAssigner.tsx`

### Files to Modify
- `lib/auth/requireRole.ts` → replace with permission-based checks
- `lib/auth/getSessionWithRole.ts` → return permissions set
- `app/(admin)/layout.tsx` → check permissions not role string
- `app/(teacher)/layout.tsx` → check permissions
- `app/(parent)/layout.tsx` → check permissions
- `components/chat/AngelinaWidget.tsx` → check angelina_enabled before render
- `app/admin/settings/page.tsx` → add Angelina toggle + link to Roles manager
- All `app/api/**` routes → replace role checks with permission checks

---

## 14. Acceptance Criteria

1. A user with both teacher + parent roles can switch context in the nav
2. Removing billing.view from a role immediately blocks that user from /admin/billing
3. super_admin always has access regardless of role_permissions state
4. Creating a new role and assigning permissions works end-to-end in the UI
5. Deleting a system role is blocked with a clear error message
6. angelina_enabled = false hides the widget for all roles at that tenant
7. RLS blocks cross-tenant data access at the database level
8. Post-login redirect uses role priority order correctly for multi-role users
