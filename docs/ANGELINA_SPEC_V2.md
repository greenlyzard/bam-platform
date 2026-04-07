# Angelina AI Assistant — Technical Specification V2

## Overview

Angelina is Ballet Academy and Movement's AI assistant, powered by the Anthropic Claude API
(`claude-sonnet-4-5-20250514` model). She operates across four contexts, each with role-specific
data access and system prompts assembled from live database queries.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  AngelinaChat component (floating / fullpage / embed)│
│  SSE streaming consumer                              │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/angelina/chat
                       ▼
┌─────────────────────────────────────────────────────┐
│                    API Route                         │
│  1. Auth check (getUser)                            │
│  2. Rate limiting (per user/session)                │
│  3. buildAngelinaContext(role, userId, tenantId)     │
│  4. Anthropic messages.stream()                      │
│  5. SSE response + DB persistence                    │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Supabase   │ │ Anthropic│ │  angelina_   │
│ (live data)  │ │   API    │ │conversations │
└──────────────┘ └──────────┘ └──────────────┘
```

## Four Context Builders

### 1. Public Context (`buildPublicContext`)
- **Data injected:** Active class catalog (name, level, ages, day/time, teacher, fee, spots), teacher names & bios, studio info
- **Token budget:** ~1500 tokens for class list (capped at 30 classes)
- **Purpose:** Lead capture, class discovery, trial class booking

### 2. Parent Context (`buildParentContext`)
- **Data injected:** Parent's children (name, age, level), enrolled classes with teacher/room/time, upcoming schedule instances (14 days), attendance summary (4 weeks)
- **Scoping:** Only this parent's children — enforced at query level via `parent_id = userId`
- **Purpose:** Schedule questions, attendance tracking, studio info

### 3. Teacher Context (`buildTeacherContext`)
- **Data injected:** Today's classes, full weekly schedule, student rosters per class (names only — no contact info), hour logging status, open sub requests
- **Scoping:** Only this teacher's classes — enforced via `teacher_id = userId`
- **Contact firewall:** Teacher never sees parent email, phone, or address
- **Purpose:** Schedule management, roster review, hour tracking

### 4. Admin Context (`buildAdminContext`)
- **Data injected:** Total enrollment, enrollment by level, today's full schedule with teachers, class capacity alerts (full/near-full), open sub requests, pending approval tasks, new leads from public chat, teacher onboarding gaps, mandated reporter incident count, **retention risk summary (top 5 at-risk students)**, **class performance digest (underperforming classes)**
- **Purpose:** Studio operations overview, lead management, staffing visibility, proactive retention

---

## Proactive Intelligence Skills ← NEW (from DMP gap analysis)

These are scheduled skills that run autonomously and surface results in the Admin context. They extend Angelina from a reactive Q&A assistant to a proactive operations intelligence layer.

---

### Skill 1: `retention_risk_scan`

**What it does:** Nightly job that scores every active enrolled student on a retention risk index and writes results to `student_retention_scores`. Top risks surface in Angelina's admin dashboard card.

**Risk Signal Sources:**
| Signal | Weight | Logic |
|---|---|---|
| Attendance streak | High | 2+ consecutive absences in last 30 days |
| Attendance rate | High | Below 60% attendance in last 4 weeks |
| Enrollment status | Medium | Enrollment created < 60 days ago (new = higher churn risk) |
| Payment behavior | High | Any failed/overdue payment in last 30 days (requires tuition module) |
| Session gap | Medium | No attendance record in last 14 days when class was scheduled |

**Risk Score:** 0–100 integer. Higher = higher risk. Threshold for surfacing: ≥ 60.

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS student_retention_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  score           integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk_signals    jsonb DEFAULT '[]',  -- array of triggered signal strings
  suggested_action text,              -- Angelina-generated suggested outreach
  scored_at       timestamptz NOT NULL DEFAULT now(),
  dismissed_at    timestamptz,        -- admin dismissed this alert
  dismissed_by    uuid REFERENCES profiles(id),
  acted_on_at     timestamptz,        -- admin marked as handled
  UNIQUE(tenant_id, student_id)       -- upsert on nightly run
);

CREATE INDEX IF NOT EXISTS idx_retention_scores_tenant ON student_retention_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retention_scores_score  ON student_retention_scores(score DESC);
```

**Cron route:** `GET /api/cron/retention-risk-scan` (runs nightly at 2:00 AM via Vercel Cron)

