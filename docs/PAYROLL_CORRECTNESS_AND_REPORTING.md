# Payroll Correctness & Reporting

**Status:** PARTIALLY BUILT — Phases 1–6 shipped 2026-07-28; 7–18 remain spec
**Author:** Derek Shaw
**Date:** 2026-07-27
**Revised:** 2026-07-28 — §2.6, §3.1, §3.2, §3.6, §4, §5 rewritten against the live CHECK constraints; second pass added §3.7 (Square Payroll boundary), retroactive rate handling, and the rate visibility rule; third pass added §3.8 (payroll deductions) and period-level paid marking; fourth pass added §3.9 (bulk rate administration), revised §3.3 for the pay-management role set, and restored the §4 heading dropped in the third pass; **fifth pass (evening) rewrote §3.1 as built, marked Phases 2–6 done with commit refs, recorded the §2.2/§2.3/§2.4/§2.6 findings as resolved rather than deleting them, folded the returned rate workbook into §5, and flagged the unclosed `timesheet_entries` amount-column gap in §3.3**
**Investigated against live DB and codebase:** 2026-07-27, 2026-07-28
**Shipped this doc describes:** `20260728000001`–`20260728000005`, commits `8384cad`, `4c303cf`, `c601279`, `1da6896`, `a9c7697`, `fe17faa`, `a673eba`, `ad9dad7`

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

> **✅ Resolved 2026-07-28 (`4c303cf`).** The entry fetch pages explicitly with `.range()`. Two details that matter for anyone touching it: the sort must be a **total** order (`date, id` — `date` alone is not unique, so pages would overlap and drop rows), and the loop advances by the number of rows **actually returned**, stopping only on an empty page. A short page means the server cap is below the requested page size, not that the data ended. Costs one extra empty request per run and is correct for any configured cap.

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

> **✅ Resolved 2026-07-28 (`8384cad`, `4c303cf`) — kept because it explains the column set.**
>
> Render-time computation is gone; pay is snapshotted per entry against the rate in effect on the entry's own work date (§3.1). The unit hazard was settled by **adding `amount_cents` rather than repurposing `rate_amount`**: `rate_amount` stays as unused legacy, and integer cents is the only unit that reaches payroll. That is why `timesheet_entries` now carries both — one is live, one is dead, and the dead one is not to be written.
>
> `teachers.*_rate_cents` is now read by nothing in the payroll path and is scheduled for removal in Phase 18.
>
> Unchanged: `paid_at` is still 0% populated, so every figure the product shows is **owed**, not **paid**. The 1099-NEC figure requires the latter (§3.7).

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

> **Partially resolved 2026-07-28.** Two of the four blockers are closed: `teacher_rates` now holds **171 rows** across 19 teachers, effective 2026-08-15 (`20260728000002`), and the six rate-less entry types are gone as a structural gap (§2.6). `pay_periods` now holds 13 rows for the 2026/27 season (`20260728000004`).
>
> Still open: **`timesheet_entries` is empty** — nothing prices until hours are logged, which for auto-drafted class entries is blocked on `_INDEX.md` task 19 (§2.7). `teachers.*_rate_cents` and `teacher_rate_cards` remain all-NULL/empty and are now deliberately unread (§3.2). `employment_type` mapping and the `classifyEmployment` fall-through question below are untouched.

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

> **✅ Resolved 2026-07-28 — kept here because it is why the schema looks as it does.**
>
> The `hours × rate` arithmetic is gone. `/admin/timesheets/payroll` no longer reads `teachers.*_rate_cents` at all; it sums `timesheet_entries.amount_cents`, snapshotted per entry by trigger (§3.1). Commit `4c303cf`.
>
> The four-column taxonomy that caused this is what `teacher_rates` replaces: `rate_key` carries a CHECK mirroring `entry_type`, so all ten types are expressible and the two taxonomies cannot drift apart again. Nine of the ten are seeded (`20260728000002`); `bonus` is deliberately not, being `flat` and per-engagement.
>
> The silent-`undefined` failure mode is now a **surfaced** one: an entry with no rate in effect keeps `amount_cents` NULL — never 0 — and the report counts unpriced entries, unpriced hours, and affected teachers, warns on the page, and writes the word `UNPRICED` rather than `0.00` into the CSV. Flat-rate entries are reported separately and excluded from hours totals, per §3.2.
>
> Still true and still unresolved: the six-way representation of substitution listed below. One of them must be authoritative for pay before auto-drafting (§3.6).

**Two entry types are structurally different from the rest:**

