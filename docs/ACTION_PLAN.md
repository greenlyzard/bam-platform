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

**Claude can do autonomously:** All content writing, schema markup, FAQ generation, keyword mapping for each city page.

---

## Sprint 2: Parent Portal MVP (30-60 Days)

| Task | Owner | AI-Assist | Timeline |
|------|-------|-----------|----------|
| Parent auth flow (magic link login) | Claude Code | Fully autonomous | Week 5 |
| Student profile creation | Claude Code | Fully autonomous | Week 5 |
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
| Student roster with photos + notes | Claude Code | Fully autonomous | Week 10 |
| Basic streaming integration (Cloudflare) | Claude Code | Fully autonomous | Week 10-11 |
| Family access streaming permissions | Claude Code | Fully autonomous | Week 11 |
| Parent messaging from teacher portal | Claude Code | Fully autonomous | Week 12 |

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
- Create FAQ content for new pages
- Generate class descriptions for new programs
- Write teacher job postings when needed

---

## Klaviyo Sequences to Build

### Sequence 1: New Lead Welcome
- Trigger: Form submission or chatbot inquiry
- Email 1 (Immediate): Welcome + about BAM + Amanda's story
- Email 2 (Day 2): Class recommendation based on child age
- Email 3 (Day 4): What makes BAM different (credentials, class size, Nutcracker)
- Email 4 (Day 7): Trial class CTA + social proof (intensive acceptances)
- Email 5 (Day 14): "We saved you a spot" urgency + easy booking link
- Email 6 (Day 21): Parent testimonial + limited availability reminder

**Claude can write all 6 emails autonomously.**

### Sequence 2: Post-Trial Class
- Trigger: Trial class attended (Studio Pro webhook)
- Email 1 (Same day): "We loved meeting [child's name] today"
- Email 2 (Day 2): Class placement recommendation + enrollment link
- Email 3 (Day 5): What the first month looks like
- Email 4 (Day 10): One last follow-up before spot is released

### Sequence 3: Re-Enrollment (Season Change)
- Trigger: 30 days before new season
- Email 1: Early enrollment opens for existing families
- Email 2: New classes/programs for next season
- Email 3: Final enrollment deadline

### Sequence 4: Nutcracker Hype
- Trigger: 90 days before performance
- Email 1: Audition announcement
- Email 2: Role assignments
- Email 3: Ticket sales open
- Email 4: Performance week logistics
- Email 5: Streaming ticket sales (for remote family)

---

## Content Calendar (Claude Generates Weekly)

### Instagram (4x/week)
| Day | Content Type | Example |
|-----|-------------|---------|
| Monday | Technique tip | "Why turnout starts from the hip, not the foot" |
| Wednesday | Student moment | Beautiful arabesque in class (with consent) |
| Friday | Behind the scenes | Nutcracker rehearsal prep |
| Sunday | Parent education | "Benefits of ballet for 4-year-olds" |

### TikTok (3x/week)
| Day | Content Type | Format |
|-----|-------------|--------|
| Tuesday | Amanda teaching tip | 30-60 sec, talking to camera |
| Thursday | Student transformation | Before/after level progression |
| Saturday | Performance highlight | Nutcracker or showcase clip |

### Blog/SEO (2x/month)
- "When Should My Child Start Ballet?" — high search volume
- "Benefits of Ballet for Toddlers" — parent education
- "How Small Class Sizes Change Ballet Training" — differentiator
- "What Makes Classical Ballet Different from Recreational Dance" — positioning
- "Preparing Your Child for a Ballet Intensive" — high-intent audience

---

## Referral Program

**Design:**
- Enrolled parent refers a new family
- New family completes trial + enrolls
- Referring family gets: 1 month free tuition credit
- New family gets: First month 15% off

**Platform tracks:**
- Referral source at enrollment
- Credit issued automatically
- Admin can override/adjust

**Claude builds:** referral tracking module, automated credit application

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

## AI Autonomous Tasks (No Direction Needed)

These Claude should do proactively:

### Weekly
- Generate 20 social media captions for the coming week
- Research any new competitor studio openings in South OC
- Check for broken links or outdated content on BAM website
- Review and flag any unanswered Google/Yelp reviews

### Monthly
- Full competitive intelligence update (all 11 competitors)
- SEO keyword ranking report for all landing pages
- Suggest 2 new blog post topics based on current search trends
- Draft parent newsletter for the month
- Generate next month's Klaviyo email content

### Seasonally
- Pre-Nutcracker: Generate all marketing copy, email sequences, social content
- Pre-spring showcase: Same as above
- Enrollment season: Generate urgency campaigns, waitlist communications
- Summer intensive season: Generate audition prep content for LMS
