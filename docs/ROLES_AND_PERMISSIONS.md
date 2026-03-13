# ROLES_AND_PERMISSIONS.md
# Ballet Academy and Movement Platform — Roles and Permissions

## Related Specs
- `SAAS.md` — tenant provisioning, platform-level roles
- `EMAIL_TEMPLATES.md` — template permission tiers
- `TICKETING.md` — comp allocation permissions
- `SCHEDULING_AND_LMS.md` — teacher and student access
- `REGISTRATION_AND_ONBOARDING.md` — family and student profiles

---

## 1. Overview

The platform uses a **role-based access control (RBAC)** system with two layers:

1. **Platform-level roles** — control access across all tenants (Green Lyzard internal)
2. **Tenant-level roles** — control access within a single studio

Every user has exactly one platform role and one tenant role (per tenant they belong to). A user can belong to multiple tenants with different roles in each.

---

## 2. Platform-Level Roles

| Role | Description |
|---|---|
| **Platform Super Admin** | Full access to all tenants, baseline templates, billing, provisioning. Green Lyzard staff only. |
| **Platform Support** | Read-only access to tenant data for support purposes. Cannot modify tenant settings. |

Platform-level roles are assigned by Platform Super Admin only and are never exposed to studio users.

---

## 3. Tenant-Level Roles

### Role Hierarchy (highest to lowest)
```
Platform Super Admin
    └── Studio Owner
            └── Studio Admin
                    └── Studio Manager
                            └── Teacher
                                    └── Parent / Guardian
                                            └── Student (18+)
                                                    └── Student (under 18) — limited access
```

### Role Definitions

**Studio Owner**
- Full control of studio settings, billing, staff, and all data
- Can assign any role up to and including Studio Admin
- Typically Amanda Cobb

**Studio Admin**
- Full operational access — classes, students, families, schedules, productions
- Can assign roles up to Studio Manager
- Cannot access platform billing or white-label settings

**Studio Manager**
- Day-to-day operational access
- Can manage classes, schedules, student check-in, announcements
- Cannot access billing, staff payroll, or system settings

**Teacher**
- Access to their own assigned classes, student rosters, attendance
- Can view (not edit) student profiles for their classes
- Access to their own schedule, timesheets, and pay stubs
- No access to other teachers' data, billing, or studio settings

**Parent / Guardian**
- Access to their linked student profiles (registration, billing, schedule)
- Can view and pay invoices
- Can communicate with studio via platform inbox
- Cannot see teacher-side data for any user, including their own children if they are teachers

**Student (18+)**
- Access to their own profile, schedule, performance history, progress
- Can view their own billing if set as primary account holder
- Cannot see other students' data

**Student (under 18)**
- Limited portal access — view own schedule and performance roles only
- No access to billing, communications, or account settings
- Account managed by parent/guardian

---

## 4. Special Identity Scenarios

### 4.1 Minor Who Is Also a Teacher

A student under 18 may also be a certified teacher at the studio (e.g. a senior student who assists with beginner classes).

**Identity structure:**
- One Supabase auth account (single email/login)
- Two role contexts: `student` and `teacher`
- Role switcher available after login: "Switch to Student View" / "Switch to Teacher View"

**Parent access rules:**
- Parent CAN see the minor's **student context**: class registration, billing, attendance, schedule
- Parent CANNOT see the minor's **teacher context**: assigned classes, student rosters, pay, teacher communications
- The teacher context is the minor's professional identity — parents do not have access

**Activation:**
- Admin or above initiates teacher onboarding as normal
- System detects the email matches an existing student/family profile
- Admin sees a confirmation prompt: *"This person has an existing student profile. Parent portal access will be limited to their student details only."*
- Admin confirms → teacher role activated → access separation is automatic
- This is a single toggle — no complex configuration required

**Implementation note:**
The `user_roles` table stores separate role entries per context. The parent's linked_students array references only the student role context, never the teacher role context.

### 4.2 Adult Who Is Both a Teacher and a Parent

A staff member who also has children enrolled at the studio.

**Identity structure:**
- One Supabase auth account
- Two role contexts: `teacher` and `parent`
- Role switcher available after login: "Switch to Parent View" / "Switch to Teacher View"

**Access rules:**
- In Teacher View: sees their assigned classes, rosters, schedule, pay
- In Parent View: sees their enrolled children's profiles, billing, schedule
- Views are fully isolated — no data bleeds between contexts

