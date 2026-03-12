# BAM Platform — Current State
_Last updated: 2026-03-11_

---

## Repository
- **GitHub:** github.com/greenlyzard/bam-platform
- **Local:** `/Users/derekshaw/bam-platform`
- **Branch:** main
- **Supabase ref:** niabwaofqsirfsktyyff
- **Vercel team:** Ballet Academy and Movement
- **Dev URL:** localhost:3000
- **Production URL:** portal.balletacademyandmovement.com

---

## Tech Stack
- Next.js 14 + Tailwind + shadcn/ui
- Supabase (auth, database, realtime, RLS)
- Drizzle ORM
- Resend (email)
- Twilio (SMS — planned)
- Klaviyo (marketing automation)
- Stripe (payments — verify existing BAM account with Amanda)
- Vercel Pro

---

## Migrations Applied (15 total)

| # | File | What it creates |
|---|---|---|
| 001 | create_core_tables | classes, students, parents, enrollments, profiles |
| 002 | create_teachers | teachers table |
| 003 | create_lms_tables | LMS/learning content |
| 004 | create_streaming_tables | video/streaming |
| 005 | create_shop_tables | merchandise |
| 006 | create_expansion_tables | multi-location |
| 007 | create_mandated_reporter | safety/compliance |
| 008 | create_triggers | updated_at triggers pattern |
| 009 | enable_rls | RLS enabled globally |
| 010 | create_teacher_hours | teacher hour logging (M4) |
| 011 | create_email_templates | email template system |
| 012 | create_studio_settings | per-tenant config |
| 013 | add_class_catalog_columns_and_seed | class catalog + seed data |
| 014 | create_casting_tables | productions, dances, casting, rehearsals, rehearsal_attendance, schedule_approvers |
| 015 | create_calendar_tables | **NEW** seasons, schedule_templates, schedule_instances, rooms, calendar_subscriptions, schedule_change_requests, approval_tasks, schedule_embeds |

---

## What Was Built This Session

### 1. Enrollment Quiz Rebuild
- 3-branch gating: Myself / My child / Multiple children
- Adult filtering fixed: only `level='open'` AND `age_min >= 14` shown to adults
- Pilates/Gyrotonic shows contact card only (no class results)
- TypeScript fix: replaced string-based level filter with exact field match

### 2. Angelina Rehearsal Tool
- Role-based scoping
- approval_status filter
- Disambiguation for ambiguous queries

### 3. Casting & Rehearsal Tables (Migration 014)
- productions, dances, production_dances, casting
- rehearsals, rehearsal_attendance, schedule_approvers
- Approval workflow at /admin/productions (draft → pending_review → approved → published)

### 4. Auth Flows
- Forgot password flow built
- Reset password flow built

### 5. Calendar & Scheduling Foundation (Migration 015)
- All 8 new tables created with RLS ✓ (verified in Supabase — all rowsecurity = true)
- lib/calendar/types.ts — TypeScript types + enums for all calendar tables
- lib/calendar/queries.ts — 6 query functions matching existing admin.ts patterns
- app/api/admin/schedule-change-requests/route.ts — GET (filtered list) + POST (create request + approval tasks)
- app/api/admin/approval-tasks/[id]/approve/route.ts — approve with field whitelist + sibling task completion
- app/api/admin/approval-tasks/[id]/reject/route.ts — reject + notify requester
- app/(admin)/admin/calendar/page.tsx — week view, pending approvals banner, day sections, color-coded event badges
- components/layouts/admin-nav.tsx — Calendar link added after Seasons in Studio nav group
- Seed data: Spring 2026 season, Studio A (cap 10), Studio B (cap 8), Waiting Area (cap 20)

---

## Security Audit — Session 2026-03-11

### ✅ Verified
- RLS on all 8 new calendar tables (Supabase SQL confirmed — all true)
- Field whitelist on approval/[id]/approve route (8 fields — prevents state injection)
- FKs reference profiles(id) not users(id) — matches existing codebase pattern
- Approval tasks scoped to assigned approver only

### ⚠️ Still To Verify
- `schedule_embeds` RLS: anonymous SELECT should be by token only, not full table scan
- `calendar_subscriptions` token: confirm generated with gen_random_uuid(), not predictable
- Approval task visibility: teachers should never see other teachers' tasks
- Run `npx tsc --noEmit` to confirm TypeScript clean after migration 015

---

## Spec Documents in docs/claude/

