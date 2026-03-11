# MODULES.md — BAM Platform Module Specifications

> Complete module definitions for the BAM Platform. Each module is a distinct product surface
> with its own routes, components, and data requirements.

---

## Module Index

| # | Module | Primary Users | Status |
|---|--------|--------------|--------|
| M1 | Parent Portal | Parents, Guardians | To build |
| M2 | Teacher Portal | Instructors, Coaches | To build |
| M3 | Admin Dashboard | Amanda, Staff | In progress |
| M4 | SEO Engine | Public visitors | P0 |
| M5 | Lead Capture & Nurture | Prospective families | P0 |
| M6 | Class Placement AI | Parents, Admin | To build |
| M7 | Studio Shop | Parents, Public | To build |
| M8 | Expansion Intelligence | Amanda, Derek | To build |
| M9 | BAM Learning Studio (LMS) | Students, Parents, Teachers | To build |

---

## M1 — Parent Portal

**Route prefix:** `/portal`
**Auth required:** Parent role
**Purpose:** Single destination for parents to manage everything about their child's studio life.

### Views

#### Dashboard (`/portal/dashboard`)
- At-a-glance: upcoming classes this week, any payments due, recent badges earned
- Quick actions: mark absence, message teacher, view schedule
- Announcements banner (admin-pushed, filterable by class/program)

#### My Children (`/portal/children`)
- List of registered students with photo, age, level, sub-brand tags
- Per-child detail view:
  - Current enrollments with class schedule
  - Attendance history (present/absent/late calendar heatmap)
  - Badges earned (constellation visualization — see M9)
  - Skill assessments (if teacher has made visible)
  - Performance roles and rehearsal schedule
- Add child flow: name, DOB, experience level, medical notes, photo

#### Schedule (`/portal/schedule`)
- Weekly calendar view showing all children's classes, rehearsals, performances
- Color-coded by child and by class style
- Tap to expand: room, teacher name, what to wear/bring
- iCal export per child or combined family calendar

#### Billing (`/portal/billing`)
- Current balance and upcoming charges
- Payment history with receipts (PDF download)
- Stored payment method management (Stripe Customer Portal embed)
- Tuition plan details: monthly amount, next charge date
- Outstanding invoices with pay-now CTA

#### Performances (`/portal/performances`)
- Active performances with child's roles listed
- Rehearsal schedule filtered to child's acts
- Costume checklist per role
- Show dates with ticket purchase link (if applicable)
- Quick-change alerts (if child has back-to-back acts)

#### Live Viewing (`/portal/live`)
- List of available streams (classes, performances)
- Embedded Cloudflare Stream player
- Access gated by enrollment or ticket purchase
- Chat disabled by default (admin toggle)

#### Shop (`/portal/shop`)
- Links to active shop configs (Studio Shop, Sugar Plum Shop, etc.)
- Order history
- See M7 for full shop specs

#### Messages (`/portal/messages`)
- Thread-based messaging with teachers and admin
- Read receipts
- Attachment support (photos, PDFs)

### Parent Portal UX Rules

- Default view on login: Dashboard
- Mobile-first — most parents access on phone during pickup/dropoff
- All monetary values show dollars (not cents) with two decimal places
- Schedule times in 12-hour format with AM/PM
- Absence marking: must be at least 2 hours before class start
- No delete actions — only "drop" enrollment (with confirmation)

---

## M2 — Teacher Portal

**Route prefix:** `/teacher`
**Auth required:** Teacher role
**Purpose:** Everything an instructor needs during and between classes.

### Views

#### Dashboard (`/teacher/dashboard`)
- Today's classes with time, room, student count
- Quick attendance entry (tap to mark present/absent/late)
- Upcoming rehearsals and performances
- Unread messages from parents
- Compliance alerts (expiring docs, mandated reporter renewal)

#### My Classes (`/teacher/classes`)
- List of assigned classes this season
- Per-class view:
  - Roster with student photos, names, experience levels
  - Attendance grid (date × student matrix)
  - Pre-filled attendance: all enrolled students default to Present
  - Class notes (persistent per session)
  - Parent contact info (tap to message)

