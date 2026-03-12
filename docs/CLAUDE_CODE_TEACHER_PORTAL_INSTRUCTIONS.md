# Claude Code — Teacher Portal Implementation Instructions

**Project:** BAM Platform (`/Users/derekshaw/bam-platform`)  
**Phase:** 2 — Internal Operations  
**Prerequisite:** Next.js scaffold exists; Supabase project connected; Drizzle ORM configured

> Paste this file into a Claude Code session. Work in order. Do not skip steps.

---

## ⚠️ FRIDAY DEADLINE — MVP SCOPE

**Goal by Friday:** A working timesheet tool with a monthly summary report in the Reporting Module.

### IN SCOPE FOR FRIDAY (MVP)
- [ ] Database schema — all teacher portal tables
- [ ] Timesheet auto-population from schedule
- [ ] Teacher timesheet UI: view, confirm entries, add manual entries, submit
- [ ] Monthly summary report (per teacher, per period: hours + pay by type)
- [ ] Finance Admin approval view (list + approve/reject)
- [ ] Basic private lesson entry (teacher logs; no billing charge flow yet)
- [ ] Performance/competition tags on timesheet entries (dropdown; no cost reports yet)

### DEFERRED TO NEXT SPRINT (NOT FRIDAY)
- Private billing split + charge processing
- Absence reporting and substitute workflow UI
- Production and competition cost reports
- Makeup policy UI
- Year-end summary report
- Announcement sign-off module
- Pattern flag notifications

---

## Step 0 — Read These Spec Files First

```
read /Users/derekshaw/bam-platform/docs/TEACHER_PORTAL.md
read /Users/derekshaw/bam-platform/docs/TEACHER_TIME_ATTENDANCE.md
read /Users/derekshaw/bam-platform/docs/TEACHER_SCHEDULE_INTEGRATION.md
read /Users/derekshaw/bam-platform/docs/TEACHER_RATE_MANAGEMENT.md
read /Users/derekshaw/bam-platform/docs/TEACHER_SUBSTITUTE_COVERAGE.md
read /Users/derekshaw/bam-platform/docs/TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md
read /Users/derekshaw/bam-platform/docs/PERFORMANCE_COMPETITION_COSTS.md
read /Users/derekshaw/bam-platform/docs/MAKEUP_POLICY.md
read /Users/derekshaw/bam-platform/docs/CLAUDE.md
read /Users/derekshaw/bam-platform/docs/SAAS.md
read /Users/derekshaw/bam-platform/docs/SCHEDULING_AND_LMS.md
read /Users/derekshaw/bam-platform/docs/REGISTRATION_AND_ONBOARDING.md
```

---

## Step 1 — Database Schema

Create: `src/db/schema/teacher-portal.ts`

Use Drizzle ORM with PostgreSQL dialect. Every table gets `tenant_id uuid NOT NULL` as second column after `id`. Use `pgTable`, `uuid`, `varchar`, `text`, `boolean`, `integer`, `decimal`, `timestamp`, `date`, `time` from `drizzle-orm/pg-core`.

### Tables

**`teacher_profiles`**
```typescript
{
  id: uuid primary key defaultRandom,
  tenant_id: uuid not null,
  user_id: uuid not null,            // FK → Supabase auth.users
  first_name: varchar(100),
  last_name: varchar(100),
  email: varchar(255) not null,
  phone: varchar(20),
  teacher_type: enum('lead','assistant','substitute','contractor_1099','admin_only'),
  employment_type: enum('w2','1099'),
  is_active: boolean default true,
  hire_date: date,
  bio: text,
  headshot_url: varchar(500),
  created_at: timestamp defaultNow,
  updated_at: timestamp defaultNow,
}
```

**`rate_definitions`**
```typescript
{
  id, tenant_id,
  rate_key: varchar(50),
  label: varchar(100),
  description: text,
  edit_requires_role: enum('finance_admin','finance_lead','super_admin'),
  is_active: boolean default true,
}
```

**`global_rates`**
```typescript
{
  id, tenant_id,
  rate_key: varchar(50),              // FK → rate_definitions.rate_key
  rate_amount: decimal(10,2),
  effective_date: date,
  set_by: uuid,
}
```

