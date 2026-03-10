# CLAUDE.md — BAM Platform AI Context

> This file is read by Claude Code at the start of every session.  
> It is the single source of truth for project context, decisions made, and work in progress.  
> **Keep this file updated as the project evolves.**

---

## 1. Project Identity

**Studio:** Ballet Academy and Movement  
**Founder:** Amanda Cobb — former professional ballerina  
**Mission:** High-level classical ballet training in a nurturing environment  
**Location:** 400-C Camino De Estrella, San Clemente, CA 92672  
**Phone:** (949) 229-0846  
**Email:** dance@bamsocal.com  
**Primary domain:** balletacademyandmovement.com  
**Redirect domain:** bamsocal.com (Cloudflare 301 → main site)

**Do not abbreviate the studio as "BAM" in public-facing content** — trademark conflict.

---

## 2. What We Are Building

A full studio management platform for Ballet Academy and Movement that:

1. **Serves BAM first** — solves every operational, marketing, and communication need of the studio
2. **Gets white-labeled later** — eventually becomes a SaaS product for other classical ballet and performing arts studios nationally

The platform beats every existing competitor (MindBody, Studio Pro, Jackrabbit, WellnessLiving, Mangomint, TeamUp) by being the only system that is simultaneously:
- Dance/performing-arts native
- Badge and achievement system enabled
- Sub-brand / multi-program capable
- Parent live-viewing enabled
- Luxury-designed (not generic fitness/spa SaaS)

---

## 3. Nine Platform Modules

Full specs are in `docs/strategy/platform-product-requirements.md`. Summary:

| Module | Name | Core Problem Solved |
|--------|------|---------------------|
| M1 | Communications Hub | One-stop: print, digital signage, email, SMS, web, app push |
| M2 | Badge + Achievement System | Skill recognition — digital + physical jacket patches |
| M3 | Session & Scheduling | Classes, privates, rehearsals, comp rehearsals — all unified |
| M4 | Teacher Management | Hour logging by pay category, scheduling, onboarding |
| M5 | Sub-Brand Architecture | Recreational / Performance / Competition programs with own identity |
| M6 | Student & Family Profiles | Multi-enrollment, guardian authorization, live-viewing access |
| M7 | Registration & Enrollment | Friction-free class discovery and signup |
| M8 | Reporting & Intelligence | Studio health metrics + AI insights |
| M9 | Physical Merchandise | Badge jackets, patches, costumes, Sugar Plum Shop |

---

## 4. Sub-Brand Structure

One student can be in any or all three programs simultaneously:

| Program | Working Name | Palette | Notes |
|---------|-------------|---------|-------|
| All students | Ballet Academy and Movement | Lavender/Cream/Gold | Master brand |
| Recreational | BAM Recreational / BAM Petite | Soft blue accent | Open enrollment |
| Performance | BAM Performance Company | Lavender (primary) | Teacher-selected |
| Competition | BAM Competition Company | Black / Gold | Auditioned |

Each sub-brand has its own: communications scope, billing line, jacket color, badge set, and class schedule filter.

---

## 5. Session Types (M3)

Each session type has its own pay rate, capacity, and attendance behavior:

1. **Regular Class** — recurring weekly group class, pre-filled roster
2. **Private Lesson** — 1-on-3 max, private pay rate, teacher confirms
3. **Performance Rehearsal** — linked to a production, cast attendance
4. **Competition Rehearsal** — linked to a routine/competition entry
5. **Competition Coaching** — polish session, private rate
6. **Masterclass / Workshop** — special event, separate attendance
7. **Summer Intensive / Camp** — multi-day grouped series
8. **Audition Session** — tryout, records result
9. **Sub Class** — substitute teacher, separate pay logging

---

## 6. Teacher Pay Categories (M4)

Teachers are paid differently by session type. The system auto-categorizes:

- Class Teaching rate
- Private Lesson rate (higher)
- Competition Rehearsal rate
- Performance Rehearsal rate
- Competition Coaching rate
- Administrative rate (manually logged with description)
- Masterclass / Guest Teaching rate
- Sub Teaching rate
- Travel / Chaperone rate

---

## 7. Badge System (M2)

