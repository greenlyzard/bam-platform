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
**Alt phone (in Quo):** (949) 736-5025  
**Email:** dance@bamsocal.com  
**Primary domain:** balletacademyandmovement.com  
**Redirect domain:** bamsocal.com (Cloudflare 301 → main site)  
**Payroll email:** PAYROLL@BAMSOCAL.COM

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
- Legal/compliance document management included
- Performance ticketing built in
- Luxury-designed (not generic fitness/spa SaaS)

**White-label name candidates:** Reverence, Arabesque, Curtain, Pointe  
**White-label target customer:** Classical ballet studios, 50–300 students, single location  
**White-label pricing model:** $99–149/mo studio + $4.99–9.99/mo family app

---

## 3. Thirteen Platform Modules

Full specs are in `docs/strategy/platform-product-requirements.md`. Summary:

| # | Module | Core Problem Solved | Replaces |
|---|--------|---------------------|---------|
| M1 | Communications Hub | Print, signage, email, SMS, web, unified inbox | Quo + Robo-Texter |
| M2 | Badge + Achievement System | Skill recognition — digital + physical jacket patches | (net new) |
| M3 | Session & Scheduling | Classes, privates, rehearsals, comp rehearsals — all unified | Studio Pro |
| M4 | Teacher Management | Hour logging by pay category, scheduling, onboarding | Studio Pro + Google Sheets |
| M5 | Sub-Brand Architecture | Recreational / Performance / Competition programs | (net new) |
| M6 | Student & Family Profiles | Multi-enrollment, guardian authorization, live-viewing | Studio Pro |
| M7 | Registration & Enrollment | Friction-free class discovery and signup | Studio Pro parent portal |
| M8 | Reporting & Intelligence | Studio health metrics + AI insights | Studio Pro + Quo analytics |
| M9 | Physical Merchandise | Badge jackets, patches, costumes, Sugar Plum Shop | (already built) |
| M10 | Group Communication & Social Feed | Group posts, private scheduling, chat rooms | BAND |
| M11 | Performance Events & Ticketing | Reserved seating, QR scanning, concession pre-orders | TutuTix |
| M12 | Legal, Waivers & Compliance | Parent waivers, teacher W9s, mandated reporter tracking | (net new) |
| M13 | Media Archive & Photo Distribution | Per-student photo albums, facial recognition, family delivery | Google Photos |

---

## 4. Sub-Brand Structure

One student can be in any or all three programs simultaneously:

| Program | Working Name | Palette | Entry |
|---------|-------------|---------|-------|
| All students | Ballet Academy and Movement | Lavender/Cream/Gold | Open |
| Recreational | BAM Recreational / BAM Petite | Soft blue | Open enrollment |
| Performance | BAM Performance Company | Lavender (primary) | Teacher-selected |
| Competition | BAM Competition Company | Black / Gold | Auditioned |

Each sub-brand has its own: communications scope, billing line, jacket color, badge set, schedule filter.

**Current Studio Pro workaround being eliminated:** "Competition- Willow" as first name prefix, "OPT OUT Sylvia" in class name.

---

## 5. Session Types (M3)

Each type has its own pay rate, capacity, and attendance behavior:

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

| Category | Notes |
|---------|-------|
| Class Teaching rate | Per-hour, varies by teacher |
| Private Lesson rate | Higher than class rate |
| Competition Rehearsal rate | Tracked separately |
| Performance Rehearsal rate | Tracked separately |
| Competition Coaching rate | Private-session rate |
| Administrative rate | Logged with description |
| Masterclass / Guest Teaching rate | Special events |
| Sub Teaching rate | Separate logging |
| Travel / Chaperone rate | Competition travel |

**Current process being replaced:** Google Sheets timesheet → emailed to PAYROLL@BAMSOCAL.COM by 26th of month. M4 eliminates this entirely.

---

## 7. Badge System (M2)

Seven badge categories:
1. Technique Skills (teacher-awarded, triggers physical patch order)
2. Program Milestones (auto from system events)
3. Attendance & Dedication (auto from attendance data)
4. Musicality & Expression (teacher-subjective)
5. Leadership (teacher or admin)
6. Competition Results (auto from comp entry results)
7. Special Programs (auto from event enrollment)

**Physical jacket program:** Badge earned → patch queue → batch vendor order → distributed → parent notified via app.

Sub-brand jackets: BAM Recreational (blue), BAM Performance (lavender), BAM Competition (black/gold).

---

## 8. Current Faculty

| Name | Role | Notes |
|------|------|-------|
| Amanda Cobb | Founder, Lead Instructor | All levels |
| Samantha "Sam" Weeks | Instructor | Active |
| Paola "Pie" Gonzalez | Instructor / Coach | Also listed as Coach Pie |
| Campbell Castner | Instructor | Active |
| Lauryn Rowe | Instructor | Active — Lauryn's timesheet format documented |
| Cara Matchett | Instructor | Active |
| Deborah Fauerbach | Instructor | Active |

