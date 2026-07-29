# Tuition Modes

**Status:** Draft spec — awaiting approval. Not built.
**Written:** 2026-07-29
**Governs:** `studio_settings.tuition_proration_mode` (new), the proration engine
(Billing Phase 1), closure interaction with tuition, partial-month adjustments,
billing cycle anchors
**Related:** `docs/STUDIO_CLOSURES.md` v2 · `docs/OCCURRENCE_GENERATION.md` ·
`docs/PRIVATE_LESSON_BILLING_AND_CREDITS.md` · `docs/COMMERCE_AND_BILLING.md` ·
`docs/BILLING_AND_CREDITS.md` (March — **conflicts, see §7**)

> **This spec reverses a locked decision.** Proration was locked as "start-date to
> next anchor date with closures excluded," which is what made the occurrence
> generator a billing dependency. Amanda confirmed on 2026-07-29 that BAM charges
> **flat monthly tuition, paid in full and in advance** — families pay for the month
> regardless of how many classes fall in it, and closures are **not** excluded. The
> engine is not deleted; it becomes one of two tenant modes, because a white-label
> buyer may well want proration.

---

## 1. The decision

| | |
|---|---|
| **Before** | Proration was the tuition model. One behaviour, closures excluded, occurrence count required. |
| **After** | Proration is a **tenant mode**. BAM runs `flat_month`. The Phase 1 proration work becomes the `prorated` branch rather than dead code. |

`studio_settings.tuition_proration_mode` — `'flat_month'` | `'prorated'`.
Default `'flat_month'`. BAM is set to `'flat_month'`.

Nothing built in Billing Phase 1 is discarded. It is reclassified from "the tuition
model" to "one of the tuition models," which for a white-label product is where it
needed to end up regardless.

---

## 2. The two modes

### `flat_month` — BAM

Full months, **paid in full and in advance**. A family joining mid-month pays the
full month. No date arithmetic, no session count, no closure lookup. Amanda adjusts
individual families down via the partial-month grid (§4) when she chooses to.

### `prorated`

**Calendar-day proration, not weekdays and not sessions:**

```
charge = monthly_rate × (days_remaining_including_start ÷ total_days_in_month)
```

Confirmed 2026-07-29: total calendar days, not weekdays, not scheduled class days.

**This is materially simpler than what was locked.** The original rule counted
sessions net of closures, which required the occurrence generator. Calendar-day
proration requires neither an occurrence lookup nor a closure lookup — only the
start date and the month. See §3.

---

## 3. Closure treatment, and what this does to the dependency chain

**Closures are not excluded in either mode.**

- Under `flat_month` there is nothing to exclude — the month is the month, and a
  closure simply makes the class one session shorter.
- Under `prorated` the basis is calendar days, and a closure does not remove a
  calendar day.

**This supersedes `STUDIO_CLOSURES.md` §4**, which recommended proration count
non-cancelled occurrences. That was correct only under per-session proration, which
is no longer either mode. Tuition does not count occurrences at all.

**Consequence: the occurrence generator is no longer a tuition dependency in any
mode.** It was one solely because proration needed a session count net of closures.
Calendar-day proration removes that, so the dependency is severed outright rather
than made conditional — which is a stronger result than expected and should be
recorded as such in the dependency notes.

The generator remains required for attendance, timesheet drafts, payroll, and the
parent-facing schedule. Its priority does not change. **What changes is that no
billing path is blocked by it.**

---

## 4. Partial months are an admin action, not an engine

Amanda needs to charge partial months **ad hoc**, in bulk, from a grid. That is a
different thing from automatic proration: she is deciding, per family, that this
month is charged differently — not asking the system to compute it.

The approval-queue adjustment machinery already does this: per-item waive,
amount-off, and percent-off, basis-points convention, append-only audit trail. A
partial-month charge is an adjustment, not a new pricing path.

