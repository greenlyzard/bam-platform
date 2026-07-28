# Payroll Correctness & Reporting

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-27
**Revised:** 2026-07-28 — §2.6, §3.1, §3.2, §3.6, §4, §5 rewritten against the live CHECK constraints
**Investigated against live DB and codebase:** 2026-07-27, 2026-07-28

---

## 1. Two questions, one answer

> *Can a teacher or admin ask about timesheets? Are these summarized for the year?*

**No, and no.** Teachers can see the current pay period and nothing else — once a period closes, a teacher cannot see what they filed. There is no annual view anywhere, for anyone.

And underneath that: **the pay figure the platform computes is structurally wrong across a rate change**, in the direction of over-reporting income on a tax form. The 2026-07-28 investigation found a second, independent correctness bug in the same arithmetic — see §2.6.

---

## 2. Findings

### 2.1 Reporting scope — teacher-facing

| Surface | Range | Prior periods? | YTD? |
|---|---|---|---|
| `/teach/timesheets` | Current pay period only | **No** | **No** |
| `/teach/timesheets/summary` | Same, deliberately identical | **No** | **No** |
| `/teach/hours` | Current calendar month, from `teacher_hours` | **No** | **No** |

The current-period scoping predates Phase B of the timezone work — Phase B changed *which* period resolves, not the scoping. The scoping is intentional and documented in-file: scoping by period rather than newest-by-`created_at` is what lets a teacher start a new period after the previous one is approved.

But there is **no period picker, no history list, no archive route**. Once a period closes, a teacher has no way to see what they submitted. That is a reasonable thing for a teacher to want and currently impossible.

Note `/teach/hours` reads `teacher_hours` — **a different table from `timesheet_entries`**, and not the one payroll pays from. See §2.4 and §2.6.

### 2.2 Reporting scope — admin

`/admin/timesheets/payroll` aggregates correctly across periods. Traced end to end:

```
timesheet_entries
  .select("…, timesheets!inner(teacher_id, status)")
  .gte("date", dateFrom).lte("date", dateTo)
```

It **never references `pay_periods`** — not in the query, not in the grouping, not in the totals. Aggregation is a flat loop over entries keyed on `teacher_profile_id`, bucketing `total_hours` by `entry_type`, then `totalOwed = Σ(hours × rate)`.

So a Jan 1 – Dec 31 range would sum every entry in the window regardless of how many periods it spans. **Nothing assumes a single period.**

**⚠️ Silent truncation hazard.** `entryQuery` has **no `.limit()` or `.range()`**, so it inherits PostgREST's `db-max-rows` cap (Supabase default 1000). At current volume that is irrelevant. A full-year, multi-teacher range would **silently truncate at the cap — no error, no indication, totals just come back low.** This must be resolved before anyone runs an annual report. Confirm the project's configured max-rows and paginate explicitly.

**No annual or multi-period view exists** — not per-teacher-per-year, not per-period history, not a rollup. The only multi-period capability in the product is that free-form from/to on an admin-only, finance-guarded surface.

### 2.3 The rate snapshot problem — the serious one

`timesheet_entries` has `rate_amount`, `rate_key`, `rate_override`, `rate_override_by`. All four are **0% populated**.

Pay is computed at *render* time:

```
teacher.totalOwed = hours.class × rateMap[id].class + …
```

where `rateMap` is built from `teachers.*_rate_cents` **as they are right now**. Nothing snapshots the rate onto the entry at the time the work was done.

**Consequence:** an annual figure spanning a mid-year rate change retroactively reprices the entire year at the current rate. A teacher who went from $30/hr to $40/hr in July has January's hours valued at $40 in a Jan–Dec run. The report cannot distinguish them — the only rate it can see is today's.

Three things make this worse than an ordinary bug:

1. **It is invisible on the page.** Nothing indicates the figure is a reconstruction rather than a record.
2. **It is wrong in the direction of over-reporting income** on a tax form.
3. **`rate_amount` exists to prevent exactly this** and is unused. The column was designed correctly and never wired.