---

## 9. Active Studio Pro Locations

1. Ballet Academy & Movement (primary — 400-C Camino De Estrella)
2. City of San Clemente Community Center
3. San Juan Hills High School — Dance Studio

Active seasons: Classes 2025/2026, Company 25/26, June 6th Recital, Morning Classes 2026, 2026 Summer

---

## 10. Communications Architecture (M1)

| Channel | Primary Uses |
|---------|-------------|
| In-Studio Print | Class rosters, attendance sheets, rehearsal schedules, badge certificates |
| Digital Signage | TV in waiting room — auto-rotating feed, admin can push urgent messages |
| Email (Klaviyo) | Welcome sequences, performance announcements, billing, newsletters |
| SMS | Last-minute changes, 24hr reminders, performance call times |
| Website Widget | Live class schedule, upcoming events, enrollment CTA |
| Parent App Push | Live-viewing alerts, badge earned, billing due |
| Unified Inbox | All inbound (text, web chat, email reply) in one thread with parent profile |

---

## 11. M12 — Legal & Compliance Document Sets

### Parent Documents (8 types)
1. General studio liability waiver
2. Photo / media release
3. Medical authorization for emergencies
4. Competition Company contract (per season)
5. Performance Company contract (per season)
6. Financial agreement (tuition + billing terms)
7. Costume / uniform agreement
8. Biometric data / facial recognition consent (California CPPA required for M13)

### Teacher Documents
1. W9 — hard payroll gate (blocks pay export until on file)
2. Independent contractor or employee agreement
3. Mandated reporter acknowledgment + CA AB 1432 certificate (2-year renewal)
4. Studio policy acknowledgment (annual)
5. Background check authorization (2-year renewal)
6. Social media & photo policy
7. Emergency procedures acknowledgment
8. Sub teacher agreement (if applicable)

**M12 behavior:** "Block from schedule" toggle if critical docs missing. Green/yellow/red status per person per document in admin dashboard.

---

## 12. M13 — Media Archive

**Current state (Google Photos):**
- 2025 Nutcracker: 339 photos
- 2025 Spring Showcase: 272 photos
- 2025 Showstoppers: 50 photos
- 2025 Company Photo Shoot: 59 photos
- Per-student albums via facial recognition (Ally Loftus: 302 items; Alice Lange: 196 items)
- Photographers: Peyton Komatsu, Gwendolyn, Hannah Sedgwick, Ari Meeker

**M13 Plan:**
- Phase 1: Google Photos API integration
- Phase 2: Native facial recognition (AWS Rekognition or Google Cloud Vision)
- Facial recognition requires biometric consent (California CPPA) — handled in M12

---

## 13. Brand Guidelines

**Palette:**
- Primary Lavender: `#9C8BBF`
- Dark Lavender: `#6B5A99`
- Cream: `#FAF8F3`
- Gold: `#C9A84C`
- Dark Gold: `#9B7A2E`

**Typography:**
- Headings: Cormorant Garamond
- UI body: Montserrat (weights 300, 400, 500, 600)

**Aesthetic:** Minimal luxury ballet studio. Feminine, refined, modern. No cartoonish graphics, no generic fitness branding.

**Content tone:** Warm, refined, encouraging, knowledgeable. Avoid corporate or overly promotional language.

Full brand guidelines: `docs/brand/brand-guidelines.md`

---

## 14. Technology Stack

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
| Live viewing (planned) | Mux.com streaming API |

**DNS note:** bamsocal.com is on Cloudflare free plan. Google Workspace MX, SPF, DKIM, and Klaviyo DNS records must be preserved on any nameserver change.

---

## 15. SEO Strategy

**Goal:** Rank #1 for ballet training searches across South Orange County.

**Established structure:** Ballet featured first, other programs (jazz, contemporary, musical theatre) listed below. All pages follow this structure without exception.

**City target order:**

| Tier | Cities |
|------|-------|
| 1 | San Clemente, Laguna Niguel, Dana Point |
| 2 | Ladera Ranch, Mission Viejo, San Juan Capistrano, Rancho Mission Viejo |
| 3 | Broad intent keywords (supported by blog content) |

Full SEO strategy: `docs/marketing/local-seo-strategy.md`

---

## 16. Competitive Landscape

| Studio | Segment | Threat Level |
|--------|---------|-------------|
| San Clemente Dance Academy | Rec + Performance + Competition | HIGH (same city) |
| Southland Ballet Academy | Classical ballet | Medium |
| Pacific Ballet Conservatory | Classical | Medium |
| Capistrano Academy of Dance | Ballet + commercial | Medium |
| South Coast Conservatory | Conservatory / premium | Low |
| Tutu School / Bonjour Ballet | Franchise toddler | Medium (ages 3-5) |
| Moxie, On Deck, Variant, Pave | Commercial/competition | Low (different market) |

