# Tenant Timezone & Date Correctness

**Status:** IN PROGRESS — Phase A landed, phases B–G outstanding
**Author:** Derek Shaw
**Date:** 2026-07-26 (last updated 2026-07-27)
**Partially addressed by:**
- `8626b5c` — client-side write sites only
- `9e9edec` — Phase A: `tenants.timezone` column, zone-aware helpers, `AuthUser` threading

---

## 1. The bug

The platform computes every calendar date in **UTC**. Vercel runs Node with no `TZ` set, so every server-rendered date, filter, and comparison is UTC-based. After **5:00 PM Pacific**, UTC has already rolled to the next day.

Observed 2026-07-26 at 17:33 PDT: the teacher portal header read **"Monday, July 27."**

### 1.1 Why this passed local testing

The defect is not confined to the `toISOString()` gotcha documented in `CLAUDE.md`. Two additional patterns look timezone-safe and are correct on a developer's Mac:

| Pattern | On a Pacific laptop | On Vercel |
|---|---|---|
| `toISOString().split("T")[0]` | UTC (visibly wrong) | UTC |
| `toLocaleDateString("en-US", {...})` with no `timeZone` | Pacific — correct | **UTC — wrong** |
| `d.getMonth()`, `d.getFullYear()`, `d.getDate()` | Pacific — correct | **UTC — wrong** |

The last two are the dangerous ones. They read as local-time-safe, pass every local test, and fail only in production.

### 1.2 Scale

| Pattern | Count |
|---|---|
| `toISOString().split("T")[0]` | 75 |
| `toISOString().slice(0, 10)` | 13 |
| `getUTCDate` / `getUTCMonth` / `getUTCFullYear` | 11 |
| **Date-only derivations** | **99 across 67 files** |
| `toLocaleDateString("en-US", …)` with no `timeZone` | 94 |
| Calls that *do* pass `timeZone` | **1** |

That one correct call is `app/api/cron/late-pickup-check/route.ts:34` — `toLocaleString("en-US", { timeZone: "America/Los_Angeles" })`. Someone hit this bug once, fixed it locally, and hardcoded the zone.

### 1.3 No tenant timezone existed — RESOLVED in `9e9edec`

> **Status:** the column now exists. `tenants.timezone text NOT NULL DEFAULT 'America/Los_Angeles'`
> landed in migration `20260727093000_tenant_timezone.sql` (commit `9e9edec`).
> The historical finding below is retained because it is the *reason* 99 call
> sites derive dates in UTC — they were written when there was nothing else to
> read. Do not treat this subsection as a live defect.

**The original finding, as investigated 2026-07-26:**

A live `information_schema` query for any column matching `%timezone%`, `%time_zone%`, or `tz` across the entire public schema returned **zero rows**. Not on `tenants`, not on `studio_settings`, not on `studio_locations`.

The only timezone knowledge in the system was one hardcoded string (`app/api/cron/late-pickup-check/route.ts:34`).

**This was the load-bearing gap.** Fixing the 99 call sites without adding a tenant timezone would have hardened the bug for BAM and left it unsolvable for tenant two. A studio in New York or London would have seen dates shift by their own offset with no way to configure it.

**What closing it does and does not buy.** The column and the helpers exist; the 99 call sites still compute UTC dates. Phase A made the fix *possible*, not *applied*. §3 remains an accurate description of live defects.

---

## 2. What was already fixed (`8626b5c`)

Six **client component** write sites, plus helper extraction. Client components execute in the user's browser, so `getFullYear()/getMonth()/getDate()` reads their real timezone — correct without any timezone infrastructure.

| File | What it writes |
|---|---|
| `teach/attendance/attendance-marker.tsx:49` | attendance `class_date` |
| `teach/timesheets/entry-form.tsx:348` | timesheet entry date |
| `teach/classes/[classId]/attendance/attendance-client.tsx:60,61` | attendance date + 30-day bound |
| `admin/timesheets/admin-entry-drawer.tsx:424,549` | admin entry date + next-day stepper |
| `teach/hours/log-hours-form.tsx:72` | `teacher_hours.date` |
| `portal/book-private/book-private-client.tsx:43` | bookable date slots |