- **`bonus`** is not an hourly quantity. `hours × rate` is meaningless for it. This is the shape a guest performer's lump sum takes.
- **`class_assistant`** is a distinct pay grade for the same work unit as `class_lead`, not a distinct activity. The taxonomy already encodes a seniority dimension, which the four rate columns cannot express.

Note also the overlap around substitution: `entry_type = 'substitute'`, plus a separate `is_substitute` boolean, plus `sub_for`, plus `substitute_for_teacher_id`, plus `teacher_role = 'substitute'`, plus `attendance_status = 'substitute_covered'`. Six representations of one concept, and one of them must be authoritative for pay before the resolver is written.

**To be clear about what the risk is and is not.** Two people paid for one class is *normal* — `class_lead` and `class_assistant` are separate entry types with separate rates, and both may legitimately work the same session. The taxonomy handles that correctly.

The risk is narrower: **one absence producing two paid entries for the same slot.** If an auto-draft is generated for the assigned teacher, and the substitute also files an entry, and nothing marks the assigned teacher as not-present, the studio pays for a class that teacher did not teach. `attendance_status = 'substitute_covered'` exists to prevent exactly that and is never written — the same unwired-by-design pattern as `rate_amount` and `is_auto_populated`.

### 2.7 The auto-draft machinery is already modeled and unwired

`timesheet_entries` carries `is_auto_populated`, `attendance_status` (`confirmed` / `absent` / `substitute_covered`), `class_id`, `schedule_instance_id`, `session_id`, `production_id`, `competition_id`, `is_substitute`, `substitute_for_teacher_id`. Every column the confirm/adjust/delete draft flow needs exists. None is populated, and no code writes them — the same pattern as `rate_amount`.

The intended flow, per the product owner: a teacher scheduled for a class with no substitute assigned gets an entry **auto-drafted** into their timesheet, which they then confirm, adjust, or delete. Attendance-taking confirms a draft; it cannot generate one, because a class nobody took attendance for still owes the teacher hours.

**Hard dependency:** auto-drafting requires a per-date occurrence row to draft *from*. That is `schedule_instances`, which is frozen on a single March week and 70% pointed at retired rooms because the occurrence generator (`_INDEX.md` task 19) is broken. **Task 19 blocks the only mechanism that puts data into `timesheet_entries`.**

---

## 3. Proposed design

### 3.1 Rate snapshot — ✅ BUILT 2026-07-28 (`8384cad` / `20260728000003`, hardened by `ad9dad7` / `20260728000005`)

`timesheet_entries` carries a stored amount, resolved against **the rate in effect on the entry's own `date`** — not the date of entry, not the date of approval. This settles the entry-vs-approval question from the original draft: with effective-dated rates (§3.2), work-date resolution is strictly better than either. A teacher who files late does not get a new rate applied to old work; an approval landing after a raise does not reprice the period; the figure is on the draft, so the teacher sees a dollar amount immediately; and it is stable — re-resolving the same entry always yields the same number.

**What was built.**

| Piece | Shipped as |
|---|---|
| Storage | `timesheet_entries.amount_cents` (integer, `>= 0`), `rate_id` (FK → `teacher_rates`, `on delete set null`), `rate_resolved_at` |
| Resolver | `resolve_teacher_rate(p_teacher_id, p_rate_key, p_work_date)` — returns the at-most-one `teacher_rates` row whose `[valid_from, valid_to)` window contains the work date. `SECURITY INVOKER` deliberately: a `SECURITY DEFINER` function returning an amount would let any caller learn any teacher's rate, defeating §3.3 |
| Application | `trg_snapshot_timesheet_entry_rate`, `BEFORE INSERT OR UPDATE ... FOR EACH ROW` on `timesheet_entries` |

**The snapshot is applied by TRIGGER, not by application code.** There are several write paths today — `/teach/timesheets` add/update/delete, the "Log Hours" path from `/teach/attendance`, `adminAddEntry` on `/admin/timesheets` — and native clients are planned. A trigger cannot be bypassed by a path that forgets to call the resolver; an application-side helper can, and the history in §2.3 is what that failure looks like. Application code must **never** write `amount_cents` or `rate_id` directly.

**Which teacher's rate applies** is read from `timesheets.teacher_id` via the entry's `timesheet_id` — the entry itself has no teacher column.

#### Re-resolution rules

On `UPDATE`, the trigger re-resolves only when something that affects the amount actually changed. The guard is:

| Column changed | Re-resolves | Why |
|---|---|---|
| `date` | Yes | Moves which effective-dated rate row is in force |
| `entry_type` | Yes | Selects a different `rate_key`, and therefore a different rate |
| `total_hours` | Yes | The multiplicand for an `hourly` rate |
| `timesheet_id` | Yes | **The timesheet determines whose rate applies.** Moving an entry to another teacher's timesheet changes the rate even when date, category and hours are identical |
| Anything else (notes, description, status, production tags…) | No | Cannot change the amount; re-resolving would only add churn to `rate_resolved_at` |