**Admin Dashboard Card:**
```
⚠️ Students to Reach Out To This Week (3)

• Sofia M. — missed 3 classes, attendance 45%
  → "Consider reaching out to offer a makeup class"
• Lily T. — no attendance in 14 days
  → "Check in — trial conversion risk"
• Oliver R. — payment failed + 2 absences
  → "Billing follow-up needed"

[View All] [Dismiss]
```

**Angelina Admin Query Examples:**
- "Which students are at risk of dropping?" → surfaces top 5 from `student_retention_scores`
- "What should I do about Sofia?" → pulls Sofia's score + signals + generates BAM-voiced outreach draft

---

### Skill 2: `class_performance_digest`

**What it does:** Weekly job (runs Sunday night) that computes class health scores and surfaces underperforming or over-capacity classes in Angelina's admin dashboard.

**Class Health Metrics:**
| Metric | Good | Concern | Critical |
|---|---|---|---|
| Fill rate (enrolled / max_students) | ≥ 70% | 40–70% | < 40% |
| Attendance rate (last 4 weeks) | ≥ 75% | 50–75% | < 50% |
| Enrollment trend | Stable/growing | Flat | Declining |
| Waitlist | Any waitlist | 0 waitlist, full | 0 waitlist, < 50% full |

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS class_performance_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  class_id        uuid NOT NULL REFERENCES classes(id),
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  fill_rate       numeric(4,1),        -- enrolled / max_students * 100
  attendance_rate numeric(4,1),        -- avg attendance last 4 weeks
  enrolled_count  integer,
  max_students    integer,
  waitlist_count  integer,
  health_status   text CHECK (health_status IN ('healthy','concern','critical','full')),
  insights        jsonb DEFAULT '[]',   -- array of AI-generated insight strings
  UNIQUE(tenant_id, class_id, snapshot_date)
);
```

**Admin Dashboard Card (weekly):**
```
📊 Class Performance — Week of Apr 7

🔴 Needs Attention (2)
• Tuesday Pre-Ballet — 3/10 enrolled (30%)
  → "Consider promoting to families with age 3–5 children not yet enrolled"
• Thursday Level 2B — 45% attendance last 4 weeks
  → "Review with teacher — possible scheduling conflict"

🟡 Approaching Capacity (1)
• Saturday Level 1 — 9/10 enrolled
  → "Consider opening a second Saturday section"

🟢 Healthy (8 classes)
[View Full Report]
```

**Angelina Admin Query Examples:**
- "Which classes are struggling?" → returns `health_status = 'concern' OR 'critical'`
- "Is Tuesday Pre-Ballet filling up?" → pulls specific class snapshot
- "Should I add another Level 1 section?" → cross-references waitlist + fill rate + room availability

---

### Skill 3: `payment_followup_composer`

**What it does:** When tuition/auto-pay is built, this skill generates context-aware, BAM-voiced payment follow-up messages for admins to review and send. It accounts for attendance context so the message feels personal rather than robotic.

**Trigger conditions:**
- Payment overdue > 3 days (once tuition module exists)
- Failed autopay charge
- Account credit balance < $0

**Message generation logic:**
```
Input: student_id, family_id, payment_status, attendance_last_30_days, last_class_attended

If student has attended recently AND payment is only slightly overdue:
  → Gentle reminder tone: "Hi [name], just a friendly reminder..."

If student has NOT attended recently AND payment is overdue:
  → Combined attendance + payment message: "We've missed [child] in class and noticed..."

If payment failed multiple times:
  → More direct: "We need to resolve an outstanding balance..."
