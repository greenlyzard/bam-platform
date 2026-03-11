# BAM Platform — Competition, Season Types & Private Lessons Spec
**Status:** Ready for Claude Code implementation  
**Depends on:** `CASTING_AND_REHEARSAL.md`, `REGISTRATION_AND_ONBOARDING.md`

---

## 1. Season Types

Studio Pro's season model is too narrow — it conflates scheduling periods with program types. BAM needs a multi-dimensional season system.

### 1.1 Season Dimensions

Every class, rehearsal, and private session belongs to one **season record**. A season has two independent attributes:

| Attribute | Values |
|-----------|--------|
| `period`  | `fall`, `winter`, `spring`, `summer` — the calendar window |
| `program` | `regular`, `performance`, `competition`, `summer_intensive`, `camp`, `workshop` |

This means you can have:
- Spring 2026 · Regular (→ the main class schedule, publicly visible)
- Spring 2026 · Performance (→ recital rehearsals, visible to enrolled families only)
- Spring 2026 · Competition (→ **never public**, admin/teacher/enrolled family only)
- Summer 2026 · Intensive (→ separate public enrollment page)
- Summer 2026 · Camp (→ week-based, separate pricing)

### 1.2 Season Visibility Rules

| program | Public schedule widget | Parent portal | Admin | Teacher portal |
|---------|----------------------|---------------|-------|----------------|
| `regular` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| `performance` | ❌ Never | ✅ Enrolled only | ✅ Yes | ✅ Yes |
| `competition` | ❌ Never | ✅ Enrolled only | ✅ Yes | ✅ Yes |
| `summer_intensive` | ✅ Yes (own page) | ✅ Yes | ✅ Yes | ✅ Yes |
| `camp` | ✅ Yes (own page) | ✅ Yes | ✅ Yes | ✅ Yes |
| `workshop` | ✅ Yes (own page) | ✅ Yes | ✅ Yes | ✅ Yes |

The schedule widget embed always receives `program: "regular"` implicitly. Admin can override to show intensives/camps on dedicated public pages.

### 1.3 Database Schema

```sql
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,               -- e.g. "Spring 2026 Regular"
  period      text not null check (period in ('fall','winter','spring','summer')),
  program     text not null default 'regular' check (program in
              ('regular','performance','competition','summer_intensive','camp','workshop')),
  year        integer not null,
  start_date  date not null,
  end_date    date not null,
  is_active   boolean default false,       -- only one active per program type
  is_public   boolean generated always as (program in ('regular','summer_intensive','camp','workshop')) stored,
  created_at  timestamptz default now()
);

-- RLS: competition rows never exposed to anon or parent roles
alter table seasons enable row level security;
create policy "seasons_public" on seasons for select using (is_public = true);
create policy "seasons_family" on seasons for select to authenticated using (
  is_public = true or (
    program = 'performance' and exists (
      select 1 from enrollments e where e.student_id in (
        select id from students where family_id = auth.uid()
      ) and e.season_id = seasons.id
    )
  )
);
create policy "seasons_competition_family" on seasons for select to authenticated using (
  program = 'competition' and exists (
    select 1 from competition_entries ce
    join students s on s.id = ce.student_id
    where s.family_id = auth.uid() and ce.season_id = seasons.id
  )
);
create policy "seasons_admin" on seasons for all to service_role using (true);
create policy "seasons_teacher" on seasons for select using (
  auth.jwt() ->> 'role' = 'teacher'
);
```

---

## 2. Competition Program

### 2.1 Concepts

| Concept | Description |
|---------|-------------|
| **Competition Season** | A season record with `program = 'competition'`. Groups all competition activity for a period. |
| **Competition Event** | A specific competition (venue, date, organization). e.g. "StarQuest San Diego · March 22, 2026" |
| **Routine** | A dance piece: title, style, duration, music. May be Solo, Duo, Trio, Small Group, Large Group. |
| **Entry** | A student's participation in a specific Routine at a specific Competition Event. |
| **Group** | The set of students doing the same Routine. Auto-created when 2+ students share a Routine. |
| **Private Session** | Training sessions for competition preparation — billed separately (see Section 3). |

### 2.2 Enrollment Workflow (Admin Only)

Competition enrollment is **admin-initiated only** — parents cannot self-enroll.