#### Attendance (`/teacher/attendance`)
- Select class → select date → mark attendance
- Pre-fill all enrolled students as Present
- Swipe right = present (green), swipe left = absent (red), tap = late (yellow)
- Bulk actions: mark all present, mark all absent
- Submit attendance with optional class notes
- Late-entry: can modify within 48 hours of class

#### Skill Assessments (`/teacher/assessments`)
- Select student → select category → rate 1-5
- Categories: technique, musicality, artistry, effort, teamwork, stage presence, flexibility, strength
- Toggle visibility to parent (default: not visible)
- Assessment history per student with trend line

#### Badge Awarding (`/teacher/badges`)
- Browse badge catalog filtered by category
- Select student → select badge → add optional note → award
- System checks for duplicate awards
- Triggers: patch order queue, parent notification

#### Hours & Pay (`/teacher/hours`)
- Log hours by pay category: class, private, comp rehearsal, performance rehearsal, coaching, admin, masterclass, sub, travel
- Calendar view of logged hours
- Monthly summary with totals per category
- Export for payroll (replaces Google Sheets timesheet)
- Submission deadline indicator (26th of month)

#### Messages (`/teacher/messages`)
- Threads with individual parents
- Class-wide broadcast (teacher → all parents in a class)
- Read receipts

### Teacher Portal UX Rules

- Attendance is the #1 action — make it accessible in ≤ 2 taps from any screen
- Student photos visible on all roster views (helps new subs)
- Compliance banner at top if any critical doc is missing or expiring within 30 days
- `can_be_scheduled = FALSE` until W9 + mandated reporter acknowledgment are complete
- Hours logging available offline (sync when connection restored)

---

## M3 — Admin Dashboard

**Route prefix:** `/admin`
**Auth required:** Admin role
**Purpose:** Complete studio operations control center for Amanda and staff.

### Views

#### Dashboard (`/admin/dashboard`)
- KPI cards: total students, new enrollments this month, attendance rate, revenue MTD
- Capacity overview: classes nearing/at capacity, waitlist counts
- Upcoming: next 7 days of classes, rehearsals, performances
- Alerts: unpaid balances > 30 days, teacher compliance gaps, classes below minimum enrollment
- Quick actions: send announcement, add student, create class

#### Season Management (`/admin/seasons`)
- CRUD for seasons with date ranges and policies
- Class catalog builder: duplicate from prior season, adjust
- Registration window control (open/close dates)
- Season comparison: enrollment numbers vs. prior season

#### Class Management (`/admin/classes`)
- All classes with filters: season, style, level, day, teacher, sub-brand
- Per-class detail: roster, attendance, capacity, waitlist
- Bulk operations: assign teacher, change room, adjust capacity
- Time conflict detection across classes

#### Student Management (`/admin/students`)
- Searchable student directory with filters
- Per-student: enrollment history, attendance, badges, assessments, billing, family info
- Sub-brand tagging (recreational / performance / competition)
- Merge duplicate students/families
- Student notes (admin-only, not visible to parents)

#### Family Management (`/admin/families`)
- Family directory with parent contact info, children, balance
- Payment history and outstanding invoices
- Communication history (emails, SMS sent)
- Family notes

#### Teacher Management (`/admin/teachers`)
- Teacher directory with status, pay rates, compliance docs
- Compliance dashboard: green/yellow/red per doc per teacher
- Schedule assignment: drag teacher into class slots
- Pay report: hours logged by category, monthly totals
- Payroll export (CSV compatible with QuickBooks)

#### Performance Management (`/admin/performances`)
- Create/edit performances, acts, roles
- Casting board: drag-and-drop students into roles
- Quick-change conflict detection with configurable buffer
- Rehearsal scheduler: link to acts, auto-generate attendee lists
- PDF export: per-student schedule, per-act call sheet, full production schedule

#### Communications (`/admin/communications`)
- Announcement builder with audience targeting:
  - All families
  - By season / class / sub-brand / performance / act
  - Custom list