```

**Admin UI:**
- Appears on family profile as "Draft Outreach" card when payment issue + risk signal both present
- Admin clicks → Angelina generates a draft → Admin reviews + sends (never auto-sends)
- Draft uses BAM voice (warm, refined, not corporate)
- Logged to `communication_threads` after send

**Dependencies:** Requires tuition/auto-pay module to be built first (STUDIO_PRO_COMPARISON.md Phase 1 items).

---

## Database Schema (Existing)

### angelina_conversations
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| user_id | UUID | FK → profiles, null for public |
| session_id | TEXT | Random UUID per session |
| role | TEXT | public/parent/teacher/admin |
| messages | JSONB | Full conversation history |
| context_snapshot | JSONB | Data snapshot at session start |
| lead_email | TEXT | Captured from public chat |
| lead_name | TEXT | |
| lead_child_name | TEXT | |
| lead_child_age | INT | |
| lead_converted | BOOLEAN | Did they book a trial? |
| token_usage | JSONB | Input/output token counts |

### angelina_feedback
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| conversation_id | UUID | FK → angelina_conversations |
| message_index | INT | Which message rated |
| rating | TEXT | helpful / not_helpful |
| comment | TEXT | Optional |

---

## Streaming Architecture

The API route uses Server-Sent Events (SSE):

1. Client sends `POST /api/angelina/chat` with `{ message, sessionId, conversationId }`
2. Server builds context, calls `anthropic.messages.stream()`
3. Each `content_block_delta` event sends `data: {"text":"..."}\n\n`
4. `message_stop` event sends `data: [DONE]\n\n`
5. After stream completes, conversation is persisted to `angelina_conversations`
6. New conversation ID is sent as `data: {"conversationId":"..."}\n\n`

---

## Lead Capture Flow (Public Context)

1. After 3+ user messages, Angelina naturally asks for name/age/email
2. Client-side regex extracts email from user messages
3. If email found, `POST /api/angelina/lead` saves to conversation record
4. Admin dashboard at `/admin/angelina` shows all captured leads

---

## Rate Limiting

| Role | Limit | Window |
|------|-------|--------|
| Public | 20 messages | Per hour per session |
| Parent | 50 messages | Per hour per user |
| Teacher | 50 messages | Per hour per user |
| Admin | 100 messages | Per hour per user |

When exceeded: "I've reached my limit for now. Please contact us directly at dance@bamsocal.com or (949) 229-0846."

---

## Adding New Data Sources

To inject new data into a context builder:

1. Add the Supabase query in the appropriate `build[Role]Context` function in `lib/angelina/context.ts`
2. Format the data as plain text (not JSON — LLMs read text better)
3. Add it to the system prompt string under a clear section header
4. Keep total system prompt under ~4000 tokens — summarize large datasets

---

## Cron Schedule

| Job | Route | Schedule | Tables Written |
|---|---|---|---|
| Retention Risk Scan | `/api/cron/retention-risk-scan` | `0 2 * * *` (2am nightly) | `student_retention_scores` |
| Class Performance Digest | `/api/cron/class-performance-digest` | `0 1 * * 0` (1am Sunday) | `class_performance_snapshots` |
| Resource Recommendations | `/api/cron/resource-recommendations` | `0 6 * * *` (6am daily) | `resource_recommendations` |

---

## Cost Monitoring

Token usage is stored in `angelina_conversations.token_usage` as:
```json
{ "input_tokens": 1234, "output_tokens": 567 }
```

Query total usage: `SELECT SUM((token_usage->>'input_tokens')::int) FROM angelina_conversations`

---

## Security

- `ANTHROPIC_API_KEY` is server-side only — never exposed to client
- Role is determined from server-side auth, not client request
- RLS policies scope conversation access by user_id
- Parent/teacher contexts enforce data isolation at query level
- Input is HTML-stripped and truncated to 2000 chars
- Lead data (emails) stored server-side only — never returned to client

---

## Future: Tool Use / Function Calling

Phase 2 will add Anthropic tool use for actions (not just questions):
- Book a trial class
- Request a makeup class
- Submit a sub request
- Log teacher hours
- Award a badge
- **Draft payment follow-up message** (Skill 3 above)
- **Dismiss a retention risk alert**

These will use the same context builders but add `tools` to the API call.

---

## File Map

| File | Purpose |
|------|---------|
| `lib/angelina/context.ts` | Context builders (system prompt assembly) |
| `lib/angelina/retention.ts` | **NEW** — retention risk scoring logic |
| `lib/angelina/class-performance.ts` | **NEW** — class health snapshot logic |
| `app/api/angelina/chat/route.ts` | Main chat API with SSE streaming |
| `app/api/angelina/lead/route.ts` | Lead capture endpoint |
| `app/api/angelina/feedback/route.ts` | Feedback (thumbs up/down) endpoint |
| `app/api/angelina/conversations/route.ts` | Admin conversation list |
| `app/api/cron/retention-risk-scan/route.ts` | **NEW** — nightly retention scoring |
| `app/api/cron/class-performance-digest/route.ts` | **NEW** — weekly class health snapshot |
| `components/angelina/AngelinaChat.tsx` | Reusable chat UI component |
| `app/(portal)/portal/chat/page.tsx` | Parent full-page chat |
| `app/(teach)/teach/chat/page.tsx` | Teacher full-page chat |
| `app/(admin)/admin/chat/page.tsx` | Admin full-page chat |
| `app/(admin)/admin/angelina/page.tsx` | Admin conversation dashboard |
| `app/(public)/widget/angelina/page.tsx` | Public embeddable widget |
| `supabase/migrations/20260311000017_create_angelina_tables.sql` | Existing migration |
| `supabase/migrations/[timestamp]_create_angelina_intelligence_tables.sql` | **NEW** — retention + performance tables |
