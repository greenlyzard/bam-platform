# BAM Platform — Full Competitive Analysis
# docs/COMPETITIVE_ANALYSIS.md
# Platforms: Studio Pro, Jackrabbit Dance, TeamReach, GameChanger

**Purpose:** Define exactly what BAM Platform must do to be better than all four
competitors. Use this as the master feature checklist for the platform roadmap.

---

## Platform Profiles

### Studio Pro (GoStudioPro)
- **Market:** Dance studios, ~6,500 customers
- **Strength:** Comprehensive billing, tuition management, robo-features
- **Weakness:** Outdated UI, no AI, single parent per student, clunky UX
- **Pricing:** Subscription (not public)

### Jackrabbit Dance
- **Market:** Dance studios, 15,000+ locations, 36 countries
- **Strength:** Best-in-class billing, auto-pay, waitlist, QuickBooks integration,
  custom-branded mobile app (Jackrabbit Plus), camps management
- **Weakness:** Per-student pricing model (costs more as you grow), complex to set up,
  no AI, costume checkout not available (only ordering), overwhelming feature set
- **Pricing:** $49/month base, scales with student count. Jackrabbit Plus starts $93/mo.
  Enterprise $245-315/mo.

### TeamReach
- **Market:** General sports teams, 4M+ users
- **Strength:** Free, simple, safe contact-less communication, availability/RSVP,
  polls, photo sharing, schedule with maps and weather
- **Weakness:** NOT a studio management tool — no billing, no enrollment, no
  teacher tools, no attendance, basic messaging only, bugs in attendance/waitlist
- **Pricing:** Free

### GameChanger
- **Market:** Youth sports, 9M+ games/year, 1M+ teams
- **Strength:** Live HD streaming (1080p), auto-generated highlights, athlete profiles,
  advanced stats (150+), AutoStream AI for basketball, RSVP scheduling,
  organization-level announcements, free for coaches
- **Weakness:** NOT a studio management tool — no billing, no enrollment, no tuition.
  Sports-specific (baseball/softball strongest). Fan subscription paywall.
- **Pricing:** Free for coaches. Fan subscription $9.99/mo or $39.99/yr.

---

## Master Feature Matrix

