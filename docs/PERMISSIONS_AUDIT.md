# Permissions & RLS Audit

> Generated: 2026-03-31
> Scope: All sensitive tables, RLS policies, helper functions, and application-level guards
> Status: **Audit findings — no changes made**

---

## 1. RLS Helper Functions (SECURITY DEFINER)

All functions query `profile_roles` and run as the definer to avoid RLS recursion.

| Function | Logic |
|----------|-------|
| `is_admin()` | `EXISTS(profile_roles WHERE user_id = auth.uid() AND is_active AND role IN ('admin','super_admin'))` |
| `is_teacher()` | `EXISTS(profile_roles WHERE user_id = auth.uid() AND is_active AND role = 'teacher')` |
| `is_front_desk()` | `EXISTS(profile_roles WHERE user_id = auth.uid() AND is_active AND role = 'front_desk')` |
| `get_user_role()` | Returns `role` from `profile_roles` WHERE `is_primary = true`, LIMIT 1 |
| `my_class_ids()` | `array_agg(id) FROM classes WHERE teacher_id = auth.uid()` |

### Findings

- **`is_admin()` does not include `finance_admin`, `studio_admin`, or `studio_manager`** — only `admin` and `super_admin`. The app-level `requireAdmin()` guard accepts all five roles, creating a mismatch: a `finance_admin` passes the Next.js guard but fails RLS SELECT on most tables.
- **`my_class_ids()` only checks `classes.teacher_id`** — it does not check `class_teachers` table. Teachers assigned via `class_teachers` (multi-teacher support) won't get access to those classes' students, enrollments, or attendance via RLS.

---

## 2. RLS Policies by Table

### `profiles`

| Policy | Cmd | Qual |
|--------|-----|------|
| `profiles_select_own` | SELECT | `id = auth.uid()` |
| `profiles_select_admin` | SELECT | `is_admin()` |
| `profiles_select_teacher_parents` | SELECT | `is_teacher() AND id IN (students → enrollments → my_class_ids())` |
| `profiles_update_own` | UPDATE | `id = auth.uid()` |
| `profiles_update_admin` | UPDATE | `is_admin()` |
| `profiles_insert_self` | INSERT | (no qual — uses WITH CHECK) |

**Status:** Solid. Teachers can only see parents of their enrolled students.

### `profile_roles`

| Policy | Cmd | Qual |
|--------|-----|------|
| `users_read_own_roles` | SELECT | `user_id = auth.uid()` |
| `admins_manage_roles` | ALL | `is_admin()` |

**Status:** Good. Users can only read their own roles; admins can manage all.

### `timesheets`

| Policy | Cmd | Qual |
|--------|-----|------|
| `teachers_own_timesheets_select` | SELECT | `teacher_id = auth.uid()` |
| `teachers_own_timesheets_insert` | INSERT | (no qual — uses WITH CHECK) |
| `teachers_own_timesheets_update` | UPDATE | `teacher_id = auth.uid() AND status IN ('draft','rejected')` |
| `admins_timesheets` | ALL | `is_admin()` |

**Status:** Good. Teachers can only see/edit their own draft/rejected timesheets. Approved/submitted timesheets are read-only for teachers.

### `timesheet_entries`

| Policy | Cmd | Qual |
|--------|-----|------|
| `teachers_own_entries_select` | SELECT | `EXISTS(timesheets WHERE id = timesheet_id AND teacher_id = auth.uid())` |
| `teachers_own_entries_insert` | INSERT | (no qual) |
| `teachers_own_entries_update` | UPDATE | `EXISTS(timesheets WHERE id = timesheet_id AND teacher_id = auth.uid() AND status IN ('draft','rejected'))` |
| `admins_timesheet_entries` | ALL | `is_admin()` |

**Finding:** INSERT has no qual — any teacher could potentially insert entries into another teacher's timesheet if they know the timesheet_id. The WITH CHECK clause (not captured in `qual`) likely prevents this, but should be verified.

### `payroll_change_log`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Teachers can view own change log` | SELECT | JOIN timesheet_entries → timesheets WHERE teacher_id = auth.uid() |
| `Admins can manage change log` | ALL | `is_admin()` |

**Status:** Good. Teachers can only see changes to their own entries.

### `private_sessions`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Teachers can manage own sessions` | ALL | `auth.uid() = primary_teacher_id` |
| `Admins can manage private sessions` | ALL | `is_admin()` |

**Finding:** Teachers have full ALL access (including DELETE) on their own private sessions. Consider restricting to SELECT + UPDATE only if deletion should require admin approval.

