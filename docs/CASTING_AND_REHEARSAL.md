# Casting & Rehearsal Tables — Schema Spec
## Covers: Recitals, Performances, Competitions, Approval Workflow, Angelina Integration

---

## Core Concept

A "production" can be a recital, showcase, or competition entry — or all three.
A single choreographed piece ("dance") can be performed at a spring recital AND entered 
in a competition, with the same cast but potentially different music and costume notes 
because competitions often require different lengths.

The `production_type` and `performance_type` fields handle all branching.

---

## Table: productions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | e.g. "Spring Showcase 2026", "Spotlight Dance Competition" |
| production_type | text | 'recital', 'showcase', 'competition', 'mixed' |
| season | text | e.g. "2025-2026" |
| venue_name | text | |
| venue_address | text | |
| venue_directions | text | Parking notes, entrance info |
| performance_date | date | |
| call_time | time | When dancers must arrive |
| start_time | time | Show start |
| end_time | time | Estimated end |
| competition_org | text | e.g. "Spotlight", "YAGP" — null if not competition |
| competition_division | text | e.g. "Junior", "Teen", "Senior" |
| notes | text | |
| approval_status | text | 'draft', 'pending_review', 'approved', 'published' |
| approved_by | uuid | FK → staff |
| approved_at | timestamptz | |
| is_published | boolean | Only true after approved |
| created_at | timestamptz | |

---

## Table: dances

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| title | text | e.g. "Swan Lake Pdd", "Hip Hop Crew" |
| discipline | text | ballet, jazz, contemporary, hip_hop, lyrical, tap, musical_theatre |
| choreographer_id | uuid | FK → teachers |
| level | text | e.g. "Level 3B", "Company" |
| duration_seconds | integer | |
| notes | text | |
| created_at | timestamptz | |

---

## Table: production_dances

Links a dance to a specific production. Competition vs recital differences live here.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| production_id | uuid | FK → productions |
| dance_id | uuid | FK → dances |
| performance_type | text | 'recital', 'competition', 'showcase' |
| performance_order | integer | Order in the show |
| music_title | text | May differ — competitions need shorter cuts |
| music_artist | text | |
| music_duration_seconds | integer | Competition-specific length |
| music_file_url | text | |
| costume_description | text | |
| costume_notes | text | Accessories, hair, makeup |
| costume_due_date | date | |
| stage_notes | text | Wings, blocking, spacing |
| notes | text | |

---

## Table: casting

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| production_dance_id | uuid | FK → production_dances |
| student_id | uuid | FK → students |
| role | text | 'principal', 'soloist', 'corps', 'ensemble' |
| costume_assigned | boolean | default false |
| costume_notes | text | Student-specific |
| is_alternate | boolean | default false |
| notes | text | |
| created_at | timestamptz | |

---

## Table: rehearsals

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| production_dance_id | uuid | FK → production_dances |
| rehearsal_date | date | |
| start_time | time | |
| end_time | time | |
| location | text | e.g. "Studio A", "Recital Hall" |
| location_address | text | If offsite |
| location_directions | text | Parking, entrance |
| rehearsal_type | text | 'rehearsal', 'dress_rehearsal', 'tech_rehearsal', 'spacing' |
| notes | text | |
| is_mandatory | boolean | default true |
| approval_status | text | 'draft', 'pending_review', 'approved' |
| approved_by | uuid | FK → staff |
| approved_at | timestamptz | |
| created_at | timestamptz | |

---

## Table: rehearsal_attendance

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| rehearsal_id | uuid | FK → rehearsals |
| student_id | uuid | FK → students |
| status | text | 'present', 'absent', 'excused', 'late' |
| notes | text | |

---

## Table: schedule_approvers

Controls who can approve schedules. Separate from general staff roles.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| staff_id | uuid | FK → staff |
| scope | text | 'all', 'production', 'rehearsal' |
| production_id | uuid | FK → productions — null means all |
| created_at | timestamptz | |

Amanda and Cara would each have a row here with scope='all'.

---

## Approval Workflow

### States
```
draft → pending_review → approved → published
```

- **draft**: Being built. Not visible to parents/students/front desk.
- **pending_review**: Submitted. Approvers notified.
- **approved**: Confirmed by Amanda/Cara/designated approver. Visible to all staff including front desk. Angelina can answer questions about it.
- **published**: Visible to parents and students in portal.

### Rules
- Only `approved` rehearsals are answerable by Angelina
- If a rehearsal is modified after approval, status resets to `pending_review` automatically (with confirmation modal warning the teacher)
- Approver cannot approve their own submissions
- Approval can be per-rehearsal or for the whole production at once

### Notification flow
1. Teacher sets status to `pending_review` → all `schedule_approvers` notified
2. Approver reviews → approves or requests changes with notes
3. On approval → parents/students notified: "Rehearsal schedule is now available"
4. On change request → submitter notified with notes

---

## Angelina — Rehearsal Query Integration

Angelina answers rehearsal questions ONLY for approved schedules.

### Access by role

| Role | What Angelina answers |
|------|-----------------------|
| Front Desk | Any student's rehearsals — today, this week, next 2 weeks |
| Admin | Same as front desk |
| Parent | Only their own children's rehearsals |
| Student | Only their own rehearsals |
| Teacher | Their own dances' rehearsal schedules |

