# SESSION PICKUP

_Last rewritten: 2026-07-27 (end of session)_

---

## 0. Pre-session ritual — do not skip

Full protocol lives in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -5`
- **Claude Code:** `/clear` before any work
- **Schema days only:** migration list check
- Supabase MCP is **read-only**. All DDL through `supabase db push` in Regular Terminal. No exceptions.

`tsc --noEmit` returns **zero errors**. If it reports anything, it is real.
Staging command that keeps the e2e scratch files out: `git add -A ':!scripts'`

⚠️ **`CLAUDE.md` was corrected 2026-07-27** — it previously claimed the `user_role` enum was dropped (it is not) and under-described `is_admin()` (five roles, not two). Corrections take effect only for sessions started after `db07952`.

---

## 1. Repo state

- **HEAD = this pickup commit**, pushed to `origin/main`. Fully synced.
- Clean tree except `scripts/e2e-*.ts` — untracked, **never commit these**.

**Shipped 2026-07-27:**

| Commit | What |
|---|---|
| `9e9edec` | **Timezone Phase A** — `tenants.timezone`, zone-aware helpers, `AuthUser` threading |
| `db07952` | CLAUDE.md schema corrections, indexed missing specs |
| `1d134a3` | **Timezone Phase B** — pay periods, period lock, submission deadlines |
| `1802cd2` | Financial anomaly + payroll correctness specs |
| `aecfb51` | Indexed those two specs |
| `80874d1` | Knowledge repository + role-scoped AI spec |
| `9db2efe` | **Fall 2026/27 class import** (89 classes), room location scoping, retired orphaned rooms |
| `d873d2e` | Calendar date windowing, Fall class start/end dates |

Previous day (2026-07-26): teacher timesheets fixed end to end, ~120 admin server actions authorized, client-side date writes corrected. Detail in git history.

---

## 2. Production state

**Live at `portal.balletacademyandmovement.com`, Stripe TEST MODE.** Config unchanged — test webhook (`checkout.session.completed` only), `sk_test`/`pk_test`/signing secret in Vercel prod, `NEXT_PUBLIC_APP_URL` = portal domain.

### Fall 2026/2027 is loaded

**89 classes imported for San Clemente**, plus the pre-existing Test Classes row = 90 in season `2026/2027`.

| | |
|---|---|
| Season id | `af220d93-0b39-4816-a2ec-0d09c6dfda7e` (name is `2026/2027`, slash not hyphen) |
| Location id | `70acde19-bd54-46c2-a4f4-2200b0adb393` (San Clemente) |
| Dates | All 89: `2026-08-15` → `2027-06-15` |
| Rehearsals | 26, as `classes` rows with `is_rehearsal = true` |
| Teachers | 14 assigned; **4 classes have no teacher** (Thu/Sat Petites, Tricks classes) |
| Rooms | All assigned by Amanda; `room_id` populated on all 90 |

**Source of truth for the import:** `BAM_Fall_2026_27_Classes_REVIEW.xlsx` — a Studio Pro export parsed into last season's naming convention, then reviewed and corrected by Amanda. The convention, verified against the 63 rows of 2025/2026:

> `name` = `<Difficulty> <Discipline>[-<Qualifier>]` — **never the level, never the day.**
> The level lives in `description`, matching the Studio Pro display string.
> Examples: `Advanced Ballet`, `Intermediate Jazz-Turns & Jumps`, `Princess Petites-Ballet & Movement`.

`levels` is `text[]` in the exact form `"Level 4B"` — never `"4B"`, never lowercase.

### Deliberate test data — do not "fix"

Three room/time overlaps exist in season 2026/2027, kept on purpose to exercise conflict detection:

| Day | Room | Classes |
|---|---|---|
| Mon | Studio 1 | Beginner Jazz 16:15–17:00 (Paola) × Beginner Ballet 16:30–17:30 (Deborah) |
| Wed | Studio 2 | Test Classes 18:00–18:30 (Amanda) × Advanced Contemporary 17:30–18:30 (Leila) |
| Thu | Studio 3 | Mini Star Hip Hop 15:30–16:30 × its own rehearsal 16:15–16:30 (both Leila) |

The Wednesday one involves **Test Classes**, which still has its own dates (`2026-08-03` → `2026-09-24`). Deleting or re-dating that row is an open decision.

### Known prod data

- Wyatt Cobb-Hardin has an active enrollment in Test Classes from 7/17. **Do not reuse Wyatt** for the approvals demo.
- The three orphaned rooms are now named `Studio 1 (retired)` etc. — see §5.3.

---

## 3. What shipped 2026-07-27

### 3.1 Timezone Phases A and B
`tenants.timezone` (default `America/Los_Angeles`), `tenantToday()` / `tenantDateStr()` / `tenantPayPeriod()` in `lib/dates.ts`, threaded onto `AuthUser` with a 5-minute process cache. Then pay-period resolution, `isPeriodLocked`, and `submission_deadline` moved to the tenant's zone.

**Verified under `TZ=UTC` with pinned clocks**, per spec §6 — a Pacific-machine test proves nothing. At 17:30 PDT on 7/31, old code filed to August; new files to July.

Phases C–G remain. **Phase D carries an unbudgeted decision** — see `TENANT_TIMEZONE_SPEC.md` §4.3.1: the originally reported header bug is on the `SessionWithRole` path, which Phase A did not touch.

### 3.2 Fall class import
Studio Pro export → parsed spreadsheet → Amanda review → migration. Four bugs surfaced along the way:

| Bug | Status |
|---|---|
| `classes` has no `tenant_id` (I wrote one into the INSERT) | Fixed — tenant lives on `class_teachers.tenant_id` |
| Room columns rendered all 8 rooms across 3 locations | Fixed — scoped to the existing location filter, labels disambiguated |
| Import omitted `start_date`/`end_date` | Fixed — backfilled |
| **Calendars never windowed by date at all** | Fixed — `classRunsOn` in `lib/dates.ts` |

That last one was pre-existing and the most consequential: `/teach/schedule` has **no `showPast`, no status filter, only `is_active = true`** — so teachers saw every class they'd ever been assigned on every week. All 63 of last season's classes are still `is_active = true`.

### 3.3 Three specs written
- `FINANCIAL_ANOMALY_DETECTION.md` — 🔴 P0. Nothing detects a double charge or a billed-but-undelivered lesson.
- `PAYROLL_CORRECTNESS_AND_REPORTING.md` — 🔴 P0. Pay is recomputed at render time from *current* rates.
- `KNOWLEDGE_REPOSITORY_AND_AI.md` — document repository serving humans and Angelina under one access model.

---

## 4. Next session — recommended

### 4.1 Open product decision, small
**The calendar defaults to "All Locations"**, so every admin sees 8 room columns with 5 permanently empty (RSM has no classes and doesn't open until September). Options: default the *calendar* to the primary location while the list keeps "All"; or hide rooms with no classes in the visible week. Neither is a bug — the labels are unambiguous now — but it's noise.

### 4.2 Rate snapshotting — time-sensitive
`PAYROLL_CORRECTNESS_AND_REPORTING.md` phases 1–3. `timesheet_entries` is empty **today**, so snapshotting `rate_amount` at entry/approval is free. Every hour logged before it exists is an hour whose true rate is unrecoverable.

### 4.3 Admin notification surface
`FINANCIAL_ANOMALY_DETECTION.md` §3.1. **88 notifications, 100% unread** — the table and API already exist, only the UI is missing. Highest value per hour in that document.

### 4.4 Timezone Phase C
Filters and comparisons. Ten-plus sites, low risk. Fixes "today's classes vanish from the teacher dashboard after 5pm."

---

## 5. Open defects

### 5.1 The `profiles.role` authorization family — ~30 API routes
Roughly 30 API routes authorize off `profiles.role` instead of `profile_roles` — the `api/admin/resources/*` family, schedule-embeds, schedule-change-requests, rentals, substitute-requests, approval-tasks, feature-flags, platform-modules, teach/roster, plus `api/teacher/*`.

**Consequence:** Cara's `profiles.role` reads `parent`, so she is **locked out of admin surfaces she runs**. `finance_admin`, `studio_admin`, and `studio_manager` are locked out everywhere. `proxy.ts:107` is the one place that does it correctly.

This is the mirror of the 2026-07-26 server-action sweep — same defect, opposite direction (too restrictive rather than too permissive).

### 5.2 Six remaining `teacher_profiles.user_id` instances
The view has no `user_id` column. Still broken: `lib/schedule/generate-sessions.ts:194-200`, `lib/queries/admin.ts:170-174`, `api/teachers/welcome/route.ts:114-116`, `admin/productions/[id]/page.tsx` (production labor-cost report), and both scripts. `welcome_sent_at` exists in **no table**.

### 5.3 `schedule_instances` — 70% point at retired rooms
61 of 87 rows reference the three now-renamed `Studio N (retired)` rooms — the frozen `2026-03-09` → `03-14` week from the broken occurrence generator (`_INDEX.md` task 19). They were renamed rather than deleted because `ON DELETE SET NULL` would have silently stripped `room_id` from all 61.

Disposition deferred to task 19. Note `private_sessions.studio` carries free-text `'Studio 1'` with no FK — a third place the name collides.

### 5.4 Root cause of the whole bug family
`lib/supabase/server.ts:7` calls `createServerClient()` **without the `<Database>` generic**. Every query is untyped — which is why queries against columns that never existed compile clean. Adding the generic will surface a wave of errors. That is the point. Its own session.

### 5.5 Other
- Enrollment catalog (`lib/queries/enroll.ts:32`) filters `end_date` only, no start bound — a scheduled class appears before it starts
- `/teach/schedule` header count reads total assigned, not the visible week ("12 classes" while the grid shows 5)
- `/admin/staff/[id]/profile` shows "No class assignments" — uninvestigated
- Browse Classes "Request Enrollment" writes to nonexistent `admin_tasks`
- Vercel custom domains "Invalid Configuration" — check GoDaddy A records on `portal`/`staging`
- **41 tables lack `tenant_id`** incl. `classes`, `profiles`, `teachers`, `attendance` — see `SESSION_2026-07-25_FINDINGS.md`
- `teacher_profiles` view hides departed teachers from payroll retroactively
- `cancelled` vs `canceled` split across six tables
- `DATABASE_SCHEMA.md` is 54% absent and drifted on 13 of 30 documented tables — regenerate or retire (`_INDEX.md` task 14)

---

## 6. Open questions for Amanda

| # | Question | Blocks |
|---|---|---|
| 1 | **Consent copy** — parents consent to costume/competition charges the platform cannot produce. Live in prod | Nothing, but it's live |
| 2 | **Cancellation policy for privates** — is a cancelled/no-show private billable? 5 live rows already drifted | Anomaly spec §3.4 |
| 3 | **Handbook vs Code of Conduct** — which is canonical where they disagree? Handbook says "Season 5 – 2025/26" | Knowledge repo Phase 0 |
| 4 | **Existing text/phone AI agent** — what is it? Feed it or replace it | Knowledge repo Phase 8 |
| 5 | **Which rate model** — flat `teachers.*_rate_cents` or `teacher_rate_cards`? Nothing reads the latter | Payroll spec §3.2 |
| 6 | **Split billing** — grandparents confirmed. Portal login or emailed receipts? | Billing Phase B |
| 7 | **Sibling discounts** — ~50% off 2nd+ registration. Registration only or tuition too? | Billing Phase C |
| 8 | **4 teacherless Fall classes** — who teaches Thu/Sat Petites and the Tricks classes? | Before Fall starts |
| 9 | **Test Classes row** — keep as demo data or remove? It creates the Wed Studio 2 conflict | Small |

---

## 7. Specs on file

| Spec | Status |
|---|---|
| `BILLING_GENERALIZATION_SPEC_V2.md` | A1 done, A2 blocked, B–I open |
| `TENANT_TIMEZONE_SPEC.md` | **A + B done**, C–G open; D needs the §4.3.1 decision |
| `FINANCIAL_ANOMALY_DETECTION.md` | 🔴 P0, not started |
| `PAYROLL_CORRECTNESS_AND_REPORTING.md` | 🔴 P0, not started |
| `KNOWLEDGE_REPOSITORY_AND_AI.md` | Not started; Phase 0 is editorial and gates the rest |
| `SESSION_2026-07-25_FINDINGS.md` | Reference |
| `COMMUNICATIONS_HUB.md` | BAND replacement, partially built — **audit what shipped before building more** |

**Not yet written:** tenant scoping remediation (P0), reporting + semantic layer, expense module, private packages, `ADMIN_TASK_CENTER`, class importer UI.

### Class importer — worth building
This session's Fall import was a one-off script. For white-label it should be a feature: **downloadable template → upload → parse → preview with errors flagged inline → commit.** Never direct-to-database. The template columns *are* the class model, so it depends on the naming convention in §2 being settled. v1 should be upload-only and create-only; update-on-reimport is a separate problem needing stable keys.