There is also no `paid_at` population (0 rows), so the report reflects *hours owed per its own arithmetic*, not *amounts actually paid* — which is the figure a 1099-NEC requires.

**Unit hazard.** `timesheet_entries.rate_amount` is `numeric` with a `>= 0` check. `teachers.*_rate_cents` is integer cents. Nothing in the codebase reconciles the two because nothing writes the former. Any implementation must **standardize on integer cents and name the column accordingly** before the first row lands.

### 2.4 1099 readiness — mechanically yes, meaningfully no

The copy is real, at `payroll-report.tsx:464`: *"1099 contractors are responsible for their own taxes. Payments over $600/year require a Form 1099-NEC."*

A Jan 1 – Dec 31 range would execute correctly, and the report already splits W-2 / 1099 / owner-draw via `classifyEmployment`. But:

| Blocker | Live state |
|---|---|
| `timesheet_entries` is empty | **0 rows.** Every teacher's hours would be 0 |
| Every pay rate is NULL | All **18** active teachers have `class_rate_cents`, `private_rate_cents`, `rehearsal_rate_cents`, `admin_rate_cents` = NULL → `rateMap` yields 0.00 and `hasMissingRates` is true for every teacher |
| `teacher_rate_cards` is also empty | **0 rows.** The newer rate model has nothing in it either — no fallback source |
| Six entry types have no rate column at all | Structural, not a data gap — see §2.6 |

The report would render, show every teacher under "hours but no rates," and total **$0.00**. It is not wrong at the margin — **there is no payroll data in the system at all.** `timesheets` has 3 rows and `pay_periods` has 2, but zero entries hang off them.

`teachers.employment_type` allows seven values (`full_time`, `part_time`, `contract`, `employee`, `contractor_1099`, `pending_classification`, `owner`). `classifyEmployment` collapses these into W-2 / 1099 / owner-draw; confirm the mapping handles `contract` and `pending_classification` explicitly rather than falling through to a default.

### 2.5 Angelina reports on the wrong table

`lib/angelina/` is two files. Tables it reads across all role contexts: `teachers`, `profiles`, `students`, `student_guardians`, `enrollments`, `schedule_instances`, `attendance`, `classes`, `teacher_hours`, `substitute_requests`, `approval_tasks`, `angelina_conversations`, `mandated_reporter_incidents`.

| Table | In Angelina's context? |
|---|---|
| `timesheets` | No |
| `timesheet_entries` | No |
| `pay_periods` | No |
| `teacher_rate_cards` | No |
| `teachers.*_rate_cents` | No — `teachers` is selected, but not the rate columns |
| `teacher_hours` | **Yes — the only one** |

The single touchpoint is `context.ts:496-511`, teacher context only:

```
teacher_hours.select("date, hours, category, approved")
  .eq("teacher_id", userId).gte("date", weekStart).lte("date", today)
```

rendered as `HOUR LOGGING STATUS (this week): Total logged: X hours (Y approved)`.

**Two things make even that hollow:**

1. `teacher_hours` has **0 rows**, so Angelina reports "No hours logged this week yet" to every teacher unconditionally.
2. **`teacher_hours` is not the table payroll pays from.** Payroll reads `timesheet_entries`. Angelina reports on hours that do not feed anyone's paycheck.

**No admin or finance Angelina context includes any payroll data.** Amanda cannot ask Angelina anything about payroll today. There is also an explicit guardrail in the teacher system prompt: *"Never share another teacher's schedule, pay, or student details."*

### 2.6 Three taxonomies that do not agree — new, 2026-07-28

The live CHECK constraints:

| Source | Values | Count |
|---|---|---|
| `timesheet_entries.entry_type` | `class_lead`, `class_assistant`, `private`, `rehearsal`, `performance_event`, `competition`, `training`, `admin`, `substitute`, `bonus` | **10** |
| `teacher_hours.category` | `class`, `private`, `rehearsal`, `admin`, `sub` | **5** |
| `teachers.*_rate_cents` columns | class, private, rehearsal, admin | **4** |

No two agree, and the one payroll pays from is the widest.

