# Tenant Timezone & Date Correctness

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-26
**Partially addressed by:** `8626b5c` (client-side write sites only)

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

### 1.3 No tenant timezone exists

A live `information_schema` query for any column matching `%timezone%`, `%time_zone%`, or `tz` across the entire public schema returns **zero rows**. Not on `tenants`, not on `studio_settings`, not on `studio_locations`.

The only timezone knowledge in the system is that one hardcoded string.

**This is the load-bearing gap.** Fixing the 99 call sites without adding a tenant timezone would harden the bug for BAM and leave it unsolvable for tenant two. A studio in New York or London would see dates shift by their own offset with no way to configure it.

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

### 4.1 Schema

```
tenants.timezone text NOT NULL DEFAULT 'America/Los_Angeles'
```

IANA identifiers only. `NOT NULL` with a default so no code path has to handle a null zone.

**Open question:** should timezone live on `tenants` or `studio_locations`? BAM's San Clemente and RSM are both Pacific, so it doesn't matter today. A tenant operating across zones would need per-location. Recommend `tenants` now, with the helper signature taking a zone string so a per-location override is additive later, not a refactor.

> ⚠️ `studio_locations` has `tenant_id`; `tenants` is the tenant table. Verify both against live schema before writing the migration — this spec was written from an investigation, not a schema dump.

### 4.2 Helper API

Extend `lib/dates.ts`:

```
toLocalDateStr(d?: Date): string          // existing — CLIENT ONLY
tenantToday(timeZone: string): string     // YYYY-MM-DD in the tenant's zone
tenantDateStr(d: Date, timeZone: string): string
tenantPayPeriod(timeZone: string): { month: number; year: number }
```

Implementation uses `Intl.DateTimeFormat` with an explicit `timeZone`, which is correct regardless of the runtime's zone and requires no dependency.

The zone must be **passed in**, never read from a global. A cron job processing multiple tenants needs a different zone per tenant in the same process.

### 4.3 Threading the zone through

Most server components already resolve a tenant via `requireRole`/`requireAdmin`, which returns `AuthUser` with `tenantId`. The cheapest path is adding `timezone` to that resolved user object so every guarded page has it without an extra query.

Cron routes and webhooks have no user. Those must load the tenant row explicitly.

**Investigate before building:** does `AuthUser` already carry enough to attach the timezone, or does the guard need a second query? That determines whether this is a one-line change or touches every guard.

### 4.4 Lint rule

Once migrated, add an ESLint rule banning bare `toISOString().split("T")[0]`, `toISOString().slice(0,10)`, and `toLocaleDateString` without a `timeZone` option in server files. **This bug will come back otherwise** — it already reappeared after being documented in `CLAUDE.md`, because the documented pattern didn't cover `toLocaleDateString` or `getMonth()`.

---

## 5. Build order

| Phase | Scope | Risk |
|---|---|---|
| **A** | `tenants.timezone` migration + helper functions + thread zone through `AuthUser` | Low — additive |
| **B** | Pay periods, `isPeriodLocked`, `submission_deadline` | Medium — payroll correctness |
| **C** | Filters and comparisons (§3.2) | Low — verify each visually |
| **D** | Display sites incl. the header (§3.4) | Low |
| **E** | Schedule generation (§3.1) | **High — verify generated dates against current output** |
| **F** | Billing proration (§3.1) | **High — verify against existing proration behavior** |
| **G** | ESLint rule | Low |

E and F are last deliberately. Both currently work; both are load-bearing; neither should be touched while tired.

---

## 6. Verification

A UTC-vs-local bug cannot be caught by testing on a Pacific machine before 5pm. Any verification must either:

- Set `TZ=UTC` locally to reproduce the production runtime, or
- Test against the deployed Vercel environment after 5pm Pacific

**Do not accept "works on my machine" as evidence for any phase of this work.**

---

## 7. Related findings (not timezone, logged here to avoid loss)

- **`/admin/staff/[id]/profile` shows "No class assignments"** while Amanda has three (Advanced Ballet, Advanced Ballet-Advanced Pointe-Sylvia Rehearsal, Test Classes — all visible at `/teach/evaluations`). The data is in `class_teachers`; the profile page query is wrong. Uninvestigated.
- **Cross-tenant authorization gap.** ~100 admin server actions now have role guards (`36741f2`) but none validate that a client-supplied `tenantId` or record `id` belongs to the caller's tenant. Latent with one tenant; blocking before the second.
- **`settings/studio/actions.ts` hardcodes BAM's IDs at module scope** — `TENANT_ID` and `STUDIO_SETTINGS_ID`. A second tenant saving studio identity would silently overwrite BAM's row.
- **`lib/supabase/server.ts:7`** calls `createServerClient()` with no `<Database>` generic, so every query in the app is untyped. This is the root cause of the `teacher_profiles.user_id` bug family — nine queries against columns that never existed compiled clean.
- **`lib/auth/` holds five overlapping modules** (`guards.ts`, `requireRole.ts`, `getSessionWithRole.ts`, `role-check.ts`, `actions.ts`). The admin layout imports `requireRole` from a different module than the guards used everywhere else.