**Recommended: percentage.** It reuses the existing basis-points adjustments with no
new machinery, and it survives a tuition price change without re-entry. A dollar
amount requires a new adjustment type and goes stale the moment tuition changes.
**Open — §8 Q1.**

The grid: rows are families or enrollments in the billing period, one editable
adjustment column, bulk apply, preview of the resulting charge before commit. It
writes adjustments — never charges directly.

Note that `prorated` mode and the grid now compute the same thing by different
routes. If Amanda's most common partial-month adjustment turns out to be
"prorate by calendar days," a grid button that fills that value per row is worth
having — but the mode setting stays tenant-level and the grid stays per-family.

---

## 5. Two billing cycles, in opposite directions

The billing spec assumes a single anchor. There are two, and they differ in both
anchor and direction.

| Stream | Anchor | Direction | Basis |
|---|---|---|---|
| **Tuition** | Tenant anchor day | **In advance** | Flat monthly under `flat_month` |
| **Privates** | **The 15th** | **In arrears** | Privates already completed |

Tuition is paid before the month. Privates are billed after the lessons happened.
These are independent runs and must not be collapsed.

---

## 6. Credits — specced elsewhere

Pre-purchased credits are a third payment path and bill on neither cycle. Credits are
deducted from the client ledger **at the moment the private occurs** — not at
booking, not on the 15th.

Amanda identified the gap on 2026-07-29: **the ledger must account for booked
privates so credits cannot be over-used.** The pattern is a reserved-versus-available
balance — purchased, less consumed, less reserved against bookings not yet occurred.
A reservation is a claim on future capacity, not a ledger entry, since no money has
moved.

**This belongs in `PRIVATE_LESSON_BILLING_AND_CREDITS.md`, not here**, and is
recorded in this section only so the cross-cycle interaction is not lost. Do not
implement credit balances from this document.

---

## 7. Spec conflict to reconcile

`docs/BILLING_AND_CREDITS.md` (March) defines **1 credit = 1 minute = $1** against
the locked dollar-denominated credit model. That reconciliation was already
outstanding before today. Today's reserved-balance decision makes it more pressing:
two documents defining the credit unit differently, while a third adds reservation
semantics, is how a billing bug gets shipped. Resolve before any credit work starts.

---

## 8. Phases

**Phase 1 — the setting.** `studio_settings.tuition_proration_mode`, CHECK
constrained, default `'flat_month'`, BAM backfilled. Type regen.

**Phase 2 — branch the engine.** The existing proration path becomes `prorated`, with
its basis changed from sessions-net-of-closures to calendar days. `flat_month`
charges the period rate with no date arithmetic. Both behind one entry point so
callers never switch on the mode.

**Phase 3 — partial-month grid.** Per §4, writing adjustments through the existing
approval-queue machinery.

**Phase 4 — separate the privates cycle.** The 15th run, in arrears, distinct from
the tuition anchor.

**Phase 5 — amend the affected specs.** `STUDIO_CLOSURES.md` §4,
`COMMERCE_AND_BILLING.md`, `BILLING_AND_CREDITS.md` reconciliation, and the
locked-decisions list. Do not leave the reversal recorded only here.

---

## 9. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | Partial-month grid — percentage or dollar amount? Percentage recommended (§4) | Phase 3 |
| 2 | Under `prorated`, is the denominator the calendar month or the tenant's anchor-to-anchor period? They differ whenever the anchor is not the 1st | Phase 2 |
| 3 | Does a family leaving mid-month get a refund under `flat_month`? Paid in advance makes this a real question; the grid handles it manually, but the default needs stating | Phase 2 |
| 4 | Does `prorated` mode need its own anchor behaviour, or does it share the tenant anchor? No tenant needs this yet | Phase 2 |

Question 2 has teeth. "Total days in the month" and "total days in the billing
period" are the same number only when the anchor is the 1st. BAM's anchor is tenant
config and may not be the 1st, so the formula in §2 needs its denominator pinned
before `prorated` is built for anyone.
