CLAUDE.md — Ballet Academy and Movement Studio
Platform
This file is the authoritative guide for Claude when working on this project. Read it at the
start of every session. It defines the domain, entities, architecture, phasing, and
collaboration norms.
1. Project Mission
Build a unified, modern studio management platform for Ballet Academy and Movement
(BAM) — a classical ballet studio in San Clemente, California, founded by professional
ballerina Amanda Cobb.
The platform replaces Studio Pro and all piecemeal tools (spreadsheets, disconnected
email, manual casting) with a single source of truth covering:
Student and family management
Season, class, and enrollment management
Performance, casting, and rehearsal coordination
Parent/student portal
Communication and announcements
Merch and ticketing (Phase 2)
Accounting integration via QuickBooks (Phase 3)
Target ship date for Studio Pro replacement: approximately 4 months from project
start.
2. Organization Context
Field Value
Studio Name Ballet Academy and Movement
Do NOT abbreviate publicly
as
BAM (trademark conflict)
Founder Amanda Cobb — former professional ballerina
Location 400-C Camino De Estrella, San Clemente, CA 92672
Phone (949) 229-0846
Email dance@bamsocal.com
Website balletacademyandmovement.com
Current tools
Studio Pro (GoStudioPro), Zapier, Klaviyo,
WordPress/Flatsome
Brand palette Lavender (#9C8BBF), cream, gold
Typography Cormorant Garamond
Culture note: BAM emphasizes nurturing, classical technique, and whole-child
development. Every product decision should respect this. The platform must feel warm and
refined — not corporate SaaS.
3. Primary User Types
Role Core Needs
Studio Owner / Director
(Amanda)
Control seasons, pricing, financials, reporting, casting
oversight
Studio Admin / Staff
Registrations, payments, communications, casting,
rehearsal logistics
Instructors Class rosters, attendance, performance assignments
Parents / Guardians
Register children, manage payments, view schedules, buy
tickets/merch
Students (older) View personal schedule, roles, rehearsal times
4. Core Domain Concepts
Understanding these entities and their relationships is essential before writing any code.
Families and Students
A Family is the billing and communication unit. One family can have multiple students.
A Student belongs to one family, has an age/grade, experience level, and enrollment
history.
Enrollment is the join between a student and a class within a season.
Seasons and Classes
A Season is a named time period (e.g., Fall 2026) with start/end dates, policies, and a
class catalog.
A Class has a style (ballet, jazz, contemporary, musical theatre), level
(beginner/intermediate/advanced), age range, capacity, schedule (day/time), and room
assignment.
Classes are tagged beginner-friendly or audition-required to aid parent selfselection.
Waitlists apply per class when capacity is reached.
Performances, Acts, Roles, and Casting
This is the highest-priority module. The current system is three Excel tables:
1. Roles — named parts in a production (e.g., Sugar Plum Fairy, Snowflake #3)
2. Schedule — performance and rehearsal dates/times
3. Casting — which student is assigned which role
The platform must model this cleanly:
A Performance (e.g., The Nutcracker 2026) contains multiple Acts
Each Act contains a set of Roles
A Casting record maps one Student to one Role
A Rehearsal is linked to one or more Acts, has a date/time, and generates a filtered
attendee list
The system must detect quick-change conflicts — when a student is cast in back-toback
acts with insufficient transition time
Payments and Financial Records
Every financial transaction is attributed to: Family, Student, Category (tuition / costume /
merch / ticket), Season/Event
Payment records must be structured to support eventual QuickBooks sync
Support tuition plans, one-time fees, scholarships, and discount codes
5. Key Entity Relationships (Text Diagram)
Family
└── Student (1..*)
└── Enrollment (1..*) → Class → Season
└── Casting (0..*) → Role → Act → Performance
Season
└── Class (1..*)
└── Enrollment (0..*)
└── ClassSession (schedule entries)
Performance
└── Act (1..*)
└── Role (1..*)
└── Casting → Student
└── Rehearsal (0..*)
└── RehearsalAttendee → Student (derived from Casting)
Family
└── Invoice (1..*)
└── LineItem (1..*)
└── Category: tuition | costume | ticket | merch | fee
6. Recommended Tech Stack
Web App (Initial Target)
Layer Choice Rationale
Frontend Next.js 14+ (App Router) SSR + RSC for fast page loads; great for
parent portal SEO
UI
Components
shadcn/ui + Tailwind CSS
Clean, accessible, customizable —
matches minimal luxury brand
State
Management
Zustand (client state) + React
Query (server state)
Simple, scalable
Backend
Next.js API Routes or Hono
(Node)
Colocation convenience; swap to
standalone API if needed
Database PostgreSQL via Supabase
Managed, row-level security, real-time,
auth built-in
ORM Drizzle ORM Type-safe, fast, migration-friendly
Auth Supabase Auth
Handles email, magic link, and rolebased
access
File Storage Supabase Storage
For costumes, show programs, rehearsal
schedules
Email
Resend (transactional) +
Klaviyo (marketing)
Clean separation of operational vs.
marketing comms
SMS Twilio For urgent announcements
Payments Stripe
Recurring tuition, one-time fees, tickets,
merch
Deployment Vercel Zero-config Next.js hosting
Future Packaging
Target Approach
iOS / Android app React Native or Capacitor wrapping the web app
Desktop app Electron wrapper (optional, low priority)
AI assistant Claude API via Anthropic SDK, embedded in staff workflows
7. Folder Structure
/
├── app/ # Next.js App Router
│ ├── (public)/ # Marketing / SEO pages
│ ├── (portal)/ # Parent + student portal
│ │ ├── dashboard/
│ │ ├── enroll/
│ │ ├── schedule/
│ │ ├── billing/
│ │ └── performances/
│ ├── (staff)/ # Admin + instructor views
│ │ ├── dashboard/
│ │ ├── seasons/
│ │ ├── classes/
│ │ ├── students/
│ │ ├── performances/
│ │ │ ├── casting/
│ │ │ └── rehearsals/
│ │ └── communications/
│ └── api/ # API routes
│ ├── students/
│ ├── seasons/
│ ├── classes/
│ ├── enrollments/
│ ├── performances/
│ ├── casting/
│ ├── rehearsals/
│ ├── payments/
│ └── communications/
├── components/
│ ├── ui/ # shadcn/ui base components
│ ├── studio/ # BAM-specific components
│ │ ├── CastingBoard/
│ │ ├── RehearsalCalendar/
│ │ ├── EnrollmentWizard/
│ │ └── ClassCard/
│ └── layouts/
├── lib/
│ ├── db/ # Drizzle schema + migrations
│ │ ├── schema.ts
│ │ └── migrations/
│ ├── auth/
│ ├── payments/ # Stripe helpers
│ ├── communications/ # Email + SMS helpers
│ └── ai/ # Claude API integration
├── hooks/
├── types/
├── CLAUDE.md # This file
└── docs/
├── data-model.md
├── api-reference.md
└── deployment.md
8. Phased Implementation Plan
Phase 1 — Performance, Casting & Rehearsal Module (Weeks 1–4)
Goal: Replace the Excel casting/rehearsal system with a proper data model and usable UI.
Milestones:
Database schema: Performance, Act, Role, Casting, Rehearsal
Staff UI: Create/edit performances and acts
Staff UI: Assign roles to students (casting board)
Rehearsal scheduler: link rehearsals to acts, auto-generate attendee lists
Conflict detection: flag students with quick-change risks (< configurable buffer time)
Export: PDF rehearsal schedule per student, per act
Acceptance criteria: Amanda can set up The Nutcracker casting entirely in the platform and
generate individual student rehearsal PDFs.
Phase 2 — Seasons, Classes & Registration (Weeks 3–7)
Goal: Families can self-register for classes each season. Staff can manage capacity and
waitlists.
Milestones:
Database schema: Season, Class, ClassSession, Enrollment, Waitlist
Class catalog with filters: age, level, style, day/time
New family onboarding flow (account → add children → browse classes → enroll)
Returning family re-enrollment flow
Capacity enforcement + waitlist queue
Age/prerequisite validation on enrollment
Staff enrollment dashboard (who is in each class, vacancies, waitlist)
Acceptance criteria: A new parent can complete full enrollment for a child in under 5
minutes on mobile.
Phase 3 — Parent/Staff Portals & Communications (Weeks 6–10)
Goal: Functional, modern portal experiences and reliable announcement delivery.
Milestones:
Parent portal: schedule view, billing overview, performance role display
Instructor portal: roster, attendance marking
Admin dashboard: enrollment stats, upcoming rehearsals, unpaid balances
Announcement builder: target by season / class / performance / all families
Delivery: email (Resend) + in-app notification + optional SMS (Twilio)
Klaviyo export for marketing audiences
Acceptance criteria: Admin can send a targeted rehearsal reminder to all families in Act 2 of
The Nutcracker in under 2 minutes.
Phase 4 — Ticketing & Merch (Weeks 9–13)
Goal: Sell tickets to performances and studio merch via the platform.
Milestones:
Performance ticketing: general admission, Stripe checkout
Ticket delivery: email PDF with QR code
Merch / pro shop: product catalog, order flow, inventory tracking
Sugar Plum Shop POS integration (Nutcracker-era concession/souvenir sales)
Scholarship codes + discount logic
Phase 5 — Accounting & Reporting (Weeks 12–16)
Goal: Clean financial reporting and QuickBooks-ready data pipeline.
Milestones:
Revenue reports: by season, class type, event, category
QuickBooks sync (summarized or line-item export)
Tuition aging report (unpaid/overdue)
Season profitability overview
9. AI Assistant Integration (Claude’s Role in the Product)
Claude will be embedded in the staff workflow to assist with:
Feature Description
Schedule planner
Suggest rehearsal schedules given cast size, room availability, and
show date
Enrollment
analysis
Identify under-enrolled classes, flag capacity risks
Casting
suggestions
Given a cast list and act order, flag potential quick-change conflicts
Communication
drafting
Generate announcement drafts for rehearsal changes, show info,
policy updates
New season setup
Walk owner through copying prior season, updating policies, and
opening enrollment
Claude API calls should be made server-side from /lib/ai/ helpers. Never expose API
keys client-side.
10. How Claude Should Behave on This Project
Planning vs. Coding
Always clarify scope before writing code for any module larger than a single
component or API route.
For new modules, propose the data model and API shape first. Get confirmation before
building UI.
When in doubt, ask: “Should I design this or build it?”
Code Style
TypeScript everywhere. No any types.
Drizzle schema is the single source of truth for data shape — derive TypeScript types
from it.
API routes should validate inputs with Zod.
Component files: one component per file, named exports for smaller pieces, default
export for page-level components.
Prefer server components; use client components only when interactivity requires it.
Write comments for non-obvious logic (especially casting conflict detection, financial
calculations).
Testing
Unit tests for: conflict detection logic, financial calculation helpers, enrollment validation
rules.
Integration tests for: enrollment flow, casting assignment, announcement delivery.
E2E tests (Playwright) for: new parent registration, class enrollment, admin casting
board.
Database Migrations
All schema changes go through Drizzle migrations — never edit the DB directly.
Migration files are committed to version control.
Security
Row-level security via Supabase policies — parents can only see their own family’s data.
Instructors can read student data for their classes only.
Admin/owner roles have full access.
Mandated reporter compliance: instructors must acknowledge California reporting
obligations during onboarding. Log acknowledgments in the DB.
Performance
Cast list and rehearsal schedule queries must be fast — these run during live show prep.
Index foreign keys on Enrollment, Casting, and Rehearsal tables.
Paginate all list views; never load unbounded datasets.
11. Key Business Rules (Do Not Break These)
1. A student cannot be enrolled in two classes that overlap in time within the same season.
2. A student flagged with a quick-change conflict must be surfaced to admin before the
casting record is saved — but the save should not be blocked (warn, don’t prevent).
3. Registration must feel simpler than e-commerce checkout. Maximum 3 steps: choose
class → confirm child info → pay.
4. All financial transactions must carry a Category tag. No untagged transactions.
5. The platform must never publicly abbreviate the studio as “BAM.”
6. Class sizes are capped at 10 students. Enforce hard capacity limits.
7. Instructor onboarding must include mandated reporter acknowledgment — this is nonnegotiable.
12. Competitive Context
BAM competes in three segments across South Orange County:
Ballet schools: Pacific Ballet Conservatory, Southland Ballet Academy
Competition/commercial studios: Variant, Pave, Moxie, On Deck
Recreational beginners: Tutu School, Bonjour Ballet, San Clemente Dance Academy,
Capistrano Academy of Dance, South Coast Conservatory
The platform should position BAM’s enrollment experience as clearly more polished and
trustworthy than any of these competitors.
13. Out of Scope (For Now)
Teacher-facing scheduling/availability management (Phase 2+)
Live video or virtual classes
Multi-location support (designed for, but not built until second location is confirmed)
Native mobile app binary (web app first; app store packaging is Phase 2)
Advanced CRM (Zoho/HubSpot/Salesforce) — Klaviyo integration is sufficient initially
14. Reference Documents
Document Location Purpose
BAM AI Knowledge
Base
/docs/bam-knowledgebase.
pdf
Full org context, brand, competitors
Vision Document /docs/vision.md
Detailed feature requirements (source
of this file)
Data Model /docs/data-model.md Entity schemas and relationships
API Reference
/docs/apireference.
md
Endpoint specs
Deployment Guide /docs/deployment.md Vercel + Supabase setup
Last updated: March 2026. Maintained by Derek / Ballet Academy and Movement.