Seven badge categories:
1. Technique Skills (teacher-awarded, triggers physical patch)
2. Program Milestones (auto from system events)
3. Attendance & Dedication (auto from attendance data)
4. Musicality & Expression (teacher-subjective)
5. Leadership (teacher or admin)
6. Competition Results (auto from comp entry results)
7. Special Programs (auto from event enrollment)

**Physical jacket program:** Badge earned → patch queue → batch vendor order → distributed → parent notified via app.

Sub-brand jackets: BAM Recreational (blue), BAM Performance (lavender), BAM Competition (black/gold).

---

## 8. Communications Architecture (M1)

All channels flow from one system:

| Channel | Primary Uses |
|---------|-------------|
| In-Studio Print | Class rosters, attendance sheets, rehearsal schedules, badge certificates, competition travel sheets |
| Digital Signage | TV/monitor in waiting room — auto-rotating feed, admin can push urgent messages |
| Email (Klaviyo) | Welcome sequences, performance announcements, billing, newsletters |
| SMS | Last-minute changes, 24hr reminders, performance call times |
| Website Widget | Live class schedule, upcoming events, enrollment CTA |
| Parent App Push | Live-viewing alerts, badge earned, billing due |
| Unified Inbox | All inbound (text, web chat, email reply) in one thread with parent profile auto-loaded |

---

## 9. AI Attendance System (M3)

**Phase 1 (build now):** Schedule pre-fill — enrolled students default to Present, teacher marks absences only.

**Phase 2:** QR code check-in — student/parent taps QR at door, marks present before class starts. Best for ages 3–12 where parent is always at drop-off. No privacy complexity.

**Phase 3 (future):** Camera + facial recognition with parental biometric consent. Use AWS Rekognition or Azure Face API. Frame-discard after recognition — no video stored.

---

## 10. Brand Guidelines

**Palette:**
- Primary: Lavender `#9C8BBF`
- Dark lavender: `#6B5A99`
- Cream: `#FAF8F3`
- Gold: `#C9A84C`
- Dark gold: `#9B7A2E`

**Typography:**
- Headings: Cormorant Garamond
- UI body: Inter or DM Sans
- Code: Courier / monospace

**Aesthetic:** Minimal luxury ballet studio. Feminine, refined, modern. No cartoonish graphics, no generic fitness branding. Think editorial ballet magazine, not gym app.

**Iconography:** Thin-stroke ballet-specific icons (pointe shoe, barre, tutu, stage curtain, music note). Not generic business SaaS icons.

**Content tone:** Warm, refined, encouraging, knowledgeable. Avoid corporate or overly promotional language.

---

## 11. Technology Stack

| Layer | Tool |
|-------|------|
| CMS | WordPress + Flatsome theme (UX Builder) |
| Studio management | Studio Pro (GoStudioPro) |
| Email marketing | Klaviyo |
| Automation | Zapier |
| DNS/CDN | Cloudflare (bamsocal.com) |
| Email hosting | Google Workspace (bamsocal.com) |
| Dashboard | React (custom — `platform/ballet-academy-dashboard.jsx`) |
| Design | Canva |
| Productivity | Microsoft Office Suite, Google Workspace |
| SEO pages | HTML + WordPress/Flatsome (Claude Code builds, Derek implements) |

**DNS note:** bamsocal.com is on Cloudflare free plan. Google Workspace MX, SPF, and DKIM records and Klaviyo DNS records must be preserved on any DNS change.

---

## 12. SEO Strategy

**Goal:** Rank #1 for ballet training searches in South Orange County.

**Established template:** Ballet featured first, other programs (jazz, contemporary, musical theatre) listed below. All pages follow this structure.

**Target keywords by city:**
- San Clemente: `ballet classes san clemente`, `ballet san clemente`, `dance classes san clemente`
- Laguna Niguel: `ballet classes laguna niguel`, `dance studio laguna niguel`
- Dana Point: `ballet classes dana point`
- Ladera Ranch: `ballet classes ladera ranch`
- Mission Viejo: `ballet mission viejo`

**Each SEO page includes:** schema markup, FAQ content, full program listing, class schedule CTA, Google Maps embed.

