# BAM Platform — Module Specifications

## Module Overview

| # | Module | Route | Primary Users |
|---|--------|-------|---------------|
| 1 | Parent Portal | `/portal` | Parents |
| 2 | Teacher Portal | `/teach` | Teachers |
| 3 | Admin Dashboard | `/admin` | Admin, Super Admin |
| 4 | SEO Engine | `/admin/seo` | Admin |
| 5 | Lead Capture + Nurture | `/admin/leads` | Admin |
| 6 | Class Placement AI | `/enroll` | Parents, Admin |
| 7 | Studio Shop | `/shop` | Parents, Admin |
| 8 | Expansion Intelligence | `/admin/expansion` | Super Admin |
| 9 | BAM Learning Studio (LMS) | `/learn` | Students, Teachers, Parents |
| 10 | **Choreography & Production Manager** | `/admin/productions` | Admin, Super Admin |
| 11 | **Staff Resource Library** | `/admin/resources/library` | Admin, Teachers |
| 12 | **Lobby Display / Digital Signage** | `/display/schedule` | Public (kiosk) |

---

## Module 1: Parent Portal

**Purpose:** Single destination for every parent interaction with the studio.

### Features
- **Dashboard** — upcoming classes, announcements, invoices at a glance
- **My Dancers** — profile cards for each enrolled child
- **Schedule** — weekly class schedule with studio room, teacher, time
- **Enrollment Management** — view enrolled classes, request changes, join waitlist
- **Invoices & Payments** — payment history, autopay setup, outstanding balance
- **Communications** — inbox for teacher notes, studio announcements
- **Performance Hub** — Nutcracker/recital dates, role assignments, rehearsal schedules
- **Trial Class Booking** — self-serve trial class scheduling for new families
- **Photo Consent & Waivers** — digital signature, stored in Supabase
- **Health & Medical** — parent can update student health record (allergies, emergency contacts, insurance)

### UX Rules
- Mobile-first — most parents check on phone
- Zero friction: critical info (next class, balance due) visible without scrolling
- Notification badges for unread messages
- One-tap access to call/text studio

---

## Module 2: Teacher Portal

**Purpose:** Everything a teacher needs before, during, and after class.

### Features
- **My Classes** — daily/weekly schedule view
- **Class Roster** — student photos, age, level, allergen flags, attendance history
- **Attendance Tracker** — one-tap mark present/absent/late per student; optional session progress note
- **Student Notes** — private notes per student (not visible to parents unless shared)
- **Progress Updates** — record skill assessments, award badges
- **Content Upload** — upload short-form video content for LMS feed
- **Live Stream Controls** — start/stop live feed for class
- **Communication** — message individual parents or broadcast to class
- **Curriculum Guide** — level-by-level skill checklist and teaching notes
- **Staff Resource Library** — access studio syllabi, policy docs, teaching materials

### Live Stream Controls (GameChanger-style)
- Toggle ON/OFF per class session
- Password-protected access for parents of enrolled students only
- Stream status visible in real-time (live indicator)
- One-tap to start recording
- Post-class: recording auto-attached to class session

---

## Module 3: Admin Dashboard

**Purpose:** Full studio operations at a glance.

### Features
- **Enrollment Metrics** — total enrolled, by class, by age group, capacity %
- **Waitlist Manager** — view and convert waitlist to enrollment
- **Revenue Overview** — monthly/YTD revenue, outstanding balances
- **Class Management** — create/edit classes, assign teachers, set capacity
- **Student Directory** — searchable student database
- **Teacher Management** — teacher profiles, schedule, certifications
- **Lead Pipeline** — inquiry tracking, trial class conversions
- **Communication Center** — broadcast emails/SMS via Klaviyo
- **Mandated Reporter Log** — incident reporting workflow, compliance tracking
- **Studio Shop Control** — activate/deactivate shop, manage inventory
- **Angelina Intelligence Cards** — retention risk alerts, class performance digest, resource recommendations

### Key Metrics Cards (top of dashboard)
- Total active students
- Classes at capacity (%)
- Open waitlist spots
- Revenue this month vs last month
- Leads this week
- Trial class conversion rate
- **Students at retention risk (count with link)**
- **Health records incomplete (count with link)**

---

## Module 4: SEO Engine

**Purpose:** Generate and manage local SEO landing pages to dominate South OC search.

### Features
- **Landing Page Generator** — AI-generated city-specific pages
- **Keyword Map** — track target keywords per city/page
- **Page Status** — published/draft/needs-update
- **Schema Manager** — LocalBusiness, FAQPage, Course schema auto-generated
- **FAQ Content Bank** — centralized FAQ library that populates pages
- **Content Calendar** — schedule blog/article publishing

