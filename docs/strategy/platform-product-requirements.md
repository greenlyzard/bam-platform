> 🏛️ **Capability Module Architecture (M1–M13)**
>
> This document defines the platform by **capability domain** — the 
> 13 capability modules (Communications, Scheduling, Teachers, etc.) 
> that compose the BAM Platform. This is the canonical source for the 
> M1–M13 taxonomy.
>
> For the route/UI surface map (Parent Portal, Teacher Portal, etc.), 
> see `docs/PORTAL_SURFACES.md`.

---

# BAM Platform — Product Requirements Document

> **Module:** Strategy  
> **Status:** Complete  
> **Last updated:** March 2026

---

## Overview

The BAM Platform is a studio management system that takes everything the best competing platforms do — and does it better — while building capabilities no competitor offers at all.

It serves three audiences with distinct interface layers:
- **Studio Administrators** (Amanda, staff) — full dashboard
- **Teachers** — session management, attendance, hour logging, badge awarding
- **Families** — class discovery, live-viewing, badge celebrations, communications

---

## Module Index

| # | Module | Core Problem Solved |
|---|--------|---------------------|
| M1 | Communications Hub | One place for print, signage, email, SMS, and web |
| M2 | Badge + Achievement System | Skill recognition — digital and physical jacket patches |
| M3 | Session & Scheduling System | Classes, privates, rehearsals, comp rehearsals — all unified |
| M4 | Teacher Management | Hour logging, pay-rate differentiation, scheduling, onboarding |
| M5 | Sub-Brand Architecture | Recreational, Performance, Competition programs with own identity |
| M6 | Student & Family Profiles | Multi-enrollment, guardian authorization, live-viewing |
| M7 | Registration & Enrollment | Friction-free class discovery and signup |
| M8 | Reporting & Intelligence | Studio health, teacher performance, AI insights |
| M9 | Physical Merchandise | Badge jackets, patches, costumes, Sugar Plum Shop |

---

## M1 — Communications Hub

### Vision
Write once, publish everywhere. Every communication — printed roster, waiting room TV, parent email, staff text — flows from one system.

### Channels

| Channel | Use Cases | Format | Trigger |
|---------|-----------|--------|---------|
| In-Studio Print | Class rosters, attendance sheets, rehearsal schedules, performance programs, badge certificates, teacher schedules, competition travel sheets, parent newsletters | PDF (8.5x11 or custom) | On-demand or scheduled |
| Digital Signage | Class schedules, student spotlights, performance announcements, badge achievements, schedule changes, competition results | Landscape TV — auto-rotating slides | Automated feed + manual push |
| Email | Welcome sequences, class reminders, performance announcements, billing, newsletters, competition updates | HTML via Klaviyo | Automated triggers + campaigns |
| SMS | Last-minute changes, 24hr reminders, performance call times, emergency notices | 160-char SMS | Automated triggers + manual blast |
| Website Widget | Class schedule, upcoming events, badge leaderboard, enrollment CTA | Embeddable JS widget for WordPress | Live-sync |
| Parent App Push | Live-viewing alerts, attendance confirmation, badge earned, billing due, teacher messages | iOS/Android push | Event-driven |
| Internal (Staff) | Teacher schedule, sub requests, studio announcements | In-platform feed + email digest | Manual + automated |

### Print Templates (auto-generated PDFs)
- Class Roster — student name, photo, age, attendance history, notes
- Attendance Sheet — pre-filled from enrollment, teacher marks absences only
- Rehearsal Schedule — by production, cast list, call times, costume notes
- Performance Program — Nutcracker/spring show bios and cast list
- Badge Certificate — printable achievement award with teacher signature line
- Teacher Schedule — weekly view with session types
- Competition Travel Sheet — student roster, costume assignments, performance order
- Parent Newsletter — monthly or per-event

### Digital Signage System
- Content rotates every 15–30 seconds (configurable)
- Admin can push urgent messages instantly from mobile ("Today's 4pm class moved to Studio B")
- Auto-populates: today's schedule, upcoming performances, recent badge earners
- Seasonal modes: Nutcracker countdown, competition season, summer intensive
- Badge earned during class → student name displays on signage in real time
- URL-based display — any TV with a browser/Chromecast works

### Unified Inbox
- Web chat, SMS, email replies — all in one inbox
- Inbound message from parent phone number → auto-loads student profile
- Staff can assign conversations, add internal notes, mark resolved
- AI-suggested replies for common parent questions

---

## M2 — Badge + Achievement System

### Badge Categories

