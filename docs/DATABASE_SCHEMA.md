# DATABASE_SCHEMA.md
# BAM Platform — Supabase Database Schema
# Project ref: niabwaofqsirfsktyyff
# Tenant UUID: 84d98f72-c82f-414f-8b17-172b802f6993
# Last updated: March 2026

> **Claude Code must read this file at the start of every session.**
> Never assume a table, column, or view exists without checking here first.
> Update this file whenever a migration adds or changes tables/columns.

---

## Critical Naming Conventions

| Rule | Correct | Wrong |
|------|---------|-------|
| FK to profiles | `user_id` | `profile_id` |
| Role checks | Query `profile_roles` | Query `profiles.role` |
| Role values | Plain text strings | `::user_role` (enum DROPPED) |
| Teacher lookup | `teacher_profiles` VIEW | Direct query on `teachers` only |
| Tenant filter | Only on tables with `tenant_id` | `classes` has NO `tenant_id` |

### Tables WITHOUT tenant_id
- `profiles` — no tenant_id
- `classes` — no tenant_id
- `students` — no tenant_id
- `enrollments` — no tenant_id
- `teachers` — no tenant_id
- `dances` — no tenant_id
- `casting` — no tenant_id
- `rehearsals` — no tenant_id
- `production_dances` — no tenant_id
- `teacher_hours` — no tenant_id

### Tables WITH tenant_id
- `profile_roles`, `tenants`, `rooms`, `schedule_instances`
- `timesheets`, `timesheet_entries`, `timesheet_entry_changes`
- `pay_periods`, `productions`, `seasons`
- `families`, `extended_contacts`
- All communications tables (channels, messages, etc. — planned)

---

## Views

### `teacher_profiles` (VIEW — not a table)
Joins `profiles` + `teachers` for active teachers.

**Columns:**
- `id` (= profiles.id = teachers.id)
- `first_name`, `last_name`, `email`, `phone`, `avatar_url`
- `employment_type`, `hire_date`, `is_active`

**No `tenant_id` column** — do not filter by tenant_id.
**No `full_name` column** — use `first_name` + `last_name`.
**No `teacher_id` column** — use `id`.

---

## Tables

### `profiles`
Core user record. Created automatically by `handle_new_user()` trigger on auth.users INSERT.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | (from auth.users) |
| role | user_role | NO | 'parent' |
| first_name | text | YES | null |
| last_name | text | YES | null |
| email | text | YES | null |
| phone | text | YES | null |
| avatar_url | text | YES | null |
| preferred_name | text | YES | null |
| stripe_customer_id | text | YES | null |
| onboarding_complete | boolean | YES | false |
| is_teacher | boolean | YES | false |
| email_opt_in | boolean | YES | true |
| sms_opt_in | boolean | YES | true |
| address_line_1 | text | YES | null |
| address_line_2 | text | YES | null |
| city | text | YES | null |
| state | text | YES | null |
| zip_code | text | YES | null |
| country | text | YES | 'US' |
| latitude | numeric | YES | null |
| longitude | numeric | YES | null |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

**Notes:**
- `role` column uses `user_role` enum type but this is legacy — always use `profile_roles` for role checks
- `preferred_name` defaults to null; UI shows `preferred_name ?? first_name`
- No `tenant_id` column
- `handle_new_user()` trigger inserts with `role = 'parent'` (plain text, not enum cast)

---

### `profile_roles`
RBAC system. Source of truth for all role checks.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | null |
| tenant_id | uuid | NO | null |
| role | text | NO | null |
| is_primary | boolean | NO | false |
| is_active | boolean | NO | true |
| assigned_by | uuid | YES | null |
| assigned_at | timestamptz | NO | now() |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Valid role values:** `super_admin`, `admin`, `finance_admin`, `studio_manager`, `front_desk`, `teacher`, `parent`, `student`

**FK:** `user_id` → `profiles.id`

---

