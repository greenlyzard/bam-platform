# Studio Pro — Gap Analysis
## Ballet Academy and Movement

> **Purpose:** Document what Studio Pro does well, where it falls short, and what the BAM Platform must do better.  
> **Decision:** Stay on Studio Pro short-term. Formally evaluate Jackrabbit by June 2026. Do not migrate to MindBody until 300+ students and multi-location.

---

## 1. Current Studio Pro Setup

### Active Locations (3)
1. **Ballet Academy & Movement** (primary — 400-C Camino De Estrella)
2. **City of San Clemente Community Center**
3. **San Juan Hills High School — Dance Studio**

### Active Seasons
- Classes 2025/2026
- Company 25/26
- June 6th Recital
- Morning Classes 2026
- 2026 Summer

### Current Faculty in System
Amanda Cobb, Samantha "Sam" Weeks, Paola "Pie" Gonzalez (Coach Pie), Campbell Castner, Lauryn Rowe, Cara Matchett, Deborah Fauerbach

---

## 2. What Studio Pro Does Well

| Capability | Notes |
|-----------|-------|
| Student enrollment and rostering | Core function, reliable |
| Class scheduling | Works well for standard weekly classes |
| Billing and tuition collection | Functional |
| Parent portal | Basic enrollment and payment access |
| Email communication | Functional for announcements |
| Basic attendance tracking | Manual check-off works |
| Multi-location support | Handles 3 locations |
| Multiple seasons | Works for season-by-season structure |

---

## 3. What Studio Pro Does NOT Do

These are the gaps that either create manual workarounds or don't exist at all:

### Structural Workarounds Currently in Use

| Problem | Current Workaround | Platform Solution |
|---------|-------------------|------------------|
| No sub-brand field | "Competition- Willow" as first name prefix | M5: Sub-brand tags natively on student record |
| No session opt-out tracking | "OPT OUT Sylvia" embedded in class name | M3: Per-student opt-out flag per session |
| No rehearsal session type | Rehearsals created as classes: "3A/4A Variations and Sylvia rehearsal" | M3: Dedicated rehearsal session type |
| SMS costs extra | Robo-Texter billed separately per text | M1: SMS included in platform, not add-on |
| No teacher hour logging by type | Google Sheets timesheets emailed to PAYROLL@BAMSOCAL.COM by 26th | M4: Teacher logs hours by category in platform |

### Missing Features (No Workaround Exists)

| Missing Feature | Impact | Platform Module |
|----------------|--------|-----------------|
| Badge / achievement system | Manual recognition only; no physical patch ordering | M2 |
| Sub-brand program architecture | All students in one bucket; no Recreational/Performance/Competition distinction | M5 |
| Live parent viewing | No solution | M6 |
| Authorized family member access | No per-student family access control | M6 |
| Unified communications inbox | Quo used separately for SMS/calls | M1 |
| Digital signage feed | No solution; no waiting room screen | M1 |
| Legal document portal | No waiver collection, no W9 management, no mandated reporter tracking | M12 |
| Performance ticketing | TutuTix used separately (5%+$1/ticket fee) | M11 |
| Group social feed / BAND replacement | BAND used separately (ad-supported) | M10 |
| Photo distribution | Google Photos used separately | M13 |
| Biometric/facial recognition consent | No waiver type | M12 |
| Competition tracking (results, entries) | No solution | M3 |
| QR code attendance | No solution | M3 |
| Production management (Nutcracker timeline) | No solution; managed manually | M3 |

---

## 4. Tool Consolidation Map

Current tools being used in parallel with Studio Pro:

| Tool | Monthly Cost | Purpose | BAM Platform Replacement |
|------|-------------|---------|--------------------------|
| Studio Pro | ~$120-150/mo | Core studio management | M3, M4, M6, M7, M8 |
| Robo-Texter | Per-text billing | SMS to parents | M1 |
| BAND | Free (ad-supported) | Group scheduling + social feed | M10 |
| TutuTix | 5%+$1/ticket | Performance ticketing | M11 |
| Quo (my.quo.com) | ~$50-100/mo | Unified SMS/call inbox, AI responses | M1 |
| Google Sheets | Admin time cost | Teacher timesheets | M4 |
| Google Photos | ~$10/mo | Student photo albums, facial recognition | M13 |

**BAM phone numbers in Quo:** (949) 229-0846 (primary), (949) 736-5025

---

## 5. Jackrabbit Evaluation (June 2026)

Jackrabbit is the most credible alternative to Studio Pro for dance studios at BAM's size.

**What to evaluate:**
- [ ] Sub-brand / program tagging capabilities
- [ ] Session type flexibility (rehearsals, privates, comp sessions)
- [ ] Teacher pay category tracking
- [ ] Parent portal UX vs. Studio Pro
- [ ] Pricing at BAM's student volume
- [ ] Data migration feasibility from Studio Pro
- [ ] API availability for BAM Platform integration

**Decision criteria:** Only migrate if Jackrabbit eliminates at least 3 of the current workarounds without introducing new complexity.

---

## 6. Priority Platform Builds to Reduce Studio Pro Dependency

Build these first — they have the highest daily friction impact:

| Priority | Build | Reduces Studio Pro Dependency |
|----------|-------|-------------------------------|
| P0 | Attendance pre-fill (enrolled students default to present) | Reduces manual attendance entry per class |
| P1 | Teacher hour logging by category | Eliminates Google Sheets timesheet entirely |
| P1 | Session type labels (rehearsal, private, comp coaching) | Eliminates class-name workarounds |
| P1 | Sub-brand program records | Eliminates first-name prefix workaround |
| P2 | Unified communications inbox | Reduces Quo dependency |
| P3 | Legal document portal (M12) | Eliminates no-waiver risk |
| P3 | Performance ticketing (M11) | Eliminates TutuTix fees |
| P4 | Group social feed (M10) | Eliminates BAND |

---

## 7. Data We Must Protect During Any Migration

If we ever migrate away from Studio Pro, these records must transfer cleanly:

- Student profiles (name, DOB, parent info, emergency contacts)
- Enrollment history (all seasons, class history)
- Payment history
- Attendance records (for competition eligibility tracking)
- Teacher records and pay history
- Family contact preferences

**Do not migrate without a full data export validation.** Never go live on a new platform mid-season.

---

*Last updated: March 2026*
