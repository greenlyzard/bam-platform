# Casting & Performance Module Spec
## BAM Platform — 2026 and beyond

---

## Overview

This module manages casting, rehearsal scheduling, and performance/competition distribution
for BAM and future SaaS studios. It powers three portals (Teacher, Parent, Student),
embeddable widgets, PDF cast sheets, and digital performance brochures.

---

## Database Schema (Supabase)

### `productions`
```sql
id               uuid PRIMARY KEY
studio_id        uuid REFERENCES studios
name             text                    -- "2026 Spring Recital - Sylvia"
type             text                    -- 'recital' | 'competition' | 'showcase' | 'workshop'
season           text                    -- "2025-2026"
performance_date timestamptz
venue_name       text
venue_address    text
show_time        time
call_time        time
logo_url         text                    -- for PDF headers
brochure_url     text                    -- generated PDF brochure
ticket_url       text
livestream_url   text
password_hash    text                    -- for password-protected cast list widget
is_published     boolean DEFAULT false
created_at       timestamptz DEFAULT now()
```

### `roles`
```sql
id               uuid PRIMARY KEY
production_id    uuid REFERENCES productions
name             text                    -- "Sylvia", "Aphrodite", "Mermaids"
role_order       int                     -- display/program order
level            text                    -- "4C", "2B+", "3C / 4B" (can be multi-level)
notes            text
music_url        text
costume_url      text
is_understudy    boolean DEFAULT false
```

### `casting`
```sql
id               uuid PRIMARY KEY
role_id          uuid REFERENCES roles
student_id       uuid REFERENCES profiles  -- links to auth user
is_understudy    boolean DEFAULT false
notes            text
```

### `rehearsals`
```sql
id               uuid PRIMARY KEY
production_id    uuid REFERENCES productions
role_id          uuid REFERENCES roles     -- NULL = full-cast call
rehearsal_date   date
start_time       time
end_time         time
arrive_time      time
teacher_id       uuid REFERENCES profiles
location         text
is_class_time    boolean DEFAULT false     -- true = happens during regular class
class_id         uuid REFERENCES classes   -- if is_class_time, which class
notes            text
rehearsal_type   text  -- 'regular' | 'dress' | 'tech' | 'full_run' | 'competition_day' | 'performance_day'
```

### `performance_events`
```sql
id               uuid PRIMARY KEY
production_id    uuid REFERENCES productions
event_type       text  -- 'show' | 'competition' | 'tech_rehearsal' | 'dress_rehearsal' | 'photo_call'
event_name       text  -- "YAGP San Diego", "Dress Rehearsal", "Show Night"
event_date       date
start_time       time
end_time         time
location         text
notes            text
competitor_ids   uuid[]  -- for competitions, which students are competing
```

---

## Module: Casting Admin UI

### Route: `/admin/productions`
- List all productions with status, date, enrollment count
- Create new production (type, name, season, date, venue)
- Duplicate from previous season

### Route: `/admin/productions/[id]`
Tabs:
1. **Overview** — name, dates, venue, publish toggle, ticket/livestream URLs
2. **Roles** — add/edit/reorder roles, set level, link music & costume
3. **Casting** — assign students to roles; drag-to-reorder; mark understudies
   - Shows student name, level, classes enrolled in
   - Warns if student has class conflict on a rehearsal day
4. **Rehearsals** — calendar + list view
   - "During Class Time" toggle — links rehearsal to existing class record
   - Bulk-add recurring rehearsals (weekly until performance)
   - Import from Excel (accepts Schedule-Input sheet format from this workbook)
5. **Performance Events** — add show dates, competition entries, tech/dress calls
6. **Export** — PDF cast sheet, brochure, widget embed code

---

## Module: Rehearsal Schedule Logic

### Class-time rehearsal handling
When `is_class_time = true`:
- The rehearsal appears on the student's schedule as their normal class time
- It does NOT create a separate calendar block — it annotates the class
- Portal shows: "Tuesday Ballet 5:00 PM — *Rehearsal for Sylvia today*"
- Teacher portal highlights these days on the class roster