**`teacher_rates`**
```typescript
{
  id, tenant_id,
  teacher_id: uuid,                   // FK → teacher_profiles
  rate_key: varchar(50),
  rate_amount: decimal(10,2),
  effective_date: date,
  set_by: uuid,
  notes: text,
}
```

**`school_years`**  ← NEW (tenant-configurable)
```typescript
{
  id, tenant_id,
  label: varchar(20),                 // e.g. "2025-2026"
  start_date: date,
  end_date: date,
  is_current: boolean default false,  // Only one current per tenant
}
```

**`productions`**
```typescript
{
  id, tenant_id,
  name: varchar(200),
  production_type: enum('nutcracker','spring_recital','showcase','parent_observation','other'),
  school_year_id: uuid,               // FK → school_years
  rehearsal_start_date: date,
  is_active: boolean default true,
  notes: text,
  created_at: timestamp,
}
```

**`competition_events`**
```typescript
{
  id, tenant_id,
  name: varchar(200),
  competition_type: enum('yagp','regional','national','local_showcase','other'),
  school_year_id: uuid,
  location: varchar(300),
  is_active: boolean default true,
  notes: text,
  created_at: timestamp,
}
```

**`pay_periods`**
```typescript
{
  id, tenant_id,
  period_month: integer,              // 1–12
  period_year: integer,
  submission_deadline: date,          // default 26th
  status: enum('open','closed','exported'),
}
```

**`timesheets`**
```typescript
{
  id, tenant_id,
  teacher_id: uuid,
  pay_period_id: uuid,
  status: enum('draft','submitted','approved','rejected','exported'),
  submitted_at: timestamp,
  reviewed_by: uuid,
  reviewed_at: timestamp,
  rejection_notes: text,
  total_hours: decimal(6,2),
  total_pay: decimal(10,2),
}
```

**`timesheet_entries`**
```typescript
{
  id, tenant_id,
  timesheet_id: uuid,
  entry_type: enum(
    'class_lead','class_assistant','private','rehearsal',
    'performance_event','competition','training','admin','substitute','bonus'
  ),
  teacher_role: enum('lead','assistant','substitute'),
  session_id: uuid nullable,          // FK → class_sessions
  production_id: uuid nullable,       // FK → productions; required for rehearsal/performance_event
  competition_id: uuid nullable,      // FK → competition_events; required for competition
  date: date,
  start_time: time,
  end_time: time,
  total_hours: decimal(4,2),
  description: varchar(500),
  notes: text,
  rate_key: varchar(50),
  rate_amount: decimal(10,2),         // Snapshot at time of entry
  rate_override: boolean default false,
  rate_override_by: uuid nullable,
  is_auto_populated: boolean default false,
  attendance_status: enum('confirmed','absent','substitute_covered') nullable,
  is_substitute: boolean default false,
  substitute_for_teacher_id: uuid nullable,
  substitute_notes: text,
}
```

**`private_billing_records`**
```typescript
{
  id, tenant_id,
  timesheet_entry_id: uuid,
  teacher_confirmed: boolean nullable, // null = not yet answered; true/false = teacher's answer
  admin_confirmed: boolean nullable,   // Finance Admin override
  admin_entered_calendar: boolean default false,
  billing_split_confirmed: boolean default false,
  created_at: timestamp,
  updated_at: timestamp,
}
```

**`private_billing_splits`**
```typescript
{
  id, tenant_id,
  private_billing_record_id: uuid,
  student_id: uuid,
  billing_account_id: uuid nullable,
  billing_account_suggested: uuid nullable,
  billing_account_override: boolean default false,
  split_amount: decimal(8,2),
  billing_status: enum('unbilled','pending','charged','waived','disputed') default 'unbilled',
  date_card_charged: date nullable,
  charge_reference: varchar(200) nullable,
  waiver_reason: text nullable,
  dispute_notes: text nullable,
}
```

