# Studio Closures — Cancellation, Location Scoping & Overrides

**Status:** Draft spec v2 — awaiting approval. Not built.
**Last updated:** 2026-07-29
**Supersedes:** the 2026-07-10 location-scoping spec (`fe53713`) and the 2026-07-29
cancellation-pass rewrite (`636ba43`). Both were authoritative in part; this merges them.
**Governs:** `studio_closures`, `closure_locations` (new), `private_sessions` (location + override),
`classes.closure_exempt` (new), `apply_closures` (new), closure display surfaces, closure enforcement
**Related:** `docs/LOCATIONS_AND_FACILITIES.md` (location model) · `docs/OCCURRENCE_GENERATION.md`
(the generator, Phases 1–3 shipped 2026-07-29) · `docs/PRIVATE_LESSON_BILLING_AND_CREDITS.md` (proration)

> **Two versions of this spec existed and one overwrote the other.** The 2026-07-10
> version established the location model, the override permission asymmetry and the
> `private_sessions` changes. The 2026-07-29 rewrite established the cancellation
> pass, ranges, total closures, exemptions and the payroll interaction. Neither
> superseded the other — the second author did not know the first existed. This
> document is the merge; §2 records what changed and when so the history is not
> lost a second time.

---

## 1. Purpose

A closure must do three things this platform cannot currently express: **target
specific studios**, **actually cancel what was scheduled**, and **admit controlled
exceptions**.

**Location scoping.** With San Clemente and RSM both live — and RSM opening in
September with an empty calendar — a tenant-wide closure is wrong. A San Clemente
closure must not cancel a performance at Casa Romantica, and RSM must not inherit
San Clemente's holiday list by default.

**Closures are often last-minute.** A closure decided on Tuesday cannot prevent the
creation of an occurrence written in August. Any mechanism that only runs at
generation time can handle only closures known months in advance, which is the
minority of them.

**A closure is not a lockout.** When the studio closes a day of children's group
classes, teachers may still book privates, rehearsals may still run, and Amanda may
still hold an adult class. There is no way today to say "closed, except."

**Some closures really are lockouts.** Remodel, deep cleaning, or simply not running
air conditioning for one student — nobody in the building, privates included. That
is a different thing from a normal closure and must be expressible as such.

And underneath all of it: **there is no un-generate path.** `generate_occurrences`
never deletes, by design. Once a season is generated, a newly-discovered closure has
no mechanism to remove the occurrences already written on that date.

---

## 2. How this model changed — and what is true now

Three distinct positions have been held, and both prior versions of this doc contain
a claim that is now false. The accurate position is stated once, here.

| When | Model | Status |
|---|---|---|
| Until 2026-07-29 | **Display-only.** Consumers greyed the day and showed a "Closed" badge. Nothing was cancelled, skipped or filtered. The occurrence generator did not exist. | Historical |
| 2026-07-29 (`3222fec`) | **Generation-time filter.** `generate_occurrences` shipped and **does** skip dates in `studio_closures`, reporting them as `dates_skipped_closed`. | **Live today** |
| This spec | **Cancellation pass.** Generation ignores closures entirely; a separate function cancels occurrences under a closure, runnable at any time. | Proposed |

**Correcting the 2026-07-10 version:** it stated that closures are display-only and
that the occurrence generator ignores `studio_closures`. That was accurate on
2026-07-10. It is not accurate now — the generator shipped on 2026-07-29 and skips
closure dates. Phase 3 below removes that behaviour again, deliberately.

**Correcting the 2026-07-29 version:** it described the generation-time filter as
"the current model," which read as though closures had always been a generation
concern. They were display-only first, for months, and several surfaces still
implement only that. Both facts belong in the record.