New: `lib/dates.ts` exporting `toLocalDateStr(d?: Date)`. Its header comment states explicitly that it returns the **runtime's** local date — correct on the client, still UTC on the server — so nobody reaches for it server-side and thinks they've fixed something.

Four client-side inline copies of the same pattern were deduped into the helper. **Six server-side copies were deliberately left inline** (`portal/schedule/page.tsx`, `portal/dashboard/page.tsx`, `admin/schedule/page.tsx`, `lib/queries/portal.ts`, `lib/schedule/queries.ts`, `lib/angelina/context.ts`). Routing them through the helper would be behavior-preserving but would make them *look* fixed while still emitting UTC. They stay visibly wrong until this spec lands.

---

## 3. What remains broken

### 3.1 Category C — written to the database

| Site | Consequence |
|---|---|
| `lib/schedule/generate-sessions.ts`, `generate.ts`, `occurrences.ts` | `schedule_instances.event_date` generated in UTC |
| `lib/billing/proration.ts`, `enrollment-ledger.ts`, `approval.ts` | Billing period boundaries |
| `admin/privates/actions.ts:35` | Private session date helper (server action) |
| `portal/book-private/actions.ts:41` | Parent booking next-available-date (server action) |

**Billing and schedule generation are the highest-risk items in this spec.** They currently work. Any change must be verified against the existing proration behavior, not just typechecked.

### 3.2 Category B — comparisons and filters (silently wrong results)

| Site | Effect after 5pm Pacific |
|---|---|
| `teach/dashboard/page.tsx:46` | Today's remaining classes vanish from the teacher dashboard |
| `api/portal/absences/upcoming-classes/route.ts:50` | A parent cannot report an absence for tonight |
| `teach/events/page.tsx:78`, `portal/events/page.tsx:97` | Upcoming events filter |
| `portal/rehearsals/page.tsx:36` | Rehearsals |
| `portal/privates/parent-privates-client.tsx:79-80` | upcoming/past bucketing |
| `public/embed/rehearsals/[productionId]/page.tsx:33` | Public embed |
| `api/portal/calendar/route.ts:77` | Calendar feed |
| `lib/schedule/generate.ts:101` | Session-generation window boundary |
| `lib/classes/status.ts` | `ended` derivation (`end_date < today`) |

### 3.3 Pay periods and the period lock

| Site | Detail |
|---|---|
| `teach/timesheets/actions.ts:51-52` | `now.getMonth() + 1` / `now.getFullYear()` — local methods, UTC runtime |
| `lib/timesheets/helpers.ts:23-24` | Same |
| `admin/timesheets/actions.ts` | Same |
| `submission_deadline` at `:71`, `:41`, `:662` | `toISOString().split("T")[0]` |
| `isPeriodLocked()` | `now.getDate() > 26` — lock engages ~5pm Pacific on the 26th, not midnight |

**Consequence:** on the last day of a month, after 5pm Pacific, a teacher's entry is filed to the *next* month's pay period. This is a payroll correctness bug, not a display bug.

### 3.4 Category A — display only

94 bare `toLocaleDateString` calls, including the reported header at `app/(teach)/layout.tsx:43`.

Note an existing workaround applied inconsistently: several display sites append `"T12:00:00"` to a DB date string before formatting (e.g. `teach/timesheets/page.tsx:151`). That midday anchor works — it puts the parsed instant far enough from midnight that no offset flips the date. It should be replaced by the standard helper, not extended.

---

## 4. Proposed design

### 4.1 Schema — BUILT (`9e9edec`)

```
tenants.timezone text NOT NULL DEFAULT 'America/Los_Angeles'
```

IANA identifiers only. `NOT NULL` with a default so no code path has to handle a null zone.

