# MARKETING_INTEGRATIONS.md
# Ballet Academy and Movement — Marketing Integrations Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

The Marketing module connects BAM's registration and enrollment data
to paid advertising platforms, content creation workflows, and
in-studio marketing. It enables Angelina to assist with ad copy,
audience targeting recommendations, content calendars, and campaign
strategy — while keeping Amanda and Admin in full control of what
actually runs and what gets spent.

Cross-references:
- REGISTRATION_AND_ONBOARDING.md — enrollment events that trigger audience sync
- COMMUNICATIONS.md — Angelina AI assistant permissions
- KLAVIYO_SEQUENCES.md — email/SMS automation sequences
- INTEGRATIONS.md — platform connection configuration

---

## 2. Advertising Platform Integrations

### 2.1 Supported Platforms
| Platform | Audience Type | Primary Use |
|---|---|---|
| Meta (Facebook/Instagram) | Custom Audiences, Lookalike Audiences | Parent acquisition, retargeting |
| Google Ads | Customer Match | Search ads, YouTube pre-roll |
| TikTok Ads | Custom Audiences | Teen/young adult awareness, parent discovery |
| YouTube Ads | Via Google Ads Customer Match | Long-form content, shorts promotion |

### 2.2 Audience Sync Architecture

Registration and lead events in BAM automatically sync to ad platform
audiences. This enables retargeting of website visitors who didn't
convert, lookalike audiences from enrolled families, and suppression
of existing students from acquisition campaigns.

**Sync events:**
| Event | Audience Action |
|---|---|
| Lead captured (Angelina chat, trial booking) | Add to "BAM Leads" audience |
| Trial class attended | Add to "Trial Attended — Not Enrolled" audience |
| Student enrolled | Add to "Current Families" audience; remove from leads |
| Student drops | Move to "Past Families" audience |
| Registration page visit (no conversion) | Add to "Website Visitors" audience (pixel) |

**Privacy:** All audience syncs use hashed email/phone (SHA-256)
per platform requirements. No PII transmitted in plain text.
Parent must have accepted marketing consent at registration
(opt-in checkbox in enrollment wizard).

```sql
marketing_consents (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  family_id       uuid FK families,
  consented_at    timestamptz,
  consent_version text,                 -- version of privacy policy accepted
  channels        text[],               -- ['email','sms','ads']
  ip_address      text,
  created_at      timestamptz default now()
)
```

### 2.3 Platform Connection Config
Each platform API connection is configured in Admin → Integrations →
Marketing (per tenant, encrypted credentials per INTEGRATIONS.md pattern):

- **Meta:** Business Manager ID, Ad Account ID, Pixel ID, System User Token
- **Google Ads:** Manager Account ID, Customer ID, OAuth credentials
- **TikTok:** Advertiser ID, API Access Token, Pixel ID
- **Klaviyo:** API Key (already in INTEGRATIONS.md)

---

## 3. Angelina — Marketing AI Assistant

### 3.1 Who Can Use
Admin and Super Admin (Amanda) only — same as Communications module.

### 3.2 What Angelina Can Do for Marketing

