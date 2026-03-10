# bam-platform
Ballet Academy and Movement — Studio Management Platform

> **Private repository** · greenlyzard/bam-platform  
> Studio: 400-C Camino De Estrella, San Clemente, CA 92672  
> Website: [balletacademyandmovement.com](https://balletacademyandmovement.com)  
> Contact: dance@bamsocal.com · (949) 229-0846

---

## Overview

A purpose-built studio management platform for Ballet Academy and Movement (San Clemente, CA). Designed to replace fragmented tools with a unified system covering marketing, operations, communications, compliance, and performance management.

Long-term goal: white-label for classical ballet studios nationally.

---

## Repository Structure

```
bam-platform/
├── CLAUDE.md                              ← AI context file (read first)
├── README.md                              ← This file
│
├── docs/
│   ├── strategy/
│   │   └── platform-product-requirements.md  ← Full 13-module PRD
│   │
│   ├── marketing/
│   │   ├── local-seo-strategy.md             ← Keyword maps, city targets, page template
│   │   ├── content-marketing-plan.md         ← Blog articles, email sequences, social media
│   │   ├── competitive-intelligence.md       ← All 11 competitor studios tracked
│   │   └── lead-capture-funnel.md            ← Trial class CTA, chatbot, email capture
│   │
│   ├── operations/
│   │   ├── teacher-recruitment.md            ← Sourcing, outreach, interview process
│   │   ├── teacher-onboarding.md             ← BAM philosophy + 2-week training program
│   │   ├── studio-pro-gap-analysis.md        ← What Studio Pro doesn't do; migration plan
│   │   └── mandated-reporter-protocol.md     ← California AB 1432 + reporting procedures
│   │
│   ├── expansion/
│   │   └── location-expansion-strategy.md    ← Ladera Ranch, RMV, SJC analysis + readiness
│   │
│   └── brand/
│       └── brand-guidelines.md              ← Colors, typography, tone, visual rules
│
└── platform/
    └── ballet-academy-dashboard.jsx          ← React dashboard (in progress)
```

---

## Platform Modules (13 Total)

| # | Module | Replaces |
|---|--------|----------|
| M1 | Communications Hub | Quo + Robo-Texter |
| M2 | Badge + Achievement System | (net new) |
| M3 | Session & Scheduling | Studio Pro |
| M4 | Teacher Management | Studio Pro + Google Sheets |
| M5 | Sub-Brand Architecture | (net new) |
| M6 | Student & Family Profiles | Studio Pro |
| M7 | Registration & Enrollment | Studio Pro parent portal |
| M8 | Reporting & Intelligence | Studio Pro + Quo analytics |
| M9 | Physical Merchandise | Sugar Plum Shop (built) |
| M10 | Group Communication & Social Feed | BAND |
| M11 | Performance Events & Ticketing | TutuTix |
| M12 | Legal, Waivers & Compliance | (net new) |
| M13 | Media Archive & Photo Distribution | Google Photos |

---

## Document Index

| Document | Path | Status |
|----------|------|--------|
| Platform PRD — All 13 Modules | `docs/strategy/platform-product-requirements.md` | ✅ Complete |
| Local SEO Strategy | `docs/marketing/local-seo-strategy.md` | ✅ Complete |
| Content Marketing Plan | `docs/marketing/content-marketing-plan.md` | ✅ Complete |
| Competitive Intelligence | `docs/marketing/competitive-intelligence.md` | ✅ Complete |
| Lead Capture Funnel | `docs/marketing/lead-capture-funnel.md` | ✅ Complete |
| Teacher Recruitment | `docs/operations/teacher-recruitment.md` | ✅ Complete |
| Teacher Onboarding | `docs/operations/teacher-onboarding.md` | ✅ Complete |
| Studio Pro Gap Analysis | `docs/operations/studio-pro-gap-analysis.md` | ✅ Complete |
| Mandated Reporter Protocol | `docs/operations/mandated-reporter-protocol.md` | ✅ Complete |
| Location Expansion Strategy | `docs/expansion/location-expansion-strategy.md` | ✅ Complete |
| Brand Guidelines | `docs/brand/brand-guidelines.md` | ✅ Complete |
| React Dashboard | `platform/ballet-academy-dashboard.jsx` | 🔄 In progress |

**Status key:** ✅ Complete · 🔄 In progress · 🔲 To build · ⚠️ Needs update

---

## Build Priority

| Priority | Item |
|----------|------|
| P0 | Attendance pre-fill (React dashboard) |
| P0 | San Clemente SEO landing page |
| P1 | Teacher hour logging by category (M4) |
| P1 | Session type setup — privates, comp rehearsals (M3) |
| P1 | Sub-brand program records (M5) |
| P1 | Badge system digital workflow (M2) |
| P2 | Digital signage feed (M1) |
| P2 | QR code check-in (M3) |
| P3 | Legal/compliance portal — parent waivers + teacher W9s (M12) |
| P3 | Production management — Nutcracker 2026 (M3) |
| P4 | Parent live-viewing MVP for Nutcracker 2026 (M6) |
| P4 | Photo distribution — Google Photos API (M13) |
| P9+ | White-label beta program |

---

## Key Decisions

| Decision | Status |
|----------|--------|
| Stay on Studio Pro short-term | ✅ Confirmed |
| Evaluate Jackrabbit by June 2026 | 🔲 Scheduled |
| Do not adopt MindBody until 300+ students | ✅ Confirmed |
| Build live-viewing on Mux.com | ✅ Confirmed |
| White-label ICP: classical ballet studios, 50–300 students | ✅ Confirmed |
| White-label pricing: $99–149/mo studio + $4.99–9.99/mo family app | ✅ Confirmed |

---

## Studio Info

**Ballet Academy and Movement**  
400-C Camino De Estrella, San Clemente, CA 92672  
(949) 229-0846 | dance@bamsocal.com  
balletacademyandmovement.com

**Founder:** Amanda Cobb — former professional ballerina  
**CMS:** WordPress + Flatsome | **Studio Mgmt:** Studio Pro | **Email:** Klaviyo | **DNS:** Cloudflare