### `private_session_billing`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Admins can manage private billing` | ALL | `is_admin()` |

**Finding:** No teacher SELECT policy. Teachers cannot see billing details for their own sessions at the RLS level. This is correct if billing is admin-only, but may need a read policy if teachers should see their own session rates.

### `class_teachers`

| Policy | Cmd | Qual |
|--------|-----|------|
| `teacher_read_class_teachers` | SELECT | `is_teacher()` |
| `admin_full_class_teachers` | ALL | `is_admin()` |

**Finding:** Any teacher can read ALL `class_teachers` rows — not scoped to their own assignments. Low risk (only contains class_id ↔ teacher_id mappings) but worth noting.

### `staff_documents`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Admins can manage staff documents` | ALL | `is_admin()` |
| `Finance can view documents` | SELECT | `profile_roles WHERE role IN ('finance_admin','super_admin')` |

**Finding:** Teachers cannot view their own documents. If staff should see their own uploaded docs, a `user_id = auth.uid()` SELECT policy is needed.

### `teachers`

| Policy | Cmd | Qual |
|--------|-----|------|
| `teachers_select_own` | SELECT | `id = auth.uid()` |
| `teachers_update_own` | UPDATE | `id = auth.uid()` |
| `teachers_all_admin` | ALL | `is_admin()` |

**Status:** Good. Teachers can only view/update their own record.

### `students`

| Policy | Cmd | Qual |
|--------|-----|------|
| `students_all_admin` | ALL | `is_admin()` |
| `students_select_parent` | SELECT | `parent_id = auth.uid()` |
| `students_select_teacher` | SELECT | `is_teacher() AND id IN (enrollments WHERE class_id = ANY(my_class_ids()))` |
| `students_insert_parent` | INSERT | (no qual) |
| `students_update_parent` | UPDATE | `parent_id = auth.uid()` |

**Finding:** `students_select_teacher` uses `my_class_ids()` which only checks `classes.teacher_id`, not `class_teachers`. Teachers assigned via `class_teachers` won't see their students.

### `enrollments`

| Policy | Cmd | Qual |
|--------|-----|------|
| `enrollments_all_admin` | ALL | `is_admin()` |
| `enrollments_select_parent` | SELECT | `student_id = ANY(my_student_ids())` |
| `enrollments_select_teacher` | SELECT | `class_id = ANY(my_class_ids())` |
| `enrollments_insert_parent` | INSERT | (no qual) |

**Status:** Same `my_class_ids()` issue as students.

### `attendance_records`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Admins manage attendance` | ALL | `is_admin()` |
| `Teachers manage own class attendance` | ALL | `teacher_id = auth.uid()` |
| `Teachers view enrolled class attendance` | SELECT | `class_id = ANY(my_class_ids())` |

**Status:** Same `my_class_ids()` issue.

### `families`

| Policy | Cmd | Qual |
|--------|-----|------|
| `admins_families` | ALL | `is_admin()` |
| `parent_own_family` | SELECT | `primary_contact_id = auth.uid()` |

**Status:** Good.

### `studio_settings`

| Policy | Cmd | Qual |
|--------|-----|------|
| `Authenticated users can read studio settings` | SELECT | `true` |
| `Admins can update studio settings` | ALL | `is_admin()` |
| `Admins can insert studio settings` | INSERT | (no qual) |

**Finding:** INSERT has no qual — any authenticated user could insert a studio_settings row. The WITH CHECK likely restricts this, but should be verified.

---

## 3. Tables Without RLS or Missing From Audit

| Table | RLS Enabled | Policies |
|-------|------------|----------|
| `teacher_pay_rates` | **Table does not exist** | N/A |
| `classes` | Yes | Not audited (broad access expected) |
| `rooms` | Yes | Not audited |
| `disciplines` | Yes | Not audited |
| `seasons` | Yes | Not audited |
| `pay_periods` | Yes | Not audited |

---

## 4. Application-Level Guards

### `lib/auth/guards.ts`

| Guard | Allowed Roles |
|-------|--------------|
| `requireAdmin()` | `admin`, `super_admin`, `studio_admin`, `finance_admin`, `studio_manager` |
| `requireTeacher()` | `teacher`, `admin`, `super_admin` |
| `requireParent()` | `parent`, `student`, `teacher`, `admin`, `super_admin` |
| `requireRole(...roles)` | Any specified role |

### `lib/rbac/permissions.ts`

