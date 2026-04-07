# Competitive Platform Analysis: Dance Master Pro
**Source:** https://dancemasterpro.com  
**Analyzed:** April 2026  
**Purpose:** Identify features and strategies present in Dance Master Pro that are not yet on the BAM Platform roadmap, for consideration in future planning cycles.

---

## Platform Overview

Dance Master Pro is a cloud-based, multi-language (EN/ES/DE/FR/IT) dance studio management SaaS targeting studios of all sizes globally. Pricing model is per-student-count (pay-as-you-need) with all features always included. They offer a full concierge setup service — clients send Excel files and DMP configures the platform for them. WhatsApp is their primary support channel.

Their AI layer is an optional paid add-on on top of the base license.

---

## What BAM Platform Already Has ✅

For reference — these DMP features are already covered:

- Class scheduling and calendar
- Student enrollment and registration
- Stripe payment processing
- Attendance tracking
- Teacher/staff management with payroll
- Parent/guardian portal
- Push, email, and SMS notifications
- Performance and competition event tracking
- Private sessions
- Role-based access control (RBAC)
- AI assistant (Angelina)
- Dashboard with KPIs

---

## Gap Analysis: Features NOT Yet on the BAM Roadmap

The following DMP capabilities are absent from the current BAM Platform build and roadmap. Each item includes a BAM-specific assessment.

---

### 1. Choreography Management Module

**What DMP does:**
- Dedicated module for cataloging all dance routines/pieces
- Each choreography entry stores: title, discipline, cast/role assignments, notes, linked music files, linked video references
- Rehearsal scheduling tied directly to choreography entries
- Role assignment per student per piece
- Media attachment (video links, audio, PDF notes) directly on each routine

**BAM Gap:**
We currently have rehearsal events on the schedule and performance tracking, but no unified choreography catalog linking pieces → cast → rehearsals → media. Nutcracker production management is a real pain point that this would solve.

**BAM Priority:** HIGH — especially for Nutcracker and Spring Showcase seasons.

**Suggested module name:** `Choreography & Production Manager`

---

### 2. Online Resource Library (Staff-Facing)

**What DMP does:**
- Internal document library accessible only to staff (not parents/students)
- Organized by course or project
- Stores: syllabi, PDFs, teaching notes, music playlists
- Permission controls per document/folder
- Multi-device sync with version history

**BAM Gap:**
We have no internal knowledge base or document repository for teachers. Amanda's syllabi, technique progressions, dress code documents, teacher handbooks, and mandated reporter training materials live outside the platform (likely Google Drive or email).

**BAM Priority:** MEDIUM — critical for teacher onboarding and consistency as the studio grows toward multi-location.

**Suggested module name:** `Staff Resource Library`

---

### 3. Medical Certificate & Health Record Tracking

**What DMP does:**
- Each student profile stores medical certificate/health record status
- Tracks expiration dates on certificates
- Enrollment can be gated on valid health record on file
- Alerts when medical docs are expiring

**BAM Gap:**
Student profiles currently store basic info and guardian relationships. There is no structured place to record allergies, medical conditions, emergency medical consent, or insurance info beyond free-text notes. For a studio with 3–5 year olds this is a liability gap.

**BAM Priority:** HIGH — medical/safety records for minors are an operational and legal necessity.

**Suggested table:** `student_health_records` with fields: allergies, conditions, emergency_contact_override, physician_name, physician_phone, insurance_carrier, insurance_policy_number, photo_consent, media_release.

---

### 4. Digital Signage Integration

**What DMP does:**
- Class schedule can be output to a digital signage display format
- Studio lobby screen shows current/upcoming classes, room assignments, teacher names

**BAM Gap:**
No in-studio display system exists. For a growing studio moving toward a second location, a lobby display is a low-cost professional touch.

**BAM Priority:** LOW-MEDIUM — nice-to-have for Phase 2. Could be a simple read-only public URL rendering the daily schedule in kiosk mode.