### `teachers`
Extended teacher record. `id` = `profiles.id` (same UUID, no separate FK column needed).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | (= profiles.id) |
| bio | text | YES | null |
| specialties | text[] | YES | '{}' |
| certifications | text[] | YES | '{}' |
| hire_date | date | YES | null |
| employment_type | text | YES | null |
| headshot_url | text | YES | null |
| class_rate_cents | integer | YES | null |
| private_rate_cents | integer | YES | null |
| rehearsal_rate_cents | integer | YES | null |
| admin_rate_cents | integer | YES | null |
| is_mandated_reporter_certified | boolean | YES | false |
| mandated_reporter_cert_date | date | YES | null |
| mandated_reporter_cert_expires_at | date | YES | null |
| background_check_complete | boolean | YES | false |
| background_check_expires_at | date | YES | null |
| w9_on_file | boolean | YES | false |
| can_be_scheduled | boolean | YES | false |
| is_active | boolean | YES | true |
| is_sub_eligible | boolean | YES | false |
| substitute_session_count | integer | YES | 0 |
| substitute_session_threshold | integer | YES | 3 |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

**Notes:** No `tenant_id`. Anyone in `teachers` table appears in `teacher_profiles` view regardless of their `profile_roles` role. Amanda Cobb and Cara Matchett have teacher records even though their primary role is `super_admin`/`admin`.

---

### `students`
Student records linked to a parent profile.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| parent_id | uuid | NO | null |
| family_id | uuid | YES | null |
| first_name | text | NO | null |
| last_name | text | NO | null |
| preferred_name | text | YES | null |
| date_of_birth | date | NO | null |
| age_group | text | YES | null |
| current_level | text | YES | null |
| medical_notes | text | YES | null |
| emergency_contact | jsonb | YES | null |
| photo_consent | boolean | YES | false |
| media_consent | boolean | YES | false |
| media_consent_date | timestamptz | YES | null |
| avatar_url | text | YES | null |
| address_line_1 | text | YES | null |
| address_line_2 | text | YES | null |
| city | text | YES | null |
| state | text | YES | null |
| zip_code | text | YES | null |
| country | text | YES | 'US' |
| latitude | numeric | YES | null |
| longitude | numeric | YES | null |
| trial_used | boolean | YES | false |
| active | boolean | YES | true |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

**Notes:** No `tenant_id`. `parent_id` → `profiles.id`. `family_id` → `families.id`. Use `active` not `is_active`.

---

### `classes`
Class templates (not specific scheduled occurrences — those are `schedule_instances`).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | null |
| style | text | NO | null |
| level | text | NO | null |
| age_min | integer | YES | null |
| age_max | integer | YES | null |
| max_students | integer | YES | 10 |
| teacher_id | uuid | YES | null |
| day_of_week | integer | YES | null |
| start_time | time | YES | null |
| end_time | time | YES | null |
| room | text | YES | null |
| is_active | boolean | YES | true |
| description | text | YES | null |
| discipline | text | YES | null |
| fee_cents | integer | YES | null |
| season | text | YES | null |
| notes | text | YES | null |
| enrolled_count | integer | NO | 0 |
| status | text | NO | 'active' |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

**CRITICAL: No `tenant_id` column.** Never filter classes by tenant_id.

---

### `enrollments`
Links students to classes.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| student_id | uuid | NO | null |
| class_id | uuid | NO | null |
| status | text | NO | 'active' |
| enrolled_at | timestamptz | YES | now() |
| dropped_at | timestamptz | YES | null |
| trial_class_date | date | YES | null |
| stripe_payment_intent_id | text | YES | null |
| amount_paid_cents | integer | YES | null |
| cancelled_at | timestamptz | YES | null |
| created_at | timestamptz | YES | now() |

**Notes:** No `tenant_id`. Added columns: `enrollment_type`, `family_id`, `billing_override`, `override_amount`.

Additional columns:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| enrollment_type | text | YES | 'regular' |
| family_id | uuid | YES | null |
| billing_override | boolean | YES | false |
| override_amount | integer | YES | null |

---

### `families`
Family grouping for billing and contact management.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| family_name | text | NO | null |
| primary_contact_id | uuid | YES | null |
| billing_email | text | YES | null |
| billing_phone | text | YES | null |
| stripe_customer_id | text | YES | null |
| stripe_payment_method_last4 | text | YES | null |
| account_credit | numeric | YES | 0 |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Notes:** HAS `tenant_id`. `primary_contact_id` → `profiles.id`.

---

### `family_contacts`
Legacy contact records within a family.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| family_id | uuid | NO | null |
| first_name | text | YES | null |
| last_name | text | YES | null |
| email | text | YES | null |
| phone | text | YES | null |
| relationship | text | YES | null |
| is_primary | boolean | YES | false |
| is_emergency | boolean | YES | false |
| created_at | timestamptz | NO | now() |