`timesheet_id` was absent from this guard until `ad9dad7`. Nothing in the code reachable at the time could hit the gap — `timesheet_id` is only ever set alongside a date change (see `TEACHER_TIME_ATTENDANCE.md`, "Editing an entry across a period boundary") — but an admin "reassign this entry to another teacher" surface is a plausible next feature and would have silently kept the previous teacher's price.

**An overridden entry is never re-resolved.** `rate_override = true` short-circuits the trigger before anything is read. `rate_override` / `rate_override_by` remain the escape hatch for a one-off manual amount, and the trigger does not touch it.

**No rate in effect leaves `amount_cents` NULL — never 0.** A null surfaces as *unpriced* and is counted and warned about on the payroll report (§2.6); a zero looks like unpaid work and reconciles to a wrong total silently. `rate_id` and `rate_resolved_at` are nulled alongside it.

**Flat rates store the amount directly**, whatever hours were recorded. Hourly rates store `round(amount_cents × total_hours)`.

#### A paid entry is immutable in `date` and `timesheet_id`

Previously written here as "never rewritten," which was aspirational. As of `ad9dad7` it is **enforced**: the trigger raises `check_violation` on any update to a row with `paid_at IS NOT NULL` that changes `date` or `timesheet_id`.

Refusing is deliberate rather than returning early and declining to reprice. An early return would let the move happen and merely leave the amount alone — producing a row whose date says one period and whose payment happened in another. Note that the period lock is **not** what protects this: in practice a paid entry's period is closed, but "paid" and "locked" are different conditions and an admin path with no lock check reaches the row. Everything else on a paid entry stays editable, including `paid_at` itself, so a payment can be corrected or reversed.

#### Retroactive rates — still unbuilt (Phase 12)

**Settled 2026-07-28: raises are sometimes backdated.** A rate row inserted with `valid_from` in the past invalidates every snapshot in its window. Those entries must be recomputed — but not uniformly:

| Entry state | Action |
|---|---|
| `draft`, `submitted`, `approved`, not yet paid | Re-resolve in place. Record the prior amount in `adjustment_note` |
| Already paid through Square | **Never rewrite the amount.** Generate a separate catch-up entry for the difference, `status = 'adjusted'` |

Rewriting a paid entry would put the portal in disagreement with money that actually left the account, and the portal is not the payer (§3.7). `timesheet_entries` already allows `status = 'adjusted'` and carries `adjusted_by` and `adjustment_note` — modeled, unwired, the same pattern `rate_amount` and `is_auto_populated` follow.

Retroactive re-resolution must be an explicit, audited operation with a preview of affected entries and totals. It must never run implicitly as a side effect of saving a rate. Nothing built to date does this: the trigger re-resolves **one row on write**, and no path walks existing entries when a rate row is inserted.

Payroll sums stored amounts and **never multiplies** — built, see §2.6. That also collapses the flat-vs-hourly distinction at read time (§3.2).

**Migration note (resolved).** This landed with `timesheet_entries` at 0 rows, so no backfill was needed and no historical rate had to be reconstructed. Fall classes begin 2026-08-15; the seeded rates carry that `valid_from`, so the first hour logged in the new season prices correctly on insert.

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

**`rate_type` belongs on the rate row, not the person.** Confirmed by the guest-performer case (2026-07-28): a guest is paid a **pre-negotiated lump sum for performances and an hourly rate for rehearsals** — the same individual, two categories, two rate types, simultaneously. A per-person flat/hourly flag could not express this. The per-category shape above handles it without modification.

On `timesheet_entries`, store the resolved `amount_cents` alongside the existing `rate_amount` / `rate_key`, or repurpose `rate_amount` to integer cents with an explicit rename. Either way, **one unit, named unambiguously** (§2.3).

`teachers.*_rate_cents` becomes read-only legacy, seeded into `teacher_rates` with an open `valid_from`, then dropped in a later phase. It is all NULL today, so there is nothing to migrate.

### 3.3 Teacher period history

A period picker or history list on `/teach/timesheets`, showing prior periods read-only. Low complexity — `pay_periods` and `timesheets` already carry everything needed; the pages simply hard-scope to the current period.

Include a year-to-date total. **Settled 2026-07-28: teachers see their own pay.** Labeled per §3.7 as this platform's record of hours worked, not a pay stub.

**Visibility and edit rule, in full** (revised 2026-07-28 — `studio_manager` added to the pay-management set):

