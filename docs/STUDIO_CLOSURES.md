# Studio Closures

_Written 2026-07-29. Status: spec, not built._

Supersedes the closure handling in `OCCURRENCE_GENERATION.md` §3.

---

## 1. Why this exists

The current model is `studio_closures(tenant_id, closed_date, reason)` — a flat list
of dates, consulted at generation time and skipped. Three things break it.

**Closures are often last-minute.** Generation runs months ahead. A closure decided
on Tuesday cannot prevent the creation of an occurrence that was written in August.
A generation-time filter can only ever handle closures known in advance, which is
the minority of them.

**A closure is not a lockout.** When the studio closes a day of children's group
classes, teachers may still book privates, rehearsals may still run, and Amanda may
still hold an adult class. The current model has no way to express "closed, except."

**Some closures really are lockouts.** Remodel, deep cleaning, or simply not wanting
to run air conditioning for one student — nobody in the building, privates included.
That is a different thing from a normal closure and must be expressible as such.

There is also a fourth problem the current model creates: **there is no un-generate
path.** `generate_occurrences` never deletes, by design. Once a season is generated,
a newly-discovered closure has no mechanism to remove the occurrences already
written on that date.

---

## 2. The change

**Closures stop being a generation filter and become a cancellation pass.**

`generate_occurrences` ignores `studio_closures` entirely. A separate function
cancels occurrences that fall under a closure, and can be run at any time — before
generation, after generation, or the morning of.

This is one mechanism instead of two, and it gains three properties:

- **Last-minute closures work**, because cancelling an existing occurrence is the
  same operation whenever it runs.
- **It is the missing un-generate path.** Cancellation is non-destructive — the row
  survives with `status='cancelled'` and a reason.
- **A closed day becomes visible history** rather than a silent absence. "This class
  was cancelled for Thanksgiving" is a better record than the occurrence never
  having existed, both for parents and for billing audit.

**Consequence for billing.** Proration in `PRIVATE_LESSON_BILLING_AND_CREDITS.md`
and the tuition rules currently compute "dates from start to anchor, minus
closures." Under this model they should count **non-cancelled occurrences** instead.
That is strictly more accurate — it picks up single-class cancellations, teacher
absences and room blocks, not just studio-wide closures — and it removes a
duplicate closure calculation from the billing path.

---

## 3. Current state — verified 2026-07-29

| Fact | Value |
|---|---|
| `studio_closures` rows | 6, all Spring Break 2026-04-06 → 04-11 |
| Shape | `tenant_id`, `closed_date` (single date), `reason` |
| Fall closures on file | **none** |
| `studio_locations` | **6** — San Clemente, Rancho Santa Margarita, San Juan Hills High School, The Resort at Pelican Hill, Casa Romantica Cultural Center, Allsize Storage |
| Classes missing `location_id` | 0 |
| Adult classes in catalogue | **0** (none by age, none by name) |
| Pilates classes | **0** |
| Disciplines present | Ballet, Contemporary, Hip Hop, Jazz, Movement, Musical Theater, Stretching |
| `private_sessions` | 5 |
| Draft generator closure handling | filters `si.status = 'published'` — see §6 |

Adult and Pilates classes do not exist yet. The exemption mechanism below is
designed so they need no schema change when they arrive.

---

## 4. Schema

### `studio_closures` — add

| Column | Type | Meaning |
|---|---|---|
| `location_id` | uuid NULL | NULL = every location. Otherwise scoped. **This matters: a San Clemente closure must not cancel a performance at Casa Romantica, and RSM opens in September without inheriting San Clemente's calendar.** |
| `closed_through` | date NULL | End of an inclusive range. NULL means a single day. Winter break becomes one row, not ten. |
| `is_total` | boolean NOT NULL default false | Nobody in the building. Exemptions are ignored entirely. |
| `exempt_event_types` | text[] NOT NULL default `'{}'` | For partial closures: event types that carry on regardless. Expected typical value `{private_lesson,rehearsal}`. |

`closed_date` stays as the range start. A CHECK enforces
`closed_through IS NULL OR closed_through >= closed_date`.

### `classes` — add

| Column | Type | Meaning |
|---|---|---|
| `closure_exempt` | boolean NOT NULL default false | This class runs through a partial closure. Amanda marks adult classes and Pilates once; no taxonomy, no age inference, and it works for classes that do not exist yet. |

**Deliberately not built:** a class-category taxonomy for "adult" or "pilates".
Neither exists in the catalogue today, `age_min` is 0 on every row, and inventing a
taxonomy to express a two-item exemption list would be building the wrong thing. The
boolean is directly controlled by the person who makes the decision.

---

## 5. The cancellation contract

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

For each closure overlapping `[p_from, p_to]`, and each occurrence on a covered date
where the closure's `location_id` is NULL or matches the occurrence's:

