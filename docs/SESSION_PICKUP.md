# SESSION PICKUP

_Last rewritten: 2026-07-30 (end of session)_

**Fall begins 2026-08-15 — 16 days.**

**🔴 The deadline changed. Read §1 before planning anything.**

---

## 0. Pre-session ritual — do not skip

Full protocol in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -8`
- **Claude Code:** `/clear` before any work
- **Schema days:** `supabase migration list` — *and then verify against the catalog*
- All DDL through `supabase db push` in Regular Terminal.
- `scripts/e2e-*.ts` stay untracked permanently. Never commit them.

### State at close — verified, not remembered

```
06e465f (HEAD -> main)  closure calendar, 12 rows
de81950                 Class Operations Mode spec
26bedeb                 apply_closures
989b276 (origin/main)   unschedule TS cron ← last pushed
```

**Three commits unpushed.** Working tree clean apart from the two e2e scripts.
Everything below is applied in production and verified against the catalog.

### 🟡 MCP write policy — amended today

The old rule was "Supabase MCP is read-only." That was too broad; the reason behind it was
**DDL through MCP bypasses the migration file, so the repo stops describing the database.**
That reason applies to DDL and nothing else. Three tiers now:

| Operation | MCP | Why |
|---|---|---|
| **DDL** | **Never.** `supabase db push`, Regular Terminal | Unchanged. This is the whole rule |
| Reads, and writes in a transaction that rolls back | Allowed | Leaves no state, cannot drift |
| Persisting data writes | Allowed on explicit per-operation say-so, logged here | No schema change, so no drift |

Used today for: the Phase 4 dry run (tier 2), the real generation and `apply_closures`
(tier 3, both explicitly authorised). **`CLAUDE.md` still says read-only and owes this edit.**

### Techniques that carried today

**Chase the small discrepancy.** A six-row difference between yesterday's 2,918 and today's
2,912 was the thread that unravelled a second occurrence generator running nightly. Waving it
off as noise would have cost the entire Fall season within 24 hours — see §4.

**Verify against the catalog, never the migration list.** `supabase db push` reported
"Remote database is up to date" for a migration whose objects did exist. `migration list`
showed it applied on both sides. Neither proved anything; querying
`information_schema` did.

**The pre-flight guard that refuses on a wrong premise.** `20260730000001` raises if
`classes.closure_exempt` exists — a column it asserts is absent. If the catalog reads behind
the migration were wrong, it refuses rather than building on a bad premise. Cheap, and it
converts an assumption into an assertion.

---

## 1. 🔴 The deadline changed — parallel running

**Amanda and Derek decided 2026-07-30: BAM stays on Studio Pro for the 2026-27 season. The
platform runs in parallel and is beta-tested all season.**

The driver was billing risk. Fall was never "Aug 15" in itself, it was *replacing Studio Pro*
by Aug 15, and a billing defect would have meant a family who cannot enrol. Shadowing removes
that failure mode entirely.

**What this changes:**

- **Billing is no longer Fall-blocking.** The vault-only enrolment work — Phases 1 and 2,
  E2E-verified in Stripe test mode — does not need to go live this season
- **Nothing on the old critical path is urgent any more.** It is also all done (§2)
- **What becomes valuable is anything that runs without money or rosters:** schedule,
  closures, occurrences, **teacher timesheets**, Angelina on the public site

**The hidden cost, named early: data parity.** If Studio Pro is the source of truth, the
platform's data goes stale. `enrollments` has **1 row**. Anything roster-dependent is
testing mechanics against empty data and proving nothing.

**Resolved 2026-07-30 — the sync problem is smaller than it first looked.** It is
**classes, not enrolments**. Classes are already live (153, of which 91 have occurrences
through 2027-06-15) and change a handful of times a season. That is Amanda mentioning a new
class, not sync infrastructure. **Explicitly rejected:** building sync infrastructure for a
system being replaced.

Rosters are still needed for attendance, but roster churn concentrates in Aug–Sep and then
trickles. A season-start CSV import plus occasional top-ups is likely enough. A CSV job, not
a system.

### The first parallel win: timesheets

**Teachers currently log timesheets in Google Sheets.** Replacing that is the strongest Fall
move available: needs classes, occurrences and teachers — all live as of today — needs no
rosters, and puts no money at risk. `generate_timesheet_drafts` already runs nightly at 08:30
UTC and, as of today, has occurrences through 2027-06-15 to draft against instead of stopping
at 2026-11-27.

Two known defects to fix first, both from yesterday's list: **class assistants are unpaid in
drafts** (the generator creates entries for the assigned teacher and substitute only), and the
**substitute default should be $35, not $50**.

Amanda also wants the payroll UI dialled in for **two studios** — RSM opens September. Doing
two locations by hand in Sheets is where errors get expensive. **This spec is not yet
written** and was the next thing queued when the session ended.

---

## 2. ✅ The Fall critical path is COMPLETE

All six steps, in one session.

| # | Step | Result |
|---|---|---|
| 1–2 | Closures Phase 1 + Phase 3, one migration | `6e39ada` · `20260730000001` |
| 2.5 | **Unschedule the TS occurrence cron** | `989b276` — *new step, see §4* |
| 3 | Occurrence Phase 4 — generate the season | **2,912 created**, 91 classes |
| 4 | Closures Phase 2 — `apply_closures` | `26bedeb` · `20260730000002` |
| 5 | Load the 12 closure rows | `06e465f` · `20260730000003` |
| 6 | Dry run, review, apply | **417 cancelled**, verified |

### Live state after all of it — verified 2026-07-30

| Fact | Value |
|---|---|
| `schedule_instances` | **3,960** — 3,482 published · 478 cancelled |
| Cancelled | 61 disposed March orphans + **417 closures** |
| Span | 2026-03-09 → **2027-06-15** |
| Classes with occurrences | **91** |
| Still published on a closure date | **0** |
| `apply_closures` second run | **0 cancelled** — idempotent |
| `studio_closures` | **18** — 6 Spring Break + 12 for 2026-27, 2 of them `is_total` |
| `closure_locations` | exists, 0 rows |
| `private_sessions` | 5, all backfilled to San Clemente, 0 overriding |
| Coverage gap 2026-03-15 → 07-22 | 0 rows. Never created, not recoverable |

Sample cancellation reason, which is the artifact a makeup credit will reference:

```
Studio closure: Thanksgiving Day (2026-11-26, total closure) [closure bf556043-…]
```

### Per-closure cancellations

Labor Day 17 · Veterans Day 19 · Fall Recess 54 · **Thanksgiving 21 (total)** ·
Day after Thanksgiving 6 · Winter Recess 74 · **Christmas 6 (total)** · Winter Recess 89 ·
MLK 17 · Presidents 17 · Spring Recess 80 · Memorial 17 — **417**

Internally consistent: every Monday closure is exactly 17, Wednesdays 19, and the multi-day
ranges decompose into those same per-weekday counts. Fridays are only 6 — a light teaching
day, consistent with the six rows the cron created on 2026-11-27.

**0 exempted is correct, not a bug.** `exempt_event_types = {private_lesson}` exempts nothing
because the schedule holds no `private_lesson` occurrences — see §5.

---

## 3. Decisions — 2026-07-30

| # | Decision | Source |
|---|---|---|
| D1 | **Parallel running all season.** Studio Pro stays the system of record; the platform beta-tests alongside it | Amanda + Derek |
| D2 | **Closed Veterans Day. NOT closed Lincoln Day.** Feb 12 removed entirely | Amanda |
| D3 | `classes.closure_exempt` **withdrawn** — never created, retracted not deferred | Derek |
| D4 | `private_sessions.location_id`, **not** `room_id` — closures are location-scoped; a room closing is already `room_block` | Derek |
| D5 | `exempt_event_types = {private_lesson}` on every partial closure. **Rehearsals stop** | Amanda |
| D6 | The 6 Spring Break rows are **not** collapsed into a range — past dates, churn with no benefit | Derek |
| D7 | **Attendance window is tenant-level, on/off, with warning and countdown** | Amanda |
| D8 | **The lock is on the initial snapshot, not the record.** Late arrivals are appends; only a MISSING snapshot escalates | Derek |
| D9 | **Escalation needs a reason** from a picklist (`refunds.reason_id` pattern). Admin may reopen so a teacher can finish before leaving | Amanda |
| D10 | **Substitutes, admins, studio_managers and super_admins may all take attendance** | Amanda |
| D11 | **Two attendance metrics, never blended:** completion and timeliness. A reopened snapshot counts for the first, not the second | Amanda + Derek |
| D12 | **Grading is emitted, not owned.** A separate recognition module will also consume curriculum adherence and substitution stars | Derek |
| D13 | **Sync classes, not enrolments.** No sync infrastructure | Derek |
| D14 | **MCP write policy amended** to three tiers — see §0 | Derek |

---

## 4. 🔴 The finding that mattered most

**There were two occurrence generators. Nobody knew.**

`/api/cron/schedule-generate` — a TypeScript generator in `lib/schedule/generate.ts`, wired to
a Vercel cron at `0 8 * * *` — had been running every night. It has nothing to do with the SQL
`generate_occurrences` every spec is built around.

It was caught because the Phase 4 dry run produced 2,912 where yesterday recorded 2,918. The
six-row delta was six rows the cron had written at 08:01 that morning, all on 2026-11-27,
`created_by` NULL.

**Had Phase 4 run before this was found, most of the 2,912 rows would have been deleted by
08:00 the next morning.** The cron prunes future rows whose `ical_uid` is not in its
freshly-built keep-set, and the SQL generator never writes `ical_uid`.

Four independent conflicts, any one disqualifying:

1. **It rewrites the snapshot.** No `ignoreDuplicates`, so every run UPDATEs nearly every
   future row — 971 of 986 that morning — re-deriving `teacher_id`, `room_id`, `location_id`
   and `status` from the live `classes` row. Attendance is now keyed on the occurrence and
   timesheets derive from it, so this is a payroll-correctness problem, not a scheduling one
2. **It republishes cancellations.** Sets `status` from the closure map every run, so anything
   `apply_closures` cancels is flipped back to published the next morning
3. **It reads `closed_date` only** — after Phase 1, it honours day one of a range and generates
   straight through the rest
4. **It prunes NULL `ical_uid`** — every row the SQL generator writes

**Resolved:** cron entry removed from `vercel.json`, deployed and confirmed READY
(`dpl_CLsapHcDvTKfCFtzLRnGwkmtN4Nc`). Route, `generate.ts` and `occurrences.ts` **retained but
unscheduled**. Also made the route fail closed on missing `CRON_SECRET` — it was
`if (cronSecret)`, which skipped auth entirely when unset. `CRON_SECRET` **is** set in Vercel
Production and Preview, so this was hardening, not a breach.

**Verified before removal:** nothing reads `schedule_instances.ical_uid` except that
generator's own prune; both ICS feeds key on other columns; the route has no side effects
beyond `schedule_instances`; the table's only trigger is an `updated_at` setter.

### What this corrects in the record

- The ~981 future occurrences were **never** produced by the SQL generator. `_INDEX.md`
  attributed them to `generate_occurrences` shipping 2026-07-29; the `ical_uid` on every row
  says otherwise
- Yesterday's "published span 2026-07-23 → 2026-11-26" was **not a season** — it was a rolling
  120-day window (`WINDOW_DAYS = 120`), which also explains the March–July coverage gap
- `STUDIO_CLOSURES.md` §11's "closures still cancel nothing" was wrong. This path had been
  writing `status='cancelled'` from closures all along

### Still owed

**Retiring the TS generator properly is a separate spec'd job** — deleting the route,
`generate.ts` and `occurrences.ts`, and resolving **two weekday encodings** (`classes.day_of_week`
scalar, JS 0=Sun, in TS; `days_of_week` array, ISO 1=Mon, in SQL). **Do not re-add a cron entry
for that path until the spec says which generator survives. The two cannot both run.**

---

## 5. Spec amendments owed

Carried forward and added to today. None are blocking.

| Spec | Change |
|---|---|
| `STUDIO_CLOSURES.md` §11 | **`apply_closures` does not cancel private sessions.** An `is_total` closure stops classes and rehearsals; an already-booked private survives until Phase 5. Real gap in the honesty boundary |
| `STUDIO_CLOSURES.md` §8 | **Scope conflict.** §8's `all_studios` rule reaches partner venues; §1 and §5 say a studio closure has no authority over Casa Romantica. §8 implemented literally; a real run REFUSES if any non-studio occurrence is in scope. Zero affected today |
| `STUDIO_CLOSURES.md` §8 | Return is now a **superset**: the four documented scalars plus `dry_run`, `by_closure`, `payroll_conflicts` |
| `STUDIO_CLOSURES.md` §5 | **`UNIQUE (tenant_id, closed_date)` means one closure per tenant per date, ever.** Two location-scoped closures on one date — San Clemente burst pipe, RSM closed for something else — cannot be represented. Doesn't matter until RSM opens |
| `STUDIO_CLOSURES.md` §6 | **Rung 3 is unreachable.** No link exists between `schedule_instances` and `private_sessions`, so `overrides_closure` cannot be read for an occurrence. The function raises rather than guessing |
| `OCCURRENCE_GENERATION.md` | Phase 4 is **done**. Add the missing event types (competitions, studio events, key dates) |
| `CONTRACTS_AND_COMMITMENTS.md` | **Amendment, not new spec** — packages absorb bundles, tiers, unlimited |
| `CALENDAR_AND_PUBLIC_EVENTS.md` | Schedule-as-hub, "My Schedule", printable weeks. Reference the April `UNIFIED_SCHEDULE.md` decision explicitly |
| `PRIVATE_LESSON_BILLING_AND_CREDITS.md` | Credits never expire, span all private disciplines, reserved vs available balance, no-show 100% overridable |
| `PAYROLL_CORRECTNESS_AND_REPORTING.md` | Substitute default $35. **Class assistants unpaid in drafts** — real gap, and now on the Fall path |
| `BILLING_AND_CREDITS.md` (March) | Still defines 1 credit = 1 minute = $1 against the locked dollar model. **Reconcile before any credit work** |
| `CLAUDE.md` | **MCP write policy** — three tiers, §0 |

**Not yet written:** payroll UI for two studios · teacher onboarding portal · Angelina
guardrails · TS generator retirement · recognition module · Class Builder.

**Three dead specs — do not build from them:** `UNIFIED_SCHEDULE.md` (rejected),
`CALENDAR_AND_SCHEDULING.md` (deprecated), `SCHEDULING_AND_LMS.md` (phantom `class_sessions`).

---

## 6. 🟡 `_INDEX.md` is 23 specs behind

Corrected today. The note in the file reads `### Still unindexed (swept 2026-07-27)` and lists
**11** docs; the real figure after indexing `CLASS_OPERATIONS_MODE.md` is **23**.