Full competitive analysis: `docs/marketing/competitive-intelligence.md`

---

## 17. Target Market

**Primary customer:** Parents of children ages 3–10  
**Household:** Upper-middle income, within 15–20 minutes of studio  
**Decision maker:** Mother  
**Acquisition channels:** Google search, Yelp, word of mouth, performances, social media  
**Ad budget:** ~$20/day across Google and Meta

---

## 18. Key Differentiators (Always Lead With These)

1. Professional ballet pedagogy (Amanda Cobb — former professional ballerina)
2. Small class sizes (max 10 students)
3. Three-time Best Dance School in San Clemente
4. San Clemente Hall of Fame recognition
5. Students accepted to Royal Ballet, ABT, and Stuttgart Ballet intensives
6. Major productions: The Nutcracker, spring recital
7. Nurturing culture — not a competition factory

**Positioning:** "Real ballet training in a nurturing environment."

---

## 19. Completed Work (as of March 2026)

| Item | Status | Location |
|------|--------|----------|
| DNS migration (bamsocal.com → Cloudflare) | ✅ Done | — |
| Contact Us page copy | ✅ Done | Live on site |
| New Students page FAQ | ✅ Done | Live on site |
| Job postings (Office Manager + Ballet Instructor) | ✅ Done | Indeed |
| React dashboard (8 modules) | 🔄 In progress | `platform/ballet-academy-dashboard.jsx` |
| Platform PRD (13 modules) | ✅ Done | `docs/strategy/platform-product-requirements.md` |
| GitHub repo structure | ✅ Done | github.com/greenlyzard/bam-platform |
| CLAUDE.md | ✅ Done | `CLAUDE.md` |
| README.md | ✅ Done | `README.md` |
| Registration & Onboarding spec | ✅ Done | `docs/REGISTRATION_AND_ONBOARDING.md` |
| Billing engine spec | ✅ Done | `docs/BILLING.md` |
| Marketing integrations spec | ✅ Done | `docs/MARKETING_INTEGRATIONS.md` |
| Scheduling & LMS spec (canonical — replaces prior version) | ✅ Done | `docs/SCHEDULING_AND_LMS.md` |

---

## 20. Pending Build Queue

| Priority | Item | Notes |
|----------|------|-------|
| P0 | Attendance pre-fill in dashboard | Enrolled students default to Present |
| P0 | San Clemente SEO landing page | Build with Claude Code + implement in Flatsome |
| P1 | Teacher hour logging by category (M4) | Eliminates Google Sheets timesheet |
| P1 | Session type setup (M3) | Privates, comp rehearsals, performance rehearsals |
| P1 | Sub-brand program records (M5) | Eliminates first-name prefix workaround |
| P1 | Badge system digital workflow (M2) | Teacher-awarding interface |
| P2 | Digital signage feed (M1) | Waiting room TV display |
| P2 | QR code check-in prototype (M3) | One React component |
| P3 | Legal/compliance portal (M12) | Parent waivers + teacher W9s |
| P3 | Production management module (M3) | Nutcracker prep — deadline Aug 2026 |
| P4 | Parent live-viewing MVP (M6) | For Nutcracker 2026 — deadline Oct 2026 |
| P4 | Photo distribution — Google Photos API (M13) | — |
| P9+ | White-label beta program | Month 9+ |

---

## 21. Platform Decisions Log

| Decision | Rationale |
|----------|-----------|
| Stay on Studio Pro short-term | Switching mid-season creates risk |
| Evaluate Jackrabbit by June 2026 | Most credible alternative at BAM's size |
| Do not adopt MindBody until 300+ students | Overkill until multi-location |
| Build live-viewing on Mux.com | Best streaming API for this use case |
| Phase 1 facial recognition: Google Photos API | Phase 2: native (AWS Rekognition or Google Cloud Vision) |
| GitHub workflow: PDFs = published snapshots, MD = living docs | PDFs for sharing, MD for working |
| White-label ICP: classical ballet studios, 50–300 students | Not gym/fitness; not multi-genre dance |

---

## 22. Working Principles

- Derek implements code and content independently after Claude generates deliverables — hands-on technically
- Work is iterative — Derek shares live URLs, screenshots, or feedback to refine
- Claude Code handles content generation at scale; Flatsome handles visual layout
- All SEO pages: ballet featured first, other programs below
- Privates content = competition/audition/performance prep focus, not pricing
- Competition messaging: BAM competes but is not a competition factory — culture comes first
- DNS changes: always sequence carefully to protect Google Workspace MX records
- Do not abbreviate studio as "BAM" in any public-facing content

---

*Last updated: March 2026*  
*Update this file whenever a major decision is made, a module is completed, or strategy shifts.*