| Viewer | Own rates and amounts | Another person's | Can change rates |
|---|---|---|---|
| Teacher, parent, front_desk, student | View own | No | No |
| `admin` | View own | **No** | **No** |
| `studio_admin` | View own | **No** | **No** — pending confirmation |
| `studio_manager` | Yes | Yes | **Yes** |
| `finance_admin`, `super_admin` | Yes | Yes | Yes |

Anyone who can change a rate can necessarily see it, so viewing and editing share one role set. **`admin` is excluded from both** — that is Cara's role, and the exclusion is deliberate.

**This requires a new guard — ✅ built 2026-07-28 (`20260728000001`).** `has_finance_role()` is `finance_admin` + `super_admin` and no longer matches. `is_admin()` admits five roles including plain `admin` and must never appear near pay.

`can_manage_pay()` shipped in **two forms**, both `SECURITY DEFINER`:

- `can_manage_pay(p_tenant_id uuid)` — the one RLS uses. Answers "does this user hold a pay-management role **in this tenant**."
- `can_manage_pay()` — the bare form, for callers with no tenant in hand. Answers "…*anywhere*," which is the weaker question.

**Use the tenant-scoped form.** The bare form is correct only while one tenant exists; the day a second studio has data, it grants a pay manager at studio A visibility into studio B. The tenant-scoped form was shipped from the start rather than retrofitted, mirroring `is_tenant_admin(p_tenant_id, p_user_id)`, precisely so no policy ever had to be rewritten after rate rows existed.

Enforced in RLS on `teacher_rates`, not in the UI: self-select by `auth.uid()` equality, plus select/insert/update for pay managers. **There is no delete policy** — a rate is closed by setting `valid_to`, never removed, so the effective-dated history stays intact.

**⚠️ Not enforced on `timesheet_entries.amount_cents` — verified 2026-07-28.** The guard above covers `teacher_rates`. The amount columns on entries still inherit the policies from `20260312000001`, which predate all of this:

- `admins_timesheet_entries` is `FOR ALL` and authorizes off **`profiles.role in ('super_admin','admin')`**. That is the stale single-role column `CLAUDE.md` §4 forbids authorizing from, and it admits plain `admin` — Cara's role, the one §3.3 deliberately excludes from pay. She can read and write every teacher's `amount_cents` today.
- The `teachers_own_entries_*` policies join `teacher_profiles tp on … tp.user_id = auth.uid()`, but `teacher_profiles` is a VIEW whose `id` **is** `profiles.id` and which has **no `user_id` column** (`CLAUDE.md` §4). Confirm whether these policies evaluate at all.

Two further notes for whoever closes this. First, the original phrasing here — "RLS on the amount columns" — is not a thing Postgres does: RLS is row-level, so hiding a *column* from a role that may read the row needs column privileges or a separate view. Second, `amount_cents` is written by a `BEFORE` trigger on rows the teacher legitimately owns, so any fix must keep the teacher's own insert/update working while withholding the amount from `admin`.

This is the largest known gap in §3.3 and it is a live one, not a future one.

**Two live gaps.** `studio_manager` appears in **no `profile_roles` row today** — defined and unused. And confirm the multi-role Add Staff picker shipped 2026-07-28 offers both `finance_admin` and `studio_manager`, or pay management cannot be delegated at all.

### 3.4 Annual reconciliation report — not a tax filing

**Reframed 2026-07-28.** Payroll is run through **Square Payroll** (§3.7). Square issues W-2s and 1099s; this platform does not and must not appear to. The annual report's purpose is **reconciliation** — "here is what we expect Square to show" — which is how a missed timesheet or an unbilled substitute gets caught before the year closes.

Per-teacher annual totals, split by employment classification, with:

- Amounts from **stored** cents (post-§3.1), never recomputed
- Explicit pagination (§2.2) — the row cap must not silently truncate
- A distinction between **owed** (this platform's arithmetic) and **paid** (Square's record)
- Flat-fee entries included in the dollar total and excluded from every hours total
- **A visible caveat on the report itself**: this is not a tax document, Square is the system of record for payment

**Copy fix required.** `payroll-report.tsx:464` currently reads *"1099 contractors are responsible for their own taxes. Payments over $600/year require a Form 1099-NEC."* That implies this platform issues the form. Rewrite to point at Square.

**Do not build this before §3.1.** An annual report built on render-time rate computation produces a number that disagrees with Square for reasons no one can trace.

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

**Settled policy (2026-07-28): a teacher who is absent and covered is not paid for that class.** The substitute is paid; the absent teacher receives nothing. Therefore `attendance_status = 'substitute_covered'` must **delete or zero the assigned teacher's auto-draft**, not merely annotate it. An annotated draft that remains submittable is a row that pays someone for a class they did not teach, and it will pass through approval looking ordinary.