**Implementation note:** This is a lightweight feature — a `/display/schedule` route with no auth, auto-refreshing, designed for a tablet mounted in the lobby.

---

### 5. AI Student Retention Risk System

**What DMP does:**
- Analyzes attendance trends, payment behavior, and engagement patterns per student
- Flags students at risk of dropping out before they actually leave
- Surfaces a prioritized list of "students to contact this week"
- Suggests specific action per student (call, email, offer makeup class, etc.)

**BAM Gap:**
Angelina has studio-wide awareness but no proactive retention scoring model. There is no mechanism that surfaces "these 3 students haven't attended in 2 weeks and their auto-pay is due — reach out now."

**BAM Priority:** HIGH — churn prevention is directly tied to revenue stability. This is a natural extension of Angelina's existing capabilities.

**Suggested Angelina skill:** `retention_risk_scan` — runs nightly, scores each active student on a retention risk index, writes results to a `student_retention_scores` table, surfaces top risks in Angelina's dashboard card.

---

### 6. AI Course Performance Insights

**What DMP does:**
- Per-class analytics: enrollment trend (growing/shrinking), attendance rate, revenue contribution
- Flags underperforming classes before they become a problem
- Identifies classes nearing capacity (opportunity to open a second section)

**BAM Gap:**
We have revenue KPI cards and the schedule page, but no automated "this class is struggling" or "this class is full, consider adding a section" intelligence layer.

**BAM Priority:** MEDIUM — valuable for Amanda's planning but secondary to retention risk.

**Suggested Angelina skill:** `class_performance_digest` — weekly summary card showing class health scores.

---

### 7. AI Payment Intelligence & Automated Follow-Up Drafting

**What DMP does:**
- Late payment detection with priority ranking (who is most overdue, who is a flight risk)
- One-click message drafting for payment reminders — personalized to the family
- Reactivation message drafts for lapsed students
- Messages available in multiple languages

**BAM Gap:**
Payment reminders are currently manual. Once tuition/auto-pay is built, we will need an intelligent follow-up layer — not just scheduled drip emails, but context-aware messaging ("Maria hasn't paid and also missed 3 classes — this message should acknowledge both").

**BAM Priority:** HIGH (dependent on tuition/auto-pay module being built first).

**Suggested Angelina skill:** `payment_followup_composer` — given a student + payment status + attendance context, drafts a warm, BAM-voiced message for Amanda or Cara to review and send.

---

### 8. Formal Electronic Invoicing System

**What DMP does:**
- Generates PDF invoices per payment, saved automatically to connected cloud storage (Google Drive / OneDrive / Dropbox)
- Invoice numbering, line items, studio branding
- Separate from payment receipts — proper invoice records for families who need them for FSA/HSA reimbursement or employer tuition benefits

**BAM Gap:**
Stripe generates payment receipts but not formal invoices. Some families (especially upper-income households using dependent care FSAs or employer arts benefits) will need itemized invoices for reimbursement.

**BAM Priority:** MEDIUM — directly supports the target demographic. FSA-eligible arts education is a growing trend.

**Implementation note:** Could be a lightweight PDF generation feature triggered per tuition payment, stored in Supabase Storage and linked from the parent portal.

---

### 9. Membership / Association Card System

**What DMP does:**
- Formal "membership" concept separate from enrollment
- Each student gets a membership card/ID with expiration
- Membership status gates certain platform actions (competition sign-up, etc.)
- Relevant in markets where studio membership is a formal legal/tax structure (common in Europe)

**BAM Gap:**
Less immediately relevant for California, but worth noting for white-label SaaS — studios in other states or countries may need formal membership tracking. Could evolve into a BAM "Dancer ID" or student ID card feature.

**BAM Priority:** LOW for BAM specifically, MEDIUM for white-label SaaS consideration.

---

### 10. Competition Registration & Data Export Module