| Function | Allowed Roles |
|----------|--------------|
| `canViewPayRates()` | `finance_admin`, `super_admin` |
| `canApproveTimesheets()` | `finance_admin`, `super_admin` |
| `canExportPayroll()` | `finance_admin`, `super_admin` |
| `isSuperAdmin()` | `super_admin` only |

### Mismatch: App Guards vs RLS

| Role | `requireAdmin()` | `is_admin()` RLS | Gap |
|------|-------------------|------------------|-----|
| `admin` | Yes | Yes | — |
| `super_admin` | Yes | Yes | — |
| `studio_admin` | Yes | **No** | Can access pages but RLS blocks data |
| `finance_admin` | Yes | **No** | Can access pages but RLS blocks data |
| `studio_manager` | Yes | **No** | Can access pages but RLS blocks data |

---

## 5. Teacher Portal Data Exposure

### `/teach/timesheets`
- Guard: `requireRole("teacher", "admin", "super_admin")`
- Data: Own timesheets only (`teacher_id` match), entries joined via timesheet_id
- RLS: Matches — teachers see only own timesheets
- **Status:** Secure

### `/teach/privates`
- Guard: `requireRole("teacher", "admin", "super_admin")`
- Data: `private_sessions WHERE primary_teacher_id = user.id`
- Does NOT fetch `billing_status`, `session_rate`, or billing details
- RLS: Matches — teachers see only own sessions
- **Status:** Secure. Billing data is not exposed to teachers.

### Admin Staff Profile — Timecards Tab (`TimecardsTab.tsx`)
- Uses `canView` prop (set by `canViewPayRates()` → `finance_admin` or `super_admin`)
- When `canView = false`: shows "You don't have permission" message
- When `canView = true`: fetches `timesheets.*` for the teacher (includes `total_pay`)
- **Uses client-side Supabase** — relies on RLS to enforce access
- **Finding:** The `canView` check is UI-only. The actual data fetch uses `createClient()` (browser Supabase). Since RLS for timesheets allows `is_admin()` full access, any admin/super_admin can fetch the data regardless of the `canView` prop. The `finance_admin` role is NOT in `is_admin()`, so a finance_admin would pass the app guard but be blocked by RLS — data would silently return empty.

---

## 6. Critical Issues Summary

### P0 — Security Gaps

1. **`is_admin()` role mismatch** — `studio_admin`, `finance_admin`, `studio_manager` pass `requireAdmin()` but are blocked by RLS. Either update `is_admin()` to include these roles, or remove them from `requireAdmin()`. Currently produces silent data failures.

2. **`my_class_ids()` ignores `class_teachers`** — Teachers assigned via multi-teacher support (`class_teachers` table) cannot see their students, enrollments, or attendance at the RLS level. The function only checks `classes.teacher_id`.

### P1 — Hardening

3. **`private_sessions` teacher ALL policy** — Teachers can DELETE their own private sessions. Consider restricting to SELECT + UPDATE if deletion should require admin approval.

4. **`staff_documents` no teacher self-view** — Teachers cannot see their own uploaded documents.

5. **`timesheet_entries` INSERT qual** — No visible qual on teacher insert policy. Verify WITH CHECK prevents cross-teacher insertion.

6. **`studio_settings` INSERT qual** — No visible qual. Verify WITH CHECK prevents non-admin insertion.

### P2 — Improvements

7. **`class_teachers` overly broad teacher SELECT** — Any teacher can read all teacher-class assignments. Consider scoping to own assignments.

8. **`private_session_billing` no teacher read** — Teachers cannot see billing for their own sessions. Add read policy if teachers should see their rates.

9. **TimecardsTab uses client-side fetch** — `canView` is a UI guard only. RLS is the real enforcement, which is correct, but the `finance_admin` role will silently fail because `is_admin()` doesn't include it.

---

## 7. Recommended Fix Priority

```
1. Update is_admin() to include finance_admin, studio_admin, studio_manager
   OR create role-specific helper functions (is_finance(), is_studio_manager())

2. Update my_class_ids() to UNION class_teachers assignments:
   SELECT array_agg(id) FROM (
     SELECT id FROM classes WHERE teacher_id = auth.uid()
     UNION
     SELECT class_id AS id FROM class_teachers WHERE teacher_id = auth.uid()
   ) sub;

3. Verify WITH CHECK clauses on INSERT policies (timesheet_entries, studio_settings)

4. Add staff_documents teacher self-view policy

5. Restrict private_sessions teacher policy to SELECT + UPDATE
```

---

*This audit covers RLS policies and application guards only. It does not cover API route authorization, middleware, or Supabase Edge Functions.*