1. Admin creates a Competition Season (if not exists)
2. Admin creates Competition Event(s) — venue, date, organization, entry deadline
3. Admin creates a Routine — assigns style, division, entry category (solo/duo/trio/small/large)
4. Admin assigns Students to the Routine → this creates the Group automatically
5. System checks: does this Group already exist for a similar Routine? (deduplication)
6. Admin assigns the Routine to one or more Competition Events
7. System sends notification to families of assigned students

**Groups are flexible early:** A solo can be created before music/choreography decisions are made. Students can be added or removed from a Group until the entry deadline. Admin notes field allows "pairing TBD" or "music pending."

### 2.3 Database Schema

```sql
-- Competition events (specific competitions)
create table competition_events (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id),
  name          text not null,             -- "StarQuest San Diego"
  organization  text,                      -- "StarQuest", "Showstoppers", etc.
  venue         text,
  city          text,
  event_date    date not null,
  entry_deadline date,
  notes         text,
  created_at    timestamptz default now()
);

-- Routines (the dance piece, independent of event)
create table routines (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id),
  title         text not null,             -- "Butterfly" or TBD
  style         text,                      -- Ballet, Jazz, Contemporary, Hip Hop, etc.
  category      text not null check (category in ('solo','duo','trio','small_group','large_group')),
  division      text,                      -- Age division per competition rules
  duration_secs integer,
  music_title   text,
  music_artist  text,
  music_status  text default 'pending' check (music_status in ('pending','selected','licensed','submitted')),
  choreo_status text default 'pending' check (choreo_status in ('pending','in_progress','set','polished')),
  notes         text,                      -- "pairing TBD", "music pending", etc.
  created_at    timestamptz default now()
);

-- Students in a Routine (the Group)
create table routine_students (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references routines(id) on delete cascade,
  student_id  uuid not null references students(id),
  role        text default 'performer',    -- 'performer', 'understudy'
  added_at    timestamptz default now(),
  unique (routine_id, student_id)
);

-- Routine → Competition Event assignments (many-to-many)
-- One routine can compete at multiple events
create table competition_entries (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id),
  competition_id  uuid not null references competition_events(id),
  season_id       uuid not null references seasons(id),
  entry_number    text,                    -- assigned by competition org
  performance_time timestamptz,           -- scheduled time at event
  result_placement integer,               -- 1st, 2nd, etc.
  result_score    numeric(5,2),
  result_award    text,                   -- "Platinum", "High Gold", etc.
  notes           text,
  unique (routine_id, competition_id)
);

-- Convenience view: student → competitions
create view student_competition_summary as
select
  rs.student_id,
  r.id as routine_id,
  r.title as routine_title,
  r.category,
  r.style,
  ce.id as competition_entry_id,
  ev.name as competition_name,
  ev.event_date,
  ev.city,
  r.music_status,
  r.choreo_status,
  ce.result_award,
  ce.result_placement
from routine_students rs
join routines r on r.id = rs.routine_id
left join competition_entries ce on ce.routine_id = r.id
left join competition_events ev on ev.id = ce.competition_id;
```

### 2.4 RLS for Competition Data

```sql
-- Competition events: never public
alter table competition_events enable row level security;
create policy "comp_events_admin" on competition_events for all to service_role using (true);
create policy "comp_events_teacher" on competition_events for select using (auth.jwt()->>'role'='teacher');
create policy "comp_events_family" on competition_events for select to authenticated using (
  exists (
    select 1 from competition_entries ce
    join routines r on r.id = ce.routine_id
    join routine_students rs on rs.routine_id = r.id
    join students s on s.id = rs.student_id
    where ce.competition_id = competition_events.id
    and s.family_id = auth.uid()
  )
);

-- Apply same pattern to routines, routine_students, competition_entries
```

### 2.5 Parent Portal — Competition View

Parents see their student's competition information only. No cross-family data is ever exposed.

Display:
- List of Routines their student is in (category, style, title or "TBD")
- For each Routine: music status, choreo status, group members (first name only if same family; otherwise "plus X other students")
- Upcoming competition dates + times (once scheduled)
- Results after event

**Do not show:** Other families' student names, scores, entry numbers, or placements.

---

## 3. Private Lessons

### 3.1 Concepts

Private lessons are fundamentally different from group classes:
- Priced per session, not per month
- Price varies by teacher and by number of students sharing the session
- Discounts are applied at the student level, not class level
- Often booked ad hoc or in recurring blocks
- Competition prep privates are linked to a Routine