**Task 19 is no longer a blocker.** The 2026-07-10 version deferred the entire class
half of this spec until an occurrence generator existed. It exists: `OCCURRENCE_GENERATION.md`
Phases 1–3 shipped 2026-07-29 (`2633d1a`, `3222fec`, `d7e7b9f`). A rolled-back test
run over the Fall window produced occurrences for **91 classes, ~2,918 rows**
(verified 2026-07-29). Class-side enforcement is buildable now. Any "deferred until
task 19" framing elsewhere in the docs is obsolete.

---

## 3. Current state — verified 2026-07-29

| Fact | Value |
|---|---|
| `studio_closures` rows | 6, all Spring Break 2026-04-06 → 04-11 |
| Shape | `tenant_id`, `closed_date` (single date), `reason` — no location, no range |
| Fall closures on file | **none** |
| `studio_locations` | 6 — San Clemente, Rancho Santa Margarita, San Juan Hills High School, The Resort at Pelican Hill, Casa Romantica Cultural Center, Allsize Storage |
| `location_type` values in use | `studio`, `partner_venue`, `internal` — **only 2 are `studio`** |
| `closure_locations` | does not exist |
| Classes missing `location_id` | 0 |
| Active classes | 153 |
| Adult classes in catalogue | **0** (none by age, none by name) |
| Pilates classes | **0** |
| Disciplines present | Ballet, Contemporary, Hip Hop, Jazz, Movement, Musical Theater, Stretching |
| `private_sessions` | 5 rows. Location is **free-text `studio`**, all `"Studio 1"`. No `location_id`, no `overrides_closure` |
| `schedule_instances` cancelled | 61 — the disposed March orphans (`d7e7b9f`), unrelated to closures |
| `generate_occurrences` | live, and **skips closure dates** (§2) |
| Draft generator closure handling | filters `si.status = 'published'` — see §9 |

Adult and Pilates classes do not exist yet. The exemption mechanism in §5 is designed
so they need no schema change when they arrive.

---

## 4. The change

**Closures stop being a generation filter and become a cancellation pass.**

`generate_occurrences` ignores `studio_closures` entirely. A separate function,
`apply_closures`, cancels occurrences that fall under a closure, and can run at any
time — before generation, after generation, or the morning of.

This is one mechanism instead of two, and it gains three properties:

- **Last-minute closures work**, because cancelling an existing occurrence is the
  same operation whenever it runs.
- **It is the missing un-generate path.** Cancellation is non-destructive — the row
  survives with `status='cancelled'` and a reason.
- **A closed day becomes visible history** rather than a silent absence. "This class
  was cancelled for Thanksgiving" is a better record than the occurrence never having
  existed, both for parents and for billing audit.

**Consequence for billing.** Proration in `PRIVATE_LESSON_BILLING_AND_CREDITS.md` and
the tuition rules currently compute "dates from start to anchor, minus closures."
Under this model they should count **non-cancelled occurrences** instead. That is
strictly more accurate — it picks up single-class cancellations, teacher absences and
room blocks, not just studio-wide closures — and it removes a duplicate closure
calculation from the billing path.

---

## 5. Data model

### `studio_closures` — add

| Column | Type | Meaning |
|---|---|---|
| `all_studios` | boolean NOT NULL DEFAULT true | `true` → applies to every `location_type='studio'` location, including studios that do not exist yet. `false` → applies only to the studios listed in `closure_locations`. |
| `closed_through` | date NULL | End of an inclusive range. NULL means a single day. Winter break becomes one row, not ten. |
| `is_total` | boolean NOT NULL DEFAULT false | Nobody in the building. **Overrides every exemption and every override** — see §6. |
| `exempt_event_types` | text[] NOT NULL DEFAULT `'{}'` | For partial closures: event types that carry on regardless. Expected typical value `{private_lesson,rehearsal}`. |

`closed_date` stays as the range start. A CHECK enforces
`closed_through IS NULL OR closed_through >= closed_date`.

### `closure_locations` — new join table

| Column | Type |
|---|---|
| `closure_id` | uuid → `studio_closures.id` ON DELETE CASCADE |
| `location_id` | uuid → `studio_locations.id` |

