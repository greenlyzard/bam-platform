# PROGRAMS.md
# Ballet Academy and Movement — Performance Program Builder Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

The Program Builder module produces digital (and optionally printable)
performance programs for every production — annual performances, Nutcracker,
spring showcases, studio-hosted competitions, and guest-event itineraries.

Programs are generated from live platform data (casting, student bios,
production details) and supplemented with content entered natively in
the Program Builder itself (artwork, story synopsis, sponsor pages,
acknowledgments). The result is a publicly accessible digital program
reachable via a QR code or shareable URL — no app install required
for audience members.

A primary June 2026 milestone: deliver a digital program for the Sylvia
production by June 6, 2026, using live casting data from the platform —
even if the Ticketing module is not yet complete.

Cross-references:
- SCHEDULING_AND_LMS.md — productions, class_sessions, casting,
  session_attendance, competition structure
- REGISTRATION_AND_ONBOARDING.md — student profiles, family accounts
- COMMUNICATIONS.md — push notifications to families at show time
- BILLING.md — sponsor billing / in-kind tracking (future)
- STREAMING_AUTH.md — future: live stream embed within digital program
- TICKETING.md (future) — seat map, ticket scan, door check-in

---

## 2. Program Types

| Program Type | Description | Casting Source |
|---|---|---|
| Per-Show Program | One program per individual performance date/time | session_attendance for that show |
| Consolidated Program | All shows in a production combined; dual-cast view | All sessions in production |
| Competition Itinerary | Order of events for a studio-hosted competition | competition_entries table |
| Travel Itinerary | Schedule packet for families attending away competitions | Manual entry + competition data |

The architecture is shared across all four types. Content blocks are
toggled on/off per program type in Admin.

---

## 3. Program Structure — Content Blocks

Each program is composed of ordered content blocks. Admins can toggle
blocks on/off, reorder them, and configure each block's content.
All blocks are optional except Cover and Casting.

### 3.1 Block Types (in default order)

| Block | Required | Source |
|---|---|---|
| Cover | Yes | Artwork upload + production metadata |
| Welcome / Director's Note | No | Free-text, rich-text editor |
| About This Production | No | Free-text with story synopsis |
| Our Version of the Story | No | Free-text — studio interpretation/modifications |
| Cast & Characters | Yes | casting module + manual ranking |
| Featured Artist Bios | No | Student bio fields, Admin-selected |
| Sponsors | No | sponsors table, native to Program Builder |
| Acknowledgments | No | donors + volunteers tables |
| Thank You / Closing | No | Free-text |

Blocks are drag-and-drop reorderable in the Program Admin UI.

---

## 4. Cover Block

### 4.1 Cover Elements
- Production title (pulled from productions.full_name)
- Subtitle / tagline (optional, free text)
- Performance date(s) — single show or date range
- Venue name and address
- Studio name and logo
- Cover artwork (image upload: JPG/PNG/WebP, min 1200px wide)
- Background color or gradient fallback if no image uploaded

### 4.2 Program Sizes

Admins select a target format at program creation. Format affects
the rendered layout proportions for PDF export and print.

| Format | Dimensions | Use Case |
|---|---|---|
| Digital Only | 390px wide, scrollable | QR link / mobile |
| Half Letter | 5.5" × 8.5" | Standard folded program |
| Letter | 8.5" × 11" | Full-page insert |
| Playbill | 5.375" × 8.375" | Classic theater program |

Default: Digital Only. Print formats generate a PDF export.

---

## 5. About This Production Block

Two sub-sections, each independently togglable:

### 5.1 Story Synopsis
- Rich-text field for a narrative summary of the ballet or show
- Intended for audience members unfamiliar with the work
- Example: "Sylvia is a story of a nymph sworn to chastity who finds
  herself caught between duty and love..."

### 5.2 Our Version / Studio Notes
- Rich-text field for production-specific notes
- Documents modifications, abridgements, or reinterpretations
- Documents how the studio has adapted the work for its students
- Examples: "We have condensed the three acts into two...",
  "This production features our Level 3 and Level 4 students..."

---

## 6. Cast & Characters Block

This is the most complex block. It pulls live data from the casting
module and displays it in a ranked, formatted list.

### 6.1 Casting Data Source

Casting comes from `class_session_casting` (or equivalent casting table
in SCHEDULING_AND_LMS.md). Each cast entry links:
- student_id → student name
- role_name → character name (e.g. "Sylvia", "Villager", "Eros")
- show_id → which show (for per-show programs)

### 6.2 Role Ranking System

Roles are ranked manually by an Admin within the Program Builder.
Ranking determines display order in the program (lead roles first).