| Category | Examples | Who Awards | Physical Patch? |
|----------|----------|------------|-----------------|
| Technique Skills | First Arabesque, En Pointe Ready, Clean Tendu, Pirouette (single/double) | Teacher — post-class flow | Yes |
| Program Milestones | First Performance, Competition Debut, Nutcracker Cast, Principal Role | Auto from system event | Yes |
| Attendance & Dedication | Perfect Month, 50 Classes, 1 Year Member, Never Late | Auto from attendance data | Yes |
| Musicality & Expression | Musical Phrase Award, Artistry Recognition, Rehearsal MVP | Teacher — subjective | Optional |
| Leadership | Senior Student, Peer Mentor, Demonstrator, Competition Captain | Teacher or Admin | Yes |
| Competition Results | Gold Medal, Regional Champion, Judge's Choice | Auto from comp results entry | Yes |
| Special Programs | Summer Intensive Completion, Guest Teacher Workshop | Auto from event enrollment | Optional |

### Digital Badge Experience
- Student profile: earned badges as visual grid — most recent first
- Parent app: push notification the moment a badge is awarded
- Digital signage: badge achievement displays on waiting room screen in real time
- Certificate: one-tap print of formal achievement certificate
- Progress view: badges earned vs. available — motivates next achievement
- Teacher view: see all students in a class and their outstanding eligible badges
- Badge history: date, awarding teacher, and class logged for every badge

### Physical Badge Jacket Program
- Badge earned → patch added to student's "Patch Order Queue"
- Admin reviews queue weekly → generates batch order for embroidery vendor
- Patch arrives → admin marks distributed → parent notified via app
- Sub-brand jackets:
  - BAM Recreational — soft blue
  - BAM Performance Company — lavender
  - BAM Competition Company — black/gold
- Jacket sold in youth S/M/L/XL through merchandise module
- Student name customization available (fundraiser opportunity)

### Teacher Awarding Workflow
1. Teacher completes class session and submits attendance
2. System surfaces "Badge Opportunities" — students who meet criteria
3. Teacher taps to award or defer each suggested badge
4. Teacher can manually nominate for subjective badges (Artistry, Leadership)
5. Student and parent notified immediately; signage updates; patch queue updates

---

## M3 — Session & Scheduling System

### Session Types

| Session Type | Description | Max Students | Pay Model | Attendance Mode |
|-------------|-------------|--------------|-----------|-----------------|
| Regular Class | Scheduled recurring weekly class | 10 (BAM standard) | Class rate | Pre-filled enrollment roster |
| Private Lesson | 1-on-1 or small group (2–3) | 1–3 | Private rate / session | Manual — teacher confirms |
| Performance Rehearsal | Rehearsal for a scheduled production | Cast-defined | Rehearsal rate | Cast attendance |
| Competition Rehearsal | Rehearsal for a specific competition routine | Routine-defined | Comp coaching rate | Routine attendance |
| Competition Coaching | Pre-competition polish session | 1–4 | Private rate | Manual |
| Masterclass / Workshop | Special event — guest teacher or themed | Configurable | Event rate | Separate event attendance |
| Summer Intensive / Camp | Multi-day grouped series | Program-defined | Program rate | Daily attendance |
| Audition Session | Tryout for production or competition company | Open | Admin rate | Records result |
| Sub Class | Another teacher covering a class | Same as class | Sub rate | Logs sub teacher |

### Production & Rehearsal Management
Each major production (Nutcracker, spring recital) is a first-class object with:
- Production record: name, dates, venue, director, roles
- Cast list: assign students to roles (one student can hold multiple roles)
- Rehearsal generator: bulk-create schedule from template
- Call time manager: per-scene call times — students only get calls for their roles
- Attendance tracking: absence from rehearsal auto-flagged
- Costume assignment: link student/role to costume size and vendor
- Performance program: auto-generated PDF from cast data
- Production archive: photos, videos, cast lists saved permanently

### Competition Tracking
- Competition record: event name, date, location, entry fees, travel details
- Routine records: routine name, style, students, costumes
- Rehearsal linking: competition rehearsals linked to routine and teacher pay logging
- Result entry: admin logs placement, scores, awards — auto-triggers badge awards
- Competition calendar: all upcoming competitions with prep deadlines
- Parent communication: auto-send competition day instructions to participating families

### AI Attendance System

**Phase 1 (now):** Schedule pre-fill
- Enrolled students default to Present
- Teacher marks absences only
- After 3 consecutive absences → teacher receives at-risk flag

**Phase 2:** QR code check-in
- Student/parent taps QR code at studio entrance
- System marks present instantly
- Takes 2 seconds per student
- No privacy complexity — works perfectly for ages 3–12 with parent at drop-off

**Phase 3 (future):** Camera + AI facial recognition
- Fixed tablet or camera at entrance
- AWS Rekognition, Google Cloud Vision, or Azure Face API
- Reference photo collected at enrollment (parental biometric consent required — California CPPA)
- Frame discarded after recognition — no video stored
- Students not recognized appear as "Unconfirmed" — teacher resolves manually

---

## M4 — Teacher Management

### Pay Rate Categories