**Schema verified before the migration was written** (the ⚠️ below is discharged). `public.tenants` is a real table, `relkind = 'r'`, PK `tenants_pkey PRIMARY KEY (id)` on `uuid DEFAULT gen_random_uuid()`, other constraint `tenants_slug_key UNIQUE (slug)`. Columns before the migration: `id`, `name`, `slug`, `created_at`, `angelina_enabled`. Exactly one row — Ballet Academy and Movement, slug `bam`. RLS is enabled with `tenants_select_authenticated USING (true)` for `authenticated`, so any logged-in user can read the zone with the ordinary server client; `supabaseAdmin` is not needed.

**DECIDED: `tenants`, not `studio_locations`.**

Reasoning:

- BAM's San Clemente and Rancho Santa Margarita locations are both `America/Los_Angeles`, so per-location storage buys nothing today and costs a join on every date derivation.
- Only a tenant operating across multiple zones needs per-location granularity. No tenant does.
- **The decision is cheap to reverse.** The helper API (§4.2) takes the zone as a plain `string` parameter and never reads it from a global or from a tenant record. Adding a per-location override later means changing *where callers source the string*, not the helpers, their signatures, or their call sites. That is additive, not a refactor.

The migration's `tenants_timezone_check` constraint follows the schema's verified naming convention — the Postgres default `<table>_<column>_check`, matching `classes_status_check`, `charges_source_check`, `badges_tier_check`, and every other check constraint in `public`. See §7 for what that constraint does and does not catch.

> ⚠️ *(Original note, now discharged — retained for provenance.)* `studio_locations` has `tenant_id`; `tenants` is the tenant table. Verify both against live schema before writing the migration — this spec was written from an investigation, not a schema dump.

### 4.2 Helper API — BUILT (`9e9edec`)

`lib/dates.ts` now exports (alongside `DEFAULT_TENANT_TIMEZONE`):

```
toLocalDateStr(d?: Date): string          // existing — CLIENT ONLY
tenantToday(timeZone: string): string     // YYYY-MM-DD in the tenant's zone
tenantDateStr(d: Date, timeZone: string): string
tenantPayPeriod(timeZone: string): { month: number; year: number }
```

Implementation uses `Intl.DateTimeFormat` with an explicit `timeZone`, which is correct regardless of the runtime's zone and requires no dependency.

The zone is **passed in**, never read from a global. A cron job processing multiple tenants needs a different zone per tenant in the same process.

Two implementation notes worth preserving, both of which are easy to get wrong:

- **`Intl.DateTimeFormat` output is locale-shaped, not ISO.** `'en-US'` returns `M/D/YYYY`, `'en-GB'` returns `D/M/YYYY`, and some locales append an era or use non-Latin digits. The helpers therefore read `formatToParts` and assemble the `YYYY-MM-DD` string explicitly rather than formatting and parsing. Do not "simplify" this back to a `.format()` call.
- **An unknown zone throws `RangeError`.** A bad value in `tenants.timezone` fails loudly at the call site rather than silently producing a date in some other zone. This is the intended behavior and is the application-side backstop for the shape-only DB constraint (§7).

`tenantPayPeriod` returns `month` as **1-12**, matching how pay periods are stored — not the 0-11 that `Date.getMonth()` returns. This is the single most likely place to reintroduce an off-by-one during Phase B.

### 4.3 Threading the zone through — BUILT (`9e9edec`)

Most server components already resolve a tenant via `requireRole`/`requireAdmin`, which returns `AuthUser` with `tenantId`. `AuthUser` now carries `timezone: string` (never null — it falls back to `DEFAULT_TENANT_TIMEZONE` when no tenant resolves, so no caller has to branch).

Cron routes and webhooks have no user. Those must still load the tenant row explicitly.

**Investigation answered — it needed a second query, and here is why.**

The guard's `getUser()` (`lib/auth/guards.ts`) already issued two queries: `profiles` for role and names, and `profile_roles` for roles and `tenant_id`. It never touched `tenants`.

The obvious cheap fix — folding the zone into the existing `profile_roles` select as a PostgREST embed, `.select("role, tenant_id, is_primary, tenants(timezone)")` — **is not available.** `profile_roles` has only two constraints, `profile_roles_pkey` and `profile_roles_user_id_tenant_id_role_key` (verified against `pg_constraint`). **`profile_roles.tenant_id` has no foreign key to `tenants`**, so PostgREST has no declared relationship to embed across. Resolving the zone is a genuine third round trip.