**Consequence — a second correctness bug, independent of §2.3.** `rateMap` is built from four columns and indexed by `entry_type`. Six of the ten entry types — `class_assistant`, `performance_event`, `competition`, `training`, `substitute`, `bonus` — have **no corresponding rate**. Those buckets resolve `undefined` and contribute `0` or `NaN` to `totalOwed` with no warning on the page. `hasMissingRates` will not catch it: that flag tests whether the four columns are NULL, not whether a rate exists for the entry type in hand.

This is not hypothetical for Fall. The season carries 26 rehearsal rows and a Nutcracker production; `performance_event` and `substitute` entries are certain to appear.

**Two entry types are structurally different from the rest:**

- **`bonus`** is not an hourly quantity. `hours × rate` is meaningless for it. This is the shape a guest performer's lump sum takes.
- **`class_assistant`** is a distinct pay grade for the same work unit as `class_lead`, not a distinct activity. The taxonomy already encodes a seniority dimension, which the four rate columns cannot express.

Note also the overlap around substitution: `entry_type = 'substitute'`, plus a separate `is_substitute` boolean, plus `sub_for`, plus `substitute_for_teacher_id`, plus `teacher_role = 'substitute'`, plus `attendance_status = 'substitute_covered'`. Five representations of one concept. Which is authoritative for *pay* must be settled before the resolver is written, or a covered class will be paid twice or not at all.

### 2.7 The auto-draft machinery is already modeled and unwired

`timesheet_entries` carries `is_auto_populated`, `attendance_status` (`confirmed` / `absent` / `substitute_covered`), `class_id`, `schedule_instance_id`, `session_id`, `production_id`, `competition_id`, `is_substitute`, `substitute_for_teacher_id`. Every column the confirm/adjust/delete draft flow needs exists. None is populated, and no code writes them — the same pattern as `rate_amount`.

The intended flow, per the product owner: a teacher scheduled for a class with no substitute assigned gets an entry **auto-drafted** into their timesheet, which they then confirm, adjust, or delete. Attendance-taking confirms a draft; it cannot generate one, because a class nobody took attendance for still owes the teacher hours.

**Hard dependency:** auto-drafting requires a per-date occurrence row to draft *from*. That is `schedule_instances`, which is frozen on a single March week and 70% pointed at retired rooms because the occurrence generator (`_INDEX.md` task 19) is broken. **Task 19 blocks the only mechanism that puts data into `timesheet_entries`.**

---

## 3. Proposed design

### 3.1 Rate snapshot — do this first

Populate a stored amount on `timesheet_entries` at the moment the entry is created, resolved against **the rate in effect on the entry's `date`** — not the date of entry, not the date of approval.

This supersedes the entry-vs-approval question in the original draft. With effective-dated rates (§3.2), work-date resolution is strictly better than either:

- A teacher who files late does not get a new rate applied to old work.
- An approval landing after a raise does not reprice the period.
- The figure is available on the draft, so the teacher sees a dollar amount immediately.
- It is stable: re-resolving the same entry always yields the same number.

Re-resolve on edit of `date`, `entry_type`, or hours. Never re-resolve on approval. `rate_override` / `rate_override_by` remain the escape hatch for a one-off manual amount, and an overridden entry is never re-resolved.

Payroll then sums stored amounts and **never multiplies**. That also collapses the flat-vs-hourly distinction at read time — see §3.2.

**Migration note:** with `timesheet_entries` at 0 rows, this is free right now. Once real hours exist, backfilling means reconstructing historical rates that were never recorded — which cannot be done accurately.

**This is the cheapest it will ever be. Do it before Fall.**

### 3.2 Rate model — decided

**Decision (2026-07-28, from the product owner): flat per-category hourly.** Teachers are paid an hourly rate that differs by work type — admin, teaching, privates, performances, competitions. Plus a flat-fee case: guest performers paid a lump sum.

`teacher_rate_cards` is not that model. It is keyed on session duration (30/45/60min) with standard-vs-market pricing and a cancellation policy — a *private-lesson pricing* artifact on the revenue side. Three of the four existing payroll categories have no session length. It should be left alone, not extended, and explicitly descoped from payroll.