| Category | Description | Logged By |
|----------|-------------|-----------|
| Class Teaching | Regular weekly group class — standard rate | Auto from scheduled class |
| Private Lesson | 1-on-1 or small group — higher rate | Teacher confirms at session |
| Competition Rehearsal | Coaching competitive routine | Auto from session type |
| Performance Rehearsal | Directing or supporting production rehearsal | Auto from session type |
| Competition Coaching | Pre-competition polish | Teacher logs manually |
| Administrative Work | Curriculum planning, parent communication, meetings | Teacher logs manually with description |
| Masterclass / Guest Teaching | Special event — flat fee or hourly | Admin creates, teacher confirms |
| Sub Teaching | Covering another teacher's class | Admin assigns, teacher confirms |
| Travel / Competition Chaperone | Accompanying students to competition | Admin records |

### Hour Logging Workflow
1. Scheduled sessions auto-populate — teacher confirms or flags discrepancy
2. Manual log for admin/coaching — date, category, description, duration
3. Private lesson — teacher taps "Complete" → auto-links to student profile
4. Pay period summary — hours by category with applicable rate and total owed
5. Admin approval workflow — review, approve, or flag for discussion
6. Pay stub export — printable/email with category breakdown

### Teacher Onboarding Modules
1. BAM Teaching Philosophy — Amanda's approach to classical ballet education
2. Classroom Management — age-appropriate techniques for ages 3–5 and 6–12
3. Child Safety — mandated reporter obligations (California law), incident logging
4. The Student Experience — building confidence, correcting without shaming
5. Studio Systems — how to use the platform
6. Studio Policies — dress code, lateness, parent communication protocols

Completion logged on teacher profile — admin can see which new hires have finished before their first class.

---

## M5 — Sub-Brand Architecture

### Default Program Structure

| Program | Working Name | Palette | Billing |
|---------|-------------|---------|---------|
| All students | Ballet Academy and Movement | Lavender/Cream/Gold | Standard tuition |
| Recreational | BAM Recreational / BAM Petite | Soft blue accent | Monthly — lower rate |
| Performance | BAM Performance Company | Lavender (primary) | Tuition + performance fee |
| Competition | BAM Competition Company | Black/Gold | Higher tuition + comp fees |

### How Sub-Brands Work
- Each sub-brand is a program record with its own name, logo/badge, palette, description
- Students are enrolled in a program — one student can be in any or all three simultaneously
- Communications scoped to a program — "email all Competition Company families" without building a list
- Digital signage can show program-specific content
- Class schedule filters by program — parents see only relevant classes
- Billing is per-program — combined invoice with program breakdown
- Badge jackets are program-specific — each has own color and badge set
- Expansion-ready: adding Location 2 or a new program is a new record, no structural change

### Future: Location Sub-Brands
When BAM opens Location 2 (Ladera Ranch, Rancho Mission Viejo, or San Juan Capistrano):
- Second location added as a sub-brand/location record — not a separate platform instance
- Families at Location 2 see BAM brand with location tag
- Admin manages both locations from one dashboard
- Shared teachers assigned across locations with accurate per-location pay tracking

---

## M6 — Student & Family Profiles

### Student Profile Data Model
- **Core:** Name, DOB, age, photo, emergency contacts
- **Programs:** Enrolled programs + classes
- **Attendance:** Running history across all session types
- **Skills:** Logged progressions by teacher, per class
- **Badges:** Full badge history with dates and awarding teacher
- **Notes:** Teacher notes (admin-visible), parent notes
- **Medical:** Allergies, physician contact, restrictions
- **Billing:** Account status, payment history, open balances
- **Costumes:** Measurements, assignments per production
- **Competition:** All competition entries and results

### Authorized Viewer System

| Role | Access Level |
|------|-------------|
| Primary Guardian | Full access: billing, enrollment, all communications |
| Secondary Guardian | Full access except billing changes and enrollment modifications |
| Authorized Family | Live-viewing access + pickup authorization only |
| Emergency Contact | No platform access — phone/address for emergencies only |

- Authorized viewers added by name, relationship label (Grandma, Uncle, Family Friend), and contact
- Named invite sent to authorized viewer with their specific access scope
- Parent can modify or revoke access at any time
- When class or performance goes live → all authorized viewers receive push notification with one-tap join

---

## M7 — Registration & Enrollment

### Class Discovery Flow
1. Parent enters child's age on website
2. System returns recommended classes with: day/time, teacher, open spots, description, price
3. Parent selects class → sees "Request a Trial Class" or "Enroll Now"
4. Trial path: name, age, contact — done. Staff notified.
5. Enroll path: create account, confirm student info, sign digital waiver, pay first month — done

### Multi-Program Enrollment
- One login for the family regardless of programs or classes
- Adding a second program: select → confirm billing → done
- System warns on scheduling conflicts
- Admin receives enrollment notification — approve (auditioned) or auto-confirm (open)

### Waitlist Management
- Full class → parent offered waitlist spot with one tap
- Spot opens → waitlist auto-notified in order
- Waitlist data visible to admin — signal to open a second section
- Full program waitlist functions as priority list for next audition cycle

---