**This is the root cause of the recurring failure.** `_INDEX.md` is the collision detector, and
every "two implementations, neither announcing the conflict" incident — three yesterday, one
today — traces back to it being stale. Indexing 23 rows is a mechanical afternoon that buys
back the thing that keeps costing hours.

Note also `INCIDENT_REPORTING.md` is among the unindexed, and `CLASS_OPERATIONS_MODE.md` names
it as Related — the attendance snapshot exists to be evidence for it.

---

## 7. Open questions

### Blocking work
| # | Question | Blocks |
|---|---|---|
| 1 | Attendance window: opens at **scheduled start time**, or at a teacher "start class" action? Scheduled is simpler; an action is more honest about a class that started late | Class Operations |
| 2 | Mid-season low-enrollment cancellation — makeups, or prorated refund? | Billing (deferred by D1) |
| 3 | Package change mid-season — new rate from next anchor, or mid-month split? | Packages |
| 4 | Partial-month grid — percentage or dollar? **Percentage recommended** | Tuition |
| 5 | Does booking a private **reserve** credit, or only intend to? | Credits |
| 6 | Can a student hold two packages at once — hard constraint or default? | Packages schema |

### For Amanda
| # | Question |
|---|---|
| 7 | **Monday families lose 8 teaching days, Friday families 4 — and under flat monthly billing both pay the same.** Accepted, absorbed by makeups, or corrected in scheduling? |
| 8 | **417 cancellations generate a makeup credit per affected enrollment.** Is that volume workable? |
| 9 | Attendance: same window for rehearsals? Multi-teacher rehearsals raise "who owns the snapshot" |
| 10 | Attendance grade — rolling 30 days, term, or season? |
| 11 | Can a teacher reopen their own window within a grace period, or is admin always required? |
| 12 | Trial students and drop-ins are not on the roster. How are they recorded in a snapshot? |
| 13 | **Private pricing sheet** — solo rate per teacher per duration (30/45/60/90) |
| 14 | Do adult students get makeups, and on what expiry basis? The "Adult" season runs to **2030** |
| 15 | Is `originating_program_id` the company track or the level? 4 tracks vs 18 levels |
| 16 | Who teaches the Friday 3:30–6:30 Tricks block? 42 occurrences with no teacher |
| 17 | Cancellation policy for privates, beyond "usually not charged" |