1. **Skip if the occurrence is already cancelled.** Re-running changes nothing.
2. **Skip if `event_date <= current_date`.** Closures do not rewrite the past, for
   the same reason generation does not. A same-day closure must be applied before
   the day ends — that is a UI concern, not a reason to let the function edit
   history.
3. If `is_total` — cancel. No exemption applies.
4. Otherwise skip (count as `exempted`) if either:
   - `event_type` is in `exempt_event_types`, or
   - the occurrence's class has `closure_exempt = true`.
5. Cancel: `status='cancelled'`, `cancellation_reason` naming the closure and its
   reason.

**`p_dry_run` defaults to TRUE.** This function cancels classes and deletes payroll
drafts; the default must be the safe one. A caller has to ask for the write.

---

## 6. Payroll interaction — the constraint that matters

`generate_timesheet_drafts` selects `where si.status = 'published'`, so cancelling
an occurrence **prevents future drafts**. It does not remove drafts already created,
and its idempotency check — "if any entry already references this occurrence, do
nothing" — means they will not be regenerated or corrected either.

So `apply_closures` must clean up behind itself:

- **Delete `timesheet_entries` with `status='draft'`** that reference a cancelled
  occurrence. Count as `drafts_removed`.
- **Never touch an entry that is approved, submitted or paid.** Paid entries are
  immutable in `date` and `timesheet_id` by migration `20260728000005`, and payroll
  history is not rewritten by a scheduling decision. Count these as
  `blocked_by_payroll` and **report them by teacher and date** — a human resolves
  them.
- If `blocked_by_payroll > 0`, still cancel the occurrence. The occurrence is a
  scheduling fact; the entry is a pay fact. They are allowed to disagree, and the
  report is how the disagreement surfaces.

This is the reason `apply_closures` cannot be a trigger on `studio_closures`. It
touches payroll and needs a dry run, a report, and a human.

---

## 7. Booking interaction

Cancellation covers what is already scheduled. Two surfaces also need to consult
closures at write time:

- **Private lesson booking** must refuse a date under an `is_total` closure, and
  allow it under a partial closure that exempts `private_lesson`. This is the
  concrete case: teachers book privates on closed days routinely, and a total
  closure is exactly when they must not.
- **Occurrence creation by hand** (admin adding a one-off session) should warn, not
  refuse. An admin adding a session on a closed day may be doing so deliberately.

Neither is built in Phase 1–3 below; both are recorded so the model is not adopted
half-way.

---

## 8. Phases

**Phase 1 — schema.** Columns in §4, CHECK on the date range, backfill:
existing 6 rows get `location_id = NULL`, `is_total = false`,
`exempt_event_types = '{}'`. Type regen.

**Phase 2 — `apply_closures`.** Per §5 and §6, dry-run default.

**Phase 3 — remove closure handling from `generate_occurrences`.** Drop the
`studio_closures` exclusion and the `dates_skipped_closed` return column. **Breaking
change to a published contract** — the function is called nowhere yet, so this is
the moment to do it, before Phase 4 of `OCCURRENCE_GENERATION.md` runs and before
any cron depends on the signature.

**Phase 4 — admin UI.** Closure calendar with range entry, location scope, the
total/partial switch, and the exemption list. Amanda must be able to enter a
last-minute closure herself; a closure model she needs a developer for is a closure
model that will not be used.

**Phase 5 — booking enforcement.** §7.

**Phase 6 — billing.** Switch proration to count non-cancelled occurrences (§2).
Coordinate with the billing spec; do not change both definitions at once.

---

## 9. What this unblocks

`OCCURRENCE_GENERATION.md` Phase 4 is currently blocked because the Fall closure
calendar is empty and generation cannot be undone. Under this model that block
**disappears**: generate the full season now, and cancel Thanksgiving, winter break
and anything else whenever Amanda pins the dates down.

Phase 3 above should land before that generation runs, so the two mechanisms never
coexist.

---

## 10. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | Default `exempt_event_types` for a normal closure — is `{private_lesson,rehearsal}` right, or do rehearsals stop too? **Amanda** | Phase 2 default |
| 2 | Does a closure at San Clemente ever imply a closure at RSM? Assumed no — separate buildings, separate calendars | Phase 1 |
| 3 | When a class is cancelled by closure, are parents notified, and by which surface? `notification_sent_at` exists on the occurrence and 88 notifications sit unread with no UI | Phase 4 |
| 4 | Does a closed day extend the season end date, or is the class simply short one session? This is a tuition question, not a scheduling one. **Amanda** | Phase 6 |

Question 4 is the one with money attached. If families pay for a fixed number of
sessions, a closure either shortens what they received or pushes the season out.
Both are defensible; the system currently assumes neither.