**Default sort:** Alphabetical by role_name ascending (unranked = bottom)

**Manual ranking:**
- Admin opens Role Ranking panel in Program Builder
- Roles are listed as draggable cards
- Admin drags roles up/down to set priority order
- Ranks are saved as integers (1 = top)
- Ties are broken by role_name alphabetically

**Within a role (multiple students):**
- Students sharing the same role are sorted alphabetically:
  last_name ASC, first_name ASC
- This is not overridable — alphabetical within role is always default
- Exception: Admin can manually promote one student within a role
  (e.g. "Principal" flag for a dual-cast lead)

### 6.3 Cast Display Formats

| Format | Layout | Best For |
|---|---|---|
| Role → Student(s) | Character name bold, student names below | Classical programs |
| Student → Role | Student name bold, role name below | Showcase/recital |
| Two-Column | Role on left, students on right | Dense casts |
| Full Spread | One role per section with photo | Featured artists |

Default: Role → Student(s)

### 6.4 Per-Show vs. Consolidated Casting

**Per-Show Program:**
- Casting filtered to students confirmed Present or Performing
  in `session_attendance` for that specific show
- Students marked Absent are automatically excluded
- Last-minute substitutions surface via attendance update
- Admin can manually override: force-include or force-exclude
  any student regardless of attendance status

**Consolidated Program (all shows):**
- Groups cast by show: "Friday Evening Cast", "Saturday Matinee Cast"
- Or displays alphabetically across all shows with show indicators
  next to each student name (e.g. "★ Fri  ◆ Sat")
- Admin configures which format at program level

### 6.5 Attendance Tie-In

The program reflects live attendance status at publish time.
Admins can lock a program (freeze casting) at a specific time
so last-minute attendance changes do not alter a published program.

| Status | Default Program Behavior |
|---|---|
| present | Included |
| absent | Excluded |
| tardy | Included (with optional note) |
| excused | Admin decides at lock time |
| no_record | Included (assume performing unless locked out) |

Lock status: `programs.casting_locked_at` — once set, attendance
changes do not update the displayed cast.

---

## 7. Featured Artist Bios Block

### 7.1 Bio Eligibility
- Any student can have a bio stored in their student profile
- Bio fields: headshot_url, bio_text (rich text, ~100 words max),
  hometown, years_at_studio, fun_fact (optional)
- Bios are written/edited by Admin (or parent-submitted + Admin approved)

### 7.2 Bio Selection for Program
- Admin selects which students appear in Featured Bios per program
- Selection is per-program, not global — the same student may appear
  in some programs but not others
- Suggested defaults: students in roles with rank 1–5 are auto-flagged
  for bio inclusion; Admin can add/remove

### 7.3 Headshot Requirements
- Recommended: square crop, min 400×400px
- Fallback: student initial avatar (lavender, matches brand)
- Headshot stored in media_assets with `asset_type = 'headshot'`
  and `student_id` reference

---

## 8. Sponsors Block

### 8.1 Sponsor Data Model

```sql
program_sponsors (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  production_id   uuid FK productions nullable,  -- null = global sponsor
  sponsor_name    text NOT NULL,
  sponsor_tier    text,          -- 'presenting', 'gold', 'silver', 'bronze', 'in_kind'
  logo_url        text,
  website_url     text,
  acknowledgment_text text,      -- "Proudly supported by..."
  display_order   integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)
```

### 8.2 Sponsor Display
- Sponsors grouped by tier in display order
- Presenting sponsor appears largest, at top or on its own page
- Logo displayed if uploaded; text-only fallback
- Tier labels are configurable (Admin can rename tiers)
- Same sponsor can appear across multiple productions

### 8.3 Sponsor Pages
- Sponsors can span multiple program pages if needed
- Admin can break sponsors into a "Thank You to Our Sponsors" section
  with a full-page layout option

---

## 9. Acknowledgments Block

### 9.1 Donor Acknowledgments

```sql
program_donors (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  production_id   uuid FK productions nullable,
  donor_name      text NOT NULL,          -- display name (may be anonymous)
  is_anonymous    boolean DEFAULT false,
  donation_level  text,                   -- 'patron', 'friend', 'supporter'
  display_order   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
)
```

- Anonymous donors display as "Anonymous Friend" or similar
- Donor levels configurable per tenant
- Donors sorted by level then alphabetically by last name

### 9.2 Volunteer Acknowledgments

```sql
program_volunteers (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  production_id   uuid FK productions nullable,
  volunteer_name  text NOT NULL,
  volunteer_role  text,   -- 'Stage Manager', 'Costume Crew', 'Front of House'
  display_order   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
)
```