### Sample front desk queries Angelina handles
- "When does Sofia have rehearsal this week?"
- "Does Marcus have anything tomorrow?"
- "What rehearsals are happening today?"
- "Who has rehearsal Saturday morning?"
- "Does Emma have any rehearsals in the next two weeks?"

### Angelina's answer includes
- Date, day of week, start/end time
- Location (and directions if offsite)
- Which dance/production it's for
- Whether it's mandatory
- Any teacher notes

### Angelina does NOT reveal
- Draft or unapproved rehearsals
- Other students' schedules to parents/students
- Costume costs or financial details
- Unpublished casting decisions

### Context injected into Angelina for front desk
```
ROLE: front_desk
TODAY: [current date]
TWO_WEEK_WINDOW: [today] to [today + 14 days]

You have access to the approved rehearsal schedule. Query by student name.
Confirm student name if ambiguous (e.g. two students named Emma).
Only return rehearsals with approval_status = 'approved'.

Format:
[Day, Date] — [Start]–[End] — [Dance Title] — [Location]
[Notes if any]

If no rehearsals found, say so clearly.
```

### Angelina tool: get_rehearsals
```typescript
// Input: { student_name?: string, student_id?: uuid, date_from: date, date_to: date }
// Query: rehearsals JOIN casting JOIN students JOIN production_dances JOIN dances JOIN productions
// Filter: approval_status = 'approved' only
// RLS: front_desk/admin sees all; parent sees own children; student sees own
```

---

## Key Scenarios

**Scenario 1: Spring Recital**
- production: type='recital', approval_status='approved'
- dance: "Waltz of the Snowflakes", 6 rehearsals all approved
- Front desk asks Angelina "Does Sofia have rehearsal Thursday?" → ✅ correct answer

**Scenario 2: Same dance enters competition**
- New production: type='competition', competition_org='Spotlight'
- Same dance, new production_dance: shorter music cut, adjusted costume notes
- Separate rehearsal block for competition prep
- Goes through full approval before Angelina can discuss it

**Scenario 3: Unapproved rehearsal added**
- Teacher adds rehearsal → status='draft'
- Front desk asks Angelina "Does Sofia have rehearsal Thursday?"
- Angelina: "No approved rehearsals Thursday" — does NOT reveal draft ✅
- Amanda approves → now Angelina answers correctly ✅

---

## RLS Rules

- `productions`: anon=none; student/parent=approved+published own; teacher=own; front_desk=approved; admin=all
- `rehearsals`: anon=none; student/parent=approved+published own; teacher=own; front_desk=all approved; admin=all
- `casting`: anon=none; student/parent=published own; teacher=own; admin=all
- `schedule_approvers`: admin only

---

## Claude Code Build Prompts

### Prompt 1 — Migration
```
Read docs/claude/CASTING_AND_REHEARSAL.md.

Create a Supabase migration with these tables:
productions, dances, production_dances, casting, rehearsals, 
rehearsal_attendance, schedule_approvers

Key requirements:
- approval_status on productions and rehearsals with check constraint: 
  ('draft', 'pending_review', 'approved', 'published')
- approved_by FK → staff on both productions and rehearsals
- RLS: front_desk and admin see all approved rehearsals; 
  parent/student see only their own approved rehearsals

Run npx supabase db push after creating the migration.
```

### Prompt 2 — Approval UI
```
Read docs/claude/CASTING_AND_REHEARSAL.md.

Build app/(admin)/schedule/approval/page.tsx:
- List all productions and rehearsals in 'pending_review' status
- Approve button: sets approval_status='approved', approved_by, approved_at
- Request changes: modal for notes, resets to 'draft', notifies submitter
- Filter by production and date range
- Only users in schedule_approvers table can access this page
- Show submission date and who submitted
```

### Prompt 3 — Angelina rehearsal tool
```
Read docs/claude/CASTING_AND_REHEARSAL.md and docs/claude/ANGELINA_AND_CLAUDE_API.md.

Add a get_rehearsals tool to app/api/chat/route.ts:
- Input: { student_name: string, date_from: string, date_to: string }
- Query rehearsals joined with casting → students, production_dances → dances → productions
- Filter: approval_status = 'approved' only — never return drafts
- Respect RLS by role: front_desk/admin see all; parent sees own children; student sees own
- Return formatted list: [Day, Date] — [Start]–[End] — [Dance Title] — [Location] + notes

Update Angelina system prompt to understand rehearsal queries and use this tool.
When role is front_desk, inject today's date and default window of today + 14 days.
```

### Prompt 4 — Teacher submission UI
```
Read docs/claude/CASTING_AND_REHEARSAL.md.

Build app/(portal)/teacher/rehearsals/page.tsx:
- Teachers create/edit rehearsals for their dances (default status: 'draft')
- "Submit for approval" button → sets status to 'pending_review'
- Status badge: draft=gray, pending=yellow, approved=green
- Approved rehearsals are read-only. "Request change" resets to draft with confirmation:
  "This will remove approval and notify the schedule coordinator. Continue?"
- Show approved_by name and approved_at date on approved rehearsals
```