- Channel selection: email (Resend), SMS (Twilio), in-app push
- Template library for common announcements
- Delivery log with open/click tracking
- Klaviyo audience sync

#### Billing & Finance (`/admin/billing`)
- Invoice management: create, send, mark paid
- Tuition plan setup per class/family
- Scholarship and discount code management
- Payment processing via Stripe
- Revenue reports: by season, class style, category, month
- Aging report: overdue balances by family
- Export for QuickBooks

#### Legal & Compliance (`/admin/compliance`)
- Document tracking dashboard per person per doc type
- Parent waivers: status per family (signed/unsigned/expired)
- Teacher docs: W9, mandated reporter, background check, agreements
- Block-from-schedule toggle for teachers missing critical docs
- Bulk reminder: email unsigned families/teachers
- Mandated reporter incident log (see SECURITY.md)

#### Reports (`/admin/reports`)
- Enrollment: by season, class, style, level, sub-brand, age group
- Attendance: rates by class, student, teacher, month
- Financial: revenue, collections, aging, profitability
- Growth: new families, retention rate, churn
- Export all reports as CSV or PDF

### Admin Dashboard UX Rules

- Amanda's primary workspace — speed and clarity are paramount
- All list views: paginated (25 per page), searchable, filterable, sortable
- Bulk actions on list views where applicable
- Destructive actions (delete, drop) require confirmation modal
- Financial values always in dollars, two decimal places
- All dates in local time (Pacific)

---

## M4 — SEO Engine

**Route prefix:** `/` (public pages)
**Auth required:** None
**Purpose:** Organic search acquisition — rank #1 for ballet training searches across South Orange County.

### Page Types

#### City Landing Pages (`/ballet-classes-[city]`)
- One page per target city
- Template: hero → class types (ballet first) → testimonials → CTA → FAQ → map
- Schema.org LocalBusiness + Course markup
- Dynamic class schedule pulled from active season

#### Style Pages (`/[style]-classes`)
- Ballet, jazz, contemporary, musical theatre, creative movement
- Template: style description → age groups → class options → CTA
- Internal links to city pages

#### Age Group Pages (`/ballet-classes-for-[age-group]`)
- Toddlers (3-4), kids (5-7), tweens (8-10), teens (11+)
- Voice matched to parent persona for that age (see BRAND.md)

#### Blog (`/blog/[slug]`)
- SEO-optimized articles targeting long-tail keywords
- Categories: ballet tips, parent guides, studio news, dance education
- Author attribution to Amanda or staff

### SEO Rules

- **Ballet featured first on every page** — other styles listed below
- Title tag format: `[Primary Keyword] | Ballet Academy and Movement`
- Meta description: max 155 characters, includes city name and CTA
- All images: descriptive alt text, WebP format, lazy loaded
- Page speed: target 90+ Lighthouse score
- City tier targeting order: Tier 1 (San Clemente, Laguna Niguel, Dana Point) → Tier 2 (Ladera Ranch, Mission Viejo, SJC, RMV) → Tier 3 (broad intent)
- Internal linking: every city page links to 2-3 related city pages
- Canonical URLs on all pages
- Sitemap.xml auto-generated

---

## M5 — Lead Capture & Nurture

**Route prefix:** Various (embedded components)
**Auth required:** None (pre-registration)
**Purpose:** Convert website visitors into trial class attendees, then into enrolled families.

### Components

#### Trial Class CTA
- Floating button on all public pages
- Modal: child's name, age, parent email, phone, preferred style
- Auto-creates lead in Klaviyo
- Triggers welcome email sequence

#### Chatbot Widget
- Bottom-right corner on all public pages
- FAQ-first: class times, pricing, location, parking
- Escalation: collect contact info → route to admin inbox
- After hours: "We'll get back to you tomorrow" with form

#### Exit Intent Popup
- Desktop only, triggers on mouse leaving viewport
- Offer: "Download our free guide: Your Child's First Ballet Class"
- Collects email → Klaviyo tag → nurture sequence

### Nurture Sequences (Klaviyo)