Rules still to settle before building:

- **Substitute rate basis, settled 2026-07-28: a substitute earns their own rate, not the rate of the teacher they covered.** Resolution therefore keys on the working teacher's own `teacher_rates` row for `substitute`. Built as specified — the trigger resolves against the teacher on the entry's `timesheet_id`, which is the person who worked. **The collapse condition is not met:** the returned workbook seeds `substitute` at a uniform $50/hr for all 19 teachers while `class_lead` ranges $35–$75, so the category is neither redundant with `class_lead` nor per-person. It is a studio-wide sub premium and must stay a distinct `rate_key`
- Which of the six substitution representations (§2.6) is authoritative for pay, with the other five derived from it or dropped
- Whether an unconfirmed auto-draft is submitted by default at period close, or silently dropped — dropping loses real hours, submitting pays for classes that may not have happened
- `class_lead` vs `class_assistant` derives from `class_teachers`, so that assignment must be reliable before drafts inherit it
- Whether a lead and an assistant both auto-draft from the same occurrence, which is legitimate and must not be mistaken for a duplicate
- **No teacher has `is_sub_eligible = true`** (all 20 rows, checked 2026-07-28). The substitute flow has no eligible pool today

**Blocked on `_INDEX.md` task 19** (§2.7). Nothing in this section is authorable until the occurrence generator produces correct `schedule_instances`.

---

### 3.7 Square Payroll is the system of record for payment

Settled 2026-07-28. **This platform computes what is owed; Square Payroll pays it.** That boundary has to be visible in the product, not just understood by the people who built it.

Consequences:

| Area | Implication |
|---|---|
| `paid_at` | Cannot be derived internally. Either entered when a Square run completes, or pulled from the Square Payroll API. Until then, every figure in the product is *owed*, not *paid* |
| Tax forms | Square issues them. Remove or rewrite any copy implying otherwise (§3.4) |
| `employment_type` | Square is authoritative for W-2 vs 1099 classification. The local column can drift; treat a mismatch as an anomaly worth surfacing |
| Teacher-facing surfaces | A YTD figure must be labeled as this platform's record of hours worked, not as a pay stub. A teacher comparing it to a Square deposit and finding a gap must not conclude they were underpaid |
| Retroactive adjustments | §3.1 — a paid entry is never rewritten, because the payment is Square's fact, not ours |

**Open:** whether to integrate the Square Payroll API to push approved hours and pull payment confirmation, or keep the handoff manual. Manual is correct for v1; the reconciliation report (§3.4) is what makes manual safe.

### 3.8 Payroll deductions — authorization is the primitive

Staff are also customers. A teacher buys merchandise, enrolls their own child in classes, books privates, or owes a share of a guest performer's rehearsal cost. Today this is settled by hand: Katherine's June 2026 sheet shows gross $1,093.75, a magenta cell reading *"Deduction: $90; Tate's 6/2 Privates"*, and a green cell reading paid $1,003.60. Three problems in one screenshot.

**Problem 1 — the net is what gets keyed into Square.** Gross wages are $1,093.75. Paying $1,003.75 as though it were gross understates W-2 wages, computes payroll tax on the wrong base, and makes the $90 disappear rather than land as studio revenue. Square supports gross plus a separate post-tax deduction line. The report must emit **three figures — gross, itemized deductions, net** — not one.

**Problem 2 — it does not reconcile.** $1,093.75 − $90.00 = $1,003.75. The sheet says $1,003.60. Fifteen cents, hand-computed, and precisely the class of defect `FINANCIAL_ANOMALY_DETECTION.md` exists to catch.

**Problem 3 — the deduction leaves no trace on the family's account.** The $90 vanished from a paycheck; nothing marks the private as paid on the billing side.

#### The model

A deduction is **never** an edit to hours, rates, or a snapshotted amount. It is a line item on the timesheet, and it may only exist if an authorization exists.

```
payroll_deduction_authorizations
  id, tenant_id
  teacher_id             not null
  deduction_type         not null   -- 'merchandise' | 'tuition' | 'privates'
                                    -- | 'costume' | 'other'
  reference_id           null       -- the order or billing record it settles
  is_recurring           not null default false
  per_period_cap_cents   null       -- null = no cap
  total_cap_cents        null       -- null = open-ended
  authorized_at          not null
  authorized_by          not null   -- the employee, always
  initiated_by           not null   -- employee or admin
  accepted_at            null       -- required when admin-initiated
  revoked_at             null
```

Each deduction line references an active authorization. **No authorization, no deduction — enforced in the write path, not the UI.**

