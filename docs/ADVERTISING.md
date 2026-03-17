# ADVERTISING.md
## BAM Platform — Advertising, Sponsorship, Freemium Tiers & AI-Driven Upsell Engine

**Status:** Foundational Draft — Living Document  
**Last Updated:** 2026-03-16  
**Owner:** Derek / BAM Platform  
**Cross-references:** `ROLE_BASED_NAV_AND_ACCESS.md` · `RESOURCE_INTELLIGENCE.md` · `ENROLLMENT_QUIZ_SPEC.md` · `CASTING_AND_REHEARSAL.md` · `SUPABASE_EMAIL_TEMPLATES.md` · `TEACHER_PORTAL.md` · `PAYROLL_AND_COMPENSATION.md`

---

## 1. Strategic Context

### 1.1 The Market Opportunity

Dance parents — and youth activity parents broadly — represent one of the most underserved yet high-value advertising segments in consumer marketing. They are:

- High intent buyers operating in a perpetual purchase cycle: costumes, shoes, accessories, competition fees, travel, photography, nutrition, and apparel.
- Emotionally invested in their children's success, creating a willingness to spend on premium products and services.
- Difficult to reach at scale through traditional channels — they are fragmented across studios, recitals, and competitions with no unified digital touchpoint.

BAM changes that. By aggregating a network of studios, we create a captive, verified, high-LTV audience that advertisers in the dance and youth activity space cannot reach anywhere else at this density and intent level.

### 1.2 Private Equity and Youth Sports Context

Private equity investment in youth sports platforms is accelerating (2025–2026). Investors recognize that:

- Families spend an average of $2,000–$10,000+ per year per child in competitive youth activities.
- Digital platforms with verified participation data command premium CPMs.
- The youth sports adjacency to dance, gymnastics, and performing arts creates natural cross-sell opportunities.

BAM's advertising model should be built to attract PE-backed brands and distributors, not just small costume shops. The infrastructure built here must support enterprise-level advertiser relationships with verifiable ROAS reporting.

### 1.3 Target Advertisers (Tier Examples)

| Tier | Example Advertisers | Primary Goal |
|------|---------------------|--------------|
| Premium / Direct | Weissman, Revolution Dance, Capezio, Bloch | Costume, shoe, and accessory sales |
| Mid-Market | Competition companies, dance camps, photography studios | Event and service enrollment |
| Affiliate / Content | TikTok Shop creators, Shopify brand stores, Amazon affiliate sellers | Product discovery and purchase |
| Local | Regional costume shops, dance photographers, event venues | Local parent conversion |

---

## 2. Freemium Studio Tier Architecture

### 2.1 Tier Overview

BAM operates on a freemium SaaS model. Studios are onboarded at no cost (Free Tier) and are progressively upsold to paid tiers as their needs grow. Advertising is the primary mechanism enabling the free tier.

| Tier | Name | Monthly Cost | Ad Exposure | Feature Gate |
|------|------|--------------|-------------|--------------|
| 0 | Free | $0 | Full ad placements visible | Core features only |
| 1 | Essentials | TBD | Reduced ad placements | + Scheduling, Basic Reporting |
| 2 | Professional | TBD | Minimal / branded only | + Resource Intelligence, Payroll Export |
| 3 | Enterprise | TBD | Ad-free option available | Full platform, white-label options |

### 2.2 Feature Gate Matrix

Feature gates are enforced at the tenant level via a `studio_tier` field in the platform's tenant record. All UI components and API endpoints must check this value before rendering gated content.

Cross-reference: `ROLE_BASED_NAV_AND_ACCESS.md` — the `studio_tier` field must be added to the role/access schema and respected in all nav rendering logic.

```
studio_tier: 0 | 1 | 2 | 3
```

### 2.3 Ad Placement as a Feature

- Free Tier studios see full ad placements on behalf of BAM's advertiser network.
- Paid Tier studios see reduced or no ads; their parent/student app views may also be ad-reduced depending on tier.
- Studios cannot opt out of ads on the Free Tier without upgrading.
- Parent and student-facing views on Free Tier studios will display relevant, contextually appropriate ads.

---

## 3. Ad Placement Architecture

### 3.1 Placement Zones

