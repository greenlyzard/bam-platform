# Tools Module — Surveys

**Doc:** `docs/TOOLS_SURVEYS.md` · **Status:** Draft for review · **Module:** Tools › Surveys (first Tools module) · **Date:** 2026-07-15

**Decision locked:** Responses are **identified by family by default**, with a per-survey **anonymous** option. Public iFrame embed responses are **always anonymous** regardless of the survey's setting.

**Implementation gate:** all schema work follows `bam-schema-sync` (verify types → migrate via `supabase db push` → regenerate types → `tsc --noEmit`). Migrations land only after the database rebaseline is complete and the exposed password is rotated.

---

## 1. Overview

Amanda (or any admin) builds a survey, distributes it to parents via in-app chat (Private Feed), email, and/or SMS, and optionally embeds it on `balletacademyandmovement.com` via iFrame. Responses land in Supabase (source of truth), sync outward to a linked Google Sheet, and surface in an admin Results Portal with charts and an AI-generated interpretation brief.

**Principle: Supabase is primary, Google Sheets is a derived sync target.** The sheet is never read back; it can be deleted and re-synced at any time.

---

## 2. Data model

All tables `tenant_id`-scoped with RLS. Naming/columns to be verified against `types/database.types.ts` before migration.

### `surveys`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | |
| `title`, `description` | text | |
| `slug` | text UNIQUE per tenant | Public embed URL key; unguessable suffix (e.g. `spring-recital-x7k2`) |
| `status` | text CHECK (`draft`,`published`,`closed`) | Closed surveys reject all new responses |
| `anonymity_mode` | text CHECK (`identified`,`anonymous`) DEFAULT `identified` | Applies to token (invited) responses |
| `embed_enabled` | boolean DEFAULT false | Gates the public route entirely |
| `allow_multiple_responses` | boolean DEFAULT false | Invited channel: one response per family unless true |
| `opens_at`, `closes_at` | timestamptz NULL | Auto-close window |
| `created_by` | uuid | |
| `created_at`, `updated_at` | timestamptz | |

### `survey_questions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `survey_id` | uuid FK | |
| `position` | int | Drag-to-reorder |
| `question_type` | text CHECK (`multiple_choice`,`checkboxes`,`rating`,`yes_no`,`free_text`,`dropdown`) | |
| `prompt` | text NOT NULL | |
| `options` | jsonb NULL | Choice labels; rating min/max/labels |
| `is_required` | boolean DEFAULT false | |

### `survey_distributions` (one row per send batch per channel)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `survey_id` | uuid FK | |
| `channel` | text CHECK (`email`,`sms`,`in_app`) | |
| `audience_filter` | jsonb | e.g. all families, by class, by location — resolved at send time |
| `sent_at` | timestamptz | |
| `sent_count` | int | |
| `created_by` | uuid | |

### `survey_invitations` (one row per family per distribution — the token)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `distribution_id` | uuid FK | |
| `survey_id` | uuid FK | Denormalized for lookup speed |
| `family_id` | uuid FK | |
| `token` | text UNIQUE | 32+ chars, URL-safe, single link `/s/r/[token]` across all channels |
| `status` | text CHECK (`pending`,`opened`,`responded`) | |
| `responded_at` | timestamptz NULL | |

**Anonymity mechanics (the important part):**
- **Identified survey:** the response row stores `family_id` (copied from the invitation) and `invitation_id`.
- **Anonymous survey, invited channel:** the token is used only for access control and dedup. On submit, the invitation's `status` flips to `responded`, but the response row stores **neither** `family_id` **nor** `invitation_id`, and `responded_at` on the invitation is coarsened to the day. Honest caveat surfaced in the admin UI: with very small audiences (e.g. 3 invitees), anonymity is statistically weak — the UI shows a notice when an anonymous survey targets fewer than 10 families.
- **Embed channel:** no token exists; responses are structurally anonymous (`source='embed'`, no family linkage possible).