| Sequence | Trigger | Emails | Goal |
|----------|---------|--------|------|
| Welcome | Trial class signup | 5 over 14 days | Convert to enrollment |
| Post-Trial | Trial class attended | 3 over 7 days | Enroll in full season |
| Re-engagement | No activity 60 days | 3 over 21 days | Return for next season |
| Seasonal | Season registration opens | 4 over 10 days | Register for new season |

### Lead Tracking

- All leads stored in profiles with `onboarding_complete = FALSE`
- Lead source tracked: google, yelp, referral, social, website, walk_in
- Conversion funnel in admin reports: lead → trial → enrollment → retained

---

## M6 — Class Placement AI

**Route prefix:** `/enroll/placement` (parent) + `/admin/placement` (admin)
**Auth required:** Parent or Admin
**Purpose:** Help parents choose the right class based on their child's age, experience, and schedule.

### Parent Flow

1. **Input:** Child's age, experience level, styles interested in, available days/times
2. **AI Processing:**
   - Filter classes by age range eligibility
   - Filter by schedule availability
   - Rank by fit: experience level match, class capacity remaining, style preference
   - Flag audition-required classes separately
3. **Output:** Ranked list of recommended classes with:
   - Match score (percentage)
   - Why it's a good fit (1-sentence explanation)
   - Capacity status (open / almost full / waitlist)
   - Direct enroll button

### Admin View

- Override AI recommendations
- Manually place students in classes
- Bulk placement tool for season transitions
- "Students without placement" report

### AI Rules

- Never recommend a class the student is ineligible for by age
- Never recommend a full class without showing waitlist option
- Audition-required classes shown separately with clear labeling
- If no good matches: suggest adding to interest list for next season
- Maximum 5 recommendations to avoid decision paralysis

---

## M7 — Studio Shop

**Route prefix:** `/shop/[shop-slug]`
**Auth required:** Optional (guest checkout allowed for ticketed events)
**Purpose:** Sell merchandise, costumes, tickets, and concessions — with white-label support per event.

### White-Label Architecture

Each shop instance has its own:
- Name (e.g., "Sugar Plum Shop", "BAM Studio Essentials")
- Logo and banner image
- Theme color (defaults to lavender, can override)
- Product catalog
- Open/close dates (for event pop-ups)

### Shop Views

#### Catalog (`/shop/[slug]`)
- Product grid with filters: category, size, price range
- Product card: image, name, price, "Add to Cart"
- Category sections: jackets, patches, costumes, shoes, accessories, concessions
- Sub-brand filtering (recreational / performance / competition items)

#### Product Detail (`/shop/[slug]/product/[product-slug]`)
- Image gallery (swipe on mobile)
- Size and color selectors
- "For which student?" selector (if logged in, pulls children from profile)
- Inventory status: in stock / low stock / out of stock / pre-order
- Add to cart with quantity

#### Cart (`/shop/[slug]/cart`)
- Line items with edit quantity / remove
- Discount code input
- Subtotal, tax (CA sales tax), total
- Checkout button

#### Checkout (`/shop/[slug]/checkout`)
- Stripe Elements embedded payment form
- Shipping vs. pickup toggle
- If pickup: "Ready for pickup at the studio — we'll notify you"
- If shipping: address form
- Order confirmation with order number

#### Order Tracking (`/portal/orders`)
- Order history for logged-in parents
- Status: pending → paid → processing → ready for pickup / shipped → delivered
- Email notification at each status change

### Sugar Plum Shop (Nutcracker Special)

- Event shop that opens ~4 weeks before Nutcracker
- Custom branding: Nutcracker theme, Sugar Plum Fairy logo
- Products: ornaments, programs, flowers, concession pre-orders
- Closes after final performance
- Revenue attributed to Nutcracker event in financial reports

### Shop Business Rules

- All payments via Stripe — never store card data
- CA sales tax calculated automatically
- Discount codes: percentage or fixed amount, with optional expiry and usage limit
- Badge jacket orders auto-created when badge is awarded (admin confirms before charging)
- Inventory tracked per size/color variant
- Order number format: `BAM-YYYY-NNNNN`