## M8 — Reporting & Intelligence

### Key Metrics
| Metric | Update |
|--------|--------|
| Total Active Students | Real-time |
| Enrollment by Program (Recreational / Performance / Competition) | Daily |
| Class Capacity Utilization | Real-time |
| Waitlist Pressure per Class | Real-time |
| Attendance Rate (weekly avg) | Weekly |
| At-Risk Students (3+ consecutive absences) | Daily |
| Revenue by Program (MRR + trend) | Monthly |
| Teacher Hours by Category | Per pay period |
| Badge Activity | Monthly |
| Trial Conversion Rate | Monthly |

### AI Intelligence Features
- **Churn Prediction:** Flag students likely to drop based on attendance decline and billing friction
- **Class Recommendation Engine:** Recommend the right class for a new student based on age and experience
- **Enrollment Forecast:** Project enrollment 3 months out to help plan staffing and capacity
- **Smart Scheduling:** Suggest optimal class times based on enrollment demand data
- **Teacher Insight:** Surface patterns in badge awarding frequency and class retention rates
- **Revenue Optimization:** Flag underpriced privates and under-enrolled classes

---

## M9 — Physical Merchandise

- **Badge Jackets:** Per-program jackets, tracked by student, size, and patch status
- **Costume Management:** Per-production assignments, measurements, fittings, vendor orders
- **Sugar Plum Shop POS:** Nutcracker-era concessions and souvenir sales (already built in dashboard)
- **Studio Merchandise:** BAM-branded gear (bags, bottles, leotards) — inventory tracked
- **Online Shop:** Parents order from family app — pickup at studio
- **Patch Orders:** System generates batch orders based on badge queue
- **Fundraiser Sales:** Nutcracker programs, photos, flowers — inventory and revenue tracked
- **Tax Reporting:** California sales tax tracked on physical goods

---

## Build Priority

| Priority | Feature | Module | Complexity | Timeline |
|----------|---------|--------|------------|----------|
| P0 — This week | Attendance pre-fill (schedule-based) | M3 | Low | Immediate |
| P0 — This week | San Clemente SEO landing page | — | Low | Immediate |
| P1 — Month 1 | Teacher hour logging by category | M4 | Medium | Month 1 |
| P1 — Month 1 | Session type setup (privates, comp, performance rehearsals) | M3 | Medium | Month 1 |
| P1 — Month 1 | Sub-brand program records | M5 | Medium | Month 1 |
| P1 — Month 1–2 | Badge system (digital + teacher awarding) | M2 | Medium | Month 1–2 |
| P2 — Month 2 | Digital signage feed | M1 | Low | Month 2 |
| P2 — Month 2 | QR code check-in | M3 | Low-Med | Month 2 |
| P2 — Month 2–3 | Unified communications inbox | M1 | High | Month 2–3 |
| P3 — Month 3–4 | Badge jacket / patch order system | M2/M9 | Medium | Month 4 |
| P3 — Month 4–5 | Production management (Nutcracker prep) | M3 | High | By Aug 2026 |
| P3 — Month 4–5 | AI class recommendation chatbot | M7 | High | Month 4–5 |
| P4 — Month 5–9 | Parent live-viewing MVP (Nutcracker 2026) | M6 | High | Oct 2026 |
| P4 — Month 6 | Authorized family member access | M6 | Medium | Month 6 |
| P4 — Month 9+ | White-label beta program | — | High | Month 9+ |

---

*Last updated: March 2026*


---

## M10 — Group Communication & Social Feed

### Vision
Replace BAND entirely. Teachers and admins post to scoped groups; families see a clean feed of everything relevant to their child's programs. Multiple teachers can schedule and share events independently. Room management is built in.

### What BAND Currently Does (must fully replicate)
Based on current studio usage:
- **BAM PRIVATES group** — 80 members; all private lesson teachers and enrolled families
- **Teachers create events** independently (Coach Pie, Lauryn Rowe, Cara Matchett, Deborah Fauerbach all posting)
- **Recurring events** — "alternating weeks" and "reoccurring" sessions visible on shared calendar
- **Room assignment** — Studio 2, Studio 3 embedded in event records
- **Notifications feed** — scoped by group, filterable by type (events, posts, tagged)
- **Group chat rooms** — private and public options within a group
- **Calendar view** — monthly + list view of all upcoming events across groups

### Group Architecture
| Group | Members | Scope |
|-------|---------|-------|
| BAM All Families | All enrolled families | General announcements, newsletter posts |
| BAM Privates | All private lesson teachers + their students' families | Private scheduling, room assignments |
| BAM Performance Company | Performance program students + families + teachers | Production updates, rehearsal schedule |
| BAM Competition Company | Competition team + families + coaches | Competition schedule, results, travel info |
| BAM Staff | All teachers + admin only | Internal scheduling, sub requests, pay info |
| [Production name] | Cast + families for a specific production | Nutcracker-specific, spring show-specific |