---

### `student_guardians`
Links students to guardian profiles with role flags.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| student_id | uuid | NO | null |
| profile_id | uuid | NO | null |
| relationship | text | NO | 'parent' |
| is_primary | boolean | NO | false |
| is_billing | boolean | NO | false |
| is_emergency | boolean | NO | false |
| portal_access | boolean | NO | true |
| created_at | timestamptz | NO | now() |

**Notes:** Uses `profile_id` (exception to the `user_id` convention). UNIQUE on (student_id, profile_id).

---

### `extended_contacts`
Additional contacts (grandparents, nannies, etc.) with notification preferences.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| first_name | text | NO | null |
| last_name | text | NO | null |
| email | text | YES | null |
| phone | text | YES | null |
| relationship | text | YES | null |
| notify_live_stream | boolean | YES | false |
| notify_recordings | boolean | YES | false |
| notify_photos | boolean | YES | false |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Notes:** HAS `tenant_id`. Linked to students via `extended_contact_students`.

---

### `extended_contact_students`
Join table linking extended contacts to students.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| extended_contact_id | uuid | NO | null |
| student_id | uuid | NO | null |
| created_at | timestamptz | NO | now() |

**Notes:** UNIQUE on (extended_contact_id, student_id). RLS: admins via `is_admin()`, parents can read contacts for their own students via `student_guardians`.

---

### `schedule_instances`
Specific scheduled occurrences of a class or event on a given date.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| template_id | uuid | YES | null |
| class_id | uuid | YES | null |
| teacher_id | uuid | YES | null |
| room_id | uuid | YES | null |
| event_type | text | NO | 'class' |
| event_date | date | NO | null |
| start_time | time | NO | null |
| end_time | time | NO | null |
| status | text | NO | 'published' |
| cancellation_reason | text | YES | null |
| substitute_teacher_id | uuid | YES | null |
| notes | text | YES | null |
| approval_status | text | YES | 'approved' |
| approved_by | uuid | YES | null |
| approved_at | timestamptz | YES | null |
| notification_sent_at | timestamptz | YES | null |
| ical_uid | text | YES | null |
| is_trial_eligible | boolean | YES | false |
| production_id | uuid | YES | null |
| created_by | uuid | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Notes:** `teacher_id` → `profiles.id`. Use this table to find a teacher's scheduled classes on a given date for timesheet pre-fill.

---

### `rooms`
Studio rooms available for scheduling.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| name | text | NO | null |
| capacity | integer | YES | null |
| is_bookable | boolean | YES | true |
| hourly_rate_private | numeric | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### `productions`
Recitals, competitions, showcases.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | null |
| production_type | text | NO | 'recital' |
| season | text | YES | null |
| venue_name | text | YES | null |
| venue_address | text | YES | null |
| venue_directions | text | YES | null |
| performance_date | date | YES | null |
| call_time | time | YES | null |
| start_time | time | YES | null |
| end_time | time | YES | null |
| competition_org | text | YES | null |
| competition_division | text | YES | null |
| notes | text | YES | null |
| approval_status | text | NO | 'draft' |
| approved_by | uuid | YES | null |
| approved_at | timestamptz | YES | null |
| is_published | boolean | NO | false |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### `dances`
Individual dance pieces within a production.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | null |
| discipline | text | NO | null |
| choreographer_id | uuid | YES | null |
| level | text | YES | null |
| duration_seconds | integer | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### `production_dances`
Join table linking productions to dances with performance details.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| production_id | uuid | NO | null |
| dance_id | uuid | NO | null |
| performance_type | text | NO | 'recital' |
| performance_order | integer | NO | 0 |
| music_title | text | YES | null |
| music_artist | text | YES | null |
| music_duration_seconds | integer | YES | null |
| music_file_url | text | YES | null |
| costume_description | text | YES | null |
| costume_notes | text | YES | null |
| costume_due_date | date | YES | null |
| stage_notes | text | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### `casting`
Links students to production dances with roles.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| production_dance_id | uuid | NO | null |
| student_id | uuid | NO | null |
| role | text | NO | 'ensemble' |
| costume_assigned | boolean | NO | false |
| costume_notes | text | YES | null |
| is_alternate | boolean | NO | false |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |

---

