# Student Profile — Spec

**Status:** Pre-spec — ready for implementation  
**Phase:** 3 — Parent & Student Experience  
**Related Modules:** LEVEL_SYSTEM.md, REGISTRATION_AND_ONBOARDING.md, CASTING_AND_REHEARSAL.md, COMPETITION_SEASONS_PRIVATES.md, ATTENDANCE.md, COMMUNICATIONS_PRIVATE_FEED.md

---

## 1. Overview

The student profile is the emotional heart of the parent experience. It surfaces a student's full journey at the studio — classes, levels, badges, performances, competitions, photos, evaluations, and documents — in a visual, gamified format that makes parents proud and keeps them engaged. Profiles are shareable with family members with granular per-relative permission controls.

---

## 2. Profile Sections

| Section | Description | Who Can Edit |
|---|---|---|
| Hero / Headshot | Student name, photo, current level, join date | Admin (photo upload) |
| Biography | Optional free-text bio about the student | Admin |
| Level Progress | Current level + visual progress bar toward next level | Admin assigns level |
| Badges & Achievements | Badge wall — auto-awarded + manually awarded | Auto system + Admin |
| Classes & Skills | Current enrollments + skills being developed | Auto from enrollment |
| Performance History | All productions student has appeared in | Auto from casting |
| Competition Results | Competition entries, awards, placements | Auto from competition module |
| Master Classes | External master classes, workshops attended | Admin |
| School Credentials | Exam results, certifications, school affiliations | Admin |
| Team Placements | Company, competitive team, program assignments | Admin |
| Evaluations | Teacher/admin notes and formal evaluations | Admin only |
| Upcoming Schedule | Next classes, rehearsals, performances | Auto from schedule |
| Photo Gallery | Linked Google Photos album(s) | Admin pastes URL |
| Documents & Waivers | Links to signed waivers, policies, agreements | Auto from documents module |

---

## 3. Hero Section

- Student headshot (uploaded by admin or parent)
- Full name + preferred name
- Current level badge (e.g. "Level 3A") with program type tag (e.g. "Performance Company")
- Years at studio (auto-calculated from enrollment date)
- "Dancer since [year]" display
- If no headshot: elegant placeholder with student initials + program type color

---

## 4. Level System

### How Levels Work
- Studio Admin assigns levels to students manually
- Student sees a visual progress bar showing position within their current level
- Progress bar fills based on: classes attended, skills marked complete, admin-set percentage
- Admin can override the progress percentage at any time
- When admin advances a student to the next level: animated celebration on the profile

### Level Display
- Current level name (e.g. "Level 3A — Beginner Ballet")
- Progress bar: 0–100% toward next level
- Next level name shown as the goal
- History: all past levels shown in a timeline below current level

---

## 5. Badges & Achievements

### Badge Types
| Category | Examples | Award Method |
|---|---|---|
| Attendance | "Perfect Month", "50 Classes", "100 Classes" | Auto |
| Performance | "First Recital", "Lead Role", "5 Productions" | Auto from casting |
| Competition | "First Competition", "Gold Award", "Platinum Award" | Auto from competition |
| Skills | "En Pointe", "First Splits", "Back Walkover" | Admin manual |
| Milestones | "1 Year", "3 Years", "5 Years" | Auto from join date |
| Special | "Most Improved", "Team Player", "Studio Star" | Admin manual |
| Master Class | "Workshop Attendee", "Master Class Grad" | Admin manual |

### Badge Display
- Visual badge wall — grid of earned badges with icons and names
- Unearned badges shown as locked/greyed out (optional — admin can hide unearned)
- Hover/tap a badge: shows description and date earned
- New badge earned: push notification to parent + animation on profile
- Badge count shown in profile header ("12 badges earned")

---

## 6. Photo Gallery

### Google Photos Integration
- Admin pastes a Google Photos shared album URL per student
- Multiple albums supported (e.g. "Recital 2024", "Competition 2025")
- Albums display as thumbnail grids within the profile
- Clicking a photo opens the Google Photos viewer
- Admin can label each album (e.g. "Spring Recital 2025")
- No OAuth required — uses public shared album URLs only
- If album URL is private/broken: shows placeholder with "Photos coming soon"

### BAM-Hosted Photos
- Admin can also upload individual photos directly to BAM (stored in Supabase Storage)
- BAM-hosted photos appear in a separate "Studio Photos" section
- Used for: headshots, competition photos, class photos