- Volunteers listed by role group, alphabetically within group
- Role groups are free-text, sorted alphabetically
- Same person can appear in multiple role groups

---

## 10. Program Database Schema

```sql
programs (
  id                  uuid PK DEFAULT gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  production_id       uuid FK productions NOT NULL,
  program_type        text NOT NULL,
    -- 'per_show' | 'consolidated' | 'competition_itinerary' | 'travel_itinerary'
  show_session_id     uuid FK class_sessions nullable,
    -- required when program_type = 'per_show'
  title               text NOT NULL,
  subtitle            text,
  format_size         text DEFAULT 'digital',
    -- 'digital' | 'half_letter' | 'letter' | 'playbill'
  cover_image_url     text,
  cover_bg_color      text,
  status              text DEFAULT 'draft',
    -- 'draft' | 'published' | 'locked' | 'archived'
  public_slug         text UNIQUE NOT NULL,
    -- URL-safe slug for public access, e.g. 'sylvia-2026-friday'
  casting_locked_at   timestamptz,
  published_at        timestamptz,
  created_by          uuid FK profiles NOT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
)

program_blocks (
  id              uuid PK DEFAULT gen_random_uuid(),
  program_id      uuid FK programs NOT NULL,
  block_type      text NOT NULL,
    -- 'cover' | 'welcome' | 'about' | 'our_version' | 'cast' |
    --  'bios' | 'sponsors' | 'acknowledgments' | 'closing'
  display_order   integer NOT NULL,
  is_visible      boolean DEFAULT true,
  content_json    jsonb,   -- block-specific config and rich text content
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)

program_role_rankings (
  id              uuid PK DEFAULT gen_random_uuid(),
  program_id      uuid FK programs NOT NULL,
  role_name       text NOT NULL,
  rank            integer NOT NULL,
  UNIQUE(program_id, role_name)
)

program_cast_overrides (
  id              uuid PK DEFAULT gen_random_uuid(),
  program_id      uuid FK programs NOT NULL,
  student_id      uuid FK students NOT NULL,
  override_type   text NOT NULL,   -- 'force_include' | 'force_exclude'
  reason          text,
  created_by      uuid FK profiles NOT NULL,
  created_at      timestamptz DEFAULT now()
)

program_bio_selections (
  id              uuid PK DEFAULT gen_random_uuid(),
  program_id      uuid FK programs NOT NULL,
  student_id      uuid FK students NOT NULL,
  display_order   integer DEFAULT 0
)
```

---

## 11. Public Access

### 11.1 Public URL Structure
```
portal.balletacademyandmovement.com/program/[public_slug]
```

Examples:
- `/program/sylvia-2026-friday`
- `/program/sylvia-2026-saturday-matinee`
- `/program/sylvia-2026-all-shows`

### 11.2 Access Rules
- Published programs: fully public, no login required
- Draft programs: Admin-only preview via authenticated portal link
- Locked programs: public, casting frozen at lock time
- Archived programs: Admin-only, not publicly accessible

### 11.3 QR Code Generation
- Each published program auto-generates a QR code
- QR code downloadable as PNG/SVG from Admin
- QR code printable on lobby signage, tickets, and flyers
- QR links to the digital program public URL

### 11.4 Share Link
- One-click copy of the program public URL in Admin
- Programs support OpenGraph metadata for clean social sharing:
  og:title = production name
  og:description = "View the program for [title]"
  og:image = cover artwork

---

## 12. Notifications to Families

When a program is published, the platform can notify families
of students in the cast.

### 12.1 Notification Trigger
- Admin clicks "Publish + Notify Families" button
- System identifies all families with a student in the cast
  for this show (per casting data)
- Notification sent via Communications module channels:
  in-app, SMS, email (per family communication preferences)

### 12.2 Notification Content
```
"The digital program for [Production Title] — [Show Date/Time]
is now available. View it here: [public URL]"
```

- Families of students in the Friday cast get the Friday program link
- Families of students in all shows get consolidated program link
- Admin can also manually trigger notification at any time post-publish

### 12.3 Future: Live Stream Integration
When STREAMING_AUTH.md is active, the program page for a show
in progress will surface a "Watch Live" button that routes to
the authenticated stream for family members.

---

## 13. Admin Interface

### 13.1 Program List — /admin/programs
- Lists all programs for all productions
- Filtered by: production, status, type
- Columns: title, production, type, status, show date, last updated
- Actions: Edit, Preview, Publish, Lock, Duplicate, Archive