---

## 13. Competitive Landscape

South Orange County competitors to track:

| Studio | Segment | Notes |
|--------|---------|-------|
| San Clemente Dance Academy | Recreational + Performance + Competition (3-track model) | Closest structural comp |
| Capistrano Academy of Dance | Ballet + commercial | Established |
| South Coast Conservatory | Conservatory model | Higher price point |
| Southland Ballet Academy | Ballet-focused | Direct comp |
| Pacific Ballet Conservatory | Classical | Direct comp |
| Moxie Dance Studio | Commercial/competition | Different market |
| On Deck Dance Studio | Commercial | Different market |
| Variant Dance Studio | Contemporary | Different market |
| Pave School of the Arts | Mixed | Different market |
| Tutu School / Bonjour Ballet | Franchise toddler programs | Competes for ages 3-5 |

---

## 14. Target Market

**Primary customer:** Parents of children ages 3–10  
**Household:** Upper-middle income, within 15–20 minutes of studio  
**Decision maker:** Mother  
**Acquisition channels:** Google search, Yelp, word of mouth, performances, social media  
**Ad budget:** ~$20/day across Google and Meta

---

## 15. Key Differentiators (always lead with these)

1. Professional ballet pedagogy (Amanda Cobb — former professional ballerina)
2. Small class sizes (max 10 students)
3. Three-time Best Dance School in San Clemente
4. San Clemente Hall of Fame recognition
5. Students accepted to Royal Ballet, ABT, and Stuttgart Ballet intensives
6. Major productions: The Nutcracker, spring recital
7. Nurturing culture — not a competition factory

**Positioning:** "Real ballet training in a nurturing environment." Not competition dance. Not recreational dance. Classical ballet with professional foundations.

---

## 16. Completed Work (as of March 2026)

| Item | Status | Location |
|------|--------|----------|
| DNS migration (bamsocal.com → Cloudflare) | ✅ Done | — |
| Contact Us page copy | ✅ Done | Live on site |
| New Students page FAQ | ✅ Done | `docs/operations/faq-new-students.md` |
| Job postings (Office Manager + Ballet Instructor) | ✅ Done | `docs/operations/job-postings.md` |
| React dashboard (8 modules) | 🔄 In progress | `platform/ballet-academy-dashboard.jsx` |
| Platform Product Requirements (9 modules) | ✅ Done | `docs/strategy/platform-product-requirements.md` |
| Platform Research Parts 1 & 2 | ✅ Done | `docs/strategy/` |
| San Clemente SEO landing page | 🔲 To build | `docs/marketing/san-clemente-seo-page.md` |

---

## 17. Pending Build Queue

In priority order:

1. **Attendance pre-fill** — add to dashboard Class Management module (P0, this week)
2. **San Clemente SEO page** — build with Claude Code + implement in Flatsome (P0)
3. **Teacher hour logging by category** — add to dashboard Teacher module (P1)
4. **Session type setup** — privates, comp rehearsals, performance rehearsals in dashboard (P1)
5. **Badge system** — digital badge awarding workflow in dashboard (P1)
6. **Sub-brand program records** — add to dashboard (P1)
7. **Digital signage feed** — web-based TV display (P2)
8. **QR code check-in prototype** — one React component (P2)
9. **Production management module** — Nutcracker prep (P3, by Aug 2026)
10. **Parent live-viewing MVP** — for Nutcracker 2026 (P4, by Oct 2026)

---

## 18. Working Principles

- Derek implements code and content independently after Claude generates deliverables — he is hands-on technically
- Work is iterative — Derek shares live URLs, screenshots, or feedback to refine
- Claude Code handles content generation at scale; Flatsome handles visual layout
- All SEO pages: ballet featured first, other programs below
- Privates content = competition/audition/performance prep focus, not pricing
- Competition messaging: BAM competes but is not a competition factory — culture comes first
- DNS changes: always sequence carefully to protect Google Workspace MX records before nameserver switches

---

## 19. Long-Term Vision

Ballet Academy and Movement becomes:
1. The most respected ballet studio in South Orange County
2. A multi-location operation (Location 2 target: Ladera Ranch / Rancho Mission Viejo / San Juan Capistrano)
3. The studio that runs on the best platform in the performing arts industry
4. The company that white-labels that platform to classical ballet studios nationally