#### Two flows, one table

- **Employee-initiated.** The teacher buys merch or asks to put their child's tuition on payroll, and authorizes at the point of request. This is the common path and should be one click.
- **Admin-initiated.** Amanda proposes it; it sits `accepted_at IS NULL` and does not apply until the employee accepts in their own portal. Never unilateral.

Revocation is available to the employee at any time and stops future deductions. It does not reverse deductions already taken.

#### Guardrails, built in from the first migration

| Guardrail | Why |
|---|---|
| **Minimum-wage floor** — deductions may not reduce net pay below minimum wage for hours worked in the period | Hard requirement in California and easy to breach accidentally with a large costume or merch order |
| **Per-period cap with rollover** — a $300 costume does not zero one paycheck; the remainder carries and the running balance is visible | Predictability for the employee; avoids the floor breach above |
| **Per-type policy switch** — `merchandise`, `tuition`, `privates`, `costume` each enabled or disabled in tenant settings | When counsel answers the question below, Amanda flips a setting rather than waiting on a release |
| **Settlement write-back** — a deduction settling a billing record marks that record paid via `reference_id` | Problem 3. Money collected must land somewhere, not merely leave a paycheck |

#### The legal question, unresolved

California Labor Code §221 prohibits an employer from collecting back wages already paid; §224 permits deductions the employee has expressly authorized in writing for specified purposes. Where a given deduction falls appears to turn on whether the obligation exists **independently of employment**:

| Case | Character |
|---|---|
| Merchandise or costume bought through a payroll-deduction agreement | The obligation is created *by* the agreement. Conventional voluntary deduction |
| A family tuition or private-lesson balance owed by someone who happens to be staff | The obligation exists regardless of employment. This is closer to what §221 targets, and written authorization may not cure it |

**This is not a determination — no one on this project is a lawyer.** The narrow question for counsel: *may the studio deduct a family's studio balance from a staff member's paycheck with written authorization, and if not, what is the compliant alternative?* The likely alternative is invoicing the family through normal billing, which the platform will do anyway.

Build the machinery regardless — merchandise, costumes, and uniforms need it independent of how tuition resolves. The schema, the caps, and the gross/deductions/net output are identical. Only the per-type switch differs.



### 3.9 Rate administration in the platform — bulk, not one at a time

The 2026-07-28 rate collection ran through a spreadsheet because no in-product path existed. That was acceptable once. It is not the ongoing model: **rates must be viewable and editable inside the platform, in bulk.** The same applies to private lesson prices (`PRIVATE_LESSON_BILLING_AND_CREDITS.md` §4.1).

Three surfaces, in priority order:

**1. Grid editor.** Teachers down, categories across, one screen. Inline edit, visible dirty state, save-all in one action. This is how an owner actually adjusts rates — comparing across people, not opening twenty profiles. The returned workbook is the evidence: nineteen of twenty teachers carry a per-teacher rate, so the grid *is* the normal case and single-record editing is the exception.

**2. Bulk actions on a selection.** Set a category to a value for selected teachers; apply a percentage increase; set an effective date across the batch. An annual raise becomes one action, not twenty.

**3. Import from spreadsheet.** Download a template pre-filled with current rates, edit offline, upload, **preview with per-row errors inline, then commit.** Never direct-to-database. Same discipline as the class importer: create-and-update against a stable key (`teacher_id` + `rate_key`), errors blocking commit rather than applying partially.

**Non-negotiables for all three:**

- Every write is effective-dated. Editing a rate **closes the current row and inserts a new one** — never an update in place. The grid shows the rate in effect today; history is preserved beneath it
- An effective date is required on every change, defaulting to today, accepting a past date (§3.1 retroactive handling applies, including the preview of affected entries)
- Guarded by `can_manage_pay()` (§3.3) in RLS, not in the route
- Every change records who and when. A rate edit is a financial control point

**Same shape for private prices.** A studio-defaults grid plus a per-teacher override grid, same import path — but guarded by whoever governs *pricing* rather than pay. Those may not be the same people, since a price is not compensation.