Populated only when `all_studios = false`. One row per targeted studio.

**Rule: only `location_type='studio'` may be referenced** — never `partner_venue`,
never `internal`. A closure of the studio has no authority over Casa Romantica or a
storage unit. Enforce in the UI and the save path.

**Why a join table and not a nullable `location_id`.** The requirement is explicitly
"all studios OR a multi-select." A nullable column **cannot express "all studios"** —
NULL would have to mean it, which collides with "not yet set" and silently widens any
closure saved incomplete. And a multi-select would **fan one closure into duplicate
date rows**, one per studio, which then have to be kept in sync on every edit and
delete. The join table plus an `all_studios` flag models one-closure → many-studios
cleanly, keeps one row per closure, scales to a third studio for free, and lets "all"
and "specific" closures coexist in the same table.

### `private_sessions` — add

| Column | Type | Meaning |
|---|---|---|
| `location_id` | uuid → `studio_locations.id` (studio-type) | **Prerequisite** for targeting privates by studio. Without it, no location-scoped enforcement works on privates at all. |
| `overrides_closure` | boolean NOT NULL DEFAULT false | This private happens even if its studio is closed on its date. Subject to §6. |

**Backfill.** Location is free-text `studio` today — 5 rows, all `"Studio 1"`, all San
Clemente. Map them to the San Clemente location as part of the schema step. **This
gets harder the longer it waits:** five rows of a single known value is a trivial
mapping; a year of privates across two studios entered as free text is a
reconstruction job. Do it now, while the answer is unambiguous.

### `classes` — add

| Column | Type | Meaning |
|---|---|---|
| `closure_exempt` | boolean NOT NULL DEFAULT false | This class runs through a partial closure. Amanda marks adult classes and Pilates once. |

**Deliberately not built:** a class-category taxonomy for "adult" or "pilates".
Neither exists in the catalogue today (0 adult by age or name, 0 Pilates; the
disciplines are Ballet, Contemporary, Hip Hop, Jazz, Movement, Musical Theater,
Stretching), `age_min` is 0 on every row, and inventing a taxonomy to express a
two-item exemption list would be building the wrong thing. The boolean is set
directly by the person who makes the decision.

---

## 6. Overrides and precedence

Two override paths exist, with **deliberately asymmetric permissions**, and one flag
that defeats both.

**A teacher may override a closure for their own private.** Any teacher who can
schedule privates may set `overrides_closure` on a private session. **No admin gate** —
it is their lesson, their student, and their call. This is the common case: teachers
book privates on closed days routinely.

**Only an admin may override a class.** Only `admin` / `super_admin` may cause a class
occurrence to run during a closure. A teacher cannot. A class involves a room, a
roster, parents arriving at a building, and a decision that the studio is open for
business that day — which is not a teacher's decision to make.

**`is_total` defeats everything.** A total closure overrides **all** exemptions and
**all** overrides, including a teacher's `overrides_closure` on a private and an
admin's class override. That is the entire purpose of the flag: nobody in the
building means nobody, and an override path that survives it would make the flag
decorative.

> Neither prior version of this spec stated this rule, because neither could:
> `is_total` did not exist on 2026-07-10 and the override model did not exist in the
> 2026-07-29 rewrite. It is the one genuinely new decision in this merge.

**Precedence, highest first:**

1. `is_total = true` → cancelled. Nothing below is consulted.
2. `event_type` ∈ `exempt_event_types` → survives.
3. Class has `closure_exempt = true` → survives.
4. Private has `overrides_closure = true` → survives.
5. Admin has explicitly overridden this class occurrence → survives.
6. Otherwise → cancelled.

---

## 7. Permissions