**For counsel:** payroll deduction of a family balance · whether instructors are mandated
reporters under §11165.7 · **whether substitution "gold stars" read as a performance incentive
for 1099 contractors** (AB5, and `SUBSTITUTE_TEACHER.md` has an open question already).

**Also still true:** `w9_on_file` false for all 20 teachers; nobody has
`employment_type = 'contractor_1099'`.

---

## 8. Defects

### 🔴 Blocking prerequisites — small, and they unblock a lot

- **`markAttendance` authorizes on `classes.teacher_id`, so a substitute cannot mark
  attendance.** Under an attendance window this becomes systematic: every substituted class
  fails and escalates, so the queue fills with an authorization bug rather than compliance
  failures. Must also read `schedule_instances.substitute_teacher_id`, with admin tiers from
  `profile_roles` via a `SECURITY DEFINER` helper — never `profiles.role`
- **The `studio_manager` role does not exist — 0 rows.** Both `CLASS_OPERATIONS_MODE.md` and
  `STUDIO_CLOSURES.md` reference it. Until it exists, treat as admin
- **Class assistants are unpaid in timesheet drafts** — now on the Fall path via timesheets

### Carried forward
Three attendance reads merge two sessions into one number · a second attendance system writes
`attendance_records` (empty, cheap to retire) · `teacher_profiles` is `WHERE is_active = true`
— **do not deactivate anyone until their final pay has run** · `class_teachers` has no
effective dating · `lms_content` has no `tenant_id` · ~30 API routes authorize off
`profiles.role` · 41 tables lack `tenant_id` · `cancelled` vs `canceled` across six tables ·
`DATABASE_SCHEMA.md` 54% absent · `/admin/classes/[id]/report` 404s · `draft`/`cancelled`
unreachable from the admin UI · `classes_day_of_week_check` allows 0–6 while `days_of_week` is
pinned 1–7 — **Sunday is `0` in one and `7` in the other, same table** ·
`private_session_billing` money columns are `numeric`, not cents · `admin_tasks` does not exist
(the Browse Classes "Request Enrollment" no-op) · older cron routes fail open when
`CRON_SECRET` is unset — `schedule-generate` fixed today, `process-scheduled-releases` still
has the same shape, and `resource-recommendations` / `weekly-digest` compare against
`Bearer undefined`