| Placement ID | Location | Format | Notes |
|---|---|---|---|
| HOME_BANNER_TOP | Parent home screen, top | Full-width banner | High visibility, premium CPM |
| SCHEDULE_INLINE_1 | Class schedule feed, between items | Native card | Contextual to class timing |
| NOTIFICATIONS_FOOTER | Bottom of push/in-app notification | Small banner | Tied to event reminders |
| STORE_HERO | BAM Store / product discovery section | Full-bleed hero image | Reserved for premium sponsors |
| PROFILE_SIDEBAR | Student/parent profile page | Sidebar card | Interest-targeted |
| COMPETITION_PRE | Before competition schedule view loads | Interstitial (optional) | High engagement moment |
| COSTUME_CONTEXT | Near casting/costume assignment features | Native card | Weissman-class advertisers ideal here |
| ANGELINA_SUGGESTED | Inline within Angelina AI chat responses | Sponsored suggestion | Highest contextual relevance |

### 3.2 Ad Rendering Rules

- Ads are rendered only when `studio_tier === 0` (or as configured per placement for Tier 1).
- Ad content is fetched from the BAM Ad Server or a third-party ad network.
- All ads must be labeled "Sponsored" per platform policy and FTC guidelines.
- Ads are never rendered in safety-critical flows: emergency contact screens, incident reports, or injury-related content.

### 3.3 Ad Targeting Data (First-Party)

- Student age and division (Petites, Company, Competitive)
- Parent account activity (browsing behavior within app)
- Class types enrolled (ballet, hip hop, contemporary, etc.)
- Competition participation status
- Geographic region (studio location)
- Costume assignment status (triggers costumeware ads contextually)
- Recital and performance dates (triggers photography, flowers, merchandise ads)

**Privacy note:** All targeting is based on aggregate studio/student behavioral data. Individual PII is never passed to advertisers.

---

## 4. Advertiser Portal & ROAS Dashboard

### 4.1 Advertiser Onboarding

Advertisers access BAM's self-serve portal at `ads.balletacademyandmovement.com` (subdomain TBD).

Onboarding flow:

1. Account creation (business email, company name, billing)
2. Campaign type selection: Display, Native, Sponsored Suggestion (Angelina), Affiliate
3. Audience targeting configuration
4. Creative upload (banner, card, video pre-roll)
5. Budget and flight dates
6. Stripe payment integration for billing
7. Campaign review and activation

### 4.2 Advertiser Metrics Dashboard

| Metric | Description |
|--------|-------------|
| Impressions | Total ad views served |
| Unique Reach | Distinct parent/guardian accounts exposed |
| Click-Through Rate (CTR) | Clicks / Impressions |
| Opt-In Conversions | Parents who opted into advertiser communications |
| Affiliate Click-Throughs | Outbound clicks to Shopify / TikTok Shop / affiliate links |
| Attributed Purchases | Verified purchases tracked via affiliate/pixel integration |
| ROAS | Revenue attributable to BAM placements / ad spend |
| Audience Segment Breakdown | Impressions by student division, region, class type |
| CPM / CPC | Cost efficiency metrics |

### 4.3 ROAS Tracking Strategy

- **Pixel integration:** Advertisers embed a BAM pixel on their Shopify or website checkout page.
- **Affiliate link wrapping:** All outbound product links from BAM are wrapped with UTM parameters and affiliate tracking codes.
- **TikTok Shop / Shopify attribution:** Native integrations allow server-side event matching.
- **Opt-in conversion tracking:** Parents who opt in and subsequently purchase are tracked as attributed conversions.
- 30/60/90 day attribution windows configurable per advertiser campaign.

---

## 5. Data Capture & Parent Opt-In Engine

### 5.1 Opt-In Mechanism Design

- Never interrupt a critical workflow. Opt-in prompts appear at natural pause points.
- Value must be explicit and immediate. "Get 20% off your first Weissman order" — not "Sign up for our newsletter."
- Single tap. No more than one confirmation tap from the parent.
- Transparent. The parent must see exactly who they are sharing data with before confirming.

### 5.2 Opt-In Flow

```
Trigger Event (e.g., costume assignment notification)
  → In-app card: "Weissman is offering BAM families 20% off — tap to claim"
  → Tap reveals: "Share your name and email with Weissman to receive your discount?"
    [Yes, share] [No thanks]
  → On confirm: parent profile data sent to advertiser CRM (name, email only)
  → Parent receives branded welcome email from advertiser
  → Conversion logged in advertiser dashboard
```

### 5.3 Opt-In Data Schema

```json
{
  "opt_in_id": "uuid",
  "parent_id": "uuid",
  "advertiser_id": "uuid",
  "campaign_id": "uuid",
  "opted_in_at": "timestamp",
  "trigger_event": "string",
  "data_shared": ["name", "email"],
  "consent_text_version": "string",
  "status": "active | withdrawn"
}
```