| Action | Who | Status |
|---|---|---|
| Create / edit / delete a closure (all studios or specific) | admin / super_admin | Buildable now |
| Mark a closure `is_total` | admin / super_admin | Buildable now |
| Set `exempt_event_types` on a closure | admin / super_admin | Buildable now |
| Mark a class `closure_exempt` | admin / super_admin | Buildable now |
| Override a **private** to run during a closure (`overrides_closure`) | **any teacher who can schedule privates** — no admin gate | Buildable now |
| Override a **class** to run during a closure | **admin / super_admin only** | Buildable now (was deferred on task 19; the generator exists) |
| Run `apply_closures` | admin / super_admin | Phase 2 |
| Override anything under an `is_total` closure | **nobody** | §6 |

---

## 8. The cancellation contract

```
apply_closures(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_dry_run   boolean default true
) returns table (
  occurrences_cancelled int,
  exempted              int,
  drafts_removed        int,
  blocked_by_payroll    int
)
```

For each closure overlapping `[p_from, p_to]` — a closure covers
`closed_date` through `coalesce(closed_through, closed_date)` inclusive — and each
occurrence on a covered date whose location is in scope (the closure has
`all_studios = true`, or the occurrence's `location_id` appears in
`closure_locations` for that closure):

1. **Skip if the occurrence is already cancelled.** Re-running changes nothing.
2. **Skip if `event_date <= current_date`.** Closures do not rewrite the past, for the
   same reason generation does not. A same-day closure must be applied before the day
   ends — that is a UI concern, not a reason to let the function edit history.
3. Apply the precedence ladder in §6: cancel unconditionally if `is_total`; otherwise
   count as `exempted` and skip if any exemption or override applies.
4. Cancel: `status='cancelled'`, `cancellation_reason` naming the closure and its
   reason.

**`p_dry_run` defaults to TRUE.** This function cancels classes and deletes payroll
drafts; the default must be the safe one. A caller has to ask for the write.

---

## 9. Payroll interaction — the constraint that matters

`generate_timesheet_drafts` selects `where si.status = 'published'`, so cancelling an
occurrence **prevents future drafts**. It does not remove drafts already created, and
its idempotency check — "if any entry already references this occurrence, do nothing" —
means they will not be regenerated or corrected either.

So `apply_closures` must clean up behind itself:

- **Delete `timesheet_entries` with `status='draft'`** that reference a cancelled
  occurrence. Count as `drafts_removed`.
- **Never touch an entry that is approved, submitted or paid.** Paid entries are
  immutable in `date` and `timesheet_id` by migration `20260728000005`, and payroll
  history is not rewritten by a scheduling decision. Count these as
  `blocked_by_payroll` and **report them by teacher and date** — a human resolves them.
- If `blocked_by_payroll > 0`, **still cancel the occurrence.** The occurrence is a
  scheduling fact; the entry is a pay fact. They are allowed to disagree, and the
  report is how the disagreement surfaces.

This is why `apply_closures` cannot be a trigger on `studio_closures`. It touches
payroll and needs a dry run, a report, and a human.

> This section had no counterpart in the 2026-07-10 version and could not have: the
> timesheet draft generator did not exist until 2026-07-28 (`20260728000007`).

---

## 10. Booking interaction

Cancellation covers what is already scheduled. Two surfaces also need to consult
closures at write time:

- **Private lesson booking** must refuse a date under an `is_total` closure, and allow
  it under a partial closure that exempts `private_lesson`. This is the concrete case:
  teachers book privates on closed days routinely, and a total closure is exactly when
  they must not.
- **Occurrence creation by hand** (admin adding a one-off session) should **warn, not
  refuse**. An admin adding a session on a closed day may be doing so deliberately.

Neither is built in Phases 1–3; both are recorded so the model is not adopted half-way.

---

## 11. Honesty boundary

**Closures still cancel nothing.** Today they skip dates at generation time (§2) and
grey a day on display surfaces. Nothing in this document is built.