### `survey_responses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id`, `survey_id` | uuid | |
| `source` | text CHECK (`invited`,`embed`) | |
| `family_id` | uuid NULL | NULL when anonymous or embed |
| `invitation_id` | uuid NULL | Same nullability rule |
| `submitted_at` | timestamptz | |
| `meta` | jsonb | UA/locale for embed spam triage; never IP for anonymous surveys |

### `survey_answers`
`id`, `response_id` FK, `question_id` FK, `value_text` text NULL, `value_choice` jsonb NULL (choice ids array), `value_number` int NULL (ratings/yes-no as 1/0). One row per question answered.

### `survey_sheet_links`
`survey_id` PK/FK, `spreadsheet_id` text, `sheet_tab` text, `last_synced_response_at` timestamptz, `sync_status` text, `error` text NULL.

### `survey_ai_summaries`
`id`, `survey_id` FK, `generated_at`, `response_count_at_generation` int, `model` text, `summary_md` text, `themes` jsonb, `sentiment` jsonb. Cached; regenerated on demand when stale (response count changed).

---

## 3. RLS & security

- **Admin surfaces** (builder, distribution, portal, sheet link, AI): SELECT/INSERT/UPDATE via the existing SECURITY DEFINER helpers over `profile_roles` (join on `user_id`; never query `profiles` in policies — known recursion failure). Roles: `super_admin`, admin; Amanda's `amandacobb@bamsocal.com` super_admin access preserved as always.
- **Invited response submission:** no direct table INSERT from the client. A SECURITY DEFINER RPC `submit_survey_response(p_token, p_answers jsonb)` validates the token, survey status/window, dedup (`allow_multiple_responses`), applies the anonymity rules above, and inserts response + answers atomically. Parents never need to be logged in — the token *is* the auth (matches ~80% mobile usage; zero-friction).
- **Embed submission:** RPC `submit_embed_response(p_slug, p_answers jsonb, p_honeypot text)` — validates `embed_enabled` + `published`, rejects filled honeypot, rate-limits per IP via a small `embed_rate_limits` table (e.g. 5/hour/IP/survey). Cloudflare Turnstile as an optional upgrade if spam appears; don't build it until needed.
- **Public read:** the embed route needs survey + questions. Expose via RPC `get_public_survey(p_slug)` returning only published, embed-enabled surveys — no anon SELECT policy on the tables themselves.
- Survey responses are parent data — no PII beyond family linkage; free-text answers may contain anything, so the AI summary is admin-only.

---

## 4. Distribution channels

All three channels deliver the **same tokenized link** `/s/r/[token]` (or the public `/embed/s/[slug]` page content rendered standalone for embed). One invitation per family per distribution; re-sends reuse the existing token.

| Channel | Mechanism | Notes |
|---|---|---|
| **In-app (chat)** | Post into the Private Feed module as a survey card with CTA button | Spec dependency: `COMMUNICATIONS_PRIVATE_FEED.md`; the card deep-links to the token URL |
| **Email** | Klaviyo (current stack) — transactional send per family with token link merged | Template: title, description, button. When Klaviyo is eventually replaced per the Movement OS roadmap, only the send adapter changes |
| **SMS** | Twilio (new integration) | **Lead-time item:** A2P 10DLC brand + campaign registration takes days–weeks; start registration before building. Message = short title + link. Opt-out compliance (STOP handling) required — Twilio Messaging Service handles it |

Audience selection reuses existing family/class/location relationships (`audience_filter` resolves against enrollments at send time — location-aware for RSM later). Distribution status view: sent / opened / responded per channel.

---

## 5. iFrame embed

- Route: `/embed/s/[slug]` — minimal layout, no nav, BAM theming via CSS variables, mobile-first.
- Headers: `Content-Security-Policy: frame-ancestors 'self' https://balletacademyandmovement.com https://*.balletacademyandmovement.com` (Next.js middleware on the embed route only). No `X-Frame-Options: DENY` on this route.
- WordPress side: paste-ready snippet generated in the admin UI: `<iframe src="https://bamsocal.com/embed/s/[slug]" style="width:100%;border:0" height="…">` plus an optional height auto-resize via `postMessage` (small script included in the snippet).
- Always anonymous; submission via the embed RPC with honeypot + rate limiting (§3).
- Closing a survey or toggling `embed_enabled` off kills the public page immediately (RPC checks live status).

