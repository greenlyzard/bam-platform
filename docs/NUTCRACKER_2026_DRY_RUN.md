# Nutcracker 2026 — Dry Run

**Purpose:** trace what actually happens in November 2026 so the failure modes are
known before they occur, not diagnosed afterwards.
**Status:** written 2026-08-01, before the events exist. Update with observed
behaviour as the test runs.

## The events

| Date | Event | Type | Venue |
|---|---|---|---|
| Sat Nov 7 | Theater rehearsal | `rehearsal` | San Juan Hills HS |
| Sat Nov 14 | Performance, 11:00–12:45 | `performance` | San Juan Hills HS |
| Sat Nov 14 | Performance, 14:30–16:15 | `performance` | San Juan Hills HS |
| Sun Nov 15 | Performance, 11:00–12:45 | `performance` | San Juan Hills HS |
| Sun Nov 15 | Performance, 14:30–16:15 | `performance` | San Juan Hills HS |

Plus Pelican Hill and Casa Romantica in early December, dates TBD. Those are
probably **not** closures — a short performance at a resort does not stop classes
at the studio.

## The closures

| Date | `closure_type` | `exempt_event_types` |
|---|---|---|
| Nov 7 | `production_conflict` | `{rehearsal, private_lesson}` |
| Nov 14–15 | `production_conflict` | `{performance}` |

## What executes, in order

### 1. Generation

`generate_occurrences` walks `classes` and writes recurring rows. Nov 7 and Nov 14
are Saturdays: **8 class occurrences each**, plus 1 studio rehearsal each. Nov 15
is a Sunday — no classes exist.

The five Nutcracker events are **not** generated. They are inserted directly, with
`production_id` set. Nothing in the generator knows about them.

### 2. `apply_closures`

**Nov 7** — exemptions `{rehearsal, private_lesson}`:

- 8 class occurrences → cancelled ✓
- Theater rehearsal → exempt, survives ✓
- **Studio rehearsal → exempt, survives ✗**

⚠️ **Nuance 1.** The exemption is by event *type*, not by event. A rehearsal
scheduled at the studio on Nov 7 survives the closure exactly as the theater
rehearsal does — but the whole company is at San Juan Hills. Nobody is at the
studio to run it.

The closure model has no way to say "rehearsals run, but only this one." Options:
cancel the studio rehearsal by hand, or scope the exemption by location.

**Nov 14** — exemptions `{performance}`:

- 8 class occurrences → cancelled ✓
- 1 studio rehearsal → cancelled ✓ (rehearsal not exempt on performance days)
- 2 performance events → exempt, survive ✓

**Nov 15** — nothing to cancel; 2 performance events survive.

### 3. Timesheet drafts

`generate_timesheet_drafts` selects `si.status = 'published'`.

**Nov 7 rehearsal** → drafts correctly. One teacher, one window, `rehearsal` rate.
This is the case the model handles well.

**Nov 14–15 performances** → ⚠️ **Nuance 2, the important one.**

Four surviving `performance` rows will auto-draft, and they will be wrong twice
over:

- **Wrong people.** A `schedule_instances` row carries one `teacher_id`. Several
  teachers attend a show; some help with cleanup; not all are asked to attend at
  all. One row cannot express a crew.
- **Wrong hours.** Drafts derive from `start_time`/`end_time` — the curtain
  window. Teachers are paid from call time through release, including the gap
  between the 11:00 and 14:30 shows. A 4-hour draft against a 7.5-hour day.

**Auto-drafting must be suppressed for `event_type = 'performance'`** before
November, or Amanda's careful entries will sit alongside four wrong ones. Paid
entries are immutable, so this is cheaper to prevent than to correct.

### 4. Manual entry — the intended path

Amanda enters one span per attending teacher, call to release, tagged to the
production rather than to an occurrence. A teacher present 9:30–17:00 on Nov 14 is
one entry, not two.

⚠️ **Nuance 3.** `PERFORMANCE_COMPETITION_COSTS.md` describes entries tagged to
productions. Verify `timesheet_entries` can reference a `production_id` without a
`schedule_instance_id`, or a show-day span has nowhere to live.

### 5. Makeup credits

`MAKEUP_POLICY.md` issues one credit per cancelled occurrence.

November cancellations:

| Date | Classes cancelled |
|---|---|
| Nov 7 | 8 |
| Nov 11 (Veterans Day) | 13 |
| Nov 14 | 8 |
| Nov 23–28 (Fall Recess + Thanksgiving) | ~60 |

**Roughly 89 class occurrences cancelled in one month**, each generating a credit
per enrolled student. That is the single heaviest makeup month of the season, and
it lands before the Winter Recess block adds more.

⚠️ **Nuance 4.** Does a cancelled *rehearsal* generate a makeup credit? A
rehearsal is not a class and has no tuition against it, but the policy says "per
cancelled occurrence." Two studio rehearsals get cancelled in November. Confirm
the credit path filters on `event_type = 'class'`.

## Cost allocation

Costs divide equally by studio and roll up to tenant total. `location_id` on each
event records **where it physically happened** — San Juan Hills — and the split is
a reporting rule, not a column.

⚠️ **Nuance 5.** RSM opens in September 2026, so this is its first Nutcracker. An
equal split charges RSM half the production cost in its opening season, likely
with few RSM students cast. Defensible as shared-brand investment, but it will
make RSM's first-year P&L look worse than its operations warrant. Decide
deliberately rather than discovering it in a report.

## What to watch during the test

1. Does a studio rehearsal survive Nov 7 when it should not?
2. Do the four performance rows generate timesheet drafts? They should not.
3. Can a timesheet entry reference a production without an occurrence?
4. Do cancelled rehearsals generate makeup credits?
5. Where does the Nutcracker labor cost land in per-location reporting?

## What year two changes

Recommendation becomes possible once there is history. In 2026 the system cannot
propose hours — there is no prior actual to propose from, and a confident wrong
draft is worse than an empty one, because Amanda edits what is in front of her
instead of starting from what she knows.

**2026:** Amanda enters everything manually.
**2027:** the system proposes the roster from casting data, and the hours from
2026's actuals — "Katherine, 9:30–17:00, same as last year."

Which puts **casting on the critical path for recommendations**, since the roster
cannot be proposed without knowing who is cast.