**Ad Copy Generation:**
- Write Facebook/Instagram ad copy for specific campaigns
  ("Write 3 variations of an ad for our fall enrollment campaign
  targeting parents of 3–5 year olds in San Clemente")
- Write Google search ad headlines + descriptions
- Write TikTok video scripts (short-form, 15–60 seconds)
- Write YouTube Shorts scripts
- Write Google Display ad copy

**Targeting Recommendations:**
- Suggest audience targeting parameters based on BAM's
  enrolled family demographics
- Recommend lookalike audience strategy
- Suggest campaign budget allocation across platforms
- Identify best performing content themes based on engagement data
  (when connected to platform analytics)

**Content Calendar:**
- Generate a monthly social content calendar
- Suggest caption copy per post
- Recommend posting schedule by platform
- Identify key dates (enrollment open, Nutcracker, recital)
  and build content themes around them

**Campaign Strategy:**
- Suggest seasonal campaign structure (back to school, Nutcracker,
  spring enrollment, summer intensive)
- Draft campaign briefs for each platform
- Recommend budget split across platforms given $20/day current budget

### 3.3 Angelina Marketing Workflow
All Angelina marketing output requires Admin review before use.
No ad is created, no post is published, no budget is spent
without explicit Admin confirmation.

1. Admin opens Marketing → AI Assistant
2. Admin types instruction to Angelina
3. Angelina generates draft output (copy, targeting, calendar, etc.)
4. Admin reviews, edits inline
5. Admin copies output to use in the relevant platform
   (or future direct publishing integration)
6. Output is saved to Marketing → Campaign Library

### 3.4 Platform-Specific Content Notes

**TikTok & YouTube Shorts:**
- Dance is the #1 content category on TikTok
- Short-form video (15–60 sec) drives the highest discovery
- Content types that perform: behind-the-scenes rehearsal,
  transformation clips (beginner → advanced), performance highlights,
  teacher tips ("3 signs your child is ready for ballet")
- Angelina can script these with on-screen text suggestions,
  hook lines, and CTA overlays

**Facebook/Instagram:**
- Parents (primary decision makers) are most active here
- Carousel ads work well for class showcases
- Reel format mirrors TikTok; cross-post where possible
- Event ads for Nutcracker, open enrollment, recitals

**Google Search:**
- Target: "ballet classes near me", "ballet for toddlers San Clemente",
  "ballet classes Laguna Niguel"
- SEO landing pages (already planned) feed Quality Score
- Call extensions + location extensions for local relevance

**YouTube:**
- Pre-roll ads targeting parents watching parenting/education content
- Longer form content (2–5 min) about Amanda's philosophy,
  studio culture, student journeys
- Shorts repurposed from TikTok content

---

## 4. Content Asset Management

### 4.1 Content Sources
Content comes from three sources:
- Amanda and teachers filming at the studio
- Periodic hired videographer
- Parent-shared content (repurposed with permission)

### 4.2 Asset Library
Admin → Marketing → Asset Library

```sql
marketing_assets (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  asset_type      text CHECK IN ('video','photo','graphic','document'),
  title           text,
  description     text,
  file_url        text,                 -- Cloudflare Stream for video
  thumbnail_url   text,
  platform_tags   text[],              -- ['tiktok','instagram','youtube']
  content_tags    text[],              -- ['nutcracker','petites','rehearsal']
  source          text CHECK IN ('studio_filmed','hired_videographer',
                    'parent_shared','ai_generated_graphic'),
  parent_consent_obtained boolean default false,
  students_visible boolean default false,
  usage_rights    text,
  uploaded_by     uuid FK users,
  created_at      timestamptz default now()
)
```

### 4.3 Student Privacy in Content
- Assets tagged `students_visible = true` require photo consent
  for all students appearing
- System cross-references student `photo_consent = true` before
  flagging asset as cleared for use
- Admin must confirm consent clearance before publishing any asset
  showing identifiable students

---

## 5. Local Marketing

### 5.1 In-Studio Digital Signage
- Admin can push announcements to in-studio digital displays
- Content types: enrollment open, upcoming performances, class
  spotlights, student achievements
- Angelina can draft signage copy on request
- Format: full-screen landscape (1920×1080) or portrait (1080×1920)
  for vertical displays

### 5.2 Print Marketing
- Admin can generate print-ready content (flyers, posters)
  for local distribution
- Canva integration (INTEGRATIONS.md) used for design
- Angelina can draft copy; Canva generates the visual
- Distribution targets: local schools, pediatric offices, community
  boards, Yelp, local Facebook groups

### 5.3 Yelp Strategy
- Yelp is a primary discovery channel ("dance studio near me")
- Amanda's professional background + 3× Best Dance School award
  featured in owner bio
- Review request triggered automatically after:
  - Student completes first full month
  - Student participates in first performance
- Review request sent via email + SMS (with Yelp link)
- Admin can suppress review request for specific families

---

## 6. Campaign Library

Admin → Marketing → Campaigns

Each campaign record stores:
```sql
marketing_campaigns (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  name            text,                 -- "Fall 2026 Enrollment Campaign"
  campaign_type   text CHECK IN (
                    'enrollment','performance','seasonal',
                    'retention','brand_awareness','local'
                  ),
  platforms       text[],               -- ['meta','google','tiktok','youtube']
  status          text CHECK IN ('draft','active','paused','completed'),
  budget_daily    numeric(10,2),
  budget_total    numeric(10,2),
  start_date      date,
  end_date        date,
  ai_drafted      boolean default false,
  copy_variants   jsonb,                -- Angelina-generated copy variations
  targeting_notes text,                 -- Angelina targeting recommendations
  asset_ids       uuid[],              -- linked marketing_assets
  notes           text,
  created_by      uuid FK users,
  created_at      timestamptz default now()
)
```

---

## 7. Phase Implementation Order

### Phase 1 — Foundation
- [ ] marketing_consents table (capture at enrollment)
- [ ] marketing_assets library (upload, tag, manage)
- [ ] Angelina marketing assistant UI (Admin only)
- [ ] Campaign library (create, draft, store)

### Phase 2 — Audience Sync
- [ ] Klaviyo sync on enrollment/lead events (already partial)
- [ ] Meta Custom Audience sync (hashed email/phone)
- [ ] Google Customer Match sync
- [ ] TikTok Custom Audience sync

### Phase 3 — Content & Publishing
- [ ] Content calendar UI
- [ ] Canva integration for design
- [ ] Digital signage content push
- [ ] Print asset generation

### Phase 4 — Analytics & Optimization
- [ ] Platform performance data pull (Meta, Google, TikTok)
- [ ] Campaign ROI dashboard (cost per lead, cost per enrollment)
- [ ] Angelina campaign optimization recommendations
- [ ] A/B copy testing framework

---

## 8. Open Questions

- [ ] Should Meta pixel be on the WordPress site, the portal, or both?
- [ ] Who manages ad accounts day-to-day — Derek or Amanda?
- [ ] Is there a Canva Business account already connected to BAM?
- [ ] For TikTok — does BAM have an existing TikTok Business account?
- [ ] Should parent consent for marketing be opt-in (checkbox) or
  opt-out (pre-checked)? (Legal consideration: CCPA)
- [ ] What is the target cost-per-enrollment from paid ads?
- [ ] Should Angelina have access to platform analytics to optimize
  recommendations, or copy/targeting only?