**`absence_records`**
```typescript
{
  id, tenant_id,
  session_id: uuid,
  teacher_id: uuid,
  reason_category: enum('illness','personal','emergency','professional_development','other'),
  notes: text,
  reported_at: timestamp,
  reported_by: uuid,
}
```

**`substitute_assignments`**
```typescript
{
  id, tenant_id,
  absence_record_id: uuid,
  session_id: uuid,
  substitute_teacher_id: uuid,
  assigned_at: timestamp,
  assigned_by: uuid,
  status: enum('pending','confirmed','declined','cancelled'),
  confirmed_at: timestamp nullable,
  response_deadline: timestamp,
  sub_rate_amount: decimal(10,2) nullable,
  sub_rate_override_by: uuid nullable,
  notes: text,
  decline_reason: text nullable,
}
```

**`makeup_credits`**
```typescript
{
  id, tenant_id,
  student_id: uuid,
  originating_session_id: uuid,
  trigger_type: enum('student_absence','class_cancelled_no_coverage','class_cancelled_studio_closure'),
  program_id: uuid,
  status: enum('pending','scheduled','redeemed','expired','waived'),
  expires_at: date nullable,
  makeup_session_id: uuid nullable,
  redeemed_at: timestamp nullable,
  waiver_reason: text nullable,
  notes: text,
  created_at: timestamp,
}
```

**`announcements`**
```typescript
{
  id, tenant_id,
  title: varchar(300),
  body: jsonb,
  type: enum('general','program_update','policy','urgent','event','payroll'),
  audience_scope: enum('all','program','role','individual'),
  audience_ids: uuid[] nullable,
  requires_signoff: boolean default false,
  signoff_deadline: timestamp nullable,
  published_at: timestamp nullable,
  expires_at: timestamp nullable,
  created_by: uuid,
  attachments: text[],
  status: enum('draft','scheduled','published','expired'),
}
```

**`announcement_acknowledgments`**
```typescript
{
  id, tenant_id,
  announcement_id: uuid,
  teacher_id: uuid,
  acknowledged_at: timestamp,
}
```

After writing schema, generate migration:
```bash
cd /Users/derekshaw/bam-platform
npx drizzle-kit generate
```
Do NOT run migration yet. Confirm schema is correct first, then:
```bash
npx drizzle-kit push
```

---

## Step 2 — Seed Rate Definitions

Create: `src/db/seeds/rate-definitions.ts`

Seed `rate_definitions` with these 10 entries (all `is_active: true`):

| rate_key | label | edit_requires_role |
|---|---|---|
| rate_regular_class | Regular Class — Lead | finance_admin |
| rate_discounted_class | Discounted Class — Lead | finance_admin |
| rate_assistant_class | Regular Class — Assistant | super_admin |
| rate_discounted_assistant_class | Discounted Class — Assistant | super_admin |
| rate_private | Private Lesson | finance_admin |
| rate_discounted_private | Discounted Private | finance_admin |
| rate_admin | Administrative | finance_admin |
| rate_bonus | Bonus | finance_admin |
| rate_performance | Performance / Rehearsal | finance_admin |
| rate_competition | Competition | finance_admin |

---

## Step 3 — Timesheet Auto-Population Job

Create: `src/lib/jobs/timesheet-auto-populate.ts`

```typescript
export async function autoPopulateTimesheets(tenantId: string, payPeriodId: string) {
  // 1. Get pay period month/year
  // 2. Get all active teachers for tenant
  // 3. For each teacher:
  //    a. Query class_sessions where:
  //       - (lead_teacher_id = teacher.id OR assistant_teacher_ids @> [teacher.id])
  //       - date BETWEEN period start and end
  //       - is_cancelled = false
  //       - tenant_id = tenantId
  //    b. For each session, determine teacher_role:
  //       - lead_teacher_id matches → 'lead' → rate_key = 'rate_regular_class' (or discounted)
  //       - assistant_teacher_ids contains → 'assistant' → rate_key = 'rate_assistant_class' (or discounted)
  //    c. Resolve rate_amount from teacher_rates (effective on session.date), 
  //       fallback to global_rates
  //    d. Create or get timesheet for teacher + pay_period
  //    e. Upsert timesheet_entry (skip if session_id already exists on this timesheet)
  //       is_auto_populated: true, attendance_status: null (pending teacher review)
  //    f. If session has production_id → set production_id on entry
  //    g. If session has competition_id → set competition_id on entry
}
```