`teachers.*_rate_cents` is the right taxonomy but the wrong shape. It cannot express:

- the six entry types with no column (§2.6) — and adding six more columns means a migration every time Amanda names a new pay type, per tenant, forever
- the `class_lead` / `class_assistant` seniority split
- a flat fee, where there are no hours to multiply
- effective dating, which §2.3 establishes as a prerequisite rather than an enhancement

**Proposed shape — categories as data, not columns:**

```
teacher_rates
  id
  tenant_id            not null
  teacher_id           not null
  rate_key             not null   -- matches timesheet_entries.entry_type
  rate_type            not null   -- 'hourly' | 'flat'
  amount_cents         not null   -- integer cents, always
  valid_from           date not null
  valid_to             date null   -- null = open-ended
  created_at, created_by
```

- One row per teacher per category per effective window. No open window overlap — enforce with an exclusion constraint on `(teacher_id, rate_key, daterange(valid_from, valid_to))`.
- `rate_key` is validated against the same allowed set as `entry_type`, so the taxonomies cannot drift again. A tenant-scoped category table is the white-label form of this; a shared CHECK is the v1 form.
- `rate_type = 'flat'` entries store `amount_cents` directly on the timesheet entry with `total_hours` null. Faking a flat fee as "1 hour at $500" would corrupt every hours total, the teacher's YTD, and any utilization reporting later.

On `timesheet_entries`, store the resolved `amount_cents` alongside the existing `rate_amount` / `rate_key`, or repurpose `rate_amount` to integer cents with an explicit rename. Either way, **one unit, named unambiguously** (§2.3).

`teachers.*_rate_cents` becomes read-only legacy, seeded into `teacher_rates` with an open `valid_from`, then dropped in a later phase. It is all NULL today, so there is nothing to migrate.

### 3.3 Teacher period history

A period picker or history list on `/teach/timesheets`, showing prior periods read-only. Low complexity — `pay_periods` and `timesheets` already carry everything needed; the pages simply hard-scope to the current period.

Include a year-to-date total. A teacher asking "how much have I earned this year" is a reasonable question and currently unanswerable by anyone.

### 3.4 Annual / 1099 report

Per-teacher annual totals, split by employment classification, with:

- Amounts from **stored** cents (post-§3.1), never recomputed
- Explicit pagination (§2.2) — the row cap must not silently truncate
- A distinction between **owed** and **paid** (`paid_at`) — a 1099-NEC reports payments made, not hours worked
- Flat-fee entries included in the dollar total and excluded from every hours total

**Do not build this before §3.1.** An annual report built on render-time rate computation produces a number Amanda would sign her name to and that would be wrong.

### 3.5 Angelina — payroll context

Two separate pieces:

**Fix the wrong table.** The teacher hours context should read `timesheet_entries`, not `teacher_hours`, or the number Angelina reports will never match the teacher's paycheck. This is a bug regardless of whether payroll context is ever added.

**Add payroll context, carefully.** A teacher asking "how many hours did I work in March" or "what's my YTD" is exactly the kind of question Angelina should answer — but it is compensation data, and the guardrails matter:

- Teacher context: own data only, enforced at the query, not the prompt
- Admin context: gated on `has_finance_role()` / `requireFinance()`, **not `is_admin()`** — see `CLAUDE.md` §4. A `studio_manager` passes `is_admin()` and must not see pay.
- The existing prompt guardrail ("never share another teacher's pay") is a prompt, not a control. Do not rely on it.

**Depends on §3.1.** Angelina answering "you earned $X in March" from render-time computation would give a teacher a number that changes when someone edits a rate.

### 3.6 Auto-drafted entries from schedule

Generate `is_auto_populated = true` draft entries from scheduled occurrences where the assigned teacher has no substitute recorded. Teacher confirms, adjusts, or deletes. Attendance-taking flips `attendance_status` to `confirmed`; it does not create the entry.

Rules to settle before building:

