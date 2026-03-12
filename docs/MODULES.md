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
- **Class Roster** — student photos, age, level, medical notes, attendance history
- **Attendance Tracker** — one-tap mark present/absent/late per student
- **Student Notes** — private notes per student (not visible to parents unless shared)
- **Progress Updates** — record skill assessments, award badges
- **Content Upload** — upload short-form video content for LMS feed
- **Live Stream Controls** — start/stop live feed for class (see Module 9)
- **Communication** — message individual parents or broadcast to class
- **Curriculum Guide** — level-by-level skill checklist and teaching notes

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
- **Lead Pipeline** — inquiry tracking, trial class conversions (see Module 5)
- **Communication Center** — broadcast emails/SMS via Klaviyo
- **Mandated Reporter Log** — incident reporting workflow, compliance tracking
- **Studio Shop Control** — activate/deactivate shop, manage inventory

### Key Metrics Cards (top of dashboard)
- Total active students
- Classes at capacity (%)
- Open waitlist spots
- Revenue this month vs last month
- Leads this week
- Trial class conversion rate

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

### Page Structure (every landing page)
1. Hero — city-specific headline
2. Why Ballet Academy and Movement
3. Programs (Ballet first, then Jazz, Contemporary, Musical Theatre)
4. About Amanda Cobb
5. Testimonials
6. FAQ (schema-marked)
7. Trial Class CTA

---

## Module 5: Lead Capture + Nurture

**Purpose:** Convert website visitors into enrolled students automatically.

### Funnel Steps
1. Visitor arrives (Google, Yelp, social, referral)
2. Engages with chatbot or trial class signup
3. Email captured → Klaviyo sequence triggered
4. Auto-sequence:
   - Email 1 (immediate): Welcome + about BAM + trial class info
   - Email 2 (Day 2): Class recommendation based on child's age
   - Email 3 (Day 4): Amanda's story + studio differentiators
   - Email 4 (Day 7): Trial class reminder + easy booking link
   - Email 5 (Day 14): Parent testimonial + urgency (limited spots)
5. Trial class attended → Admin notified
6. Post-trial: enrollment flow triggered

### CRM Integration
- Leads sync to Klaviyo via API
- Lead source tracked (Google, Yelp, referral, social, organic)
- Trial class bookings sync to Studio Pro (GoStudioPro)
- Conversion tracked: Lead → Trial → Enrolled

### Chatbot Behavior
- Friendly, warm, refined tone
- Asks: child's age, interest (ballet/jazz/all), location
- Returns: class recommendation + trial class booking link
- Escalates to human for complex questions
- Never says "I'm an AI" unless directly asked

---

## Module 6: Class Placement AI

**Purpose:** Instantly match any child to the right class without staff intervention.

### Logic
```
Input: child age (required) + dance experience (optional) + goals (optional)

Age 2-3    → Mommy & Me Ballet (if offered) or Pre-Ballet
Age 3-4    → Pre-Ballet
Age 4-5    → Pre-Ballet or Primary Ballet
Age 5-6    → Primary Ballet
Age 6-8    → Ballet Level 1 (or assessment recommended)
Age 8-10   → Ballet Level 1-2 (assessment recommended)
Age 10-12  → Assessment required for Level 2+
```

### Output
- Recommended class name + description
- Teacher name + photo
- Schedule (day/time)
- Spots available / waitlist status
- "Book a Trial Class" CTA
- Option to speak with Amanda for assessment

### Rules
- Always recommend assessment for age 8+
- If class is full → show waitlist option
- Show 1 primary recommendation + 1 alternative
- Never recommend a class that is full as primary option

---

## Module 7: Studio Shop

**Purpose:** White-label POS for studio retail, Nutcracker merchandise, recital flowers, apparel.

### White-Label Config
Each event/season gets its own shop configuration:
- Custom shop name (e.g., "Sugar Plum Shop" for Nutcracker)
- Custom logo upload
- Custom primary/secondary colors
- Activate/deactivate per season
- Admin can run multiple configs, only one active at a time

### Features
- **Product Catalog** — merchandise, concessions, flowers, apparel
- **Inventory Tracking** — real-time stock levels
- **POS Interface** — tablet-optimized for in-person sales at performances
- **Cart + Checkout** — cash, card, Zelle, Venmo
- **Tax Calculation** — California sales tax (9.25% in San Clemente)
- **Order History** — per-event sales reporting
- **Vendor Payments** — record outgoing payments (Zelle/Venmo) per vendor

### Performance Mode
- Full-screen simplified UI for lobby sales
- Large touch targets
- No login required for cashier (PIN access)

---

## Module 8: Expansion Intelligence

**Purpose:** Data-driven decision making for opening Location #2.

### Readiness Indicators
Track these metrics; alert when expansion threshold is met:
- Enrollment capacity ≥ 90% for 3+ consecutive months
- Active waitlist ≥ 15 students
- Revenue target met (internal threshold set by Amanda)
- Brand search volume growing in target cities

### Market Research
For each candidate city track:
- Population + family/child demographic data
- Median household income
- Competitor studio count + ratings
- Available commercial real estate (manual input)
- Drive time from San Clemente

### Target Expansion Markets (priority order)
1. Ladera Ranch
2. Rancho Mission Viejo
3. San Juan Capistrano
4. Laguna Niguel