What changed since 2026-07-10 is which half is blocked. The **class half is no longer
deferred** — the occurrence generator exists and materializes rows to cancel. The
**privates half is now the one that cannot be enforced by location**, because
`private_sessions.location_id` does not exist and location is still free text. That is
a schema step, not a blocker on anything external.

Nothing here should imply that closure enforcement works before `apply_closures`
ships.

---

## 12. Build sequence

**Phase 1 — schema.** `studio_closures.all_studios`, `closed_through`, `is_total`,
`exempt_event_types`; the `closed_through >= closed_date` CHECK; `closure_locations`
join table; `private_sessions.location_id` + `overrides_closure`; `classes.closure_exempt`.
Backfill: the 6 existing closures get `all_studios = true`, `is_total = false`,
`exempt_event_types = '{}'`; the 5 privates' free-text `"Studio 1"` → San Clemente
`location_id`. One migration via `supabase db push` (Regular Terminal), pre-flight
guards, then type regen and `bam-schema-sync`.

**Phase 2 — `apply_closures`.** Per §8 and §9, dry-run default.

**Phase 3 — remove closure handling from `generate_occurrences`.** Drop the
`studio_closures` exclusion and the `dates_skipped_closed` return column. **This is a
breaking change to a published contract** (`OCCURRENCE_GENERATION.md` §4) — and now is
the cheap moment: the function is called from nowhere, no cron depends on its
signature, and Phase 4 of that spec has not run. Land this before that generation runs
so the two mechanisms never coexist.

**Phase 4 — closure CRUD + admin UI.** Closure calendar with range entry, all-studios /
specific-studios multi-select (studio-type locations only), the total/partial switch,
and the exemption list. Display surfaces become location-aware: grey and badge only the
**targeted** studios on that date, not the whole tenant. Amanda must be able to enter a
last-minute closure herself; a closure model she needs a developer for is a closure
model that will not be used.

**Phase 5 — enforcement on booking.** §10. Privates enforcement at targeted studios
with per-private `overrides_closure`, editable by any private-scheduling teacher;
respect the existing `status='cancelled'` exclusion the app already honours.

**Phase 6 — billing.** Switch proration to count non-cancelled occurrences (§4).
Coordinate with the billing spec; do not change both definitions at once.

---

## 13. What this unblocks

`OCCURRENCE_GENERATION.md` Phase 4 (first full-season generation) is currently blocked
because the Fall closure calendar is empty and generation cannot be undone. Under this
model that block **disappears**: generate the full season now, and cancel Thanksgiving,
winter break and anything else whenever Amanda pins the dates down.

Phase 3 above should land before that generation runs.

---

## 14. Open questions

| # | Question | Source | Blocks |
|---|---|---|---|
| 1 | Default `exempt_event_types` for a normal closure — is `{private_lesson,rehearsal}` right, or do rehearsals stop too? **Amanda** | 2026-07-29 | Phase 2 default |
| 2 | Does a closure at San Clemente ever imply a closure at RSM? Assumed **no** — separate buildings, separate calendars, which is what `all_studios = false` is for | both | Phase 1 |
| 3 | When a class is cancelled by closure, are parents notified, and by which surface? `notification_sent_at` exists on the occurrence and 88 notifications sit unread with no UI | 2026-07-29 | Phase 4 |
| 4 | **Does a closed day shorten the season or extend the end date?** A tuition question, not a scheduling one. **Amanda** | 2026-07-29 | Phase 6 |
| 5 | For a **recurring** private, does `overrides_closure` apply per occurrence or to the whole recurrence series? | 2026-07-10 | Phase 5 |
| 6 | Should an admin class override be a column on the occurrence, or an audited action? §6 assumes the former; nothing implements either yet | this merge | Phase 4 |

**Question 4 is the one with money attached.** If families pay for a fixed number of
sessions, a closure either shortens what they received or pushes the season out. Both
are defensible; the system currently assumes neither, and §4's switch to counting
non-cancelled occurrences makes the answer directly observable in what gets billed.
