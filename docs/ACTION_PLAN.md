# BAM Platform — Action Plan & Team Assignment System

## How to Use This Document

Each action item has:
- **Owner** — who executes it
- **AI-Assist** — what Claude can do autonomously
- **Timeline** — when to complete
- **Status** — track progress

---

## Sprint 1: Foundation (Now — 30 Days)

### Technical Infrastructure

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| Resolve Vercel DNS (check GoDaddy for conflicting A records on portal/staging) | Derek | None | Day 1 |
| Verify BAM Stripe credentials with Amanda | Derek + Amanda | None | Day 1 |
| Get Cloudflare Stream API token + Account ID | Derek | None | Day 1 |
| Add Cloudflare + Stripe env vars to Vercel | Derek | None | Day 2 |
| Install Supabase packages in Next.js repo | Claude Code | Fully autonomous | Day 2 |
| Install Resend + React Email packages | Claude Code | Fully autonomous | Day 2 |
| Create initial Supabase migrations (all tables from DATA_MODEL.md) | Claude Code | Fully autonomous | Day 3-4 |
| Set up Supabase Auth with magic link + Google OAuth | Claude Code | Fully autonomous | Day 4-5 |
| Build middleware for role-based route protection | Claude Code | Fully autonomous | Day 5 |

---

### SEO Foundation

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| Set up Google Search Console for balletacademyandmovement.com | Derek | Guide setup | Day 1 |
| Set up Google Analytics 4 | Derek | Generate tracking code | Day 1 |
| Create Google Business Profile (if not done) | Derek/Amanda | Write bio + description | Day 2 |
| Optimize existing Yelp listing | Derek/Amanda | Write copy | Day 3 |
| Build San Clemente SEO landing page | Claude Code | Fully autonomous | Day 5-7 |
| Build Laguna Niguel SEO landing page | Claude Code | Fully autonomous | Day 7-9 |
| Build Dana Point SEO landing page | Claude Code | Fully autonomous | Day 9-11 |

---

## Sprint 2: Parent Portal MVP (30-60 Days)

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| Parent auth flow (magic link login) | Claude Code | Fully autonomous | Week 5 |
| Student profile creation | Claude Code | Fully autonomous | Week 5 |
| **Student health records form (parent self-serve)** | Claude Code | Fully autonomous | Week 5 |
| Class enrollment flow | Claude Code | Fully autonomous | Week 6 |
| Class schedule view | Claude Code | Fully autonomous | Week 6 |
| Payment history view (Stripe integration) | Claude Code | Fully autonomous | Week 7 |
| Push notification setup | Claude Code | Fully autonomous | Week 7 |
| Trial class booking flow | Claude Code | Fully autonomous | Week 8 |

---

## Sprint 3: Teacher Portal MVP (60-90 Days)

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| Teacher auth + class assignment | Claude Code | Fully autonomous | Week 9 |
| Attendance tracking UI | Claude Code | Fully autonomous | Week 9 |
| **Session progress notes on attendance records** | Claude Code | Fully autonomous | Week 9 |
| Student roster with photos, allergen flags, notes | Claude Code | Fully autonomous | Week 10 |
| Basic streaming integration (Cloudflare) | Claude Code | Fully autonomous | Week 10-11 |
| Family access streaming permissions | Claude Code | Fully autonomous | Week 11 |
| Parent messaging from teacher portal | Claude Code | Fully autonomous | Week 12 |
| **Staff Resource Library — seed folders + upload UI** | Claude Code | Fully autonomous | Week 12 |

---

## Sprint 4: LMS Foundation (90-120 Days)

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| TikTok-style swipe feed (student view) | Claude Code | Fully autonomous | Week 13-14 |
| Video upload for teachers | Claude Code | Fully autonomous | Week 14 |
| Badge system + awarding UI | Claude Code | Fully autonomous | Week 15 |
| Constellation progress visualization | Claude Code | Fully autonomous | Week 15-16 |
| Parent LMS view (progress, milestones) | Claude Code | Fully autonomous | Week 16 |
| Age-gated content routing | Claude Code | Fully autonomous | Week 16 |

---

## Backlog — DMP Competitive Gap Items (Prioritized)

These items were identified via competitive analysis of Dance Master Pro (April 2026). They are not on the current sprint plan but should be scheduled once core modules are stable.

### P0 — Safety & Liability (Schedule Immediately)

| Task | Priority | Owner | Notes |
|---|---|---|---|
| Student health records module (`student_health_records` table + admin UI + parent portal form) | **P0** | Claude Code | Schema in STUDENT_PROFILE.md. Allergen badge on teacher roster. Enrollment gate option. |

---

### P1 — Revenue Protection (Schedule After Core Portal is Live)