The platform name is TBD — working candidates: **Reverence**, **Arabesque**, **Curtain**, **Pointe**.

---

*Last updated: March 2026*  
*Update this file whenever a major decision is made, a module is completed, or the strategy shifts.*

---

## 20. Group Communication System (M10) — Replaces BAND

BAM currently uses the **BAND app** for private lesson scheduling and group communication (80-member "BAM PRIVATES" group). The platform must fully replace BAND with:

**What BAND does today:**
- Teachers (Coach Pie, Lauryn Rowe, Cara Matchett, Deborah Fauerbach) each post events independently to the group
- Private lessons scheduled as events with room assignments (Studio 2, Studio 3)
- Recurring event support (alternating weeks, reoccurring)
- Group feed with notifications (events, posts, tagged, activity)
- Group chat rooms — private and public options
- Calendar view (monthly + list) for all group events
- 80+ members receiving notifications when new events are created

**Platform group structure:**
- BAM All Families — general announcements
- BAM Privates — private scheduling, all teachers + families
- BAM Performance Company — production-specific
- BAM Competition Company — competition-specific
- BAM Staff — internal only
- Per-production groups (Nutcracker, spring show)

**Room management:** Studio 1, Studio 2, Studio 3 as bookable rooms — admin defines, system prevents double-booking.

---

## 21. Performance Events & Ticketing (M11) — Replaces TutuTix

BAM currently uses **TutuTix** for Nutcracker and performance ticketing. TutuTix charges patrons 5% + $1 per ticket. The platform replaces this entirely.

**TutuTix features to replicate:** Reserved seating with seat map, general admission, digital + keepsake tickets, QR door scanning, weekly payouts, promo codes, family allotments, refund control, donation collection.

**BAM platform advantages over TutuTix:**
- Zero external ticketing fee — BAM keeps the revenue
- Concession/merch pre-orders bundled at ticket checkout (flowers, programs, Sugar Plum Shop items)
- Live stream ticket sold alongside in-person ticket
- Student name on keepsake ticket auto-populated from cast record
- Integrated with production record — ticket sales, cast list, and program in one place

**Checkout flow:** Buy ticket → choose seats → add concession pre-orders → pay → receive digital ticket in app + email → keepsake option → day-of: QR scan at door, pre-orders fulfilled at Sugar Plum Shop window.


---

## 22. Studio Pro — Current System Observations (March 2026)

From live screenshots, Studio Pro is being used for the following. This is the baseline the BAM Platform must replicate and improve:

**Data model in use:**
- Students have: Summary, Family Members, Classes, Medical, Notes, Sizes, Absences, Files, Class History, Comm History, Orders & Punch Cards, Groups, Skills
- Parents have: Summary, Students, History, Contacts, Notes, Parent Access Monitor, Waivers, Groups, Gift Codes
- Parent portal includes: Messages, Register, Pay, Punch, Files, Waivers, Attendance, Calendar, Check In

**Active seasons:** Classes 2025/2026, Company 25/26, June 6th Recital, Morning Classes 2026, 2026 Summer

**3 active locations:**
1. Ballet Academy & Movement (main studio — 400-C Camino De Estrella)
2. City of San Clemente Community Center
3. San Juan Hills High School — Dance Studio

**Known naming workarounds (platform must eliminate):**
- Sub-brand tagging done by prefixing student first name: "Competition- Willow" = competition program student
- "OPT OUT Sylvia" in class enrollment = no native opt-out field; using class name as workaround
- Rehearsal sessions created as classes with names like "3A/4A Variations and Sylvia rehearsal"
- Competition routines created as classes: "Jazz Comp Rehearsal - Diamonds Level 2B+/2C - Jazz"

**Communication tools in Studio Pro:**
- Robo-Mailer (email blast)
- Robo-Dialer (phone)
- Robo-Texter (SMS — billed separately per text, not included)
- Studio Chat
- Studio Announcements