Wire this function to run on the 1st of each month. For now, also expose a manual trigger endpoint for testing:
```
POST /api/admin/timesheets/auto-populate  { payPeriodId }
```

---

## Step 4 — API Routes (MVP Only)

Create under `src/app/api/`. Every route must:
1. Validate Supabase JWT
2. Extract `tenant_id` from the session
3. Scope all DB queries by `tenant_id`
4. Check role before executing

### Teacher Routes
```
GET    /api/teacher/timesheet           ?month=&year=
POST   /api/teacher/timesheet/entries   (manual entry: private, admin, rehearsal, competition)
PATCH  /api/teacher/timesheet/entries/[id]  (confirm attendance, update manual entry)
PATCH  /api/teacher/timesheet/[id]/submit
GET    /api/teacher/timesheet/summary   ?month=&year=  (hours + pay totals by type)
```

### Finance Admin Routes
```
GET    /api/admin/timesheets            ?month=&year=&status=
GET    /api/admin/timesheets/[id]       (full detail with all entries)
PATCH  /api/admin/timesheets/[id]/approve
PATCH  /api/admin/timesheets/[id]/reject  { notes }
PATCH  /api/admin/entries/[id]/rate     { rate_amount }  (override rate)
GET    /api/admin/timesheets/export     ?pay_period_id=  (CSV download)
POST   /api/admin/timesheets/auto-populate  (manual trigger for testing)
```

### Reporting Routes
```
GET    /api/admin/reports/monthly-summary  ?month=&year=
  Returns: per-teacher breakdown of hours and pay by entry type for the period
  Shape: { teachers: [{ teacher, hours_by_type, pay_by_type, total_hours, total_pay }] }
```

---

## Step 5 — Teacher Timesheet UI (MVP)

Use shadcn/ui components. BAM brand: lavender `#9C8BBF` as primary. Tailwind CSS.

### Page: `src/app/(teacher-portal)/timesheet/page.tsx`

**Layout:**
```
[Month/Year selector: ← March 2026 →]
[Status banner: Draft | Submitted | Approved | Rejected]
[Deadline: Submit by March 26, 2026 — X days remaining]

[MONTHLY SUMMARY CARD]
  Work Type          Hours    Rate    Total
  ─────────────────────────────────────────
  Classes (Lead)     3.5h     $XX     $XX
  Classes (Asst)     0h       $XX     $XX
  Privates           5.75h    $XX     $XX
  Rehearsals         0h       $XX     $XX
  Performances       0h       $XX     $XX
  Competitions       0h       $XX     $XX
  Training           0h       $XX     $XX
  Administration     0h       $XX     $XX
  Sub Coverage       2.0h     $XX     $XX
  ─────────────────────────────────────────
  TOTAL              11.25h            $XX

[+ Add Entry button → modal: type selector → relevant fields]

[ENTRY TABLE]
  Type | Date | Description | Start | End | Hours | Status | Rate | Total | Actions
  Each row: auto-populated entries show a badge "Auto"
  Attendance status: Confirmed (green) | Absent (red) | Sub Covered (amber) | Pending (grey)
  Production/competition tag shown as a small badge on rehearsal/performance/competition rows

[SUBMIT TIMESHEET button — disabled if: past deadline OR no entries confirmed]
```

**Interactions:**
- Click attendance status pill → dropdown: Confirmed / Absent / (Absent triggers sub alert — note only, no sub workflow in MVP)
- Click "+ Add Entry" → drawer with fields appropriate to entry type
- For private entries: "Did this happen?" Yes/No toggle visible
- For rehearsal entries: production dropdown (required before saving)
- For competition entries: competition dropdown (required before saving)
- Submit → confirmation modal → POST to submit endpoint → status banner updates

---

## Step 6 — Finance Admin Timesheet Review UI (MVP)