### 3.2 Pricing Model

```
Base rate = teacher_rate[teacher_id]
Shared discount = student_count_discount[n_students]
Student discount = student.private_discount_pct (admin-set)

Session price per student =
  (base_rate × shared_discount_multiplier) × (1 - student_discount_pct/100)
```

**Example:**
- Teacher base rate: $95/hr
- 2 students sharing: $95 × 0.65 = $61.75 each
- Student A has 10% loyalty discount → $55.58
- Student B has no discount → $61.75

Admin sets:
- Teacher rate per hour (or per 30 min)
- Shared rate multipliers (1 student = 100%, 2 = 65%, 3 = 55%, 4+ = 50%)
- Per-student discount percentage (0–100%, any amount, any reason)

### 3.3 Database Schema

```sql
-- Teacher rate cards
create table teacher_rates (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references users(id),
  rate_per_30   numeric(8,2),
  rate_per_60   numeric(8,2),
  effective_from date not null,
  notes         text,
  unique (teacher_id, effective_from)
);

-- Shared session multipliers (studio-wide setting)
create table private_shared_rates (
  n_students    integer primary key check (n_students >= 1),
  multiplier    numeric(4,3) not null  -- e.g. 1.000, 0.650, 0.550, 0.500
);
-- Seed:
insert into private_shared_rates values (1, 1.000), (2, 0.650), (3, 0.550), (4, 0.500);

-- Per-student discounts (any class or private)
create table student_discounts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id),
  discount_type text not null check (discount_type in
                ('private_pct','class_pct','class_flat','private_flat','sibling','loyalty','scholarship','custom')),
  discount_pct  numeric(5,2),            -- percentage (0–100)
  discount_flat numeric(8,2),            -- flat dollar amount off per session/month
  applies_to    text default 'all' check (applies_to in ('all','privates','classes')),
  reason        text,                    -- "Sibling discount", "Scholarship", internal note
  show_on_invoice boolean default true,  -- whether to display to parent
  valid_from    date,
  valid_until   date,                    -- null = indefinite
  created_by    uuid references users(id),
  created_at    timestamptz default now()
);

-- Private sessions
create table private_sessions (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references users(id),
  season_id     uuid references seasons(id),
  routine_id    uuid references routines(id),  -- null if not comp prep
  session_type  text not null check (session_type in
                ('technique','comp_prep','choreography','coaching','other')),
  scheduled_at  timestamptz not null,
  duration_mins integer not null default 60,
  location      text,
  notes         text,
  status        text default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  created_at    timestamptz default now()
);

-- Students in a private session
create table private_session_students (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references private_sessions(id) on delete cascade,
  student_id      uuid not null references students(id),
  base_rate       numeric(8,2) not null,        -- teacher rate at time of booking
  shared_mult     numeric(4,3) not null,         -- multiplier for n students
  discount_pct    numeric(5,2) default 0,        -- from student_discounts
  discount_flat   numeric(8,2) default 0,
  discount_reason text,                          -- shown on invoice
  final_price     numeric(8,2) not null,         -- computed, stored for billing
  billing_status  text default 'unbilled' check (billing_status in ('unbilled','billed','paid','waived')),
  unique (session_id, student_id)
);
```

### 3.4 Price Computation (Server-Side)

```typescript
// lib/billing/private-pricing.ts

export async function computePrivatePrice(
  teacherId: string,
  studentIds: string[],
  durationMins: number
): Promise<PrivatePriceResult[]> {
  const n = studentIds.length;
  const teacher = await getTeacherRate(teacherId);
  const sharedMult = await getSharedMultiplier(n);
  const basePerStudent = (teacher.rate_per_60 * (durationMins / 60)) * sharedMult;

  return Promise.all(studentIds.map(async (sid) => {
    const discounts = await getActiveDiscounts(sid, 'privates');
    const pctOff = discounts.reduce((sum, d) => sum + (d.discount_pct || 0), 0);
    const flatOff = discounts.reduce((sum, d) => sum + (d.discount_flat || 0), 0);
    const afterPct = basePerStudent * (1 - pctOff / 100);
    const final = Math.max(0, afterPct - flatOff);
    return {
      studentId: sid,
      baseRate: teacher.rate_per_60,
      sharedMultiplier: sharedMult,
      basePerStudent,
      discountPct: pctOff,
      discountFlat: flatOff,
      discountReasons: discounts.map(d => d.reason).filter(Boolean),
      finalPrice: Math.round(final * 100) / 100,
    };
  }));
}
```