### 5.4 Offer Types Supported

- Percentage discount codes
- Free shipping offers
- Free product samples (physical fulfillment handled by advertiser)
- Competition or camp entry credits
- Sweepstakes entries

---

## 6. Affiliate & Commerce Integration Layer

### 6.1 Shopify Integration

- Shopify Storefront API for product browsing and deep-linking
- Shopify Affiliate / Referral tracking via UTM + Order attribution
- Optional: Shopify Buy Button embedded in BAM app for in-app purchase flow
- Revenue share model: BAM earns a commission per attributed sale

```json
{
  "shopify_integration": {
    "merchant_id": "string",
    "storefront_url": "string",
    "api_key": "string",
    "tracking_pixel_id": "string",
    "commission_rate": "float",
    "attribution_window_days": 30
  }
}
```

### 6.2 Smile.io Loyalty Integration

- Smile.io API (Pro tier required for API access — $999/mo, evaluate against volume)
- BAM passes referral data to Smile.io on purchase confirmation
- Parents optionally connect their Smile.io account in BAM profile settings
- Points balance can be surfaced in BAM app as an engagement feature

### 6.3 TikTok Shop Integration

- TikTok Shop Affiliate API (via TikTok Shop Partner Center)
- BAM registers as an affiliate partner in TikTok Shop ecosystem
- Product links within BAM app use TikTok Shop affiliate link format
- Server-side event matching via TikTok Business API for purchase attribution
- TikTok Login Kit optionally available for parents

### 6.4 Additional Affiliate Networks

| Network | Relevance | Integration Method |
|---------|-----------|-------------------|
| Amazon Associates | High | API + affiliate link wrapping |
| ShareASale | High | API integration |
| Impact.com | High | API integration |
| Rakuten Advertising | Medium | API integration |
| AvantLink | Low-Medium | Evaluate |

### 6.5 Attribution & Tracking Schema

```json
{
  "affiliate_click": {
    "click_id": "uuid",
    "parent_id": "uuid",
    "advertiser_id": "uuid",
    "destination_url": "string",
    "network": "shopify | tiktok_shop | amazon | shareasale | impact | direct",
    "campaign_id": "uuid",
    "placement_id": "string",
    "clicked_at": "timestamp",
    "converted": "boolean",
    "conversion_value": "decimal",
    "commission_earned": "decimal",
    "attribution_window_days": 30
  }
}
```

---

## 7. Angelina — AI Upsell & Engagement Engine

### 7.1 Angelina's Upsell Persona

Angelina is direct, persistent, and confident — not passive. She does not ask permission to make a recommendation. She frames upgrades as solutions to problems the studio manager is already experiencing.

She does NOT say: "Would you like to consider upgrading?"  
She DOES say: "You've hit your class limit. Upgrade to Professional and add unlimited classes today — takes 30 seconds."

Maximum 3 touches per upgrade event before backing off for 14 days.

### 7.2 Behavioral Triggers — Studio Manager / Admin

| Trigger | Signal | Recommended Upgrade |
|---------|--------|---------------------|
| Class count approaching limit | Studio at 80%+ of Free Tier class cap | Tier 1 |
| Teacher count approaching limit | Studio at 80%+ of Free Tier teacher cap | Tier 1 |
| Payroll export attempted | Manager tries to export payroll (gated) | Tier 2 |
| Resource Intelligence accessed | Manager views RI feature teaser | Tier 2 |
| Substitute coverage feature blocked | Manager tries to assign sub (gated) | Tier 1 |
| Advanced reporting attempted | Manager views analytics teaser | Tier 2 |
| Competition module accessed | Manager attempts to enter competition data | Tier 2 |
| Multi-location interest | Second studio location added or attempted | Tier 3 |
| Enrollment spike | Studio enrollment grew 20%+ in 30 days | Tier 1 |
| Manual spreadsheet behavior detected | Manager repeatedly exports basic data | Any paid tier |

### 7.3 Behavioral Triggers — Parent / Student (Ad Upsell)

| Parent Action | Advertiser Trigger |
|---|---|
| Views costume assignment | Weissman / Revolution Dance offer |
| Views competition schedule | Competition photography, travel packages |
| Views class schedule for new session | New dance shoes / apparel offer |
| Receives recital notification | Flowers, recital gifts, photography |
| Views student progress notes | Private lesson packages, training tools |

### 7.4 Upsell Message Delivery Channels