## 4. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | ~~Decide the rate model~~ — **decided 2026-07-28**, §3.2 | ✅ Done |
| **2** | ~~`teacher_rates` table: effective-dated, per-category, hourly-or-flat, integer cents~~ | ✅ **Done 2026-07-28 — `20260728000001`.** Shipped with the `teacher_rates_no_overlap` exclusion constraint, a `rate_key` CHECK mirroring `entry_type`, `can_manage_pay(p_tenant_id)` **and** a bare `can_manage_pay()`, and RLS from the first migration (self-select, pay-manager select/insert/update, **no delete policy** — rates are closed with `valid_to`, never removed) |
| **3** | ~~Rate resolver + snapshot at entry, resolved on work date (§3.1)~~ | ✅ **Done 2026-07-28 — `8384cad` / `20260728000003`, hardened `ad9dad7` / `20260728000005`.** `resolve_teacher_rate()` + `trg_snapshot_timesheet_entry_rate`. Landed at 0 entry rows, so no backfill |
| **4** | ~~Enter the 18 teachers' actual rates~~ | ✅ **Done 2026-07-28 — `20260728000002`.** 171 rows: 19 teachers × 9 categories, `valid_from` **2026-08-15** (the season start, not the migration date). `bonus` deliberately unseeded — it is `flat` and per-engagement. Derek Shaw excluded, not a teacher |
| **5** | ~~Payroll read path sums stored cents; drop the `hours × rate` arithmetic (§2.6)~~ | ✅ **Done 2026-07-28 — `4c303cf`.** `rateMap` and the `teachers.*_rate_cents` read are gone from `/admin/timesheets/payroll` entirely |
| **6** | ~~Pagination fix on the payroll query (§2.2)~~ | ✅ **Done 2026-07-28 — `4c303cf`.** Explicit `.range()` paging on a total order (`date, id`), advancing by rows actually returned and stopping on an empty page, so a server cap below the page size is not mistaken for the end of the data |
| **7** | Teacher period history + YTD (§3.3) | Low |
| **8** | Annual / 1099 report (§3.4) | Depends on 3, 5, 6 |
| **9** | Angelina: fix the `teacher_hours` → `timesheet_entries` bug (§3.5) | Low |
| **10** | Auto-drafted entries (§3.6) | **Blocked on task 19** |
| **11** | Angelina payroll context (§3.5) | Depends on 3; needs finance-level gating |
| **12** | Retroactive re-resolution for backdated raises (§3.1) — audited, previewed, never touches paid entries | Medium |
| **13** | Mark-period-as-paid: bulk `paid_at` + Square run reference; paid entries become immutable (§3.7) | Low |
| **14** | Payroll deductions (§3.8) — authorization table, line items, minimum-wage floor, per-type switches | Medium |
| **15** | Square reconciliation: owed-vs-paid variance surfacing (§3.7) | Depends on 13 |
| **16** | Rate administration UI: grid editor + bulk actions (§3.9) | Medium |
| **17** | Rate import/export with preview (§3.9) | Medium |
| **18** | Retire `teachers.*_rate_cents` and reconcile `teacher_hours` | Cleanup |

**RLS is not a phase — it ships with Phase 2.** Held: `20260728000001` created the policies in the same migration as the table, so no rate row ever existed unprotected.

**Phases 2–3 were time-sensitive, and landed in time.** They shipped 2026-07-28 with `timesheet_entries` at 0 rows — every hour of the Fall season will be priced on insert, and no historical rate had to be reconstructed. Fall classes begin **2026-08-15**.

**Also shipped 2026-07-28, outside the numbered phases** — timesheet write correctness, which the snapshot depends on because the trigger prices against the entry's `date` and the teacher on its `timesheet_id`:

| Commit | Change |
|---|---|
| `c601279` / `20260728000004` | 13 `pay_periods` for the 2026/27 season; `teacher_edit_cutoff` separated from `submission_deadline` |
| `1da6896` | The period lock reads `teacher_edit_cutoff`, not the submission deadline; late-but-open surfaced as a distinct state |
| `a9c7697` | Three divergent `getOrCreateTimesheet` implementations consolidated to one; entries filed by **work date**, not today |
| `fe17faa` | Writes gated on the **entry period's** cutoff rather than today's; the `/teach/attendance` path gated for the first time |
| `a673eba` | Cross-period re-dating re-files the entry to the destination timesheet and checks **both** periods' locks; dead `resolvePeriodLock` deleted |

Full behaviour in `TEACHER_TIME_ATTENDANCE.md` — "Which period a lock is evaluated against" and "Editing an entry across a period boundary."

---

## 5. Open questions for Amanda

**Settled 2026-07-28:**

| Decision | Section |
|---|---|
| Rate model — flat per-category hourly, categories as data | §3.2 |
| Snapshot timing — resolved on the entry's work date | §3.1 |
| A covered teacher is not paid; the substitute is | §3.6 |
| A substitute earns **their own** rate, not the covered teacher's | §3.6 |
| Guest performers — lump sum for performances **plus** hourly for rehearsals | §3.2 |
| Teachers see their own pay; cross-teacher visibility is `has_finance_role()` only | §3.3 |
| Raises are sometimes backdated — retroactive re-resolution required | §3.1 |
| Square Payroll is the system of record for payment | §3.7 |
| Marking paid is a period-level bulk action; a paid entry is immutable | §3.7 |
| Backdated raises produce a memo line on a future timesheet, one per affected period, never an edit to paid history | §3.1 |
| Deductions require employee authorization, employee- or admin-initiated | §3.8 |
| Rates are administered in-platform in bulk, not one record at a time | §3.9 |
| Pay rates editable by super_admin, finance_admin, studio_manager only | §3.3 |