| Task | Priority | Owner | Notes |
|---|---|---|---|
| Angelina `retention_risk_scan` cron + dashboard card | P1 | Claude Code | Schema in ANGELINA_SPEC_V2.md. Nightly at 2am. Requires attendance + enrollment data to be populated first. |
| Formal PDF invoice generation per tuition payment | P1 | Claude Code | FSA/HSA reimbursement support for target demographic. Triggered per payment. Stored in Supabase Storage. Linked from parent portal. |
| Angelina `payment_followup_composer` skill | P1 | Claude Code | Dependent on tuition/auto-pay module (see STUDIO_PRO_COMPARISON.md Phase 1). Draft BAM-voiced messages for late payments. |

---

### P2 — Operational Excellence (Schedule for Phase 2)

| Task | Priority | Owner | Notes |
|---|---|---|---|
| Choreography & Production Manager — catalog layer | P2 | Claude Code | Master choreography library independent of productions. Media attachments. Links to existing `production_dances`. See MODULES.md Module 10. |
| Staff Resource Library module | P2 | Claude Code | Folder-based doc library for teachers. Schema in MODULES.md Module 11. Seed BAM default folders on deploy. |
| Session progress notes + `progress_flag` on attendance records | P2 | Claude Code | Teacher adds optional note per student per class. Surfaces on student profile + parent portal. See ATTENDANCE.md. |
| Angelina `class_performance_digest` cron + dashboard card | P2 | Claude Code | Weekly Sunday job. Fill rate + attendance rate health scoring per class. Schema in ANGELINA_SPEC_V2.md. |

---

### P3 — Nice to Have (Phase 3 / SaaS)

| Task | Priority | Owner | Notes |
|---|---|---|---|
| Lobby display / digital signage route (`/display/schedule`) | P3 | Claude Code | No auth. Auto-refresh. Kiosk mode. See MODULES.md Module 12. 1–2 hour build. |
| Competition entry manager | P3 | Claude Code | Structured registration flow for competition organizer data export. See COMPETITIVE_DANCEMASTERPRO.md. |
| Concierge import wizard (Studio Pro / Excel import) | P3 | Claude Code | White-label SaaS prerequisite. See SAAS.md. Students won't re-enter years of data manually. |
| Dancer ID / membership card | P3 | Derek | Low priority for California. Medium priority for white-label SaaS markets. |

---

## Ongoing: Marketing Machine (Starts Immediately)

### What Amanda Does
- Film 3 short videos/week in studio (technique tips, behind-the-scenes, student moments)
- Respond to Google/Yelp reviews within 24 hours
- Host trial classes on consistent schedule (e.g., first Saturday of each month)
- Ask happy parents for referrals after first performance

### What the Office Manager Does
- Post to Instagram 4x/week using Claude-generated captions
- Post to TikTok 3x/week (upload Amanda's videos)
- Respond to all DMs and inquiries within 2 hours
- Enter all leads into Studio Pro + trigger Klaviyo sequences
- Follow up with all trial class no-shows within 24 hours

### What Claude Does Autonomously
- Generate Instagram caption library (50 captions/month, ready to post)
- Generate TikTok script ideas based on trending ballet content
- Write blog posts for SEO (2/month minimum)
- Draft email sequences for new leads
- Monitor and flag any Google/Yelp reviews that need response
- Generate monthly competitive intelligence report
- Draft parent newsletter content
- Generate class descriptions for new programs
- Write teacher job postings when needed

---

## Klaviyo Sequences to Build

### Sequence 1: New Lead Welcome (6 emails over 21 days)
### Sequence 2: Post-Trial Class (4 emails)
### Sequence 3: Re-Enrollment (Season Change)
### Sequence 4: Nutcracker Hype (5 emails)

**Claude can write all sequences autonomously.**

---

## Expansion Readiness Tracker

Auto-track these metrics in Admin Dashboard:

| Metric | Threshold for Action |
|--------|---------------------|
| Overall enrollment capacity | ≥90% for 3 consecutive months |
| Active waitlist | ≥15 students |
| Pre-ballet waitlist | ≥8 students (leading indicator) |
| Monthly revenue | Hits internal target (set by Amanda) |
| Brand search volume in Ladera Ranch | Growing MoM |
| Google reviews | ≥50 with 4.8+ average |

When 4+ thresholds are met → Admin dashboard shows "Expansion Ready" alert.

---

## Competitive Research Pipeline

Per the research methodology established in April 2026, these platforms should be analyzed next (same format as COMPETITIVE_DANCEMASTERPRO.md):

| Platform | URL | Priority | Status |
|---|---|---|---|
| Jackrabbit Dance | jackrabbittech.com | High | Not started |
| The Studio Director | thinkeric.com | High | Not started |
| Pike13 | pike13.com | Medium | Not started |
| iClassPro | iclasspro.com | Medium | Not started |
| Mindbody | mindbodyonline.com | Low | Not started |

For each: fetch homepage, AI features page, pricing page. Output as `COMPETITIVE_[NAME].md` in docs/ directory. Cross-reference against BAM Platform feature set and add new gaps to this ACTION_PLAN backlog.