### Conflict detection
Before saving a rehearsal:
```
SELECT students enrolled in role
FOR EACH student:
  CHECK if they have another class or confirmed absence on rehearsal_date at that time
  FLAG if conflict found — admin can override with note
```

### Locations
Track: BAM Studios | San Juan Hills High School | Center Stage (RSM) | TBD | [custom]
Show map link when location is external.

---

## Portal Views

### Teacher Portal — `/teacher/schedule`
- Weekly calendar view showing:
  - All classes with enrolled students
  - Rehearsals (color-coded by production)
  - Class-time rehearsals annotated inline
- Per-class roster with role assignments shown
- "Rehearsal today" banner on class-time rehearsal days
- Ability to take attendance, mark present/absent for rehearsal

### Parent Portal — `/portal/schedule`
- Scoped to their child(ren) only
- Shows:
  - Regular class schedule
  - Upcoming rehearsals (date, time, arrive-by time, location)
  - Performance/competition dates (with countdown)
  - Music & costume links for their roles
- Badge on calendar days with rehearsals
- Push notification opt-in for schedule changes

### Student Portal — `/portal/student`
- Same as parent but self-view
- "My Roles" section: production name, role name, role order in show
- Rehearsal checklist (can confirm they've seen the schedule)

---

## WordPress Cast Widget

### Embed code (password-protected page)
```html
<script>
  window.BAM_CAST_CONFIG = {
    productionId: "PRODUCTION_UUID",
    apiBase: "https://your-bam-platform.vercel.app",
    password: "optional-client-side-gate",  // real auth is server-side
    showRoleOrder: true,
    showTeacher: true,
  };
</script>
<script src="https://your-bam-platform.vercel.app/widgets/cast.js" defer></script>
<div id="bam-cast-widget"></div>
```

Widget displays:
- Production name & date
- Roles in program order
- Cast members per role
- Upcoming rehearsal dates (next 3)
- Password gate (checked server-side via /api/cast/[id] with token)

WordPress password protection + server-side token = two layers.

---

## PDF Cast Sheet

### Tech stack: `@react-pdf/renderer` or `puppeteer` (server-side)

### Route: `GET /api/productions/[id]/pdf/cast`

### Layout:
```
┌─────────────────────────────────────────┐
│  [PRODUCTION LOGO]                      │
│  Production Name                        │
│  Date · Venue · Season                  │
├─────────────────────────────────────────┤
│  CAST                                   │
│  Role (in order)    Student Name(s)     │
│  ...                                    │
├─────────────────────────────────────────┤
│  REHEARSAL SCHEDULE                     │
│  Date | Day | Time | Location           │
│  ...                                    │
├─────────────────────────────────────────┤
│  [QR CODE → blog post or platform URL]  │
│  "Scan for full details, music links,   │
│   and live updates"                     │
└─────────────────────────────────────────┘
```

### QR Code
- Use `qrcode` npm package
- Links to: `https://balletacademyandmovement.com/sylvia-2026` (or platform URL)
- Platform URL shows the live cast + brochure

### Per-student cast slip (separate PDF mode)
One page per student:
- Their name, roles, rehearsal dates that apply to THEM only
- Costume & music links
- QR code to their personal portal
- Designed for printing and handing out at studio

---

## Digital Performance Brochure

### Format: PDF + web page (same data source)

### Distribution:
- Ticket holders: email with PDF attachment + web link
- Livestream viewers: web link only (gated by auth)
- Studio parents: push via portal notification

### Brochure sections:
1. Cover — production logo, name, date, venue, studio branding
2. Welcome message (editable rich text by admin)
3. Cast list — full role order with student headshots (optional)
4. Program order — act/scene breakdown
5. Sponsor section (optional — future monetization)
6. Advertiser section (future)
7. Back page — QR code to livestream, social handles, next season teaser

### Web brochure route: `/brochure/[production-slug]`
- Auth-gated (ticket holder token OR livestream access token)
- Progressive reveal: act-by-act as show progresses (future feature)
- Live updates: if cast changes day-of, brochure updates in real time

---

## Claude Code Implementation Prompts

### Prompt 1 — Database + types
```
Read docs/claude/STACK.md and docs/claude/CASTING_AND_REHEARSAL.md.
Create the Supabase migration for the casting module tables:
productions, roles, casting, rehearsals, performance_events.
Include RLS policies: studios can only read/write their own data.
Parents and students can read productions/roles/rehearsals scoped to their enrolled classes.
```

### Prompt 2 — Admin casting UI
```
Read docs/claude/CASTING_AND_REHEARSAL.md and docs/claude/UX_PATTERNS.md.
Build the admin production management pages at /admin/productions.
Include: production list, create/edit production, roles CRUD, casting assignment (student search + assign to role), 
rehearsal calendar with is_class_time toggle, performance events.
Use the existing shadcn/ui components and BAM design system.
```

### Prompt 3 — Portal schedule views
```
Build the Teacher, Parent, and Student portal schedule views.
Teacher: /teacher/schedule — weekly calendar with class+rehearsal overlay, class-time rehearsal annotations.
Parent: /portal/schedule — child's rehearsals + performance dates, arrive-by times, location with map link.
Student: /portal/student — same as parent but self-view, role list, rehearsal checklist.
Scope all queries by the authenticated user's role and enrolled classes.
```

### Prompt 4 — PDF generation
```
Install @react-pdf/renderer and qrcode packages.
Create GET /api/productions/[id]/pdf/cast — server-side PDF with:
  full cast list in role order, rehearsal schedule, QR code linking to production page.
Create GET /api/productions/[id]/pdf/student/[studentId] — per-student cast slip with 
  only their roles and their relevant rehearsal dates.
Use BAM brand colors (primary: #7B4FA8, accent: #E8A0C0) and Cormorant Garamond / Montserrat fonts.
```

### Prompt 5 — Cast widget
```
Create a standalone embeddable cast widget at /widgets/cast.js.
It reads window.BAM_CAST_CONFIG, fetches from /api/cast/[productionId] with a session token,
renders: role list in order, cast members, next 3 rehearsal dates.
Includes an optional password gate (checked server-side).
Designed to embed on a WordPress blog post or any HTML page via <script> + <div id="bam-cast-widget">.
```

### Prompt 6 — Digital brochure
```
Build the digital brochure page at /brochure/[slug].
Auth-gated by ticket holder token (stored in Supabase as production_access_tokens).
Sections: cover, welcome message, full cast in program order, rehearsal schedule.
Also build GET /api/productions/[id]/brochure/pdf — generates the full brochure as a PDF 
with production logo, QR code, and BAM branding.
```

---

## Excel Import Support

The studio currently uses BAM_Casting_Schedule_Model workbook with three key input sheets:
- `Casting-Input`: first_name, last_name, role_name
- `Roles-Input`: role_name, role_order, level, music_url, costume_url, season, performance_type
- `Schedule-Input`: role_name, rehearsal_date, start_time, end_time, arrive_time, teacher, location, class_day, class_start, class_end

### Import route: `POST /api/productions/[id]/import`
- Accepts .xlsx upload
- Reads these three sheets
- Maps to productions/roles/casting/rehearsals tables
- Returns import summary: X roles, X cast entries, X rehearsals imported
- Flags conflicts (student double-booked)
- Does NOT overwrite existing data — merges/updates

---

## Future: Competition Module

### Additional tables needed:
- `competition_entries`: student_id, event_id, division, entry_type (solo/duo/group)
- `competition_scores`: entry_id, judge, score, placement, feedback_url
- `competition_travel`: event_id, hotel, departure, return, chaperones

### Integration points:
- Competitions appear on the parent portal alongside recital rehearsals
- Per-competition PDF with schedule, dress requirements, arrival times
- Score tracking post-event

---

*Spec version: 2026-03-11 | Derek Shaw / BAM Platform*
