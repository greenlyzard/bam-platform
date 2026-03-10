# Local SEO Strategy
## Ballet Academy and Movement

> **Goal:** Rank #1 for ballet and dance class searches across South Orange County.  
> **Approach:** City-specific landing pages + parent education content + schema markup + Google Business optimization.

---

## 1. Target Cities & Priority Keywords

### Tier 1 — Primary (Build First)

| City | Primary Keyword | Secondary Keywords |
|------|----------------|-------------------|
| San Clemente | ballet classes san clemente | dance classes san clemente, ballet san clemente, toddler ballet san clemente |
| Laguna Niguel | ballet classes laguna niguel | dance studio laguna niguel, ballet lessons laguna niguel |
| Dana Point | ballet classes dana point | dance classes dana point, ballet dana point |

### Tier 2 — Secondary (Build After Tier 1)

| City | Primary Keyword | Secondary Keywords |
|------|----------------|-------------------|
| Ladera Ranch | ballet classes ladera ranch | dance studio ladera ranch, kids ballet ladera ranch |
| Mission Viejo | ballet classes mission viejo | dance studio mission viejo, ballet mission viejo |
| San Juan Capistrano | ballet classes san juan capistrano | dance san juan capistrano |
| Rancho Mission Viejo | ballet classes rancho mission viejo | dance studio rancho mission viejo |
| Laguna Hills | ballet classes laguna hills | dance studio laguna hills |

### Tier 3 — Broad Intent (Support With Blog Content)

- `ballet classes near me` (radius-based — supported by GMB + schema)
- `ballet for toddlers` / `ballet for 3 year olds`
- `ballet classes for kids`
- `best ballet school south orange county`
- `classical ballet training orange county`

---

## 2. Landing Page Structure (Master Template)

All city-specific pages follow this exact structure. **Ballet is always first.**

```
H1: Ballet Classes in [City], CA | Ballet Academy and Movement
─────────────────────────────────────────────────────────────
[Hero: Photo of students in class + CTA: Schedule a Free Trial]

SECTION 1: About Our [City] Ballet Classes
  - 2-3 paragraphs about the studio, Amanda Cobb's background
  - Mention proximity to [City]: "serving families from [City] and surrounding areas"
  - Lead with credentials: 3x Best Dance School, Hall of Fame, Royal Ballet/ABT/Stuttgart

SECTION 2: Ballet Programs
  [Ages 2-3] Tiny Dancers
  [Ages 3-5] Pre-Ballet
  [Ages 5-7] Ballet Foundations
  [Ages 7-12] Classical Ballet I / II / III
  [Performance Company]
  [Competition Company]

SECTION 3: Other Programs
  Jazz Ballet
  Contemporary
  Musical Theatre

SECTION 4: Why Families Choose Us
  - Professional pedagogy (Amanda Cobb)
  - Small class sizes (max 10)
  - Credentials callout block

SECTION 5: FAQ (city-localized)
  6-8 questions with schema markup

SECTION 6: Location + Map
  Studio address, Google Maps embed, parking info

SECTION 7: CTA
  "Ready to start? Schedule a free trial class."
```

### URL Structure
- `/ballet-classes-san-clemente`
- `/ballet-classes-laguna-niguel`
- `/ballet-classes-dana-point`
- `/ballet-classes-ladera-ranch`
- `/ballet-classes-mission-viejo`

---

## 3. Schema Markup Requirements

Every landing page must include:

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Ballet Academy and Movement",
  "description": "Classical ballet training studio in San Clemente, CA",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "400-C Camino De Estrella",
    "addressLocality": "San Clemente",
    "addressRegion": "CA",
    "postalCode": "92672"
  },
  "telephone": "(949) 229-0846",
  "url": "https://balletacademyandmovement.com"
}
```

Plus `FAQPage` schema for all FAQ blocks.

---

## 4. Google Business Profile Optimization

**Critical actions:**
- Primary category: `Dance School`
- Secondary categories: `Performing Arts School`, `Children's Party Service` (for trial class visibility)
- Posts: minimum 1x/week (performance photos, class openings, events)
- Q&A: pre-seed with 10 common parent questions + answers
- Photos: minimum 25 active photos (class, performance, studio, headshot)
- Reviews: system to prompt satisfied parents after performances and milestones

---

## 5. Content Silo Structure

```
balletacademyandmovement.com/
├── /ballet-classes-san-clemente       ← Tier 1 city page
├── /ballet-classes-laguna-niguel      ← Tier 1 city page
├── /ballet-classes-dana-point         ← Tier 1 city page
├── /ballet-classes-ladera-ranch       ← Tier 2 city page
├── /blog/
│   ├── /benefits-of-ballet-for-toddlers
│   ├── /when-should-my-child-start-ballet
│   ├── /how-ballet-improves-posture
│   ├── /what-to-expect-first-ballet-class
│   ├── /ballet-vs-dance-team-whats-right-for-my-child
│   └── /how-small-class-sizes-help-children-learn
└── /programs/
    ├── /pre-ballet
    ├── /classical-ballet
    ├── /performance-company
    └── /competition-company
```

---

## 6. On-Page SEO Checklist Per Landing Page

- [ ] H1 contains city name + "ballet classes"
- [ ] First 100 words contain primary keyword naturally
- [ ] Meta title: `Ballet Classes in [City] CA | Ballet Academy and Movement` (under 60 chars)
- [ ] Meta description: unique, 150-160 chars, includes city + CTA
- [ ] At least 800 words of body copy
- [ ] FAQ section with 6+ questions (FAQPage schema)
- [ ] Internal links to /programs pages
- [ ] Google Maps embed with city-specific location context
- [ ] Alt text on all images includes city + "ballet"
- [ ] Schema: LocalBusiness + FAQPage

---

## 7. Internal Linking Strategy

| Source Page | Links To | Anchor Text |
|-------------|----------|-------------|
| San Clemente city page | Pre-Ballet program | "Pre-Ballet classes for ages 3-5" |
| San Clemente city page | Trial class CTA | "Schedule a free trial class in San Clemente" |
| Laguna Niguel city page | San Clemente page | "our San Clemente studio" |
| Blog: when to start ballet | Pre-Ballet program | "our Pre-Ballet program for ages 3-5" |
| Blog: benefits of ballet | Any city page | "ballet classes near [city]" |
| Homepage | All city pages | city name anchors |

---

## 8. Page Build Status

| Page | URL | Status | Build Date |
|------|-----|--------|------------|
| San Clemente | `/ballet-classes-san-clemente` | 🔲 To build | — |
| Laguna Niguel | `/ballet-classes-laguna-niguel` | 🔲 To build | — |
| Dana Point | `/ballet-classes-dana-point` | 🔲 To build | — |
| Ladera Ranch | `/ballet-classes-ladera-ranch` | 🔲 To build | — |
| Mission Viejo | `/ballet-classes-mission-viejo` | 🔲 To build | — |

---

## 9. Measurement

**Track in Google Search Console:**
- Impressions and clicks per city keyword
- Average position for each primary keyword
- CTR by city page

**KPIs:**
- Target: Top 3 ranking for all Tier 1 keywords within 6 months
- Target: Top 3 for Tier 2 keywords within 12 months
- Conversion: 5%+ of city page visitors submit trial class inquiry

---

*Last updated: March 2026*