- In-app modal (highest conversion, used for hard gate moments)
- Angelina chat suggestion (contextual, lower friction)
- Push notification (max 1/week for upsell content)
- Email (new template: UPSELL_TRIGGER_EMAIL — see SUPABASE_EMAIL_TEMPLATES.md)
- Dashboard banner (persistent but dismissible for 7 days)

### 7.5 AI Upsell Intelligence Schema

```json
{
  "upsell_event": {
    "event_id": "uuid",
    "studio_id": "uuid",
    "trigger_type": "string",
    "trigger_context": "object",
    "recommended_tier": "1 | 2 | 3",
    "message_delivered_via": ["modal", "angelina", "push", "email", "banner"],
    "delivered_at": "timestamp",
    "dismissed": "boolean",
    "dismissed_at": "timestamp",
    "converted": "boolean",
    "converted_at": "timestamp",
    "touch_count": "integer",
    "suppressed_until": "timestamp"
  }
}
```

### 7.6 Upsell Analytics (Internal Admin Dashboard)

- Trigger volume by type
- Impression-to-conversion rate by channel
- Average days from first trigger to upgrade
- Revenue attributed to Angelina upsell events
- A/B test results for message variants

---

## 8. Revenue Model Summary

| Revenue Source | Mechanism | Notes |
|---|---|---|
| Advertiser CPM / CPC | Display and native ad placements | Primary revenue on Free Tier |
| Affiliate Commission | Purchase attribution via Shopify, TikTok Shop, networks | Ongoing passive revenue |
| Opt-In Data Packages | Advertisers pay premium for verified opt-in parent contacts | Must be structured carefully for compliance |
| Studio SaaS Subscriptions | Tier upgrade revenue driven by Angelina upsell engine | Primary long-term revenue |
| Sponsored Angelina Suggestions | Premium placement within Angelina chat responses | Highest CPM, limited inventory |

---

## 9. Compliance & Privacy

- **COPPA:** Student data is never used for targeting or shared with advertisers. Only parent/guardian data is used in opt-in flows.
- Opt-in consent records must be retained with full consent text version for a minimum of 3 years.
- GDPR and CCPA considerations apply depending on studio geography. A consent management layer must be implemented before advertising goes live.
- Ad content is subject to BAM review and approval. No gambling, alcohol, political, or adult content permitted.
- FTC disclosure requirements: all sponsored content must be clearly labeled.

---

## 10. Cross-Reference Implications

| File | Implication |
|---|---|
| ROLE_BASED_NAV_AND_ACCESS.md | Must add `studio_tier` to tenant schema. All nav and feature gate logic must check `studio_tier`. Ad placement zones must be defined as renderable UI regions with tier-conditional logic. |
| RESOURCE_INTELLIGENCE.md | RI features are gated at Tier 2. Angelina must reference RI feature teasers as upsell triggers. |
| ENROLLMENT_QUIZ_SPEC.md | Enrollment flow is a high-value opt-in moment. Consider inserting advertiser offer card post-quiz completion. |
| CASTING_AND_REHEARSAL.md | Costume assignment events are primary triggers for costumeware advertiser placements. Casting completion webhook should fire an ad trigger event. |
| SUPABASE_EMAIL_TEMPLATES.md | New templates required: UPSELL_TRIGGER_EMAIL, ADVERTISER_OPT_IN_CONFIRMATION, ADVERTISER_WELCOME. |
| TEACHER_PORTAL.md | Teacher-facing views should be ad-free regardless of studio tier. Ads are parent/student-facing only. |
| PAYROLL_AND_COMPENSATION.md | Payroll export is a Tier 2 gate trigger for Angelina upsell. Gate must fire the upsell event before blocking the action. |

---

## 11. Open Questions & Future Considerations

- **Ad server decision:** Build lightweight internal ad server vs. third-party (Google Ad Manager, Kevel). Recommendation: start with direct-sold placements managed internally; evaluate ad server when volume justifies it.
- **Video pre-roll:** TikTok-style short video ads within the app (e.g., before competition schedule loads). Evaluate in Phase 2.
- **BAM Marketplace:** Long-term, BAM could operate its own marketplace where verified dance brands sell directly to BAM families, with BAM taking a transaction fee.
- **Influencer / Creator Program:** Dance teachers and studio owners as micro-influencers promoting brands through BAM. Affiliate links tracked at the teacher level.
- **White-label ad network:** As BAM scales, first-party audience data could be packaged as a standalone ad product sold to brands outside the platform.