---

## M8 — Expansion Intelligence

**Route prefix:** `/admin/expansion`
**Auth required:** Admin only
**Purpose:** Data-driven evaluation of potential new studio locations.

### Views

#### Market Map (`/admin/expansion/map`)
- Map visualization of South Orange County
- Pins for: BAM studio, competitor studios, prospective locations
- Color-coded by readiness score or threat level
- Click pin for detail card

#### Competitor Tracker (`/admin/expansion/competitors`)
- Table of tracked competitor studios
- Columns: name, city, segment, threat level, Google rating, review count, est. students
- Detail view: strengths, weaknesses, pricing, notes
- "Last reviewed" indicator — flag stale data (> 90 days)

#### Market Analysis (`/admin/expansion/markets`)
- Table of prospective cities/neighborhoods
- Columns: city, population, median income, families %, competitor count, drive time, rent/sqft, readiness score
- Readiness score formula:
  - Population density (20%)
  - Household income (20%)
  - Families with children (20%)
  - Competitor saturation (inverse, 20%)
  - Drive time from HQ (inverse, 10%)
  - Commercial rent affordability (10%)
- Detail view with pros, cons, and notes

#### Expansion Report (`/admin/expansion/report`)
- PDF-exportable summary
- Top 3 recommended markets
- Competitor landscape summary
- Financial projections template (rent, build-out, staffing, break-even)

### Expansion Intelligence Rules

- Admin-only — never visible to parents, teachers, or students
- Data is manually entered + periodically refreshed
- Google/Yelp ratings can be fetched on-demand (rate-limited, cached 30 days)
- Readiness scores recalculated on data change
- All financial projections clearly labeled as estimates

---

## M9 — BAM Learning Studio (LMS)

**Route prefix:** `/learn` (student/parent) + `/teacher/content` (teacher) + `/admin/content` (admin)
**Auth required:** Yes (role-based views)
**Purpose:** A mobile-first learning experience that makes ballet education addictive, trackable, and streamable.

### Student View — TikTok-Style Swipe Feed

#### Feed (`/learn`)
- Full-screen vertical video cards
- Swipe up to advance to next content
- Content types: technique videos, combos, exercises, quizzes
- Personalized: filtered by student's level, enrolled class styles, and age
- Interaction: like (heart), save to favorites, mark as practiced
- Progress bar on each card showing completion status

#### Content Player (`/learn/[content-slug]`)
- Full-screen Cloudflare Stream video player
- Auto-advances to next content in sequence
- Overlay: title, teacher name, difficulty badge, duration
- Below video: description, related content, comments (teacher-moderated)
- "I practiced this" button — logs to progress

#### My Progress (`/learn/progress`)
- **Constellation Visualization** — earned badges displayed as stars in a constellation
  - Each badge category = a constellation group
  - New badges animate in with a sparkle/connect effect
  - Tap a star to see badge details
  - Unearned badges shown as dim placeholder stars
- Progress stats: videos watched, practice sessions logged, badges earned
- Streak tracker: consecutive days with activity
- Level progress bar: beginner → intermediate → advanced → pre-professional

#### Favorites (`/learn/favorites`)
- Saved content for quick replay
- Organized by style and teacher

### Parent View of LMS

#### Child's Learning (`/portal/learning`)
- View per child: progress summary, badges earned, content completed
- Constellation visualization (same as student view, read-only)
- Practice log: when and what the child practiced
- Weekly summary email opt-in
- No ability to mark content as complete (that's the student's action)

### Teacher View of LMS

#### Content Management (`/teacher/content`)
- Upload video content with metadata: title, style, level, age range, tags
- Video upload → Cloudflare Stream (auto-transcoding)
- Set thumbnail (auto-generated or custom upload)
- Content ordering within style/level sequences
- View engagement analytics: views, completion rate, likes
- Moderate comments on content

#### Student Progress Review (`/teacher/content/progress`)
- Per-class view: which students have watched which content
- Engagement leaderboard (opt-in, teacher-controlled visibility)
- Flag students who haven't engaged in 14+ days