---

## 4. Discount Display — "Savings" Feature

Discounts must be **prominently surfaced** to parents. The goal: parents see exactly how much BAM is saving them, in aggregate, so it feels like a benefit rather than a hidden pricing rule.

### 4.1 Where to Show Discounts

| Location | What to show |
|----------|-------------|
| Monthly invoice / statement | Itemized line per discount, subtotal saved |
| Parent portal dashboard | "This month you saved $X" banner |
| Class cart (widget) | Per-item strikethrough + discounted price |
| Private session booking confirmation | Full price breakdown with savings |
| Enrollment summary | "Total discount applied: $X/mo" |
| Annual summary (end of year) | "In 2025–2026 BAM saved your family $X" |

### 4.2 Invoice Line Item Format

```
Mini Star Ballet — Level 1 (Mon 3:30 PM)     $125.00
  ✓ Sibling discount (15%)                   -$18.75
  ✓ Loyalty discount (5%)                     -$6.25
  Subtotal                                   $100.00

Private — Comp Prep w/ Ms. Sarah (60 min)     $95.00
  ✓ Shared session (2 students, 35% off)     -$33.25
  ✓ Scholarship discount (10%)               -$6.18
  Subtotal                                    $55.58

─────────────────────────────────────────────────────
  Gross charges                              $220.00
  Total discounts                            -$64.43
  ──────────────────────────────────────────────────
  Amount due                                 $155.57
  You saved this month                        $64.43  ← PROMINENTLY SHOWN
```

### 4.3 Annual Savings Rollup

```sql
-- Query: family savings for a year
select
  sum(pss.base_rate * pss.shared_mult - pss.final_price) as private_savings,
  sum(e.list_price - e.billed_amount) as class_savings,
  sum(pss.base_rate * pss.shared_mult - pss.final_price) +
  sum(e.list_price - e.billed_amount) as total_savings
from students s
left join private_session_students pss on pss.student_id = s.id
left join private_sessions ps on ps.id = pss.session_id
  and ps.scheduled_at >= '2025-09-01' and ps.scheduled_at < '2026-09-01'
left join enrollments e on e.student_id = s.id
  and e.season_id in (select id from seasons where year = 2026)
where s.family_id = $family_id;
```

### 4.4 Admin Discount UI

Admin manages discounts at `admin/students/[id]/discounts`:
- Add discount: type, amount (% or flat), applies to, reason, validity dates
- Active discounts shown with green badge
- Expired discounts shown greyed out (historical)
- "Preview invoice" button shows what next bill looks like with all discounts applied
- Bulk discount: apply same discount to multiple students (e.g. all siblings)

---

## 5. Admin Screens Summary

### Screens to Build (Claude Code Prompts)

**Prompt 1 — Season Management**
```
Create an admin page at /admin/seasons with:
- List of all seasons (grouped by year, then program type)
- Create/edit season form: name, period, program, start/end dates, is_active
- Active season switcher per program type (only one active at a time)
- Season program badge colors: regular=purple, performance=teal, competition=red (NEVER public), 
  summer_intensive=gold, camp=green, workshop=blue
- Warning banner on competition seasons: "⚠ Competition data is never shown publicly"
Reference: COMPETITION_SEASONS_PRIVATES.md, STACK.md, BRAND.md
```

**Prompt 2 — Competition Roster Management**
```
Create admin pages at /admin/competition with:
1. /admin/competition — list of competition events for active competition season
2. /admin/competition/events/new — create event (name, org, venue, city, date, entry deadline)
3. /admin/competition/routines — list all routines; create routine (title, style, category, status fields)
4. /admin/competition/routines/[id] — edit routine; assign students (searchable dropdown); 
   assign to events (multi-select); show group members with first name + last initial
5. Status badges for music_status and choreo_status with color coding
6. Notes field prominently placed for "pairing TBD", "music pending" states
7. All pages have competition-season-only visibility warning in header
Reference: COMPETITION_SEASONS_PRIVATES.md, STACK.md, BRAND.md
```