### Feed & Post Types
- **Event post** — teacher creates a session (private, rehearsal, etc.) → appears on group calendar + feed + family notification
- **Announcement post** — admin or teacher posts text/image to group feed
- **Poll** — quick parent poll (e.g., "Which performance time works for you?")
- **File/document** — share PDFs (rehearsal schedule, costume list, competition itinerary)
- **Photo/video post** — teacher shares a class moment (opt-in only, under-13 privacy controls)

### Event Creation by Teachers
- Any teacher can create an event in their assigned groups
- Event fields: title, session type, date/time, duration, room/studio, recurrence rule, students involved, notes
- Room management: Studio 1, Studio 2, Studio 3 — admin sets available rooms, system prevents double-booking
- Recurring events: daily, weekly, alternating weeks, custom pattern
- Event visible immediately to relevant group members + generates push notification

### Chat Rooms
- Each group has a default group chat (equivalent to BAND's default chat room)
- Teachers can create private chat rooms within a group (e.g., 1:1 with a specific family)
- Public and private room options
- All chat history searchable by admin
- No external app required — all within the BAM platform or family app

### Notifications
- Filterable by: New Events, Announcements, Tagged, Activity
- Per-group notification settings (families can mute a group without leaving it)
- Admin can send urgent broadcast to all groups simultaneously

---

## M11 — Performance Events & Ticketing

### Vision
Replace TutuTix entirely. Own the ticketing layer so BAM keeps the fee revenue (currently 5% + $1/ticket goes to TutuTix), and connect ticket purchase directly to concession/gift shop pre-orders at checkout. One platform from "buy your ticket" to "order your flowers and program" to "scan at the door."

### TutuTix Features to Replicate
| Feature | TutuTix | BAM Platform |
|---------|---------|--------------|
| Reserved seating | ✓ Staff build chart | ✓ Admin builds chart, parents click-and-pick |
| General admission | ✓ | ✓ |
| Hybrid (reserved + GA) | ✓ | ✓ |
| Digital ticket delivery | ✓ | ✓ via app + email |
| QR door scanning | ✓ iPhone/iPad app | ✓ built into staff app |
| Keepsake/printed tickets | ✓ foil-embossed (fee) | ✓ branded BAM keepsake (sold as upsell) |
| Phone/call center ordering | ✓ toll-free | BAM front desk handles via admin portal |
| Weekly payouts | ✓ | ✓ direct deposit |
| Promo codes | ✓ | ✓ |
| Family ticket perks | ✓ | ✓ loyalty integration with badge system |
| Donation collection | ✓ | ✓ |
| Refund control | Studio controls | Studio controls |

### BAM Advantages Over TutuTix
- **Zero external fee** — patrons currently pay $1 + 5% to TutuTix; BAM platform captures this or passes a lower fee
- **Concession/merch pre-order at checkout** — "Add flowers, a program, or a Sugar Plum Shop item to your order"
- **Live stream ticket** — sell a streaming ticket alongside in-person tickets (Nutcracker family viewing)
- **Student name on ticket** — "Clara's Nutcracker — Act I" as a keepsake, not a manual add-on
- **Loyalty integration** — ticket purchases can earn family reward points redeemable in the shop
- **Integrated with production record** — ticket sales link directly to the Nutcracker production record, cast list, and performance program

### Event Ticketing Flow
1. Admin creates a performance event (links to production record)
2. Admin uploads or draws venue seat map (Studio Theatre, local venue, school auditorium)
3. Admin sets: ticket tiers, prices, family allotments (per-dancer limits), sale open date
4. Parents receive notification: "Nutcracker tickets go on sale October 1 at 9am"
5. Parent opens app or website → selects seats → adds concession/merch pre-orders → pays
6. Digital ticket delivered to app + email; keepsake option available at checkout
7. Day of show: staff scans QR codes at door using the staff app
8. Concession/merch pre-orders fulfilled at the Sugar Plum Shop pickup window

### Seat Map & Capacity
- Admin builds seat map using a visual drag-and-drop editor (rows, sections, accessible seats)
- Supports multiple performance dates — separate inventory per show
- Real-time sales dashboard: seats sold, revenue, unsold inventory
- Waitlist for sold-out performances — auto-notify when seats open
- Hold/comp tickets for teachers, sponsors, and staff (tracked separately)

### Concession & Gift Shop Integration at Checkout
When a family completes a ticket purchase, the checkout offers:
- Performance program (printed keepsake — pre-order guarantees availability)
- Flowers/bouquet (pre-ordered for lobby pickup)
- BAM merchandise (Sugar Plum Shop items — available for pickup at show)
- Photo package pre-order (if BAM has a show photographer)
- Donation to BAM scholarship fund

All pre-orders aggregate into a fulfillment list for the Sugar Plum Shop team before the show.

### Revenue Model vs. TutuTix
| Scenario | TutuTix | BAM Platform |
|----------|---------|--------------|
| $20 ticket, 500 sold | Studio gets $10,000; TutuTix gets $1,500 | Studio gets full $10,000 |
| Concession pre-orders | Not available | Additional revenue stream |
| Streaming tickets | Not available | Additional revenue stream |
| Keepsake ticket upsell | $4.50/order to TutuTix | BAM keeps revenue |



---

## Studio Pro Analysis — What Exists, What's Missing

> This section documents what BAM currently uses Studio Pro for, observed from live system screenshots. Use this as the baseline gap analysis for the BAM Platform build.

### What Studio Pro Does Well (keep/replicate)

| Feature | Studio Pro Behavior | BAM Platform Approach |
|---------|--------------------|-----------------------|
| Student profiles | Left nav: Summary, Family Members, Classes, Medical, Notes, Sizes, Absences, Files, Class History, Comm History, Orders, Groups, Skills | Replicate all — add badge history, competition results, program tag |
| Season-based student tabs | Classes 2025/2026, Company 25/26, June 6th Recital, Morning Classes, Summer, Inactive | Replicate with sub-brand program filter |
| Parent portal | Web-based portal: Messages, Register, Pay, Attendance, Calendar, Waivers, Files, Check In | Replicate as modern app — not a legacy web portal |
| Family billing | Per-student balance view, auto-pay enrollment, stop auto-pay through date | Replicate — add per-program billing line |
| Digital waivers | Stored per parent with timestamp, full text, signed at registration | Replicate + expand to program contracts + teacher compliance docs |
| Room assignment | Studio 1, Studio 2, Studio 3 on class records | Replicate — add double-booking prevention |
| Multi-location | 3 BAM locations: Main Studio, San Clemente Community Center, San Juan Hills HS | Replicate — locations as first-class records |
| Class registration (parent view) | Shows class, location/studio, day/time, spots left, tuition — checkbox to enroll | Improve: age-based recommendation first, then filtered list |
| Mass communications | Robo-Mailer, Robo-Dialer, Robo-Texter — segmented by group, location, season, class | Replicate and include SMS cost natively (Studio Pro bills per text separately) |
| Sibling/family linking | Multiple students under one parent; siblings cross-referenced | Replicate |
| Punch cards | Parent portal has Punch section | Replicate for drop-in / trial management |
| Gift codes | Parent portal, admin-side | Replicate |
| Costume sizes | Per-student Sizes section | Replicate — add per-production costume assignment |

### Critical Studio Pro Gaps (BAM Platform must fix)

| Gap | Studio Pro Workaround | BAM Platform Solution |
|-----|----------------------|----------------------|
| No program/sub-brand tagging | Prefix student first name: "Competition- Willow" | True program enrollment records — no name hacks |
| No badge or achievement system | None | Full M2 badge system |
| No group social feed | Teachers use BAND separately | M10 Group Communication |
| No teacher pay category tracking | Manual/external | M4 teacher hour logging by category |
| No production management | Classes named with rehearsal type ("3A/4A Variations and Sylvia rehearsal") | M3 production records and rehearsal management |
| No competition tracking | Manual; classes named "Jazz Comp Rehearsal - Diamonds" | M3 competition records |
| SMS costs extra | "Send Texts And Bill Later" button | Native SMS included in platform cost |
| No digital signage | None | M1 digital signage feed |
| No live streaming | None | M6 parent live-viewing (Nutcracker 2026) |
| No teacher compliance tracking | None | M12 Legal & Compliance |
| No W9/contractor docs for teachers | External | M12 teacher compliance portal |
| No performance ticketing | Uses TutuTix externally | M11 ticketing system |
| No group scheduling (privates) | Uses BAND externally | M10 group communication + M3 private sessions |
| Basic parent portal UI | Dated web interface, separate login friction | Native mobile app — one login, all programs |

### Observed BAM-Specific Data Points

- **3 active locations in Studio Pro:** Ballet Academy & Movement (main), City of San Clemente Community Center, San Juan Hills High School — Dance Studio
- **Active seasons:** Classes 2025/2026, Company 25/26, June 6th Recital, Morning Classes 2026, 2026 Summer
- **Naming convention workaround:** "Competition- Willow" in first name field = student is in competition program. Platform must eliminate this hack.
- **"OPT OUT Sylvia"** notation in class assignments — students opting out of specific rehearsal components. Platform needs a proper opt-out/override field on class enrollment.
- **Contact roles in use:** Parent (primary, auto-pay), Contact (secondary), Parent (secondary), Sibling references
- **Teachers visible in class data:** Amanda Cobb, Samantha "Sam" Weeks, Paola "Pie" Gonzalez, Campbell Castner, Lauryn Rowe, Cara Matchett, Deborah Fauerbach, Coach Pie
- **Studio rooms visible:** Studio 2, Studio 3 (Studio 1 implied)
- **Mass text segmentation available:** Special Groups → All Students/Teachers/Parents, All Teachers; By Location; By Season+Class

---

## M12 — Legal, Waivers & Compliance

### Vision
All legal documents — parent waivers, program contracts, teacher agreements, W9s, policy acknowledgments — managed in one place with digital signatures, timestamp audit trail, and auto-reminders for renewals. Nobody teaches a class or enrolls a student without the right docs on file.

---

### Parent & Family Legal Documents

#### Waiver Types

| Document | Trigger | Renewal |
|----------|---------|---------|
| General Studio Waiver | First enrollment at BAM | Annual |
| Photo & Media Release | First enrollment | Annual |
| Medical Authorization | First enrollment | Annual — requires emergency contacts confirmed |
| Competition Program Contract | Enrolling in Competition Company | Each season |
| Performance Program Contract | Enrolling in Performance Company | Each season |
| Summer Intensive Agreement | Summer program enrollment | Per program |
| Financial Agreement | Any enrollment with tuition | Annual |
| Costume & Uniform Agreement | First Nutcracker or recital enrollment | Per production |

#### How It Works (Parent Side)
1. Parent registers or enrolls in a new program
2. System identifies outstanding required documents for that enrollment
3. Parent presented with documents in sequence at checkout — must complete before enrollment confirms
4. Digital signature captured with timestamp and IP
5. Signed documents stored permanently on family profile (admin view + parent view)
6. Annual renewal: 30-day advance reminder → 7-day reminder → day-of prompt at login
7. If renewal expires: parent can still view content but re-sign is required before next payment cycle
8. Admin view: shows each parent's document status — green (signed), yellow (due within 30 days), red (expired/missing)

#### Program Contracts (Competition & Performance)
These are more detailed than waivers — full contracts with:
- Commitment expectations (attendance, competition travel, rehearsal attendance)
- Financial obligations (competition fees, costume fees, travel costs)
- Withdrawal policy and tuition refund schedule
- Photo/social media policy for competition performances
- Code of conduct
- Parent volunteer expectations (Nutcracker, recital)
Admin can upload custom contract PDF or use the built-in contract template editor.

---

### Teacher & Staff Legal Documents

Studio Pro has zero teacher compliance tracking. Every item below is a BAM Platform gap-fill.

#### Teacher Document Types

| Document | Who | Trigger | Renewal |
|----------|-----|---------|---------|
| W9 (Tax Form) | Independent contractors | Before first paycheck | When tax status changes |
| Independent Contractor Agreement | IC teachers | Before teaching first class | Annual |
| Employee Agreement | W2 employees | Before first shift | As needed |
| Mandated Reporter Acknowledgment | All teaching staff | Before teaching first class | Annual (California law) |
| California Mandated Reporter Training Certificate | All teaching staff | Before teaching first class | Every 2 years |
| Studio Policy Acknowledgment | All staff | Onboarding | Annual |
| Teaching Philosophy Agreement | All teachers | Onboarding | As needed |
| Background Check Authorization | All teaching staff | Hiring | Every 2 years |
| Social Media & Photo Policy | All staff | Onboarding | Annual |
| Emergency Procedures Acknowledgment | All staff | Onboarding | Annual |
| Non-Compete / Confidentiality (if applicable) | Senior staff | Onboarding | As needed |
| Sub Teacher Agreement | Substitute teachers | Before first sub assignment | Annual |

#### W9 Workflow
1. New teacher added to system by admin
2. System immediately flags: "W9 required before this teacher can be paid"
3. Teacher receives email with secure link to W9 upload portal
4. Teacher uploads completed W9 (PDF or image)
5. Admin reviews and marks accepted
6. Pay period processing blocked until W9 is on file
7. Stored securely — encrypted, access-logged

#### Teacher Compliance Portal (Teacher-Facing)
Teachers log in and see their own compliance dashboard:
- Documents required: list with status (Complete / Pending / Expired)
- Tap to upload or digitally sign
- Training modules: list with completion status (from M4 onboarding)
- Upcoming renewals: 30-day advance alerts
- Certificate uploads: California Mandated Reporter training, CPR/first aid if required

#### Admin Compliance Dashboard
- Table of all staff with per-document status
- Filter: show only staff with missing/expired documents
- "Block from schedule" toggle — prevents teacher from being assigned to classes if critical docs are missing
- Batch reminders: one click sends reminder to all teachers with outstanding items
- Audit log: every document view, upload, sign, and expiration recorded with timestamp
- Payroll gate: teacher hour logging exports blocked if W9 missing

---

### Digital Signature System
- All documents signed within the platform (no DocuSign dependency — BAM owns the audit trail)
- Signature captured via: typed name + checkbox consent, or drawn signature on mobile
- Each signature record contains: document version, timestamp, IP address, device type, signer name
- Documents versioned — if BAM updates a waiver, existing signed copies are preserved; all families re-prompted on new version
- PDF export: any signed document can be exported as a signed PDF for legal records

---

### Compliance Reporting
- Admin can export: all signed waivers for a season, all teacher compliance status, renewal due list for next 30/60/90 days
- "Ready to perform" check: before a performance/event, system confirms every performing student's family has signed all required docs
- "Ready to teach" check: before first class of a season, admin can run a report of any teacher with missing critical compliance items


---

## M13 — Media Archive & Photo Distribution

### Vision
Replace Google Photos as the studio's photo management and student distribution system. Every performance photo is automatically sorted by student using facial recognition and delivered to the family app — no manual sorting, no shared Google links, no privacy exposure of one student's photos to another family.

### What Google Photos Does Today (must replicate)
- Production albums: 2025 Nutcracker (339 photos), Spring Showcase (272), Showstoppers, Company Photo Shoot
- Per-student albums auto-populated via Google facial recognition (Alice Lange: 196 items, Ally Loftus: 302 items, etc.)
- Albums shared with individual families via link
- Photographer albums stored separately by contributor (Peyton Komatsu, Gwendolyn, Hannah Sedgwick, etc.)

### BAM Platform Advantages Over Google Photos
- Photos surface directly in the family app on the student's profile — no external link, no separate Google login
- Admin controls visibility — photos not released to families until reviewed
- Photo purchase / print ordering built in (revenue stream)
- Facial recognition consent managed in M12 — biometric data handling is documented and compliant
- No risk of one family accessing another student's photos (Google shared albums can be forwarded)
- Production archive linked directly to the production record in M3

### Photo Workflow

**Upload:**
1. Photographer uploads batch to the platform (web upload or direct camera integration)
2. Photos tagged to a production event (e.g., "2025 Nutcracker — Act I")
3. Admin reviews and approves batch before distribution

**Auto-Sort by Student (Facial Recognition):**
- System runs facial recognition against reference photos on file for each student
- Reference photo collected at enrollment (stored in student profile)
- Each photo matched to one or more students → added to their personal gallery
- Unmatched photos go to "Unsorted" queue for admin manual tagging
- Integration options:
  - **Phase 1:** Google Photos API — surface existing albums in the BAM family app (lower build effort, uses existing facial recognition)
  - **Phase 2:** Native facial recognition — AWS Rekognition or Google Cloud Vision API, photos processed and stored within BAM Platform entirely

**Family Access:**
- Parent opens app → Student profile → Media tab
- Sees: gallery organized by production/event, chronological
- Photos downloadable (full resolution)
- Print ordering available (via print partner API or in-house print store)
- Sharing: family can share individual photos externally — but album access stays private to their account

**Privacy & Compliance:**
- Facial recognition on minors requires explicit biometric consent — separate from general photo release
- "Biometric Data / Facial Recognition Consent" is a required M12 enrollment document before any child's reference photo is processed
- Reference photos stored encrypted, access-logged
- California CPPA compliance: parents can request deletion of biometric data — system purges reference photo and all auto-sort matches
- Photos of unidentified/unmatched students never shown in another student's gallery
- Photographers sign a media usage agreement before uploading to the platform

### Production Archive
Each production record (M3) has a linked media archive:
- All approved photos for that production, organized by act/scene/role
- Accessible to admin permanently
- Studio can share a curated "production gallery" publicly (website embed) without exposing individual student galleries
- Video archive: performance recordings stored and linked to production record (for family viewing — separate from live streaming)

### Photographer Management
- Admin adds photographers as contributors with limited platform access
- Photographer uploads to their assigned production event only
- Admin reviews and approves before photos are distributed to families
- Photographer receives credit on production gallery
- Payment/invoice tracked in M4 (vendor payment) if photographers are paid contractors

### Photo Purchase & Revenue
- Families can purchase: digital download packs, individual prints, photo books, canvas prints
- Print partner integration (e.g., Printful, Mpix API) or in-studio print sales
- Revenue tracked in M9 merchandise module
- "Performance photo package" available as pre-order add-on at ticket checkout (M11)

### Content Moderation
- Admin must approve all photos before family distribution
- "Flag" option: family can flag a photo for removal (e.g., unflattering, wrong student tagged)
- Flagged photos reviewed by admin → removed or re-tagged
- No public posting without admin release (separate from family-private galleries)

---

## Tool Consolidation Summary

The BAM Platform replaces 6 external tools currently in use:

| Tool Replaced | Monthly Cost (est.) | BAM Platform Module |
|--------------|--------------------|--------------------|
| Studio Pro | ~$120–150/mo | M3, M4, M6, M7, M8 |
| BAND | Free (limited) | M10 |
| TutuTix | 5% + $1/ticket (patron fee) | M11 |
| Quo | ~$50–100/mo | M1 |
| Google Sheets (timesheets) | Manual admin time | M4 |
| Google Photos (photo distribution) | ~$10/mo storage | M13 |

**Additional value recovered:**
- Robo-Texter (Studio Pro SMS) — billed per text, not included in Studio Pro subscription
- BAND ads shown to members (free tier limitation)
- TutuTix keepsake ticket fees ($4.50/order to TutuTix)