That cost is not once per page. `getUser()` is not memoized and runs **2+ times per request** — the route-group layout guard, then the page guard, and again for any server action on the same render. Left uncached this would have added several Supabase round trips to every guarded page.

**Mitigation, as built:** a module-scope `Map<tenantId, {timezone, expiresAt}>` in `lib/auth/guards.ts` with a **5-minute TTL**. A tenant's zone changes approximately never, so steady-state cost in a warm lambda is nil, while an onboarding change still propagates within five minutes. **Only successful lookups are cached** — a failed lookup (e.g. before the migration is pushed) is retried on the next call, so the Pacific fallback can never stick in a warm process.

If the extra query is ever wanted back unconditionally, deleting the cache is a local change to that one function.

#### 4.3.1 ⚠️ There are TWO auth resolution paths — Phase A only fixed one

**This spec did not anticipate this, and Phase D depends on it.**

`lib/auth/` holds two parallel, independently-maintained ways to resolve the current user. They return **differently shaped objects**, and only one now carries a timezone.

| Path | Shape | Defined in | Importers | Has `timezone`? |
|---|---|---|---|---|
| **`AuthUser`** | `{id, email, role, roles, firstName, lastName, tenantId, timezone}` | `lib/auth/guards.ts` (constructed in `getUser()` — the **only** construction site) | **214 files** | ✅ **yes, as of `9e9edec`** |
| **`SessionWithRole`** | `{user{id,email}, profile{role, roles, full_name, avatar_url, tenant_id}}` | `lib/auth/getSessionWithRole.ts`, reached via `requireRole.ts` | 7 files | ❌ **no** |

The seven files on the `SessionWithRole` path:

- `app/(admin)/layout.tsx`
- `app/(teach)/layout.tsx`
- `app/(portal)/layout.tsx`
- `context/RoleContext.tsx`
- `components/layouts/admin-nav.tsx`
- `app/unauthorized/page.tsx`
- `app/api/admin/angelina-toggle/route.ts`

That is **all three route-group layouts**.

**Why this matters concretely:** the bug that started this spec — the header reading **"Monday, July 27"** at 17:33 PDT on 2026-07-26 — is at `app/(teach)/layout.tsx:43`. That file is on the `SessionWithRole` path. **Phase A did not give it a timezone.** The originally reported symptom is not fixable with what Phase A landed.

**This is a decision Phase D must make, not a detail to discover mid-implementation.** Two options:

1. **Thread `timezone` through `SessionWithRole` too** — mirrors the `AuthUser` change, including the same cache (the two resolvers would want to share one, not keep two). Leaves the duplication in place.
2. **Switch the seven files to `guards.ts`** — removes a whole redundant resolver, but changes the redirect semantics: `requireRole.ts` sends unauthorized users to `/unauthorized`, while `guards.ts` `requireRole` redirects to the user's role home. Layout-level behavior change, needs checking against each of the three route groups.

Related: §7 already records that `lib/auth/` holds five overlapping modules and that the admin layout imports `requireRole` from a different module than the guards used everywhere else. This is that drift, with a concrete cost attached.

Note the two paths also disagree on naming (`tenantId` vs `tenant_id`) and on identity (`firstName`/`lastName` vs a pre-joined `full_name`), so option 2 is not a pure import swap.

### 4.4 Lint rule

Once migrated, add an ESLint rule banning bare `toISOString().split("T")[0]`, `toISOString().slice(0,10)`, and `toLocaleDateString` without a `timeZone` option in server files. **This bug will come back otherwise** — it already reappeared after being documented in `CLAUDE.md`, because the documented pattern didn't cover `toLocaleDateString` or `getMonth()`.

---

## 5. Build order