### Target Cities
San Clemente, Laguna Niguel, Laguna Hills, Dana Point, Ladera Ranch,
Mission Viejo, San Juan Capistrano, Rancho Santa Margarita, Rancho Mission Viejo

---

## Module 5: Lead Capture + Nurture

**Purpose:** Convert website visitors into enrolled students automatically.

### Funnel Steps
1. Visitor arrives (Google, Yelp, social, referral)
2. Engages with chatbot or trial class signup
3. Email captured → Klaviyo sequence triggered
4. Auto-sequence: 6-email lead nurture over 21 days
5. Trial class attended → Admin notified
6. Post-trial: enrollment flow triggered

---

## Module 6: Class Placement AI

**Purpose:** Instantly match any child to the right class without staff intervention.

### Logic
Age-based placement + experience qualifier → 1 primary + 1 alternative recommendation. Always recommends assessment for age 8+. See ENROLLMENT_QUIZ_SPEC.md.

---

## Module 7: Studio Shop

**Purpose:** White-label POS for studio retail, Nutcracker merchandise, recital flowers, apparel.

### Features
- Per-event shop configuration (custom name/logo/colors)
- Product catalog with inventory tracking
- Tablet-optimized POS for in-person lobby sales
- Stripe checkout for online orders
- Order history and reporting

---

## Module 8: Expansion Intelligence

**Purpose:** Data-driven decision making for opening Ballet Academy and Movement Location #2.

### Features
- Readiness score tracking across 4 indicators
- Target market demographics (Ladera Ranch, Rancho Mission Viejo, San Juan Capistrano)
- Competitor studio directory with threat level
- Studio capacity and waitlist live tracking

---

## Module 9: BAM Learning Studio (LMS)

**Purpose:** The differentiator. A dance-specific learning platform with three distinct interfaces.

### Student Interface
TikTok-style swipe feed, age-gated content, gamified badges, constellation progress visualization.

### Parent Interface
This Week's Focus, teacher notes, milestone push alerts, performance hub, content recommendations.

### Teacher Interface
Content management, feed curation, live streaming, badge awarding, skill assessment, class analytics.

---

## Module 10: Choreography & Production Manager ← NEW

**Priority:** HIGH — especially for Nutcracker and Spring Showcase seasons.

**Purpose:** Unified catalog linking choreography pieces → cast → rehearsals → media. Solves the Nutcracker production management pain point that currently lives in spreadsheets and email.

**Route:** `/admin/productions` (extends existing productions module)

### What This Adds Beyond Current `productions` Table

The existing schema has `productions`, `dances`, `production_dances`, `casting`, and `rehearsals`. What's missing is the **choreography catalog layer** — a way to manage dance pieces independently of any specific production, with media attached.

### New Capabilities

**Choreography Catalog (`/admin/choreography`)**
- Master library of all choreographed pieces the studio owns
- Per piece: title, discipline, choreographer, level, duration, music file URL, notes
- Version history — if a piece is revived in a new production, create a new version vs. re-using the same
- Media attachments: reference video (Cloudflare Stream), music file, PDF score, blocking notes
- Not tied to a specific production — reusable across years

**Enhanced Production Management**
- Pull pieces from the choreography catalog into a production
- Per production-dance: music cut (competitions need shorter versions), costume notes, stage blocking
- Role assignment per student per piece with alternate tracking
- Rehearsal scheduling tied directly to each piece
- Media attachment per piece per production (can differ from catalog entry)

**Teacher AI Assist (Angelina)**
- "Angelina, add this Google Drive link to Sylvia Act 2 music" → attaches to the piece
- "Angelina, note that company girls need black skirts for Sylvia" → costume note on piece
- "Angelina, what's the casting for Waltz of the Snowflakes?" → reads from casting table

### Database Additions

```sql
-- Choreography catalog (reusable pieces, independent of productions)
CREATE TABLE IF NOT EXISTS choreography_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  title               text NOT NULL,
  discipline          text NOT NULL,
  choreographer_id    uuid REFERENCES profiles(id),
  level_tags          text[] DEFAULT '{}',     -- e.g. ['Level 3B', 'Company']
  duration_seconds    integer,
  reference_video_url text,                    -- Cloudflare Stream URL
  music_title         text,
  music_artist        text,
  music_file_url      text,
  score_pdf_url       text,
  blocking_notes      text,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Media attachments on production-specific pieces
-- (extends existing production_dances with richer media)
ALTER TABLE production_dances
  ADD COLUMN IF NOT EXISTS reference_video_url text,
  ADD COLUMN IF NOT EXISTS score_pdf_url       text,
  ADD COLUMN IF NOT EXISTS blocking_notes      text,
  ADD COLUMN IF NOT EXISTS catalog_id          uuid REFERENCES choreography_catalog(id);
```

