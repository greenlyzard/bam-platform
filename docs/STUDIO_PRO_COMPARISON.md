# BAM Platform — Studio Pro Competitive Analysis & Gap Analysis
# docs/STUDIO_PRO_COMPARISON.md

**Purpose:** Cross-reference Studio Pro's 28 guide modules against BAM Platform's
current state. Identify gaps, define where we exceed them, and spec the Help Center.

---

## Studio Pro Feature Coverage vs BAM Platform

### ✅ BUILT — We Have It (Equal or Better)

| Studio Pro Feature | BAM Equivalent | BAM Advantage |
|---|---|---|
| Student management | Students module | Multi-guardian, structured addresses, geocoding |
| Parent portal | Parent portal | AI-native, real-time, mobile-first |
| Adding teachers & staff | Teachers module | Role firewall, contact protection |
| Enrolling students | Enrollment module | Stripe checkout, cart, quiz-based placement |
| Payment processor | Stripe integration | White-label ready, pluggable adapters |
| Parent portal communications | Communications module | Real-time chat, groups, announcements, SMS |
| Class schedule | Schedule module (in progress) | Room view, print, calendar sync |
| Attendance | Attendance module | Teacher mobile check-in, overpayment alerts |
| Tickets & Events | Ticketing module (stub) | — |
| Help Center | BAM Help Center (to build) | AI-powered, searchable, video-linked |

---

### 🔴 GAPS — Studio Pro Has It, We Don't Yet

| Studio Pro Feature | Priority | Notes |
|---|---|---|
| **Tuition: Hourly & Class Count Rates** | HIGH | We have fixed fees per class. No hourly rate or class count billing |
| **Tuition: Fixed by Student** | HIGH | We only have fixed by class. Need per-student override |
| **Registration Fees** | HIGH | One-time fees at enrollment — not built |
| **Discounts** | HIGH | Multi-student, sibling, loyalty discounts — not built |
| **Late Fees** | MEDIUM | Auto-apply late fee policy — not built |
| **Payment Terms** | MEDIUM | Early pay discount — not built |
| **Auto-Pay setup** | HIGH | Parents save card, auto-charge monthly — not built |
| **Running Auto-Pay** | HIGH | Batch charge all enrolled families — not built |
| **Due Dates & Transaction Codes** | MEDIUM | Grouping transactions for reporting — not built |
| **Posting Tuition** | HIGH | Monthly tuition batch posting — not built |
| **Importing Data (CSV)** | HIGH | Bulk import students/families from Studio Pro — not built |
| **Personal Assistant (automated reminders)** | MEDIUM | Late tuition, birthday, schedule reminders — partial (weekly digest built) |
| **Robo-Mailer / Robo-Texter** | MEDIUM | Bulk email/SMS — partial (announcements built, no Robo-Dialer) |
| **Class Manager (teacher tool)** | HIGH | Mobile teacher dashboard: attendance, lesson plans, notes, costume sizes |
| **Online Store** | LOW | Sell tights, leotards, shoes — not built |
| **Costume Console** | MEDIUM | Costume tracking, sizing, ordering — stub in casting module |
| **Recital Wizard** | MEDIUM | Full production playbook, volunteers, communication — casting module is partial |
| **Lesson Plans** | MEDIUM | Per-class curriculum planning for teachers — not built |
| **Sizes/Measurements** | MEDIUM | Student costume measurements — not built |
| **Point of Sale** | LOW | In-person payment terminal — not built |
| **Season management** | MEDIUM | Seasons table exists, UI is minimal |
| **Waitlist management** | HIGH | Waitlist when class is full — not built |

---

### 🚀 WHERE WE BEAT STUDIO PRO

These are BAM Platform capabilities that Studio Pro doesn't have at all:

| BAM Feature | Why It Wins |
|---|---|
| **Angelina AI** | Conversational AI for parents, admin consultation mode, email drafting |
| **Real-time messaging** | Group channels, DMs, message board — Studio Pro has a static bulletin board |
| **Personalized weekly digest** | Per-child schedule emails with calendar links and change highlights |
| **Multi-guardian system** | Multiple parents per student with roles — Studio Pro only has one parent |
| **Extended contacts (watchers)** | Grandparents/friends for live stream notifications |
| **Geographic optimization** | Structured addresses with lat/lng for marketing and location planning |
| **AI-powered class recommendations** | Enrollment quiz + Angelina suggest classes |
| **Casting & rehearsal module** | Production management, role assignment, rehearsal scheduling |
| **White-label SaaS** | Multi-tenant architecture — Studio Pro is single-tenant per studio |
| **Pluggable payment adapters** | Stripe, Authorize.net, Square, PayPal switchable per tenant |
| **Communication firewall** | Teacher role cannot see parent contact data — structural protection |
| **Schedule widget embed** | WordPress iframe embed for public website |
| **Timesheet + payroll** | Teacher hour logging, pay period management, payroll report |
| **Lead capture + CRM** | Angelina captures leads, admin pipeline view |
| **Compliance module** | Mandated reporter tracking |
| **Custom email builder** | Branded templates, sender alias (in progress) |

---

## Priority Build Queue (Gaps to Close)

### Phase 1 — Revenue Critical (build next)
1. **Tuition posting** — monthly batch, fixed by class or student
2. **Auto-pay** — parent saves card, monthly auto-charge
3. **Discounts** — sibling, multi-class, loyalty
4. **Registration fees** — one-time at enrollment
5. **Waitlist** — auto-enroll from waitlist when spot opens