**Answered by the returned workbook, 2026-07-28** (`BAM_Teacher_Pay_Rates.xlsx` → `20260728000002`):

| Was | Answer |
|---|---|
| Q1 — the actual rates | Returned and seeded. 171 rows, 19 teachers × 9 categories, `valid_from` 2026-08-15. Studio defaults where a teacher had no override: `class_lead` $35 · `class_assistant` $20 · `private` $45 · `rehearsal` $35 · `performance_event` $20 · `competition` $20 · `training` $20 · `admin` $20 · `substitute` $50 |
| Q4 — are `training` and `competition` paid | **Yes, both.** Seeded for all 19 teachers, uniformly at $20/hr |
| Q5 — is `class_assistant` a fraction of the lead rate | **Neither a fraction nor per-person.** It is a uniform $20/hr for all 19, while `class_lead` ranges $35–$75. No constant ratio exists, so it must stay an independent per-category rate — which is the shape `teacher_rates` already has |

**Still open:**

| # | Question | Blocks |
|---|---|---|
| 2 | **Guest lump sum — per show or per run?** "$800 for Nutcracker" splits across four performance entries; "$200 a show" does not. Per-run becomes one flat entry plus separate hourly rehearsal entries. **Still unanswered by the workbook** — `bonus` was deliberately left unseeded, since a per-engagement flat amount would be wrong at any seeded value | Phase 2 shape. The only `flat` path with no data behind it |
| 3 | **Are guest performers in `teachers` at all?** A one-off guest may have no profile, no schedule, no login. `timesheet_entries` reaches a person through `timesheets.teacher_id`, so without a row they cannot be paid or reported at all. Recommended: a `teachers` row, `employment_type = 'contractor_1099'`, no login | Phase 2. Modeling gap, not a rate question |
| 6 | **Owner draws in the annual report** — Amanda's and Derek's hours are `owner_draw` and excluded from wage totals. Include an annual figure anyway? | Phase 8 |
| 7 | **Square handoff** — manual entry of pay runs, or API integration? Manual is correct for v1 | Phase 9 |
| 8 | **For counsel, not Amanda** — may a family's studio balance be deducted from a staff member's paycheck with written authorization (§3.8)? Merchandise and costumes are a separate, likelier-permissible case. Build proceeds either way; the answer sets a switch | Phase 14 policy |
| 9 | **Does `studio_admin` belong in `can_manage_pay()`** alongside `studio_manager`? **Shipped 2026-07-28 excluded** (`20260728000001`), matching §3.3. Still a policy question, not a code one — changing the answer is a one-line function change plus a `NOTIFY pgrst` | Nothing. Answer it before a `studio_admin` exists who needs it |
| 10 | **Deduction caps** — a per-period ceiling so a large costume order does not consume one paycheck. What figure, or a percentage of net? | Phase 14 |

**Live data findings needing attention regardless (checked 2026-07-28):**

- **`w9_on_file` is false for all 20 staff.** Square will need these
- **No one has `employment_type = 'contractor_1099'`** — seven values are allowed, and the classification split in the report has nothing to split on
- **`is_sub_eligible` is false for all 20** — the substitute flow has no eligible pool
- **`profiles.role` disagrees with `profile_roles`** for at least Cara (`parent` vs admin+teacher) and Katherine Thomas — §5.1 of the session pickup, and the reason ~30 API routes lock the wrong people out

---

## 6. Related

- `docs/TENANT_TIMEZONE_SPEC.md` — Phase B fixed *which* period an entry files to; this spec covers what it is worth
- `docs/FINANCIAL_ANOMALY_DETECTION.md` — the billing half of the same problem
- `docs/TEACHER_RATE_MANAGEMENT.md` — describes a `teacher_rate_cards`-driven override hierarchy that no timesheet code reads. **Descoped from payroll by §3.2** — retire or re-scope to private-lesson pricing
- `docs/TEACHER_TIME_ATTENDANCE.md` — canonical for timesheets
- `_INDEX.md` task 19 — occurrence generator; blocks §3.6
- `BAM_Teacher_Pay_Rates.xlsx` — rate collection workbook sent to Amanda 2026-07-28