---

## 9. Recommended next session

**Push first.** Three commits are unpushed: `26bedeb`, `de81950`, `06e465f`.

Then, in order:

1. **Substitute authorization on `markAttendance`** — small, self-contained, unblocks Class
   Operations and the class session hub
2. **Create the `studio_manager` role**
3. **Payroll UI spec for two studios** — the first parallel-season win, and the thing Amanda
   asked for. Simple v1 deliberately: get people using it
4. **Class assistants in timesheet drafts + substitute default $35**

**Still owed a browser test:** `cda3a64` (attendance keyed on the occurrence) was verified by
`tsc` and line-by-line review but never exercised in a browser. It needs a class that genuinely
meets twice on one date — **which now exists**, since Phase 4 has generated the season.

**Not urgent any more, per D1:** packages, billing, Angelina upsell, waitlist, interest lists.

---

## 10. The pattern, restated

Yesterday: three times, two implementations or specs of one thing, one of them stale.
Today: a fourth, and the most expensive — a nightly cron nobody knew was a generator.

**In every case both looked plausible and neither announced the conflict.** The only thing
that caught today's was refusing to wave off a six-row discrepancy.

`ls docs/ | grep -i <topic>` before drafting anything. Check for an existing implementation
before writing a new one. And when a number is off by six, find out why.
