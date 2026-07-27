# Payroll Correctness & Reporting

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-27
**Investigated against live DB and codebase:** 2026-07-27

---

## 1. Two questions, one answer

> *Can a teacher or admin ask about timesheets? Are these summarized for the year?*

**No, and no.** Teachers can see the current pay period and nothing else — once a period closes, a teacher cannot see what they filed. There is no annual view anywhere, for anyone.

And underneath that: **the pay figure the platform computes is structurally wrong across a rate change**, in the direction of over-reporting income on a tax form.

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

Note `/teach/hours` reads `teacher_hours` — **a different table from `timesheet_entries`**, and not the one payroll pays from. See §2.4.

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

### 2.4 1099 readiness — mechanically yes, meaningfully no

The copy is real, at `payroll-report.tsx:464`: *"1099 contractors are responsible for their own taxes. Payments over $600/year require a Form 1099-NEC."*

A Jan 1 – Dec 31 range would execute correctly, and the report already splits W-2 / 1099 / owner-draw via `classifyEmployment`. But:

| Blocker | Live state |
|---|---|
| `timesheet_entries` is empty | **0 rows.** Every teacher's hours would be 0 |
| Every pay rate is NULL | All **18** active teachers have `class_rate_cents`, `private_rate_cents`, `rehearsal_rate_cents`, `admin_rate_cents` = NULL → `rateMap` yields 0.00 and `hasMissingRates` is true for every teacher |
| `teacher_rate_cards` is also empty | **0 rows.** The newer rate model has nothing in it either — no fallback source |

The report would render, show every teacher under "hours but no rates," and total **$0.00**. It is not wrong at the margin — **there is no payroll data in the system at all.** `timesheets` has 3 rows and `pay_periods` has 2, but zero entries hang off them.

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

---

## 3. Proposed design

### 3.1 Rate snapshot at entry time — do this first

Populate `timesheet_entries.rate_amount` and `rate_key` **when the entry is created or approved**, from the rate in effect at that moment. Payroll then sums stored amounts instead of recomputing from current rates.

**Decision required:** snapshot at entry creation, or at approval? Approval is the stronger candidate — it is the moment the studio agrees to pay, and it survives a teacher editing an entry after a rate change. But it means a draft entry shows no dollar figure, which may be worse for the teacher.

**Migration note:** with `timesheet_entries` at 0 rows, this is free right now. Once real hours exist, backfilling means reconstructing historical rates that were never recorded — which cannot be done accurately.

**This is the cheapest it will ever be. Do it before Fall.**

### 3.2 Rate resolution — a prerequisite nobody has built

Snapshotting requires a rate to snapshot. Today all 18 teachers have NULL rates in `teachers.*_rate_cents`, and `teacher_rate_cards` is empty.

Two competing rate models exist:

| Model | Shape | Status |
|---|---|---|
| `teachers.*_rate_cents` | Flat per-teacher, per-category (class/private/rehearsal/admin) | Read by payroll and `/teach/hours`. All NULL |
| `teacher_rate_cards` | Per session type (30/45/60min), standard vs market, cancellation policy | Written by `/admin/staff/[id]/profile`, **read by no timesheet or payroll code**. Empty |

**Pick one before building the resolver.** The rate cards model is richer and is what `docs/TEACHER_RATE_MANAGEMENT.md` describes, but nothing reads it. The flat model is what payroll actually uses. Shipping a resolver against the wrong one wastes the work.

Neither model has **effective dating** — no `valid_from`/`valid_to`. Without it, "the rate in effect at that moment" has no source of truth beyond "whatever the column says right now," which is the problem §2.3 describes. **Effective-dated rates are a prerequisite for a correct snapshot, not an enhancement.**

### 3.3 Teacher period history

A period picker or history list on `/teach/timesheets`, showing prior periods read-only. Low complexity — `pay_periods` and `timesheets` already carry everything needed; the pages simply hard-scope to the current period.

Include a year-to-date total. A teacher asking "how much have I earned this year" is a reasonable question and currently unanswerable by anyone.

### 3.4 Annual / 1099 report

Per-teacher annual totals, split by employment classification, with:

- Amounts from **stored** `rate_amount` (post-§3.1), never recomputed
- Explicit pagination (§2.2) — the row cap must not silently truncate
- A distinction between **owed** and **paid** (`paid_at`) — a 1099-NEC reports payments made, not hours worked

**Do not build this before §3.1.** An annual report built on render-time rate computation produces a number Amanda would sign her name to and that would be wrong.

### 3.5 Angelina — payroll context

Two separate pieces:

**Fix the wrong table.** The teacher hours context should read `timesheet_entries`, not `teacher_hours`, or the number Angelina reports will never match the teacher's paycheck. This is a bug regardless of whether payroll context is ever added.

**Add payroll context, carefully.** A teacher asking "how many hours did I work in March" or "what's my YTD" is exactly the kind of question Angelina should answer — but it is compensation data, and the guardrails matter:

- Teacher context: own data only, enforced at the query, not the prompt
- Admin context: gated on `has_finance_role()` / `requireFinance()`, **not `is_admin()`** — see `CLAUDE.md` §4. A `studio_manager` passes `is_admin()` and must not see pay.
- The existing prompt guardrail ("never share another teacher's pay") is a prompt, not a control. Do not rely on it.

**Depends on §3.1.** Angelina answering "you earned $X in March" from render-time computation would give a teacher a number that changes when someone edits a rate.

---

## 4. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Decide the rate model (§3.2) — `teachers.*_rate_cents` vs `teacher_rate_cards` | Decision, not code |
| **2** | Effective-dated rates on the chosen model | Medium — schema |
| **3** | Rate snapshot at entry/approval (§3.1) | **Free now, impossible to backfill later** |
| **4** | Pagination fix on the payroll query (§2.2) | Low, but blocks any annual run |
| **5** | Teacher period history + YTD (§3.3) | Low |
| **6** | Annual / 1099 report (§3.4) | Depends on 3 + 4 |
| **7** | Angelina: fix the `teacher_hours` → `timesheet_entries` bug (§3.5) | Low |
| **8** | Angelina payroll context (§3.5) | Depends on 3; needs finance-level gating |

**Phases 1–3 are time-sensitive.** `timesheet_entries` is empty today. Every hour logged before rate snapshotting exists is an hour whose true rate is unrecoverable.

---

## 5. Open questions for Amanda

1. **Which rate model** (§3.2)? Flat per-category, or per-session-type rate cards? Nothing reads the latter today.
2. **Snapshot at entry or at approval** (§3.1)?
3. **Are rates ever retroactive?** If a raise is backdated, effective dating needs to support it.
4. **Should teachers see their own YTD earnings**, or only hours? Hours are uncontroversial; dollars may not be.
5. **Owner draws in the annual report** — Amanda's hours are classified `owner_draw` and excluded from wage totals. Does she want an annual figure for them anyway? It is not a 1099 or W-2 number, but it is a real cost.

---

## 6. Related

- `docs/TENANT_TIMEZONE_SPEC.md` — Phase B fixed *which* period an entry files to; this spec covers what it is worth
- `docs/FINANCIAL_ANOMALY_DETECTION.md` — the billing half of the same problem
- `docs/TEACHER_RATE_MANAGEMENT.md` — describes a `teacher_rate_cards`-driven override hierarchy that no timesheet code reads
- `docs/TEACHER_TIME_ATTENDANCE.md` — canonical for timesheets