| File | Status | Notes |
|---|---|---|
| CLAUDE.md | ✓ Complete | Root project guide |
| SCHEDULING_AND_LMS.md | ✓ Complete | |
| REGISTRATION_AND_ONBOARDING.md | ✓ Complete | |
| CHATBOT_AND_LEAD_CAPTURE.md | ✓ Complete | |
| CASTING_AND_REHEARSAL.md | ✓ Complete | Built in migration 014 |
| ENROLLMENT_QUIZ_SPEC.md | ✓ Complete | Built this session |
| COMMUNICATIONS_AND_STAFF_VISIBILITY.md | ✓ Written | **NOT YET BUILT** — 4 Claude Code prompts ready |
| COMMUNICATIONS_AND_STAFF_VISIBILITY_1.md | ✓ Written | Variant/version |
| LEVEL_SYSTEM.md | ✓ Written | |
| PORTAL_FEATURES.md | ✓ Written | |
| ANGELINA_AND_CLAUDE_API.md | ✓ Written | Angelina chatbot wiring |
| CLASSES.md | ✓ Written | |
| COMPETITION_SEASONS_PRIVATES.md | ✓ Written | Informs calendar private lesson logic |
| CALENDAR_AND_SCHEDULING.md | ✓ Written | **Built in migration 015 (Phase 1 only)** |
| M4_TEACHER_HOUR_LOGGING.md | ✓ Written | Built in migration 010 |

---

## Calendar Module — Build Phases

| Phase | Description | Status |
|---|---|---|
| **1** | Schema + migrations + approval workflow + admin calendar view | ✅ COMPLETE |
| **2** | Schedule widget + embed system + filter UI + print mode | ⏳ NOT STARTED |
| **3** | Notifications + calendar sync (ICS feeds) | ⏳ NOT STARTED |
| **4** | Rooms + private lesson booking + check-in/check-out + accountability | ⏳ NOT STARTED |
| **5** | Trial class lead funnel + Klaviyo integration | ⏳ NOT STARTED |

---

## Pending Items (Priority Order)

### Immediate Next — Calendar Phase 2
Run the Phase 2 Claude Code prompt to build:
- `/widget/schedule/[embed_token]` route
- Admin embed generator at `/admin/schedule-embeds`
- Filter bar (all 8 filters, parent-visible filters controlled by embed config)
- Print mode with color coding + icons
- WordPress iframe embed instructions

### Also Pending
1. **Communications/leads module** — 4 Claude Code prompts in COMMUNICATIONS_AND_STAFF_VISIBILITY.md — HIGH IMPACT for enrollment
2. **Wire Angelina to CLASSES.md + BRAND.md** at filesystem runtime
3. **San Clemente SEO landing page** — `/ballet-classes-san-clemente` in WordPress (Flatsome UX Blocks)
4. **Survey module** — `/admin/surveys`, configurable questions, seasonal promo mode

---

## Pending Credentials / Actions

- ⚠️ **Cloudflare Stream API token + Account ID** — needed for Vercel env vars
- ⚠️ **Verify BAM's existing Stripe account** with Amanda
- ⚠️ **Vercel domain "Invalid Configuration"** — check GoDaddy for conflicting A records on portal/staging subdomains
- ⚠️ **Cancel Weebly** subscription
- ⚠️ **Set up Google Business Profile**
- ⚠️ **Transfer Cloudflare + Stripe** to Amanda eventually (Derek/Green Lyzard holds during dev)

---

## Key Contacts
- **Amanda Cobb** — studio founder, curriculum, marketing execution — amanda.cobb@bamsocal.com
- **Cara** — co-approver for schedule changes (super_admin role)
- **Derek Shaw** — platform owner/builder — derek@greenlyzard.com
- **Studio** — dance@bamsocal.com / (949) 229-0846

## Brand
- Full name: **Ballet Academy and Movement** (never "BAM" publicly — trademark conflict)
- Primary domain: balletacademyandmovement.com
- Legacy redirect: bamsocal.com
- Colors: lavender #9C8BBF, cream #FAF9F7, charcoal #2C2C2C, gold accents
- Typography: Cormorant Garamond (headings), Montserrat (body)
- Aesthetic: minimal luxury ballet studio

---

## How to Resume in a New Session

1. Open this conversation in Claude.ai (Projects — BAM Platform)
2. Paste this file or say "continuing BAM platform — read CURRENT_STATE.md from the repo"
3. Claude will search past chats and have full context
4. State what you just completed and what you want to work on next