| Feature | Studio Pro | Jackrabbit | TeamReach | GameChanger | BAM Platform |
|---|---|---|---|---|---|
| **STUDENT MANAGEMENT** |||||
| Student profiles | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Multiple guardians per student | ❌ | ✅ | ❌ | ❌ | ✅ Built |
| Structured address + geocoding | ❌ | ❌ | ❌ | ❌ | ✅ Built |
| Media consent tracking | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Student photo/avatar | ✅ | ✅ | ❌ | ✅ | ✅ Built |
| Preferred name | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Costume sizes/measurements | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Extended contacts (grandparents/watchers) | ❌ | ❌ | ❌ | ⚠️ Partial | ✅ Built |
| **ENROLLMENT & REGISTRATION** |||||
| Online registration | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Enrollment quiz / placement | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| Waitlist management | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Trial class booking | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| CSV data import | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Class cart / multi-enroll | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| **BILLING & PAYMENTS** |||||
| Fixed tuition by class | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Fixed tuition by student | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Hourly / class count rates | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Monthly tuition posting | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Auto-pay | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Multi-student discounts | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Registration fees | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Late fees | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Payment terms / early pay | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| QuickBooks integration | ❌ | ✅ | ❌ | ❌ | 🔴 Gap |
| Point of sale | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Online store (merchandise) | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Pass credit card fees to parents | ❌ | ✅ | ❌ | ❌ | 🔴 Gap |
| **SCHEDULING & CLASSES** |||||
| Class schedule management | ✅ | ✅ | ❌ | ❌ | ✅ Built (in progress) |
| Room management | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Multi-room view / room grid | ❌ | ✅ | ❌ | ❌ | ✅ Built |
| Calendar views (week/month/list) | ✅ | ✅ | ✅ | ✅ | ✅ Built |
| ICS calendar subscription | ✅ | ✅ | ✅ | ✅ | ✅ Built |
| Schedule embed on website | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Print weekly schedule | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Private lesson booking | ✅ | ✅ | ❌ | ❌ | ⚠️ Partial |
| Camps management | ❌ | ✅ | ❌ | ❌ | 🔴 Gap |
| Season management | ✅ | ✅ | ❌ | ❌ | ⚠️ Partial |
| **ATTENDANCE** |||||
| Teacher attendance taking | ✅ | ✅ | ❌ | ✅ RSVP | ✅ Built |
| Mobile attendance (teacher app) | ✅ | ✅ | ❌ | ✅ | ✅ Built |
| Attendance history per student | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Attendance rate reporting | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Check-in/check-out (minor safety) | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Overpayment alerts (attendance vs timesheet) | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| Attendance → timesheet link | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| **TEACHER / STAFF TOOLS** |||||
| Teacher profiles | ✅ | ✅ | ❌ | ✅ | ✅ Built |
| Teacher pay rates | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Timesheet logging | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Payroll report | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Substitute management | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Teacher mobile app (Class Manager) | ✅ | ✅ | ❌ | ✅ | ⚠️ Partial |
| Lesson plans | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Teacher contact firewall | ❌ | ❌ | ✅ | ✅ | ✅ BAM Exclusive |
| **COMMUNICATIONS** |||||
| Group messaging (class groups) | ⚠️ Basic | ✅ | ✅ | ✅ | ✅ Built |
| Direct messaging | ❌ | ✅ | ❌ | ✅ | ✅ Built |
| Real-time chat | ❌ | ❌ | ✅ | ✅ | ✅ Built |
| Message board / posts | ✅ Bulletin | ✅ | ❌ | ❌ | ✅ Built |
| Studio-wide announcements | ✅ | ✅ | ✅ | ✅ | ✅ Built |
| Email blasts | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| SMS / text messaging | ✅ Robo | ✅ | ✅ | ❌ | ✅ Built (Quo) |
| Automated reminders | ✅ | ✅ | ✅ | ✅ | ⚠️ Partial |
| Personalized weekly digest | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| RSVP / availability | ❌ | ❌ | ✅ | ✅ | 🔴 Gap |
| Polls | ❌ | ❌ | ✅ | ✅ | 🔴 Gap |
| Photo sharing | ✅ | ✅ | ✅ | ✅ | 🔴 Gap |
| Safe messaging (no contact exchange) | ❌ | ❌ | ✅ | ✅ | ✅ Built |
| **LIVE STREAMING & VIDEO** |||||
| Live class/rehearsal streaming | ❌ | ❌ | ❌ | ✅ HD | 🔴 Gap (Phase 3) |
| Recorded class archive | ❌ | ❌ | ❌ | ✅ | 🔴 Gap (Phase 3) |
| Auto highlight clips | ❌ | ❌ | ❌ | ✅ | 🔴 Gap (Phase 3) |
| Grandparent/fan streaming access | ❌ | ❌ | ❌ | ✅ | 🔴 Gap (Phase 3) |
| **PRODUCTIONS & PERFORMANCES** |||||
| Production/recital management | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Casting / role assignment | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| Rehearsal scheduling | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Ticket sales | ✅ | ✅ | ❌ | ❌ | ⚠️ Stub |
| Costume management | ✅ | ✅ | ❌ | ❌ | ⚠️ Partial |
| Recital wizard / playbook | ✅ | ✅ | ❌ | ❌ | 🔴 Gap |
| Volunteer management | ✅ | ❌ | ❌ | ❌ | 🔴 Gap |
| **AI & INTELLIGENCE** |||||
| AI chatbot (public-facing) | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| AI admin consultation | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| AI email drafting | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| AI class recommendations | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| AI lineup / coaching insights | ❌ | ❌ | ❌ | ✅ | ❌ Not applicable |
| Geographic optimization | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| **REPORTING & ANALYTICS** |||||
| Enrollment reports | ✅ | ✅ | ❌ | ❌ | ⚠️ Basic |
| Revenue / billing reports | ✅ | ✅ | ❌ | ❌ | ⚠️ Basic |
| Attendance analytics | ✅ | ✅ | ❌ | ✅ | ✅ Built |
| Teacher payroll report | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Business intelligence dashboard | ❌ | ✅ Enterprise | ❌ | ❌ | 🔴 Gap |
| Student progress tracking | ✅ | ✅ | ❌ | ✅ Stats | ⚠️ Basic |
| Geographic / demographic reports | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| **PLATFORM & INFRASTRUCTURE** |||||
| Mobile app (iOS + Android) | ✅ | ✅ Plus | ✅ | ✅ | 🔴 Gap (Phase 3) |
| Custom-branded mobile app | ❌ | ✅ Plus | ❌ | ❌ | 🔴 Gap (Phase 3) |
| Multi-location management | ❌ | ✅ Enterprise | ❌ | ✅ | ✅ Built (white-label) |
| White-label SaaS | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| WordPress embed widget | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Help center / knowledge base | ✅ | ✅ | ❌ | ✅ | 🔴 Gap |
| **COMPLIANCE & SAFETY** |||||
| Mandated reporter compliance | ❌ | ❌ | ❌ | ❌ | ✅ BAM Exclusive |
| Minor check-in/check-out safety | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Emergency roster export | ✅ | ✅ | ❌ | ❌ | ✅ Built |
| Photo/media consent tracking | ✅ | ✅ | ❌ | ❌ | ✅ Built |