| Phase | Scope | Risk | Status |
|---|---|---|---|
| **A** | `tenants.timezone` migration + helper functions + thread zone through `AuthUser` | Low — additive | ✅ **DONE — `9e9edec`** |
| **B** | Pay periods, `isPeriodLocked`, `submission_deadline` | Medium — payroll correctness | Not started |
| **C** | Filters and comparisons (§3.2) | Low — verify each visually | Not started |
| **D** | Display sites incl. the header (§3.4) | Low | Not started — **see §4.3.1 first** |
| **E** | Schedule generation (§3.1) | **High — verify generated dates against current output** | Not started |
| **F** | Billing proration (§3.1) | **High — verify against existing proration behavior** | Not started |
| **G** | ESLint rule | Low | Not started |

E and F are last deliberately. Both currently work; both are load-bearing; neither should be touched while tired.

**Phase A deliberately migrated zero call sites.** The column and helpers exist; every site in §3 still derives dates in UTC. Phase A made the fix possible, not applied.

**Phase D carries an unbudgeted decision.** The header that prompted this spec is on the `SessionWithRole` path, which Phase A did not touch. Read §4.3.1 before starting D — the fix is either threading `timezone` through a second resolver or consolidating the two, and neither is a display-layer change. D's "Low" risk rating covers the 94 formatting call sites, not that decision.

---

## 6. Verification

A UTC-vs-local bug cannot be caught by testing on a Pacific machine before 5pm. Any verification must either:

- Set `TZ=UTC` locally to reproduce the production runtime, or
- Test against the deployed Vercel environment after 5pm Pacific

**Do not accept "works on my machine" as evidence for any phase of this work.**

---

## 7. Related findings (not timezone, logged here to avoid loss)

- **`tenants_timezone_check` validates shape, not existence — and rejects 70 real zone names.** The constraint is `timezone = 'UTC' OR timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){1,2}$'`, tested against the live `pg_timezone_names` (1194 rows) rather than assumed. It accepts `America/Los_Angeles`, `Europe/London`, `UTC`, and 3-segment names like `America/Argentina/Buenos_Aires`; it rejects `PST`, `Pacific Time`, `UTC-8`, and `''` — the realistic onboarding mistakes, plus all fixed offsets, which do not observe DST. Two known gaps, both deliberate:
  - A well-formed but fictional zone (`Foo/Bar`) still passes. A `CHECK` constraint cannot contain the subquery against `pg_timezone_names` that would catch it; full validation needs a `BEFORE INSERT OR UPDATE` trigger, which was out of scope for Phase A. `Intl.DateTimeFormat` throws `RangeError` on these at the call site, so they fail loudly rather than silently.
  - It rejects **70 of the 1194** names Postgres knows — the legacy single-segment backward-compat aliases (`Japan`, `Iceland`, `GB`, `ROK`, `EET`, `HST`, `Navajo`, `W-SU`, …). These are links to canonical `Area/Location` zones, and the canonical form is what belongs in this column: a studio in Reykjavik gets `Atlantic/Reykjavik`, not `Iceland`. **If this proves too strict, widen the regex — do not drop the constraint.**

- **`/admin/staff/[id]/profile` shows "No class assignments"** while Amanda has three (Advanced Ballet, Advanced Ballet-Advanced Pointe-Sylvia Rehearsal, Test Classes — all visible at `/teach/evaluations`). The data is in `class_teachers`; the profile page query is wrong. Uninvestigated.
- **Cross-tenant authorization gap.** ~100 admin server actions now have role guards (`36741f2`) but none validate that a client-supplied `tenantId` or record `id` belongs to the caller's tenant. Latent with one tenant; blocking before the second.
- **`settings/studio/actions.ts` hardcodes BAM's IDs at module scope** — `TENANT_ID` and `STUDIO_SETTINGS_ID`. A second tenant saving studio identity would silently overwrite BAM's row.
- **`lib/supabase/server.ts:7`** calls `createServerClient()` with no `<Database>` generic, so every query in the app is untyped. This is the root cause of the `teacher_profiles.user_id` bug family — nine queries against columns that never existed compiled clean.
- **`lib/auth/` holds five overlapping modules** (`guards.ts`, `requireRole.ts`, `getSessionWithRole.ts`, `role-check.ts`, `actions.ts`). The admin layout imports `requireRole` from a different module than the guards used everywhere else.