---

## 7. Evaluations

### Who Can Write
- Studio Admin only — teachers cannot write evaluations directly
- Admin can attribute an evaluation to a specific teacher ("Notes from Ms. Lauryn")

### Evaluation Types
| Type | Description |
|---|---|
| Formal Evaluation | Structured assessment with skill ratings |
| Progress Note | Freeform note on student progress |
| Goal Setting | Admin sets goals for the student for the season |
| Achievement Note | Celebrating a specific accomplishment |

### Parent View
- Parents see evaluations but cannot edit or respond
- Evaluations marked "private" by admin are not shown to parents
- Formal evaluations shown with skill rating grid
- Progress notes shown as timeline entries

---

## 8. Shareable Public Profile

### Concept
Parent generates a shareable link for a specific relative (grandparent, aunt, etc.). Each relative gets their own customized view based on what the parent has permitted them to see.

### Relative Management
- Parent adds relatives: name, relationship, email (optional)
- Per relative, parent toggles visibility of each section:
  - Bio
  - Level & progress
  - Badges
  - Photo gallery
  - Performance history
  - Competition results
  - Upcoming schedule
- Documents, waivers, evaluations are NEVER shareable — always private
- Each relative gets a unique shareable URL: `portal.bamsocal.com/student/[token]`

### Shared Profile View
- Clean, public-facing design — no admin chrome
- Studio branding (logo, colors)
- Shows only sections the parent has permitted
- "Powered by BAM Platform" footer (tenant-brandable at premium tier)
- No login required for relatives
- Link expires if parent revokes access

### Schema (new tables)
```
student_profile_relatives
  id, student_id, tenant_id, name, relationship, email, share_token, is_active, created_at

student_profile_share_permissions
  id, relative_id, section_key, is_visible
  section_key: bio, level, badges, photos, performances, competitions, schedule
```

---

## 9. Documents & Waivers Section

- Auto-populated from the documents module (waivers, enrollment agreements, policies)
- Shows document name, date signed, and a "View" link
- Unsigned/pending documents shown with a "Action Required" badge
- Policy links (makeup policy, competition policy, etc.) shown as quick links
- This section is parent/admin only — never shared with relatives

---

## 10. Visual Design Principles

- Profile feels like a **sports trading card meets a digital yearbook**
- Large headshot hero section with gradient overlay
- Level badge prominent — color coded by program type
- Badge wall is visually satisfying — icons, colors, animations on hover
- Progress bar uses brand colors with smooth animation on load
- Timeline views for performance history and evaluations
- Mobile-first — parents primarily view on phone
- Dark mode supported (inherits tenant theme)

---

## 11. Admin Profile Management

### Admin View (at /admin/students/[id]/profile)
- All sections visible including private evaluations
- Edit controls per section
- Upload headshot
- Add/edit bio, master classes, credentials, team placements
- Award/revoke manual badges
- Set level and progress percentage
- Add evaluation
- Paste Google Photos album URLs
- View sharing settings (which relatives have access, what they can see)
- Preview public profile as a specific relative

---

## 12. Decisions Log

| # | Decision |
|---|----------|
| 1 | Profile hero: student headshot uploaded by admin or parent |
| 2 | Evaluations: admin only — teachers do not write evaluations directly |
| 3 | Google Photos: paste shared album URL — no OAuth required |
| 4 | Level advancement: admin assigns levels manually; student sees progress bar |
| 5 | Badges: auto-awarded based on milestones + manually awarded by admin |
| 6 | Sharing: custom per-relative permissions — parent controls what each relative sees |
| 7 | Documents/waivers: never shareable with relatives |
| 8 | Gamification: both levels (progress bar) and badges (badge wall) |

---

## 13. Open Questions

- [ ] Should students (age 13+) be able to edit their own bio and upload their own headshot?
- [ ] Should the badge wall show locked/unearned badges, or only earned ones?
- [ ] Should parents receive a push notification when a new evaluation is posted?
- [ ] Should there be a "highlight reel" section linking to purchased performance videos?
- [ ] Should relative share links expire after a set time, or stay active until revoked?
- [ ] Should the public profile support a custom vanity URL (e.g. portal.bamsocal.com/dancer/emma-cobb)?