---

## Attendance Module — Critical Priority

Derek flagged this as critical because it ties directly to timesheets.
Here's what each competitor does and what BAM needs:

### What Studio Pro does:
- Teacher takes attendance per class per day
- Absent/present/excused statuses
- Parents can see attendance history
- No link to timesheets or payroll

### What Jackrabbit does:
- Full attendance management
- Teacher mobile attendance via Class Manager app
- Attendance history and reports
- No link to timesheets

### What BAM does (built):
- Sessions table with attendance records
- Teacher mobile check-in
- present/absent/excused/late/makeup/trial statuses
- Attendance history per student
- **Overpayment alert system** — cross-references teacher timesheets against actual sessions held
- If teacher logs hours for a cancelled class → FLAG
- If teacher logs hours but zero attendance → WARNING
- If hours exceed session duration → WARNING

### What BAM still needs for attendance:
1. **Attendance → timesheet auto-prompt** — when a teacher takes attendance, system should suggest "Log hours for this session?" with pre-filled class, date, and duration. One tap to log. This closes the loop.
2. **Daily attendance summary to admin** — each morning, admin sees yesterday's attendance summary: which classes ran, which were cancelled, which teachers logged hours vs didn't
3. **Parent notification on check-in** — "Emma has checked in to Ballet II at 4:00 PM" push notification
4. **Late pickup alert** — if class ends and student not checked out within 10 minutes, admin gets alert
5. **Makeup class tracking** — when a student misses class, system tracks makeup eligibility and shows available makeup slots

---

## Attendance → Timesheet Link (Claude Code Prompt)

This is the critical feature Derek referenced. Add to Claude Code:

```
Read CLAUDE.md and docs/ATTENDANCE.md. Build the attendance-to-timesheet bridge:

1. After a teacher submits attendance for a session, show a prompt:
   "Log hours for this session?"
   Pre-filled: teacher, class name, date, start_time, end_time from session record.
   Hours auto-calculated from session duration.
   Teacher can review and tap "Log Hours" or "Skip".
   If confirmed, creates a timesheet_entry and navigates to the timesheet.

2. In the admin attendance overview, add a column "Hours Logged" next to each session.
   Green checkmark if a timesheet entry exists for that teacher + class + date.
   Red warning if no timesheet entry found (possible missed logging).

3. Add a daily attendance summary email sent to admin at 9am each morning:
   - Yesterday's sessions: class name, teacher, enrolled count, attended count
   - Sessions where no attendance was taken (flagged)
   - Sessions where no timesheet hours were logged (flagged)
   - Sent via Resend with reply-to dance@bamsocal.com
   - Only send if there were sessions yesterday

4. Parent check-in notification: when a student is marked present,
   send an in-app notification to all guardians (via student_guardians table)
   where portal_access = true: "Emma has checked in to Ballet II at 4:00 PM"

5. Late pickup alert: at class end_time + 10 minutes, if student is still
   checked in (no checkout recorded), send in-app alert to admin and front desk.

Display names: first_name || ' ' || last_name. Tenant scoping via profile_roles.
```