**What's missing entirely from Studio Pro (must build):**
- Badge/achievement system
- Group social feed → BAND fills this gap externally
- Teacher pay category tracking → manual/external
- Production/Nutcracker management
- Competition tracking
- Digital signage
- Live streaming
- Teacher compliance portal (W9, contracts, mandated reporter training)
- Performance ticketing → TutuTix fills this externally
- True sub-brand/program tagging

---

## 23. Legal, Waivers & Compliance (M12)

**Two sides — parent and teacher. Both critical.**

**Parent documents:**
- General studio waiver (annual renewal)
- Photo/media release
- Medical authorization
- Competition Company contract (per season) — includes commitment expectations, financial obligations, withdrawal policy
- Performance Company contract (per season)
- Financial agreement
- Costume/uniform agreement (per production)

**Teacher documents (not in Studio Pro at all — full gap):**
- W9 (required before first paycheck — payroll gate)
- Independent contractor or employee agreement
- Mandated reporter acknowledgment + California mandated reporter training certificate (every 2 years)
- Studio policy acknowledgment (annual)
- Teaching philosophy agreement
- Background check authorization (every 2 years)
- Social media & photo policy
- Emergency procedures acknowledgment
- Sub teacher agreement

**Key behaviors:**
- W9 blocks payroll export until on file — hard gate
- "Block from schedule" toggle prevents teacher assignment if critical docs missing
- "Ready to perform" check before any production — confirms all performing families are signed
- "Ready to teach" check — confirms all teachers have valid docs before season starts
- All documents digitally signed within the platform (no DocuSign dependency)
- Every signature stored with: document version, timestamp, IP, device, signer name
- Admin compliance dashboard shows green/yellow/red status per person per document

---

## 24. Quo — Unified Communications Inbox (currently in use)

BAM currently uses **Quo** (my.quo.com) as a unified SMS/call inbox. Two phone numbers active:
- **(949) 229-0846** — "Use this Number Please!" (primary)
- **(949) 736-5025** — "Ballet Academy and Movement" (secondary)

Quo shows: unified chat inbox, call analytics, contact list. Parent contacts stored as "Emily (Clara) Bredthauer" — student name in parentheses is a workaround since Quo has no native parent-to-student linking.

Month-to-date (March 2026): 411 messages, 56 calls, 158 unique conversations, 2:06 avg time on calls.

**Sona** (AI assistant inside Quo) is being evaluated for AI-suggested replies. This functionality is replicated natively in M1 Unified Inbox.

**BAM Platform replaces Quo entirely via M1.** Both phone numbers route into the BAM Platform unified inbox. Inbound phone number auto-matches to family profile — no name-hack needed.

---

## 25. Google Photos — Student Photo Distribution (currently in use)

BAM uses Google Photos with facial recognition to create per-student performance photo albums distributed to families. Active albums include:
- Production albums: 2025 Nutcracker (339 photos), 2025 Spring Showcase (272), 2025 Showstoppers (50), 2025 Company Photo Shoot (59)
- Per-student albums for Company students (Ally Loftus: 302 items, Alice Lange: 196 items, etc.) auto-populated via facial recognition
- Photographer albums (Peyton Komatsu, Gwendolyn, Hannah Sedgwick, Ari Meeker)
- Albums shared with families via link

**BAM Platform replaces Google Photos via M13.**

**Critical legal requirement:** Facial recognition on minors requires explicit biometric consent separate from general photo release — this is a required M12 document ("Biometric Data / Facial Recognition Consent") before any child's reference photo is processed. California CPPA compliance.

---

## 26. Complete External Tool Stack (as of March 2026)

| Tool | Purpose | Monthly Cost | BAM Module |
|------|---------|--------------|------------|
| Studio Pro | Student/class/billing/comms | ~$120–150/mo | M3,M4,M6,M7,M8 |
| BAND | Private scheduling + group comms | Free (ad-supported) | M10 |
| TutuTix | Performance ticketing | 5%+$1/ticket | M11 |
| Quo | Unified SMS/call inbox + AI | ~$50–100/mo | M1 |
| Google Sheets | Teacher timesheets (manual) | Admin time cost | M4 |
| Google Photos | Student photo albums + facial recognition | ~$10/mo storage | M13 |