**What DMP does:**
- Dedicated competition registration flow: select students → assign pieces → collect required info
- Bulk data export in the format competition organizers require
- Tracks which students are registered for which competitions and in which categories

**BAM Gap:**
Competition events exist on the schedule but there's no structured competition entry management. Currently this is managed ad hoc (spreadsheets, emails to competition organizers). As BAM grows its competitive track this will become a pain point.

**BAM Priority:** MEDIUM — not urgent for a classical ballet studio positioning away from competition dance, but valuable for showcases and regional festivals.

---

### 11. Attendance Score / Grade Tracking Per Session

**What DMP does:**
- Attendance check-in includes a "score" field — teachers can rate/note student performance per class
- Creates a longitudinal performance record beyond just present/absent

**BAM Gap:**
We track attendance (present/absent/late) but not per-class progress notes from the teacher. A teacher noting "working on arabesque alignment" or "ready for Level 3" in the attendance record would be valuable for student progress visibility and parent communication.

**BAM Priority:** MEDIUM — aligns with the student experience vision ("class progression tracking") in the project spec.

**Suggested addition:** Add an optional `session_notes` and `progress_flag` field to the attendance record. Surface in student profile and parent portal.

---

### 12. Concierge Onboarding / Setup Service (Business Model Observation)

**What DMP does:**
- Offers full configuration setup as a service: clients email their Excel files and DMP's team builds the platform configuration for them
- This dramatically reduces time-to-value for new studio customers

**BAM White-Label Implication:**
When BAM Platform eventually white-labels to other studios, offering a concierge onboarding service (or at minimum an import wizard for common formats like Dance Studio Pro exports) will be a competitive necessity. Studios will not want to re-enter years of student data manually.

**BAM Priority:** LOW now, HIGH when white-label SaaS launches.

---

## Strategic Observations

### DMP's Positioning vs. BAM Platform

| Dimension | Dance Master Pro | BAM Platform |
|---|---|---|
| AI approach | Separate add-on, data analysis focus | Embedded Angelina, conversational + operational |
| Target market | Global, any dance style | US classical ballet focus (white-label later) |
| Onboarding | Concierge setup service | Self-serve (needs wizard) |
| Payments | Stripe only | Pluggable (Stripe, Auth.net, Square, PayPal) |
| Mobile | Web-responsive only | Native push notifications + mobile app planned |
| Choreography | Full module | Not built |
| Resource library | Staff-facing document store | Not built |
| Medical records | Structured per student | Not built |
| Retention AI | Proactive risk scoring | Angelina (extensible) |
| Invoicing | PDF + cloud storage | Payment receipts only |

### Key Takeaway

DMP's strongest differentiator over BAM Platform today is the **Choreography Management + Online Resource Library + Medical Records** triangle. These three features together create a meaningful operational advantage for studios managing productions. The AI layer is directionally similar to Angelina but less conversational and more dashboard-driven.

BAM Platform's advantages are: deeper RBAC, richer parent/guardian model, superior notification architecture, better multi-role support (planned), and a far more capable AI assistant foundation.

---

## Recommended Additions to BAM Roadmap

In priority order:

1. **Medical/Health Records on Student Profile** — safety and liability, immediate need
2. **AI Retention Risk Scoring** (Angelina skill) — revenue protection, natural Angelina extension
3. **Choreography & Production Manager** — Nutcracker/showcase use case, high Amanda value
4. **Staff Resource Library** — teacher onboarding and consistency
5. **Session Progress Notes on Attendance** — student experience and parent transparency
6. **Formal Invoice PDF Generation** — FSA/HSA support for target demographic
7. **Lobby Display / Digital Signage route** — lightweight, professional touch
8. **Concierge Import Wizard** — white-label SaaS prerequisite (future)
9. **Competition Entry Manager** — future as studio grows

---

*Generated from live competitive research of dancemasterpro.com — April 2026*  
*Next: Compare jackrabbittech.com, thinkeric.com (Studio Director), and Pike13*