### Phase 2 — Operational
6. **Class Manager** — teacher mobile dashboard
7. **Lesson plans** — per-class curriculum
8. **Student measurements/sizes** — costume sizing
9. **CSV import** — migrate from Studio Pro
10. **Late fees** — auto-apply policy

### Phase 3 — Growth
11. **Costume Console** — full costume management
12. **Recital Wizard** — production playbook
13. **Online Store** — merchandise sales
14. **Season management UI** — full CRUD

---

## Help Center Spec

### Purpose
Replace Studio Pro's static PDF guide with a dynamic, AI-powered help system
that serves three audiences:
- **BAM Staff** — how to use the platform operationally
- **BAM Parents** — how to use the parent portal
- **SaaS Clients** — how to set up and run their own studio on the platform

### Structure

The Help Center lives at `/help` (public) and `/admin/help` (staff-only articles).

#### Article Categories (mirroring Studio Pro's 28 guides but better)

**Getting Started**
- Welcome to Ballet Academy and Movement Platform
- Setting up your studio profile
- Adding your first season and classes
- Adding teachers and staff
- Importing students from another system

**Students & Families**
- Adding a family and student
- Managing multiple guardians
- Setting up emergency contacts
- Student profile and media consent
- Enrolling a student in classes

**Billing & Payments**
- Setting up tuition rates
- Discounts and sibling pricing
- Registration fees
- Setting up auto-pay
- Running monthly tuition
- Understanding your billing reports

**Communications**
- Sending a studio announcement
- Using group channels
- Direct messaging
- Setting up the weekly digest
- SMS notifications via Quo

**Schedule & Classes**
- Building your class schedule
- Managing substitutes and cancellations
- Printing the weekly schedule
- Embedding the schedule on your website

**Teachers**
- Teacher onboarding
- Using the Class Manager on mobile
- Taking attendance
- Logging hours and submitting timesheets
- Lesson plan templates

**Productions & Performances**
- Creating a production
- Casting students
- Managing rehearsals
- Selling tickets
- The Costume Console

**Angelina AI**
- What Angelina can do
- Using Angelina on the public website
- Admin consultation mode
- Drafting emails with Angelina
- Asking Angelina about your studio data

**Parent Portal Guide**
- Logging in for the first time
- Viewing your child's schedule
- Adding classes to your calendar
- Making payments
- Communicating with teachers

### Help Center Features

1. **Search** — full-text search across all articles
2. **Video embeds** — each article can embed a YouTube/Loom video
3. **AI assistant** — "Ask Angelina" widget on every help page:
   - Answers questions using the article content as context
   - Can look up live studio data if the parent is logged in
   - Escalates to staff if it can't answer
4. **Role-aware content** — articles shown based on role (parent sees parent articles, teacher sees teacher articles, admin sees all)
5. **Article feedback** — thumbs up/down + comment on each article
6. **Last updated date** — shown on every article
7. **Related articles** — suggested at the bottom of each article
8. **Print view** — clean printable version of any article
9. **Admin authoring** — Amanda or admin can write/edit articles in a simple rich text editor

### Database Schema

```sql
CREATE TABLE help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id), -- NULL = platform-wide
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  body text NOT NULL, -- markdown
  category text NOT NULL,
  audience text[] NOT NULL DEFAULT '{admin}',
  -- e.g. ['admin','teacher','parent','saas_client']
  video_url text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  author_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || body)
  ) STORED
);

CREATE INDEX idx_help_articles_search ON help_articles USING GIN(search_vector);
CREATE INDEX idx_help_articles_category ON help_articles(category, sort_order);

CREATE TABLE help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id),
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### UI Pages

- `/help` — public help center landing, search, category grid
- `/help/[category]` — article list for a category
- `/help/[category]/[slug]` — individual article with video, Angelina widget
- `/admin/help` — admin article management (create, edit, publish)
- `/admin/help/new` — rich text editor for new articles

### Angelina Integration on Help Pages

Every help page has a floating "Ask Angelina" button. When clicked:
- Opens a chat panel
- System prompt includes the current article content as context
- If the user is logged in, Angelina can look up their specific data
- Example: "When is my daughter's next class?" → Angelina checks enrollments and answers
- Example: "How do I add a sibling discount?" → Angelina explains from the article

---

## Studio Pro Weaknesses to Exploit in Marketing

When positioning BAM Platform against Studio Pro for SaaS clients:

1. **"Studio Pro is built for 2015"** — no AI, no real-time messaging, no mobile-first design
2. **"One parent per family"** — Studio Pro can't handle modern family structures
3. **"No teacher protection"** — Studio Pro doesn't prevent teachers from seeing parent contact data
4. **"Static help guides"** — 28 PDFs vs our AI-powered help that knows your studio
5. **"No white-label"** — Studio Pro is Studio Pro everywhere; our platform is your brand
6. **"No geographic intelligence"** — Studio Pro can't tell you where to open your next location
7. **"No AI class recommendations"** — parents have to figure out placement themselves
8. **"Robo-Dialer feels like 2010"** — our Quo integration is conversational, not robocalling

---

*Last updated: March 2026 | Green Lyzard / Ballet Academy and Movement*