### `rehearsals`
Scheduled rehearsal sessions for a production dance.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| production_dance_id | uuid | NO | null |
| rehearsal_date | date | NO | null |
| start_time | time | NO | null |
| end_time | time | NO | null |
| location | text | YES | null |
| location_address | text | YES | null |
| location_directions | text | YES | null |
| rehearsal_type | text | NO | 'rehearsal' |
| notes | text | YES | null |
| is_mandatory | boolean | NO | true |
| approval_status | text | NO | 'draft' |
| approved_by | uuid | YES | null |
| approved_at | timestamptz | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### `pay_periods`
Monthly pay periods for teacher payroll.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| period_month | integer | NO | null |
| period_year | integer | NO | null |
| submission_deadline | date | NO | null |
| status | text | NO | 'open' |
| created_at | timestamptz | NO | now() |

---

### `timesheets`
Monthly timesheet per teacher per pay period.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| teacher_id | uuid | NO | null |
| pay_period_id | uuid | NO | null |
| status | text | NO | 'draft' |
| submitted_at | timestamptz | YES | null |
| reviewed_by | uuid | YES | null |
| reviewed_at | timestamptz | YES | null |
| rejection_notes | text | YES | null |
| total_hours | numeric | YES | 0 |
| total_pay | numeric | YES | 0 |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Notes:** `teacher_id` → `profiles.id`. `total_hours` is auto-calculated by a DB trigger when entries are added/updated/deleted.

---

### `timesheet_entries`
Individual hour log entries within a timesheet.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| timesheet_id | uuid | NO | null |
| entry_type | text | NO | null |
| teacher_role | text | NO | 'lead' |
| session_id | uuid | YES | null |
| production_id | uuid | YES | null |
| competition_id | uuid | YES | null |
| schedule_instance_id | uuid | YES | null |
| class_id | uuid | YES | null |
| date | date | NO | null |
| start_time | time | YES | null |
| end_time | time | YES | null |
| total_hours | numeric | NO | 0 |
| description | varchar | YES | null |
| notes | text | YES | null |
| rate_key | varchar | YES | null |
| rate_amount | numeric | YES | 0 |
| rate_override | boolean | NO | false |
| rate_override_by | uuid | YES | null |
| is_auto_populated | boolean | NO | false |
| attendance_status | text | YES | null |
| is_substitute | boolean | NO | false |
| substitute_for_teacher_id | uuid | YES | null |
| substitute_notes | text | YES | null |
| sub_for | text | YES | null |
| event_tag | text | YES | null |
| production_name | text | YES | null |
| status | text | NO | 'draft' |
| submitted_at | timestamptz | YES | null |
| approved_at | timestamptz | YES | null |
| approved_by | uuid | YES | null |
| flagged_at | timestamptz | YES | null |
| flagged_by | uuid | YES | null |
| flag_question | text | YES | null |
| flag_response | text | YES | null |
| flag_responded_at | timestamptz | YES | null |
| adjusted_by | uuid | YES | null |
| adjustment_note | text | YES | null |
| paid_at | timestamptz | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Valid entry_type values:** `class_lead`, `class_assistant`, `private`, `rehearsal`, `substitute`, `admin`, `training`, `performance`, `competition`, `bonus`, `other`

---

### `timesheet_entry_changes`
Audit log for all changes to timesheet entries.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| entry_id | uuid | NO | null |
| changed_by | uuid | NO | null |
| changed_by_name | text | YES | null |
| change_type | text | NO | null |
| field_changed | text | YES | null |
| old_value | text | YES | null |
| new_value | text | YES | null |
| note | text | YES | null |
| created_at | timestamptz | NO | now() |

---

### `teacher_hours`
Legacy teacher hour logging (pre-timesheet module). May be superseded by `timesheet_entries`.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| teacher_id | uuid | NO | null |
| class_id | uuid | YES | null |
| date | date | NO | null |
| hours | numeric | NO | null |
| category | text | NO | null |
| notes | text | YES | null |
| approved | boolean | YES | false |
| approved_by | uuid | YES | null |
| approved_at | timestamptz | YES | null |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

**Notes:** No `tenant_id`. New work should use `timesheet_entries` instead.

---

## Other Tables (Schema Not Yet Fully Documented)

These tables exist but their full column schemas have not been captured.
Run `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>'`
before writing queries against any of these.

