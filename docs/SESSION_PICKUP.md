# SESSION PICKUP

_Last rewritten: 2026-07-31 (end of session)_

**Fall begins 2026-08-15 — 15 days. The Fall critical path is DONE (§2).**

---

## 0. Pre-session ritual — do not skip

Full protocol in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -8`
- **Claude Code:** `/clear` before any work
- **Schema days:** `supabase migration list` — *and then verify against the catalog*
- All DDL through `supabase db push` in Regular Terminal
- `scripts/e2e-*.ts` stay untracked permanently. **They were accidentally committed twice
  today** — once by a `git add -A`, once by a stray paste. Both caught before pushing. Stage
  paths explicitly, never `-A`.

### State at close

```
4027be6 (HEAD -> main, origin/main)  room labels name their location
```

**Everything is pushed. Working tree clean apart from the two e2e scripts.**

Fifteen commits today, all on origin:

| | |
|---|---|
| `1c6f73a` | closures spec amendments |
| `6e39ada` | closures Phase 1 + 3 |
| `989b276` | TS occurrence cron unscheduled |
| `26bedeb` | `apply_closures` |
| `06e465f` | 12-row closure calendar |
| `b9b0093` | session pickup (superseded by this file) |
| `1b7f868` | `/admin/schedule` restored, ranged closure banner, no synthetic weeks |
| `aeb8afd` | auth resolvers fail closed |
| `d4ee329` | role vocabulary pinned |
| `073e204` | room editing |
| `4ca974d` | room archive + guarded delete |
| `4a36eb5` | location abbreviation column |
| `9307368` | shared room-label helper |
| `77c555b` | parent calendars stop naming the wrong studio |
| `4027be6` | admin/teacher room labels; By Room stops merging studios |

### 🟡 MCP write policy — amended 2026-07-30

The old rule was "Supabase MCP is read-only." Too broad; the actual reason was **DDL through
MCP bypasses the migration file, so the repo stops describing the database.** Three tiers:

| Operation | MCP | Why |
|---|---|---|
| **DDL** | **Never.** `supabase db push`, Regular Terminal | This is the whole rule |
| Reads, and writes in a transaction that rolls back | Allowed | Leaves no state |
| Persisting data writes | Allowed on explicit per-operation say-so | No schema change, no drift |

**`CLAUDE.md` still says read-only and owes this edit.**

---

## 1. 🔴 Parallel running — the deadline changed

**Decided 2026-07-30: BAM stays on Studio Pro for the 2026-27 season.** The platform runs
alongside it and is beta-tested all season. The driver was billing risk — a defect would have
meant a family who cannot enrol.

- **Billing is no longer Fall-blocking.** Vault-only enrolment Phases 1 and 2 stay unshipped
- **Valuable now:** anything that runs without money or rosters — schedule, closures,
  occurrences, **teacher timesheets**, Angelina on the public site

**Sync classes, not enrolments.** Classes are live (153) and change a handful of times a
season. That is Amanda mentioning a new class, not sync infrastructure. **Explicitly
rejected:** building sync infrastructure for a system being replaced.

`enrollments` still has **1 row**, so anything roster-dependent is testing against empty data.
A season-start CSV import covers it when needed. A CSV job, not a system.

### The first parallel win: timesheets

Teachers log timesheets in Google Sheets today. Replacing that needs classes, occurrences and
teachers — all live — needs no rosters, and puts no money at risk.
`generate_timesheet_drafts` runs nightly at 08:30 UTC and now has occurrences through
2027-06-15 to draft against instead of stopping at 2026-11-27.

Two defects to fix first: **class assistants are unpaid in drafts** (the generator creates
entries for the assigned teacher and substitute only), and the **substitute default should be
$35, not $50**.

**Amanda's payroll UI for two studios is still not spec'd** and was next in the queue when
2026-07-30 ended. RSM opens September; two locations by hand in Sheets is where errors get
expensive.

---

## 2. ✅ The Fall critical path is COMPLETE

| # | Step | Result |
|---|---|---|
| 1–2 | Closures Phase 1 + Phase 3, one migration | `6e39ada` |
| 2.5 | **Unschedule the TS occurrence cron** | `989b276` — see §4 |
| 3 | Occurrence Phase 4 — generate the season | **2,912 created**, 91 classes |
| 4 | Closures Phase 2 — `apply_closures` | `26bedeb` |
| 5 | Load the 12 closure rows | `06e465f` |
| 6 | Dry run, review, apply | **417 cancelled**, verified |

### Live state — verified 2026-07-31

| Fact | Value |
|---|---|
| `schedule_instances` | **3,960** — 3,482 published · 478 cancelled |
| Cancelled | 61 disposed March orphans + **417 closures** |
| Span | 2026-03-09 → **2027-06-15** |
| `studio_closures` | **18** — 6 Spring Break + 12 for 2026-27, 2 `is_total` |
| `rooms` | **11** — 8 active, **3 unassigned** (the retired orphans) |
| `studio_locations` | **6** — 2 with an abbreviation (SC, RSM) |
| `profile_roles` | 27 active rows across 21 people |
| `enrollments` | **1** |
| `classes` | 153 active — **62 of them ended weeks ago** (§8) |
| Coverage gap 2026-03-15 → 07-22 | 0 rows. Never created, not recoverable |

Per-closure cancellations: Labor Day 17 · Veterans Day 19 · Fall Recess 54 ·
**Thanksgiving 21 (total)** · Day after Thanksgiving 6 · Winter Recess 74 ·
**Christmas 6 (total)** · Winter Recess 89 · MLK 17 · Presidents 17 · Spring Recess 80 ·
Memorial 17 — **417**.

---

## 3. Decisions

### 2026-07-30
| # | Decision |
|---|---|
| D1 | **Parallel running all season.** Studio Pro stays the system of record |
| D2 | **Closed Veterans Day. NOT closed Lincoln Day** |
| D3 | `classes.closure_exempt` **withdrawn** — never created |
| D4 | `private_sessions.location_id`, not `room_id` |
| D5 | `exempt_event_types = {private_lesson}`. **Rehearsals stop** |
| D6 | The 6 Spring Break rows are **not** collapsed into a range |
| D7 | **Attendance window is tenant-level, on/off, warning + countdown** |
| D8 | **The lock is on the initial snapshot, not the record.** Only a MISSING snapshot escalates |
| D9 | **Escalation needs a reason** from a picklist. Admin may reopen |
| D10 | Substitutes, admins, studio_managers and super_admins may all take attendance |
| D11 | **Two attendance metrics, never blended:** completion and timeliness |
| D12 | **Grading is emitted, not owned** — a recognition module consumes it |
| D13 | **Sync classes, not enrolments.** No sync infrastructure |
| D14 | MCP write policy amended to three tiers |

### 2026-07-31
| # | Decision |
|---|---|
| D15 | **Auth resolvers fail closed.** Read error throws; zero rows resolves to `parent`. `profiles.role` is never read |
| D16 | **`profile_roles.role` vocabulary is pinned** at the database to nine values |
| D17 | **Rooms are archived, never deleted, unless nothing references them** — all three FKs are `ON DELETE SET NULL`, so a delete never fails |
| D18 | **Room label rule:** location filter active → bare name; otherwise always append `Studio 1 · RSM`. **Never collision-conditional** |
| D19 | **Screen gets the abbreviation, calendars get the address.** `formatRoomLabel` vs `formatCalendarLocation` |
| D20 | **Never derive a short label by splitting a name on punctuation.** `studio_locations.abbreviation` is the source |

---

## 4. 🔴 The finding that mattered most

**There were two occurrence generators. Nobody knew.**

`/api/cron/schedule-generate` — a TypeScript generator in `lib/schedule/generate.ts`, on a
Vercel cron at `0 8 * * *` — had been running nightly. Nothing to do with the SQL
`generate_occurrences` every spec is built around.

Caught because the Phase 4 dry run produced 2,912 where the day before recorded 2,918. The
six-row delta was six rows the cron had written that morning.

**Had Phase 4 run before this was found, most of the 2,912 rows would have been deleted by
08:00 the next morning** — the cron prunes future rows whose `ical_uid` is not in its keep-set,
and the SQL generator never writes `ical_uid`.

Four independent conflicts: it rewrote 971 of 986 future rows nightly, re-deriving `teacher_id`
from the live class; it republished anything `apply_closures` cancelled; it read `closed_date`
only, so it generated straight through a closure range; and it pruned NULL `ical_uid`.

**Resolved:** cron entry removed, deployed, confirmed READY. Route and libs retained but
unscheduled. Also made the route fail closed on a missing `CRON_SECRET`.

### Still owed

**Retiring the TS generator properly is its own spec** — deleting the route, `generate.ts` and
`occurrences.ts`, and resolving **two weekday encodings** (`classes.day_of_week` scalar, JS
0=Sun, in TS; `days_of_week` array, ISO 1=Mon, in SQL). **Do not re-add a cron entry for that
path until the spec says which generator survives.**

---

## 5. What shipped 2026-07-31

### Auth — resolvers stop guessing roles
`getSessionWithRole`, `guards.getUser` and `proxy.ts` fell back to `profiles.role` when the
`profile_roles` read errored **or** returned zero rows. Conflating those was the bug.

- read error → **throw**, with the code logged. This path was 100% silent before
- zero rows → **`['parent']`**. Expected, not broken: `handle_new_user()` creates a profiles
  row and no role row, so **every new signup lands there**. Throwing would have locked out
  every family at account creation

Dropping the fallback also closed a quiet escalation: `DELETE /api/admin/roles` removes a role
row without mirroring `profiles.role`, so the stale column handed a revoked admin their access
back.

Added `app/error.tsx` — the **root** boundary is the only one that can catch a throw from a
route-group layout, since a group-level `error.tsx` renders *inside* the layout that throws.
`/unauthorized` now renders without a successful role read.

**Verified on localhost:** a zero-role account reaches `/portal` and is denied `/admin`; a
forced PGRST205 produces the branded boundary; `/unauthorized` renders during that failure.
**Verified in production on Amanda's account** — four roles resolved, Timesheets and Teacher
Portal both present.

**`CLAUDE.md` §4 corrected.** It claimed Cara's `profiles.role` was `parent` (it is `admin`),
Katherine's was `parent` (it is `teacher`), and 5 of 26 disagree. **Zero disagree** —
`legacyProfileRole()` keeps the mirror accurate. The 5 were profiles with no role rows at all.
**The argument against the column is collapse, not staleness:** 4 of 26 hold multiple roles and
one column cannot hold four values.

### Role vocabulary pinned
`profile_roles.role` was plain text with no CHECK. A typo produced a row matching nothing in
`is_admin()` and nothing in `ROLE_ROUTES` — granted-looking, no access. Nine-value CHECK added;
`techer` verified rejected. `POST /api/admin/roles` was `z.string().min(1)`; now `z.enum` bound
to `UserRole` so drift is a compile error.

### Rooms
Editing was **unreachable code** — `upsertRoom` had an update branch, `RoomForm` was only ever
mounted for create. Now editable, including moving a room between locations. Archive/Restore,
an Archived view, and the three unassigned orphans surfaced.

**Delete is guarded at three layers** because all three FKs are `ON DELETE SET NULL` — a delete
never fails, it silently nulls `room_id` on every referencing row. Reference count across all
three tables, archive-first, and a typed `DELETE` confirmation, with the server re-counting
immediately before deleting.

**Spec drift caught:** `LOCATIONS_AND_FACILITIES.md` §5.4 instructed deleting exactly the three
retired rooms as "redundant legacy seed", and §10 marked it **done**. It was never done, and
doing it would have stripped `room_id` from the **61 preserved disposed orphans**. Struck, and
§6.1 added.

### Location labels
`studio_locations.abbreviation` added (SC, RSM; the four partner/internal rows null by design).
`formatRoomLabel` and `formatCalendarLocation` in `lib/locations/resolve.ts` — which already
held the resolver and was **dead code with only its own tests as callers**.

**The parent ICS feed hardcoded `LOCATION:Studio 1 - Ballet Academy and Movement`.** Once RSM
opens, every RSM class in a parent's synced calendar would have named the wrong studio — not
ambiguous, false. Fixed, along with the Google and Apple calendar links that rebuilt the same
string.

**`/admin/schedule` By Room grouped on the room NAME**, so the two "Studio 1" rooms merged into
one column with a **summed session count** — the count was wrong, not just the heading. Now
keyed on `room_id`.

`shortLocationName` and `makeRoomLabeller` deleted from `class-management.tsx`.

---

## 6. 🟡 `_INDEX.md` is 23+ specs behind

**This is the root cause of the recurring failure.** `_INDEX.md` is the collision detector, and
every "two implementations, neither announcing the conflict" incident traces back to it being
stale. Indexing is a mechanical afternoon that buys back the thing that keeps costing hours.

Today's count of that pattern: the TS cron (§4), the `/admin/schedule` redirect, the
synthetic-week fallback in two surfaces, fourteen surfaces rendering bare room names while a
correct resolver sat unused, and a spec instructing a data-destroying delete.

---

## 7. Spec amendments owed

| Spec | Change |
|---|---|
| `STUDIO_CLOSURES.md` §11 | **`apply_closures` does not cancel private sessions.** An `is_total` closure stops classes and rehearsals; an already-booked private survives until Phase 5 |
| `STUDIO_CLOSURES.md` §8 | Scope conflict: `all_studios` reaches partner venues, which §1 and §5 forbid. A real run REFUSES; a dry run reports |
| `STUDIO_CLOSURES.md` §8 | Return is a superset: adds `dry_run`, `by_closure`, `payroll_conflicts` |
| `STUDIO_CLOSURES.md` §5 | **`UNIQUE (tenant_id, closed_date)` means one closure per tenant per date, ever.** Two location-scoped closures on one date cannot be represented |
| `STUDIO_CLOSURES.md` §6 | Rung 3 unreachable — no link between `schedule_instances` and `private_sessions` |
| `OCCURRENCE_GENERATION.md` | Phase 4 is **done**. Add missing event types |
| `CLAUDE.md` | MCP write policy — three tiers |
| `CONTRACTS_AND_COMMITMENTS.md` | **Amendment, not new spec** — packages absorb bundles, tiers, unlimited |
| `PAYROLL_CORRECTNESS_AND_REPORTING.md` | Substitute default $35; **class assistants unpaid in drafts** |
| `BILLING_AND_CREDITS.md` (March) | Still defines 1 credit = 1 minute = $1 against the locked dollar model |

**Not yet written:** payroll UI for two studios · teacher onboarding portal · Angelina
guardrails · TS generator retirement · recognition module · Class Builder · roster CSV import.

**Three dead specs — do not build from them:** `UNIFIED_SCHEDULE.md` (rejected),
`CALENDAR_AND_SCHEDULING.md` (deprecated), `SCHEDULING_AND_LMS.md` (phantom `class_sessions`).

---

## 8. Open defects

### 🔴 Next up
- **The teacher dashboard shows classes that are not happening.** Verified 2026-07-31: the
  database had **one** occurrence that week; the dashboard showed seven, mixing classes that
  ended 2026-06-15 with classes that do not start until 2026-08-15. It synthesises a week from
  `classes` with no occurrence lookup and no date filter — the **third** synthetic-schedule
  surface found. An investigation prompt was drafted and never run
- **62 classes ended weeks ago and still carry `status='active'`** — nothing retires a class at
  term end. This is what makes the synthetic surfaces look so wrong, and why "1 active class"
  on the admin dashboard is arithmetically right (it derives from dates) while three notions of
  "active" disagree by 152 rows
- **`markAttendance` authorizes on `classes.teacher_id`** — a substitute cannot mark
  attendance. Blocks `CLASS_OPERATIONS_MODE.md` entirely
- **The `studio_manager` role has zero rows** — but needs no migration: `profile_roles.role` now
  permits it, `is_admin()` already accepts it, `ROLE_ROUTES` already routes it. Granting one
  works today
- **`/admin/schedule` has no location filter.** Once RSM publishes, the By Room view roughly
  doubles its columns with no way to narrow. `class-management` has the control to copy

### Carried forward
`app/global-error.tsx` does not exist, so a throw in the root layout is still a bare 500 ·
hardcoded tenant UUID in `/admin/schedule` (5 sites) · cancelled privates filtered while
cancelled classes show · `teach/substitute-requests` has no list endpoint, so its room label
could not be adopted · ~28 API routes authorize off `profiles.role` · `teacher_profiles` is
`WHERE is_active = true` — **do not deactivate anyone until their final pay has run** ·
`class_teachers` has no effective dating · `lms_content` has no `tenant_id` · 41 tables lack
`tenant_id` · `cancelled` vs `canceled` across six tables · `/admin/classes/[id]/report` 404s
and the whole `[id]` segment is missing · `classes_day_of_week_check` allows 0–6 while
`days_of_week` is pinned 1–7 — **Sunday is `0` in one and `7` in the other, same table** ·
`private_session_billing` money columns are `numeric`, not cents · `admin_tasks` does not exist
· `process-scheduled-releases` still fails open on `CRON_SECRET`; `resource-recommendations`
and `weekly-digest` compare against `Bearer undefined` · 88 push notifications unread with no
UI · `confirmation-card.tsx` emits a single studio address from chat config

---

## 9. Open questions

### Blocking
| # | Question | Blocks |
|---|---|---|
| 1 | Attendance window: opens at scheduled start time, or a teacher "start class" action? | Class Operations |
| 2 | Mid-season low-enrollment cancellation — makeups or prorated refund? | Billing (deferred) |
| 3 | Package change mid-season — next anchor or mid-month split? | Packages |
| 4 | Partial-month grid — percentage or dollar? **Percentage recommended** | Tuition |

### For Amanda
| # | Question |
|---|---|
| 5 | **Monday families lose 8 teaching days, Friday families 4 — flat monthly charges both the same.** Accepted, absorbed by makeups, or corrected in scheduling? |
| 6 | **417 cancellations generate a makeup credit per affected enrollment.** Is that volume workable? |
| 7 | Attendance: same window for rehearsals? Who owns the snapshot in a multi-teacher rehearsal? |
| 8 | Attendance grade window — 30 days, term, or season? |
| 9 | Can a teacher reopen their own window, or is admin always required? |
| 10 | Trial students and drop-ins are not on the roster. How do they appear in a snapshot? |
| 11 | Private pricing sheet — solo rate per teacher per duration |
| 12 | Do adult students get makeups? The "Adult" season runs to **2030** |
| 13 | Who teaches the Friday 3:30–6:30 Tricks block? 42 occurrences with no teacher |
| 14 | Should RSM be added to the seven public-facing docs carrying the SC address? A content decision, not a doc sync |

**For counsel:** payroll deduction of a family balance · whether instructors are mandated
reporters under §11165.7 · **whether substitution "gold stars" read as a performance incentive
for 1099 contractors** (AB5).

**Also still true:** `w9_on_file` false for all 20 teachers; nobody has
`employment_type = 'contractor_1099'`.

---

## 10. Recommended next session

1. **The teacher dashboard synthetic week** — it is showing Amanda classes that do not exist,
   today, on the surface she opens first
2. **Retire the 62 ended classes** — the data defect underneath it
3. **Substitute authorization on `markAttendance`** — small, unblocks Class Operations
4. **Payroll UI spec for two studios** — the parallel-season win Amanda asked for

**Still owed a browser test:** `cda3a64` (attendance keyed on the occurrence) was verified by
`tsc` and review but never exercised in a browser. It needs a class that meets twice on one
date — which now exists.

**Also unverified in a browser:** everything shipped today after `1b7f868`. The auth fix was
confirmed on Amanda's dashboard; the room lifecycle and every room label were not.

---

## 11. The pattern, restated

2026-07-29: three times, two implementations or specs of one thing, one stale.
2026-07-30: a fourth — a nightly cron nobody knew was a generator.
2026-07-31: three more — a redirect implementing a proposal that was rejected four weeks after
it shipped, a resolver written for the job and never called by anything but its own tests, and
a spec instructing a delete that would have destroyed 61 preserved rows.

**In every case both looked plausible and neither announced the conflict.**

`ls docs/ | grep -i <topic>` before drafting anything. Check for an existing implementation
before writing a new one. And when a number is off by six, find out why.