---

## Key Gaps to Prioritize (Ordered by Revenue Impact)

### Tier 1 — Revenue Blockers (build immediately)
1. Monthly tuition posting
2. Auto-pay (parent saves card, auto-charges monthly)
3. Multi-student / sibling discounts
4. Registration fees
5. Waitlist management with auto-enroll
6. Attendance → timesheet bridge (operational efficiency + accuracy)

### Tier 2 — Competitive Parity
7. Lesson plans (teacher tool)
8. Student costume measurements
9. CSV import from Studio Pro / Jackrabbit
10. RSVP on events (TeamReach / GameChanger parity)
11. Photo sharing in groups (all competitors have this)
12. Polls in group channels
13. Business intelligence dashboard (Jackrabbit Enterprise feature)
14. QuickBooks integration

### Tier 3 — Growth Features
15. Live streaming (class, rehearsal, performance) — GameChanger's killer feature for BAM context
16. Auto-generated highlight clips from performances
17. Custom mobile app (Jackrabbit Plus equivalent)
18. Camps management
19. Volunteer management
20. Online store (merchandise)

---

## Where BAM Platform Wins Outright (No Competitor Has These)

1. **Angelina AI** — conversational AI for parents AND admin consultation mode
2. **Attendance → timesheet cross-check** — overpayment alert system
3. **Multi-guardian with roles** — billing contact, emergency contact, portal access per guardian
4. **Extended contacts (watchers)** — grandparents get live stream notifications without portal login
5. **Geographic optimization** — structured addresses + geocoding for marketing intelligence
6. **Teacher contact firewall** — structural (RLS-level) protection against student poaching
7. **Personalized weekly digest** — per-child, per-student schedule email with calendar links
8. **AI class recommendations** — enrollment quiz + Angelina placement
9. **White-label SaaS** — compete with ALL of these tools as a platform for other studios
10. **Mandated reporter compliance** — legal protection built in
11. **Casting & role assignment** — production management no competitor offers

---

## Competitive Positioning Summary

| Axis | Studio Pro | Jackrabbit | TeamReach | GameChanger | BAM |
|---|---|---|---|---|---|
| Billing power | ★★★★ | ★★★★★ | ❌ | ❌ | ★★ (gaps) |
| Communications | ★★ | ★★★ | ★★★★ | ★★★★ | ★★★★★ |
| AI / Intelligence | ❌ | ❌ | ❌ | ★★ (sports AI) | ★★★★★ |
| Teacher tools | ★★★ | ★★★★ | ❌ | ★★★ | ★★★★ |
| Parent experience | ★★ | ★★★ | ★★★★ | ★★★★★ | ★★★★ |
| Live streaming | ❌ | ❌ | ❌ | ★★★★★ | ❌ (Phase 3) |
| White-label / SaaS | ❌ | ❌ | ❌ | ❌ | ★★★★★ |
| Setup complexity | ★★ easy | ★ complex | ★★★★★ | ★★★★★ | ★★★★ |

---

## Help Center Vision (Better Than All Competitors)

Studio Pro and Jackrabbit have static help docs and video libraries. TeamReach
and GameChanger have basic FAQs. None have AI-powered help.

BAM Help Center differentiators:
- **Angelina answers questions** in context of the current article AND your studio data
- **Role-aware** — parents see parent articles, teachers see teacher articles
- **Live data** — "When is my next class?" answered from real enrollment data
- **Admin authoring** — Amanda can write and publish articles without a developer
- **Video embedded** per article (YouTube/Loom links)
- **White-labeled** for SaaS clients — each studio has their own help center

---

*Last updated: March 2026 | Green Lyzard / Ballet Academy and Movement*