| Table | Purpose |
|-------|---------|
| `angelina_conversations` | Angelina AI chat history |
| `angelina_feedback` | Feedback on Angelina responses |
| `announcement_recipients` | Recipients for announcements |
| `announcements` | Studio-wide announcements |
| `approval_tasks` | Approval workflow tasks |
| `attendance` | Class attendance records |
| `badges` | Badge definitions |
| `calendar_subscriptions` | iCal subscription tokens |
| `class_reminders` | Automated class reminders |
| `communication_attachments` | File attachments in communications |
| `communication_messages` | Messages in communication threads |
| `communication_thread_reads` | Read receipts for threads |
| `communication_threads` | Communication thread containers |
| `competitor_studios` | Competitive intelligence data |
| `email_templates` | Customizable email templates |
| `enrollment_cart_items` | Items in enrollment carts |
| `enrollment_carts` | Enrollment checkout carts |
| `expansion_markets` | Location expansion research |
| `leads` | Prospective family leads |
| `live_sessions` | Live streaming sessions |
| `lms_content` | Learning management system content |
| `mandated_reporter_incidents` | Mandated reporter incident log |
| `message_threads` | Legacy message threading |
| `messages` | Legacy messages |
| `permissions` | Granular permission definitions |
| `platform_modules` | Feature module toggles per tenant |
| `products` | Studio store products |
| `rehearsal_attendance` | Attendance for rehearsals |
| `role_permissions` | Permissions assigned to roles |
| `roles` | Role definitions |
| `schedule_approvers` | Users who can approve schedules (Amanda + Cara) |
| `schedule_change_requests` | Requests to change scheduled instances |
| `schedule_embeds` | Public schedule embed tokens |
| `schedule_templates` | Recurring schedule templates |
| `seasons` | Studio seasons |
| `shop_configs` | Studio store configuration |
| `shop_orders` | Studio store orders |
| `skill_assessments` | Teacher skill assessments of students |
| `stream_access` | Live stream access control |
| `student_badges` | Badges awarded to students |
| `student_content_progress` | LMS progress tracking |
| `studio_settings` | Per-tenant studio configuration |
| `substitute_alerts` | Alerts for substitute availability |
| `substitute_authorizations` | Teacher sub authorization records |
| `substitute_requests` | Requests for substitute teachers |
| `tenants` | Multi-tenant studio records |

---

## DB Triggers

| Trigger | Table | Event | Function | Notes |
|---------|-------|-------|----------|-------|
| `on_auth_user_created` | `auth.users` | INSERT | `handle_new_user()` | Creates profiles row; uses plain text 'parent' not enum |
| `set_updated_at` | `profiles` | UPDATE | `update_updated_at()` | Auto-updates updated_at |
| `recalculate_timesheet_hours` | `timesheet_entries` | INSERT/UPDATE/DELETE | `recalculate_timesheet_total_hours()` | Keeps timesheets.total_hours in sync |

---

## RLS Helper Functions (SECURITY DEFINER)

| Function | Returns | Queries |
|----------|---------|---------|
| `is_admin()` | boolean | `profile_roles` WHERE role IN ('admin','super_admin') |
| `is_teacher()` | boolean | `profile_roles` WHERE role = 'teacher' |
| `is_front_desk()` | boolean | `profile_roles` WHERE role = 'front_desk' |
| `get_user_role()` | text | `profile_roles` primary role |
| `my_class_ids()` | uuid[] | `classes` WHERE teacher_id = auth.uid() |

**Always use these in RLS policies — never query profiles.role directly.**

---

## Migration History

| Migration | Description |
|-----------|-------------|
| 20260312000001 | Initial schema — teacher portal tables |
| 20260314000003 | Create roles and permissions |
| 20260315000001 | Fix RLS recursion and auth functions |
| 20260315000002 | Create teacher_hour_productions junction |
| 20260315000003 | Timesheet schedule instance link |
| 20260315000004 | Pay periods — add class_id column |
| 20260315000005 | Create timesheets and timesheet_entries |
| 20260316000001 | Timesheet total_hours trigger |
| 20260317000000 | Families, family contacts, student guardians |
| 20260319000000 | Student profiles, address columns, extended contacts |

---

*Last updated: March 2026*
*Update this file immediately after every migration or schema change.*
*Run `NOTIFY pgrst, 'reload schema';` after any schema change.*