### UI Pages
- `/admin/choreography` — catalog list with search/filter by discipline, level, choreographer
- `/admin/choreography/[id]` — piece detail with media player, cast history, production history
- `/admin/productions/[id]/choreography` — link pieces from catalog to this production

---

## Module 11: Staff Resource Library ← NEW

**Priority:** MEDIUM — critical for teacher onboarding consistency as studio scales.

**Purpose:** Internal document library for teachers and staff. Stores syllabi, technique progression guides, teaching notes, dress code documents, teacher handbook, mandated reporter training materials, music playlists. Replaces ad-hoc Google Drive sharing.

**Route:** `/admin/resources/library` (admin management), `/teach/library` (teacher read access)

### Features
- **Folder organization** by course, program, or topic
- **Permission controls** per folder (some materials are admin-only, others are all-staff)
- **Document types** supported: PDF, Google Drive link, YouTube/Vimeo link, plain text notes
- **Version tracking** — when a document is updated, old version is retained
- **Multi-device access** — teachers access from phone, tablet, or desktop during class prep
- **Search** — full-text search across document titles and descriptions

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS staff_library_folders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  description     text,
  parent_folder_id uuid REFERENCES staff_library_folders(id),
  access_level    text NOT NULL DEFAULT 'all_staff'
    CHECK (access_level IN ('all_staff', 'admin_only', 'lead_teachers_only')),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_library_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  folder_id       uuid REFERENCES staff_library_folders(id),
  title           text NOT NULL,
  description     text,
  document_type   text NOT NULL CHECK (document_type IN ('pdf','google_drive','video_link','text_note','music_link')),
  file_url        text,              -- Supabase Storage path or external URL
  file_size_bytes integer,
  version         integer DEFAULT 1,
  is_active       boolean DEFAULT true,
  uploaded_by     uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### Access Rules
- Admin/Super Admin: full CRUD on all folders and documents
- Lead Teachers: read access to `all_staff` and `lead_teachers_only` folders
- All Teachers: read access to `all_staff` folders only
- Parents/Students: no access

### Seed Folders for BAM
On provisioning, create these default folders:
- Studio Policies
- Curriculum Guides (sub-folders per level)
- Teaching Resources
- Music Library
- Mandated Reporter Training
- Performance Materials

---

## Module 12: Lobby Display / Digital Signage ← NEW

**Priority:** LOW-MEDIUM — lightweight, professional touch for Phase 2.

**Purpose:** A read-only, auto-refreshing schedule display designed to run on a tablet or monitor mounted in the studio lobby. Shows today's and tomorrow's classes with room assignments and teacher names.

**Route:** `/display/schedule` — no authentication required, public but not linked from nav

### Features
- Auto-refreshes every 5 minutes
- Shows: current time, today's remaining classes, tomorrow's preview
- Each class block: class name, time range, room, teacher name, enrolled count (optional)
- Studio closures shown as full-day banners
- Brand colors (lavender) with elegant typography
- Kiosk mode: no browser chrome, no scroll bar, designed for `?kiosk=true` URL param
- Tenant-scoped: `/display/schedule?tenant=[slug]` for future multi-tenant use

### Implementation Notes
- Lightweight server component — no auth, minimal JS
- Data fetched from public `schedule_embeds` table (new embed type: `lobby_display`)
- OR direct from `schedule_instances` with tenant scoping via a public read policy
- CSS: full-screen, large font, high contrast for readability at 6–10 feet
- Brightness: designed for always-on display (dark background option for OLED screens)

### URL Examples
- `portal.balletacademyandmovement.com/display/schedule` — BAM lobby display
- `portal.balletacademyandmovement.com/display/schedule?kiosk=true` — kiosk mode (hides browser UI)
- `portal.balletacademyandmovement.com/display/schedule?room=studio-a` — single room view

---

## Technical Notes Across All Modules

- All routes protected by Supabase Auth + RLS (except `/display/schedule` which is public read-only)
- Role-based access control enforced server-side (middleware)
- Mobile-first responsive design (parent/student interfaces)
- Desktop-optimized for admin/teacher interfaces
- Real-time updates via Supabase Realtime for attendance, live status, notifications
- Email via Resend (transactional) + Klaviyo (marketing)
- All video content stored in Cloudflare Stream (not Supabase Storage)
- Images/documents in Supabase Storage