### Competitor Intelligence
Track for each competitor:
- Programs offered
- Price per month (estimated)
- Google/Yelp rating
- Number of reviews
- Marketing style (competition, recreational, classical)
- Teacher names (for recruitment)
- Last updated date

### Competitors to Monitor
Variant, Pave, San Clemente Dance Academy, Capistrano Academy of Dance,
South Coast Conservatory, Southland Ballet Academy, Moxie, On Deck,
Pacific Ballet Conservatory, Tutu School, Bonjour Ballet

---

## Module 9: BAM Learning Studio (LMS)

**Purpose:** The differentiator. A dance-specific learning platform with three distinct interfaces.

---

### Student Interface (Ages 3–12)

**Design Philosophy:** TikTok-meets-ballet. Swipe-up vertical video feed. Gamified progress. Age-appropriate UX.

#### Age 3–5 (Pre-Ballet / Primary)
- Giant colorful buttons, minimal text
- Video-first: animated instructor explains movement
- Sticker rewards for watching/completing
- Parent co-view encouraged
- Simple: "Watch" → "Try It" → "I Did It!" flow

#### Age 6–9 (Level 1–2)
- Swipe-up video feed (TikTok style)
- Short clips: 15–90 seconds
- Skill categories: Barre, Centre, Jumps, Turns, Stretching, Musicality
- Heart/bookmark videos
- Progress bar per skill area
- Badge notifications on achievement

#### Age 10–12 (Level 3+)
- More text, technique breakdowns
- Slow-motion replay option
- Peer progress (can see classmates' badges, not scores)
- Personal goal setting
- Audition prep content for intensive programs (ABT, Royal Ballet, Stuttgart)

#### Gamification System
**Badges (examples):**
- First Day Dancer — attended first class
- Arabesque Achiever — teacher awards when mastered
- Nutcracker Debut — performed in Nutcracker
- Level Up — completed level and promoted
- Perfect Attendance — monthly
- Sugar Plum — principal role in Nutcracker
- Swan — principal role in spring showcase
- Pointe Ready — cleared for pointe work
- Competition Star — competed at approved competition
- Intensive Accepted — accepted to summer intensive

**Progress Visualization:**
- Star constellation fills in as skills are mastered (not a boring progress bar)
- Each level = a different constellation (Orion for Level 1, etc.)
- Animated when new badge earned
- No negative feedback in UI — only encouragement

---

### Parent Interface

**Purpose:** Stay connected to their child's progress without overwhelming them.

#### Features
- **This Week's Focus** — what skill their child is working on
- **Teacher Notes** — shared notes from teacher (curated, positive)
- **Milestone Alerts** — push notification when badge is earned
- **Upcoming Performances** — roles, rehearsal schedule, costume info
- **Practice Encouragement** — "Sofia has a new exercise to try this week!"
- **Progress Report** — monthly summary of skills developing
- **Content Recommendations** — "Watch this with your dancer tonight"
- **Live Stream Notifications** — alert when teacher starts live stream

**Tone:** Warm parent-to-parent feel. Never clinical. Never report-card-like.

---

### Teacher Interface

**Purpose:** Manage content delivery and student progress tracking.

#### Features
- **Content Management** — upload videos, assign to age/level groups
- **Feed Curation** — drag-and-drop order content in student feeds
- **Live Stream** — start/stop live class stream (see Live Streaming below)
- **Badge Awarding** — one-tap award badge to student with optional note
- **Skill Assessment** — rate student on 5-point scale per skill area
- **Class Analytics** — who watched what, completion rates, engagement
- **Bulk Actions** — award same badge to multiple students at once
- **Parent Messaging** — send note to parent directly from student profile

---

## Live Streaming (all modules)

**Provider:** Cloudflare Stream (or Mux) — do not use YouTube/Zoom for class streams

### Stream Types

| Type | Access | Paid? |
|------|--------|-------|
| Class Stream | Enrolled students' parents only | No |
| Performance Stream | Purchased ticket OR family of performer | Optional |
| Workshop | Registered participants | Yes |
| Open Demo | Public | No |

### Teacher Flow
1. Teacher opens Teacher Portal
2. Taps "Go Live" on today's class
3. Selects stream type (class or performance)
4. Stream starts — enrolled parents notified immediately
5. Red LIVE indicator visible to all authorized viewers
6. Tap "End Stream" → recording auto-saved to class session
7. Recording available to parent within 24 hours

### Parent Flow
1. Push notification: "Ms. Amanda is live in Pre-Ballet right now!"
2. Tap → lands in stream view (no login friction if already authenticated)
3. View-only — no chat for class streams (reduce distraction)
4. Performance streams: purchase ticket → immediate access

### Paid Performance Streaming
- Stripe integration for ticket sales
- Price set per performance ($15–$25 suggested)
- Grandparent/family access links (purchaser can share with X devices)
- Recording available for 30 days post-performance
- Revenue split tracking (studio keeps 100% by default)

---

## Technical Notes Across All Modules

- All routes protected by Supabase Auth + RLS
- Role-based access control enforced server-side (middleware)
- Mobile-first responsive design (parent/student interfaces)
- Desktop-optimized for admin/teacher interfaces
- Real-time updates via Supabase Realtime for attendance, live status
- Email via Resend (transactional) + Klaviyo (marketing)
- All video content stored in Cloudflare Stream (not Supabase Storage)
- Images/documents in Supabase Storage