### 13.2 Program Builder — /admin/programs/[id]/edit
A full-screen editor with two panes:
- Left: Block list (toggle, reorder, configure each block)
- Right: Live preview rendering the program as the audience sees it

Block editing opens an inline panel — no separate page navigation.
Preview updates in real time as edits are made.

### 13.3 Role Ranking Panel
Accessed from the Cast block settings:
- Lists all unique roles in the production
- Drag-and-drop handles for manual reorder
- Current rank number displayed next to each role
- "Reset to Alphabetical" button
- Changes save immediately (auto-save)

### 13.4 Cast Override Panel
Accessed from the Cast block settings:
- Lists all students in the production cast
- Attendance status shown next to each name
- "Force Include" / "Force Exclude" toggles
- Reason field for audit log

### 13.5 Publish Flow
1. Admin clicks Publish
2. System checks: cover image present? casting data present?
3. If program has no casting_locked_at, prompt:
   "Lock casting now? Locking freezes the displayed cast.
   You can still update after locking by unlocking first."
4. Options: "Publish + Lock", "Publish (Live)", "Cancel"
5. On confirm → status = 'published', published_at = now()
6. If "Notify Families" checked → triggers notification batch

---

## 14. Competition Itinerary Mode

When `program_type = 'competition_itinerary'`, the Cast block
is replaced by an Order of Events block.

### 14.1 Order of Events Block
- Pulls from `competition_entries` table (see SCHEDULING_AND_LMS.md)
- Entries listed in competition performance order
- Each entry shows:
  - Entry number
  - Division / category
  - Title of piece
  - Choreographer (optional)
  - Performing students (from competition_entries.student_ids)
  - Estimated time (optional)
- Admins can manually reorder entries
- Entries can be grouped by division

### 14.2 Travel Itinerary Mode
When `program_type = 'travel_itinerary'`:
- No casting block
- Replaces Cast block with Schedule block (day-by-day timeline)
- Schedule entries are manually entered:
  - Date, time, event name, location, notes
- Intended for family packets when traveling to away competitions

---

## 15. Multi-Tenant Considerations

- All program data is scoped to tenant_id
- public_slug must be unique per tenant (not globally)
  → Public URL: `/program/[tenant_slug]/[program_slug]`
  → For BAM (single tenant on portal subdomain): `/program/[program_slug]`
- Program formatting (fonts, colors) inherits from tenant brand settings
- Sponsor and donor data are per-tenant
- Competition itinerary is available to all tenants that have the
  Competition module enabled (see SAAS.md feature flags)

---

## 16. Implementation Priority

Given the June 6, 2026 Sylvia deadline, the build order is:

### Phase 1 — MVP Digital Program (Priority: Immediate)
- [ ] programs table + program_blocks table
- [ ] program_role_rankings table
- [ ] program_bio_selections table
- [ ] program_cast_overrides table
- [ ] Public program page: `/program/[slug]`
- [ ] Admin program list: `/admin/programs`
- [ ] Program builder UI with Cover, About, Cast, Closing blocks
- [ ] Role ranking drag-and-drop panel
- [ ] Cast block pulling from production casting data
- [ ] Per-show attendance filtering (present/absent)
- [ ] Publish flow + public URL + QR code generation
- [ ] "Publish + Notify Families" button → Communications module

### Phase 2 — Full Program Suite (Post-June)
- [ ] Bios block + student bio fields in student profiles
- [ ] Sponsors block + program_sponsors table
- [ ] Acknowledgments block + program_donors + program_volunteers tables
- [ ] PDF export for print formats
- [ ] Consolidated multi-show program
- [ ] OpenGraph metadata for social sharing
- [ ] Competition itinerary mode
- [ ] Travel itinerary mode
- [ ] Live stream button integration (when STREAMING_AUTH is live)

---

## 17. Open Questions

- Should parents be able to submit bio content for their child
  (subject to Admin approval), or is bio entry Admin-only?
- Should sponsor logos be uploaded per-production or maintained in
  a global sponsor library across productions?
- Should programs support multiple languages (Spanish) for bios
  and about sections?
- For print PDF export: should the platform generate the PDF server-side
  (Puppeteer/headless Chrome) or use a client-side print stylesheet?
- Should archived programs remain publicly accessible indefinitely
  (historical archive) or be fully hidden?
- For competition itinerary: should timing estimates roll up to
  an estimated start time per entry (auto-schedule)?
- Should the travel itinerary be linked to a specific competition
  in the competition module, or be standalone?

---

*This file is part of the BAM Platform specification library.*
*All modules are documented before implementation begins.*
*See CLAUDE.md for the full module cross-reference index.*