**Prompt 3 — Private Session Scheduling & Billing**
```
Create admin pages at /admin/privates with:
1. /admin/privates — calendar + list view of private sessions; filter by teacher/student/status
2. /admin/privates/new — create session: teacher, students (multi-select, 1-4), 
   session_type, date/time, duration, linked routine (optional)
3. Real-time price calculator: as teacher and students are selected, show per-student pricing
   with full breakdown (base rate → shared multiplier → discounts → final)
4. /admin/privates/[id] — session detail; mark complete/cancel; billing status per student
5. Teacher rate card management at /admin/teachers/[id]/rates
6. Shared rate multiplier table at /admin/settings/private-rates (editable n-students → multiplier)
Reference: COMPETITION_SEASONS_PRIVATES.md, STACK.md, BRAND.md
```

**Prompt 4 — Student Discount Management**
```
Create discount management at /admin/students/[id]/discounts:
1. Active discounts list with type, amount, applies_to, reason, valid dates
2. Add discount form: type dropdown, pct or flat amount, applies_to, reason, dates
3. "Preview next invoice" button showing full itemized bill with all discounts
4. Bulk discount tool at /admin/discounts/bulk: select multiple students, apply same discount
5. Discount summary dashboard at /admin/discounts showing total discounts given this month/year
6. "Savings badge" logic: if total savings > $50/mo show "⭐ High-value family" tag in admin
Reference: COMPETITION_SEASONS_PRIVATES.md, REGISTRATION_AND_ONBOARDING.md, BRAND.md
```

**Prompt 5 — Parent Portal: Competition + Savings View**
```
Add to the parent portal at /portal/dashboard:
1. Competition card (only shown if student has competition entries):
   - List routines with category badge (Solo/Duo/Trio/Group)
   - Music status + choreo status progress indicators  
   - Upcoming competition dates
   - Group member count ("with 3 other dancers") — no other students' full names
   - Results when available (award, placement)
2. Savings banner: "This month BAM saved your family $XX" — purple card, prominent
3. Savings history tab showing monthly savings over the season with total YTD
4. Competition data behind auth guard — never shown to unauthenticated users
Reference: COMPETITION_SEASONS_PRIVATES.md, STACK.md, BRAND.md, UX_PATTERNS.md
```

**Prompt 6 — Invoice/Statement with Discount Itemization**
```
Create invoice generation at /admin/billing/invoices:
1. Monthly invoice template showing:
   - Per-class line items with gross price, each discount as separate line, subtotal
   - Per-private line items with base rate, shared multiplier calculation, each discount, subtotal
   - Footer: Gross charges, Total discounts (green), Amount due
   - Large "You saved $X this month" callout box (brand gold color)
2. PDF export using @react-pdf/renderer (see CASTING_AND_REHEARSAL.md for PDF pattern)
3. Email delivery: send via Resend API, template in lib/email/layout.ts
4. Annual savings summary: "In 2025-2026 BAM saved your family $X total"
Reference: COMPETITION_SEASONS_PRIVATES.md, SUPABASE_EMAIL_TEMPLATES.md, BRAND.md
```

---

## 6. Embed Widget — Season Filtering

The public schedule widget (`bam-schedule-v10.html`) uses `classFilter` config to restrict what shows. The season/program type is enforced server-side before data reaches the widget — competition classes are never included in any API response that feeds the public widget.

**Admin Embed Generator** (`bam-embed-generator.html`) generates pre-filtered embed codes for use on different pages:

| Page | Preset | Season programs shown |
|------|--------|-----------------------|
| Main classes page | Full Schedule | regular only |
| New students page | Entry Level Only | regular only |
| Summer page | Summer Intensive | summer_intensive only |
| Camp page | Camp Week | camp only |
| Parent portal | Full + userMode:returning | regular + performance |
| Competition portal | (not embeddable) | competition — auth-gated React page |

---

## 7. Key Rules Summary

1. **Competition data is never public.** No embed, no API endpoint, no widget config will ever expose it. Enforced at RLS level in Supabase.
2. **Groups are auto-created** from routine_students — no separate group management needed.
3. **One routine can enter multiple competitions** via competition_entries junction table.
4. **Privates are billed per-session**, not monthly. They appear on the monthly statement but as individual line items.
5. **Discounts stack** — a student can have a sibling discount + loyalty discount simultaneously. Both apply.
6. **Discount display is non-negotiable** — every parent-facing billing view must show the full savings breakdown prominently.
7. **Admin enrolls competition students** — parents cannot self-enroll in competition programs.
8. **Music/choreo status on routines** — admin can flag "TBD" states so teachers and parents understand where things stand.