---

## 6. Google Sheets sync

- **Auth:** Google OAuth connection (Amanda's Google account) with `spreadsheets` scope, tokens stored encrypted; a service account is the fallback if the OAuth consent flow is more friction than it's worth for a single-tenant phase.
- **Model:** on survey publish (or on demand), create/link a spreadsheet; tab = one row per response, columns = submitted_at, source, family name (blank when anonymous), then one column per question.
- **Sync trigger:** append-on-insert is fragile under retries; instead a **cursor sync** — Vercel cron (every 5 min) + an on-submit fire-and-forget nudge. The sync job reads responses where `submitted_at > last_synced_response_at`, appends rows, advances the cursor. Idempotent, self-healing, and a full re-sync is just resetting the cursor and clearing the tab.
- Sheet edits are never read back; the admin UI labels the sheet "export copy."

---

## 7. Results Portal

Admin route: `/admin/tools/surveys/[id]/results`.

- **Overview:** sent / opened / responded counts, response rate per channel, responses over time (line).
- **Per-question:** multiple choice & dropdown → bar chart; checkboxes → horizontal bar; rating → distribution histogram + average; yes/no → donut; free text → response list with search. Recharts, consistent with existing component stack; all dropdown filters via `SimpleSelect`.
- **Filters:** by channel/source, by class/location (identified surveys only), by date range.
- **Identified surveys:** per-family response drill-in and a "who hasn't responded" list with a one-click re-send (creates no new token).
- **Export:** CSV download + "Open Google Sheet" link.

---

## 8. AI interpretation layer

- **Trigger:** on-demand "Analyze results" button (and auto-refresh banner when the cached summary is stale — `response_count_at_generation` ≠ current count).
- **Pipeline:** server route assembles a compact payload (question stats + free-text answers, chunked if large) → Anthropic API → structured output: executive summary (plain English "what this means"), themes with counts and representative paraphrases, sentiment split, notable outliers ("6 families mentioned recital ticket pricing"), and suggested actions. Stored in `survey_ai_summaries`.
- **Anonymity guarantee:** for anonymous surveys the payload contains no family identifiers, and the prompt instructs the model never to attempt identification.
- **Future:** these summaries are natural Angelina RAG documents (pgvector) — "what did parents say about the spring recital?" — no extra work now, just keep `summary_md` clean markdown.

---

## 9. Build phases (~12 hrs/week budget)

| Phase | Scope | Est. |
|---|---|---|
| **1 — Core** | Schema + RLS + RPCs, builder UI, token response page, email distribution (Klaviyo), basic results portal (counts + per-question charts) | 2–3 wks |
| **2 — Reach** | In-app Private Feed card, iFrame embed route + CSP + snippet generator, Google Sheets sync | 1–2 wks |
| **3 — Intelligence** | AI summary pipeline + cached summaries UI, CSV export, non-responder re-send | 1 wk |
| **4 — SMS** | Twilio integration (start 10DLC registration during Phase 1), STOP compliance | 1 wk |

Phase order rationale: email + in-app cover ~all parents on day one; SMS is gated by carrier registration anyway, so it goes last while registration clears.

---

## 10. Open questions

1. **Sheets auth:** Amanda's Google OAuth vs. a service-account-owned spreadsheet shared to her — OAuth is nicer, service account is simpler. Pick during Phase 2.
2. **SMS sender:** dedicated 10DLC number vs. toll-free verification (faster approval, less "local" feel).
3. **Minimum-audience anonymity threshold:** default warning at <10 invitees — right number?
4. **Embed on WordPress now vs. after the site migrates into the platform** — snippet works either way; just confirms the CSP allowlist.
5. **Should closed surveys keep their embed page up as a "survey closed" message or 404?** (Recommend the friendly closed message.)