- Which of the five substitution representations (§2.6) determines who gets paid
- Whether an unconfirmed auto-draft is submitted by default at period close, or silently dropped — dropping loses real hours, submitting pays for classes that may not have happened
- `class_lead` vs `class_assistant` derives from `class_teachers`, so that assignment must be reliable before drafts inherit it

**Blocked on `_INDEX.md` task 19** (§2.7). Nothing in this section is authorable until the occurrence generator produces correct `schedule_instances`.

---

## 4. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | ~~Decide the rate model~~ — **decided 2026-07-28**, §3.2 | Done |
| **2** | `teacher_rates` table: effective-dated, per-category, hourly-or-flat, integer cents | Medium — schema |
| **3** | Rate resolver + snapshot at entry, resolved on work date (§3.1) | **Free now, impossible to backfill later** |
| **4** | Enter the 18 teachers' actual rates. Nothing above matters without them | Blocked on Amanda |
| **5** | Payroll read path sums stored cents; drop the `hours × rate` arithmetic (§2.6) | Low — fixes the NaN bucket bug |
| **6** | Pagination fix on the payroll query (§2.2) | Low, but blocks any annual run |
| **7** | Teacher period history + YTD (§3.3) | Low |
| **8** | Annual / 1099 report (§3.4) | Depends on 3, 5, 6 |
| **9** | Angelina: fix the `teacher_hours` → `timesheet_entries` bug (§3.5) | Low |
| **10** | Auto-drafted entries (§3.6) | **Blocked on task 19** |
| **11** | Angelina payroll context (§3.5) | Depends on 3; needs finance-level gating |
| **12** | Retire `teachers.*_rate_cents` and reconcile `teacher_hours` | Cleanup |

**Phases 2–3 are time-sensitive.** `timesheet_entries` is empty today. Every hour logged before rate snapshotting exists is an hour whose true rate is unrecoverable. Fall classes begin **2026-08-15**.

---

## 5. Open questions for Amanda

**Resolved:** rate model (flat per-category hourly, §3.2); snapshot timing (work date, §3.1).

| # | Question | Blocks |
|---|---|---|
| 1 | **The actual rates** — a number for each of the ten entry types, per teacher, or a studio default with per-teacher exceptions | Phase 4. Nothing pays out without this |
| 2 | **`class_assistant` rate** — a fixed fraction of the lead rate, or independently set? | Phase 2 shape |
| 3 | **Are `training` and `competition` paid at all**, and at what rate? Both are allowed entry types with no rate | Phase 4 |
| 4 | **Guest performers** — are they in `teachers` at all? A one-off Nutcracker guest may have no profile, no schedule, no login, but must appear on a 1099 | Phase 2. This is a modeling gap, not a rate question |
| 5 | **Flat fees** — per-engagement ad hoc, or a standing per-session rate (e.g. a weekly accompanist)? Different shapes | Phase 2 |
| 6 | **Are rates ever retroactive?** A backdated raise changes what effective dating must support | Phase 2 |
| 7 | **Substitute pay** — does a sub earn their own rate or the absent teacher's? And is the absent teacher paid anything? | Phase 3, §3.6 |
| 8 | **Should teachers see their own YTD earnings**, or only hours? | Phase 7 |
| 9 | **Owner draws in the annual report** — Amanda's hours are `owner_draw` and excluded from wage totals. Does she want an annual figure anyway? | Phase 8 |

---

## 6. Related

- `docs/TENANT_TIMEZONE_SPEC.md` — Phase B fixed *which* period an entry files to; this spec covers what it is worth
- `docs/FINANCIAL_ANOMALY_DETECTION.md` — the billing half of the same problem
- `docs/TEACHER_RATE_MANAGEMENT.md` — describes a `teacher_rate_cards`-driven override hierarchy that no timesheet code reads. **Descoped from payroll by §3.2** — retire or re-scope to private-lesson pricing
- `docs/TEACHER_TIME_ATTENDANCE.md` — canonical for timesheets
- `_INDEX.md` task 19 — occurrence generator; blocks §3.6