### Admin View of LMS

#### Content Library (`/admin/content`)
- Full CRUD for all LMS content
- Publish/unpublish toggle
- Featured content selection (pinned to top of feed)
- Analytics dashboard: most-watched, highest completion, most liked
- Content gap analysis: levels/styles without content

### Live Streaming

#### Live Sessions (`/learn/live/[session-id]`)
- Embedded Cloudflare Stream live player
- Session types:
  - **Parent Viewing:** Free for enrolled families, watch your child's class live
  - **Performance Ticket:** Paid stream, ticket purchased through shop
  - **Masterclass:** Special event, may be free or ticketed
  - **Competition Stream:** For comp families, view routines
- Viewer count (live)
- Chat (admin-toggleable, moderated)
- Recording auto-saved after stream ends → available as on-demand content

#### Going Live (Teacher/Admin)
- Start stream from teacher or admin portal
- Select session type and linked class/performance
- Auto-generates stream key for OBS/streaming software
- Or: one-tap mobile stream from phone (Cloudflare Stream RTMP)
- End stream → recording processed → optionally published to LMS library

### Badge & Achievement System — GameChanger-Style

#### Badge Categories and Tiers

| Category | How Earned | Examples |
|----------|-----------|---------|
| Technique Skills | Teacher-awarded | "Clean Pirouette", "Pointe Ready", "Grand Allegro" |
| Program Milestones | Auto — system events | "First Class", "First Performance", "1 Year at BAM" |
| Attendance & Dedication | Auto — attendance data | "10 Class Streak", "Perfect Month", "100 Classes" |
| Musicality & Expression | Teacher-subjective | "Beautiful Port de Bras", "Musical Phrasing" |
| Leadership | Teacher or admin | "Class Helper", "Mentor to New Students" |
| Competition Results | Auto — comp entry results | "Gold Medal", "Regional Champion", "Judges' Choice" |
| Special Programs | Auto — event enrollment | "Nutcracker Cast", "Summer Intensive", "Workshop Graduate" |

#### Tiers

| Tier | Visual | Criteria |
|------|--------|---------|
| Bronze | Copper star | First achievement in category |
| Silver | Silver star | 3+ achievements in category |
| Gold | Gold star with glow | 5+ achievements in category |
| Platinum | Diamond star with animation | Exceptional / rare achievements |

#### Constellation Visualization

- Full-screen dark background (deep navy `#1A1A2E`)
- Stars positioned in thematic constellation patterns:
  - Technique: ballet slipper shape
  - Milestones: ascending staircase
  - Attendance: calendar/clock shape
  - Musicality: musical note shape
  - Leadership: crown shape
  - Competition: trophy shape
  - Special: star cluster
- Earned badges: bright, full-color star with glow
- Unearned badges: dim outline star (shows what's possible)
- New badge earned: sparkle animation + connection line to constellation
- Tap any star: badge name, description, date earned, awarded by
- Pinch to zoom, pan to explore

#### Badge Earning Flow

1. Teacher taps "Award Badge" in teacher portal
2. Selects student, selects badge, adds optional note
3. System checks: not already earned, badge is active
4. Badge saved → parent notified (push + email)
5. Student sees new star appear in constellation with animation
6. If physical patch: added to patch order queue
7. Admin reviews patch queue → batch order to vendor → distribute → mark distributed

### LMS Business Rules

- Content must be age-appropriate: enforce age_min/age_max filtering
- Video content hosted exclusively on Cloudflare Stream (never self-hosted)
- Student progress is per-student, not per-family (siblings have separate progress)
- Badge earning is permanent — badges cannot be revoked (admin can hide from display if needed)
- Live stream access for parent viewing: automatic for enrolled families, no ticket needed
- Performance live streams: ticket required, purchased through shop (M7)
- Streak tracking resets at midnight Pacific time
- Content recommendations use collaborative filtering: "Students at your level also watched..."
- Teacher-uploaded content requires admin approval before publishing (optional toggle)

---

*Last updated: March 2026*