**No special activation needed** — when a teacher enrolls a child, the system automatically adds a parent context to their account. Role switcher appears automatically.

### 4.3 Role Switcher UI
- Appears in the top-right account menu when a user has multiple role contexts
- Switches the entire portal view — navigation, dashboard, and data all reflect the active role
- The active role is shown clearly in the header at all times
- Switching roles does not require re-authentication

---

## 5. Permission Matrix

### Studio Management
| Action | Super Admin | Owner | Admin | Manager | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| Edit studio settings | ✓ | ✓ | — | — | — | — | — |
| View studio dashboard | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Manage billing/invoices | ✓ | ✓ | ✓ | — | — | — | — |
| View own invoices | — | — | — | — | — | ✓ | ✓* |
| Manage staff roles | ✓ | ✓ | ✓ | — | — | — | — |
| View staff list | ✓ | ✓ | ✓ | ✓ | — | — | — |

### Classes and Scheduling
| Action | Super Admin | Owner | Admin | Manager | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| Create/edit classes | ✓ | ✓ | ✓ | ✓ | — | — | — |
| View all class rosters | ✓ | ✓ | ✓ | ✓ | — | — | — |
| View own class roster | — | — | — | — | ✓ | — | — |
| Take attendance | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| View own schedule | — | — | — | — | ✓ | ✓ | ✓ |

### Student and Family Profiles
| Action | Super Admin | Owner | Admin | Manager | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| View all student profiles | ✓ | ✓ | ✓ | ✓ | — | — | — |
| View own class students | — | — | — | — | ✓ | — | — |
| View own child profile | — | — | — | — | — | ✓ | — |
| Edit own profile | — | — | — | — | ✓ | ✓ | ✓* |
| View own profile | — | — | — | — | ✓ | ✓ | ✓ |

### Productions and Ticketing
| Action | Super Admin | Owner | Admin | Manager | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| Create/edit productions | ✓ | ✓ | ✓ | — | — | — | — |
| Manage comp allocation | ✓ | ✓ | ✓ | — | — | — | — |
| Activate door scanner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* | — |
| Scan tickets at door | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* | — |
| Send intermission push | ✓ | ✓ | ✓ | — | — | — | — |
| Purchase tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own tickets | — | — | — | — | ✓ | ✓ | ✓ |

*Requires explicit activation by Admin per event for volunteers

### Email and Communications
| Action | Super Admin | Owner | Admin | Manager | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| Edit baseline templates | ✓ | — | — | — | — | — | — |
| Edit studio templates | ✓ | ✓ | ✓ | ✓* | — | — | — |
| Send announcements | ✓ | ✓ | ✓ | ✓ | — | — | — |
| View comms inbox | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Send message to studio | — | — | — | — | — | ✓ | ✓* |

*Manager can only edit Announcement and Communication templates, not transactional templates

---

## 6. Database Schema

```sql
-- User role assignments per tenant
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tenant_id uuid references tenants(id) not null,
  role text not null,                    -- 'owner','admin','manager','teacher','parent','student'
  role_context text,                     -- 'teacher' or 'parent' or 'student' for multi-role users
  is_active boolean default true,
  activated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(user_id, tenant_id, role_context)
);

-- Parent-student links
create table parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid references auth.users(id) not null,
  student_user_id uuid references auth.users(id) not null,
  tenant_id uuid references tenants(id) not null,
  can_view_billing boolean default true,
  can_view_schedule boolean default true,
  can_view_teacher_context boolean default false,  -- always false for minor teachers
  created_at timestamptz default now(),
  unique(parent_user_id, student_user_id, tenant_id)
);

-- Minor teacher flag
create table teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tenant_id uuid references tenants(id) not null,
  is_minor boolean default false,
  parent_access_restricted boolean default false,  -- true when teacher is also a minor student
  onboarded_by uuid references auth.users(id),
  onboarded_at timestamptz
);
```

---

## 7. Implementation Notes

- Role checks are enforced server-side via Supabase Row Level Security (RLS) policies
- Client-side navigation hides menu items based on role, but server enforces all restrictions
- Role switcher state is stored in session, not persisted — resets on logout
- When a new teacher context is created for an existing parent, a migration runs to set `can_view_teacher_context = false` on all parent_student_links for that user
- Platform Super Admin bypasses all RLS for support purposes — all queries include a `bypass_rls` flag that is only available to service role key

---

## 8. Open Questions
- None — all decisions resolved in Session 6.
