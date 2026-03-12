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
- **Data injected:** Total enrollment, enrollment by level, today's full schedule with teachers, class capacity alerts (full/near-full), open sub requests, pending approval tasks, new leads from public chat, teacher onboarding gaps, mandated reporter incident count
- **Purpose:** Studio operations overview, lead management, staffing visibility

## Database Schema

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

## Streaming Architecture

The API route uses Server-Sent Events (SSE):

1. Client sends `POST /api/angelina/chat` with `{ message, sessionId, conversationId }`
2. Server builds context, calls `anthropic.messages.stream()`
3. Each `content_block_delta` event sends `data: {"text":"..."}\n\n`
4. `message_stop` event sends `data: [DONE]\n\n`
5. After stream completes, conversation is persisted to `angelina_conversations`
6. New conversation ID is sent as `data: {"conversationId":"..."}\n\n`

## Lead Capture Flow (Public Context)

1. After 3+ user messages, Angelina naturally asks for name/age/email
2. Client-side regex extracts email from user messages
3. If email found, `POST /api/angelina/lead` saves to conversation record
4. Admin dashboard at `/admin/angelina` shows all captured leads

## Rate Limiting

| Role | Limit | Window |
|------|-------|--------|
| Public | 20 messages | Per hour per session |
| Parent | 50 messages | Per hour per user |
| Teacher | 50 messages | Per hour per user |
| Admin | 100 messages | Per hour per user |

When exceeded: "I've reached my limit for now. Please contact us directly at dance@bamsocal.com or (949) 229-0846."

## Adding New Data Sources

To inject new data into a context builder:

1. Add the Supabase query in the appropriate `build[Role]Context` function in `lib/angelina/context.ts`
2. Format the data as plain text (not JSON — LLMs read text better)
3. Add it to the system prompt string under a clear section header
4. Keep total system prompt under ~4000 tokens — summarize large datasets

## Cost Monitoring

Token usage is stored in `angelina_conversations.token_usage` as:
```json
{ "input_tokens": 1234, "output_tokens": 567 }
```

Query total usage: `SELECT SUM((token_usage->>'input_tokens')::int) FROM angelina_conversations`

## Security

- `ANTHROPIC_API_KEY` is server-side only — never exposed to client
- Role is determined from server-side auth, not client request
- RLS policies scope conversation access by user_id
- Parent/teacher contexts enforce data isolation at query level
- Input is HTML-stripped and truncated to 2000 chars
- Lead data (emails) stored server-side only — never returned to client

## Future: Tool Use / Function Calling

Phase 2 will add Anthropic tool use for actions (not just questions):
- Book a trial class
- Request a makeup class
- Submit a sub request
- Log teacher hours
- Award a badge

These will use the same context builders but add `tools` to the API call.

## File Map

| File | Purpose |
|------|---------|
| `lib/angelina/context.ts` | Context builders (system prompt assembly) |
| `app/api/angelina/chat/route.ts` | Main chat API with SSE streaming |
| `app/api/angelina/lead/route.ts` | Lead capture endpoint |
| `app/api/angelina/feedback/route.ts` | Feedback (thumbs up/down) endpoint |
| `app/api/angelina/conversations/route.ts` | Admin conversation list |
| `components/angelina/AngelinaChat.tsx` | Reusable chat UI component |
| `app/(portal)/portal/chat/page.tsx` | Parent full-page chat |
| `app/(teach)/teach/chat/page.tsx` | Teacher full-page chat |
| `app/(admin)/admin/chat/page.tsx` | Admin full-page chat |
| `app/(admin)/admin/angelina/page.tsx` | Admin conversation dashboard |
| `app/(public)/widget/angelina/page.tsx` | Public embeddable widget |
| `supabase/migrations/20260311000017_create_angelina_tables.sql` | Database migration |