### Page: `src/app/(admin)/timesheets/page.tsx`

```
[Pay Period selector: ← March 2026 →]
[Summary: X submitted | Y approved | Z not started | W rejected]

[TABLE]
  Teacher | Hours | Pay | Status | Submitted | Actions
  ───────────────────────────────────────────────────
  Lauryn  | 11.25h | $XXX | Submitted | Mar 23 | [Review] [Approve] [Reject]
  Pi      | 8.0h   | $XXX | Approved  | Mar 20 | [View]
  ...

[BULK APPROVE button — only if all submitted timesheets have no flags]
[EXPORT CSV button — only if at least one approved timesheet]
```

### Page: `src/app/(admin)/timesheets/[id]/page.tsx`

```
[Teacher name + period]
[Status banner]

[SUMMARY CARD — same as teacher view]

[ENTRY TABLE — same columns + Rate Override column]
  Each row: inline rate override field (Finance Admin only; saves on blur)
  Rate override rows highlighted in amber

[APPROVE button] [REJECT button → modal with notes field]
```

---

## Step 7 — Monthly Summary Report (MVP)

### Page: `src/app/(admin)/reports/monthly-summary/page.tsx`

This is the Reporting Module page Amanda needs by Friday.

```
[Month/Year selector]
[DOWNLOAD CSV button]

[STUDIO SUMMARY]
  Total teachers with timesheets: X
  Total studio hours: XXh
  Total studio payroll cost: $X,XXX
  Status: X approved | Y submitted | Z pending

[PER-TEACHER TABLE]
  Teacher | Lead Hrs | Asst Hrs | Private Hrs | Rehearsal Hrs | Perf Hrs | Comp Hrs | Admin Hrs | Sub Hrs | Total Hrs | Total Pay | Status
  Sortable by any column
  Color-coded status badge
  Click row → link to that teacher's timesheet detail

[BREAKDOWN BY ENTRY TYPE — bar chart using recharts]
  Stacked bar per teacher, segments by entry type
  Visual way to see who is doing what
```

**CSV Export columns:**
`Teacher, Employment Type, Lead Hours, Assistant Hours, Private Hours, Rehearsal Hours, Performance Hours, Competition Hours, Training Hours, Admin Hours, Sub Coverage Hours, Total Hours, Lead Pay, Assistant Pay, Private Pay, Rehearsal Pay, Performance Pay, Competition Pay, Training Pay, Admin Pay, Sub Pay, Bonus Pay, Total Pay, Timesheet Status, Period`

---

## Step 8 — Validation Checklist Before Committing

- [ ] All tables have `tenant_id` — no query runs without it
- [ ] No hardcoded tenant IDs anywhere in the codebase
- [ ] Role checks on every API route (PATCH /admin/* rejects teacher JWT)
- [ ] Auto-population is idempotent — safe to run twice without duplicating entries
- [ ] Rate snapshot on `timesheet_entry.rate_amount` is captured at entry creation, not recalculated live
- [ ] Rate changes do not alter approved timesheet entries
- [ ] `billing_status` on `private_billing_splits` defaults to `unbilled` on creation
- [ ] Timesheet submit is blocked if any auto-populated entry has `attendance_status: null` (not yet reviewed)
- [ ] Absence marked → `attendance_status: absent` → hours set to 0 on that entry
- [ ] Finance Admin rate override is logged with `rate_override_by` user ID
- [ ] CSV export uses rate_amount snapshot from entry, not current rate
- [ ] All timestamps stored as UTC
- [ ] Monthly summary report query runs on DB (no aggregation in browser)
- [ ] School year table has constraint: only one `is_current: true` per tenant

---

## Step 9 — After Friday: Next Sprint Items

In priority order:

1. Private billing split UI + charge processing (Stripe integration)
2. Absence reporting UI + substitute assignment workflow
3. Production and competition cost reports
4. Pattern flag notifications → Super Admin + Studio Manager
5. Makeup credit tracking and admin scheduling
6. Year-end summary report
7. Announcement sign-off module
8. Self-serve substitute pool (Phase 2)
