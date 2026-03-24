# Private Lesson Feed, Booking & AI Scheduling — Spec

**Status:** Pre-spec — ready for Claude Code implementation  
**Phase:** 3 — Parent & Teacher Experience  
**Related Modules:** COMMUNICATIONS.md, CALENDAR_AND_SCHEDULING.md, RESOURCE_INTELLIGENCE_SPEC.md, TEACHER_TIME_ATTENDANCE.md, COMPETITION_SEASONS_PRIVATES.md, CASTING_AND_REHEARSAL.md

> **Data Model:** Private session schema (rates, discounts, `private_sessions`, `private_session_students`) lives in `COMPETITION_SEASONS_PRIVATES.md`. This file covers the communications, booking UX, AI scheduling, and teacher operations layer only.

---

## 1. Private Lesson Social Feed

### Concept
Parents see activity when students in their child's class or company book private lessons. Creates social proof and FOMO that drives additional bookings — preserves the mechanic that BAND currently creates organically but makes it intentional and integrated into the booking flow.

### Display Options
- Integrated into the main Communications feed
- OR as a dedicated "Privates" channel
- Tenant-configurable — not all studios will want this visible

### Multi-Tenant Configurability (CRITICAL)

| Setting | Description |
|---|---|
| `private_feed_enabled` | Show/hide private lesson activity entirely |
| `private_feed_scope` | `class` (same class only) / `company` (same program) / `studio` (all students) |
| `private_feed_detail` | `name_visible` / `anonymous` ("A student in your class booked a private") |
| `private_feed_channel` | `main_feed` / `dedicated_channel` / `both` |

### Feed Entry (what parents see)
- Student name (if `name_visible`) or anonymous
- Teacher name
- Date/time (optional — configurable)
- No rate, no billing info ever visible in feed

---

## 2. Private Lesson Booking Flow (Parent/Student-Facing)

### Concept
Parents and students can book privates directly from the feed or teacher profiles — but only if the teacher has published availability. Booking triggers billing automatically via the schema in COMPETITION_SEASONS_PRIVATES.md.

### Booking Rules
- Teacher must opt in and set available time slots
- Admin can restrict which teachers are visible to which students (pairing controls)
- Admin can restrict which teachers accept bookings from which families
- Booking creates a `private_session` record automatically
- Stripe charge initiated at booking or at session confirmation (tenant-configurable)
- Price calculated using `computePrivatePrice()` from COMPETITION_SEASONS_PRIVATES.md

### Pairing Controls (Admin-managed)

| Control | Description |
|---|---|
| `allowed_pairings` | Whitelist: teacher X can only be booked by students in Y program |
| `blocked_pairings` | Blacklist: teacher X cannot be booked by student Y |
| `admin_approval_required` | Booking requests go to admin before confirmed |
| Reason never exposed to parent | Admin blocks are silent — parent just sees "unavailable" |

---

## 3. AI Scheduling — Role-Based Behavior

### Parent/Student View
- See teacher availability, suggest times, complete booking
- Never expose admin pairing restrictions — blocked teachers show as unavailable
- Simplified language, no operational detail
- Example: "Angelina, book a private with Lauryn next week" → shows available slots → confirms booking

### Teacher View
- Show their own schedule gaps and revenue optimization
- "Angelina, when am I free this week for privates?"
- "Angelina, how can I maximize my hours this week?"
- Revenue projection: "If you fill your Thursday gap, you earn an extra $X"
- Availability publishing: "Angelina, open Tuesday 4–6pm for private bookings"

### Admin View
- Full resource visibility across all teachers and rooms
- Conflict resolution and override
- Pairing management
- "Angelina, who has availability Thursday afternoon?"
- "Angelina, find a room and teacher for a makeup private for [student]"

---

## 4. Resource Scheduling

### Problem
Studio rooms and equipment are finite. Private lessons, rehearsals, classes, and competitions all compete for the same spaces. Currently managed manually via BAND events.

### Requirements
- Rooms defined per tenant (Studio 1, Studio 2, etc.)
- Equipment defined per tenant (sound system, props, etc.)
- Each scheduled event (class, private, rehearsal) claims a resource
- Conflicts flagged in real time when booking
- AI suggests optimal slots based on full resource picture

### Resource Types

| Type | Examples |
|---|---|
| Room | Studio 1, Studio 2, Lobby, Green Room |
| Equipment | Sound system, Marley floor, Portable barres, Props |
| Staff | Teacher availability (pulled from schedule) |

### AI Resource Logic
- Knows current resource availability across all event types
- Suggests optimal time slots for privates based on room availability, teacher availability, student's existing class schedule, buffer time between bookings
- Finance Admin / Studio Manager can override AI suggestions
- AI explains reasoning: "Studio 2 is free 4–5pm; Lauryn has no conflict"
- Resource conflicts: configurable as hard-block or warning (tenant setting)

### Integration Points
- TEACHER_TIME_ATTENDANCE.md — private entries claim a room
- CALENDAR_AND_SCHEDULING.md — all events claim resources
- CASTING_AND_REHEARSAL.md — rehearsals claim rooms
- COMPETITION_SEASONS_PRIVATES.md — competition prep claims rooms

---

## 5. Angelina — Teacher Operations Assistant

### Core Capability
Teachers talk to Angelina in natural language to handle operational tasks mid-stream. Designed for on-the-go use — teacher walks out of class and dictates notes via voice or text.

### Supported Actions

| Action | Example Prompt |
|---|---|
| Add music to a class/private/rehearsal | "Angelina, add this Google Drive link to my Tuesday pointe class music" |
| Add costume notes | "Angelina, note that Level 3 girls need black skirts for Sylvia Act 2" |
| Add notes for other teachers | "Angelina, leave a note for Cara that Emma needs extra barre work" |
| Capture improvement notes | "Angelina, remember to work on port de bras with the company next week" |
| Log a private session | "Angelina, I just finished a private with Morgan and Izzy, split billing between their families" |
| Check schedule | "Angelina, what do I have tomorrow?" |
| Publish availability | "Angelina, I'm available for privates Saturday 10am to 1pm" |

### Stream of Consciousness Note Capture
- Teacher speaks or types freely
- Angelina extracts structured data (student name, class, improvement area, action item)
- Routes to correct module: casting notes, attendance notes, curriculum notes, or general log
- Teacher reviews and confirms before saving
- Example: "You mentioned Emma needs barre work — should I add this to her student profile, your class notes, or both?"

### Music & Resource Linking
- Teacher pastes Google Drive / Spotify / YouTube link
- Angelina tags it to the correct class, rehearsal, or production
- Stored in CASTING_AND_REHEARSAL.md resource store
- Admin and other teachers can access

### Costume Notes
- Angelina captures costume requirements per student per production
- Feeds into PERFORMANCE_COMPETITION_COSTS.md costume tracking
- Tags by size, color, vendor, status (ordered/arrived/fitted)
- Can sync with vendor order portals (Weissman, etc.) — future phase

---

## 6. Open Questions

- [ ] Should Angelina note capture require teacher confirmation before saving, or auto-save with edit option?
- [ ] For music links — does BAM have a Spotify or Apple Music account for class playlists?
- [ ] Should costume notes sync with an external vendor portal (e.g. Weissman)?
- [ ] Is room/equipment inventory managed per season or persistent year-over-year?
- [ ] Should resource conflicts hard-block booking or just warn? (Recommend: tenant-configurable)
- [ ] Should the private lesson feed be opt-in per parent, or opt-out?
- [ ] For teacher availability — does the teacher set recurring windows or ad hoc slots?
