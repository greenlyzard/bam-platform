# Private Lesson Billing & Credits

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. Why this exists

The platform can say what a private lesson **costs** — teacher pay, covered by `PAYROLL_CORRECTNESS_AND_REPORTING.md`. It has no working representation of what a lesson **sells for**.

That gap blocks three things at once:

1. Families cannot be charged for privates through the platform
2. The scholarship/discount callout has no honest source — computing it from a teacher's pay rate would both be wrong (pay is cost, not price) and leak rates, which §3.3 of the payroll spec restricts to `has_finance_role()`
3. Packs of privates cannot be sold at all

The tables to do it are largely present. Almost none of them are wired.

---

## 2. Findings

### 2.1 Three overlapping billing families for one lesson

| Table | Carries |
|---|---|
| `private_sessions` (35 cols) | `session_rate`, `market_rate`, `studio_contribution`, `contribution_note`, `billing_model`, `billing_status` |
| `private_session_billing` (19 cols) | Per student: `split_percentage`, `amount_owed`, `points_owed`, `market_value`, `studio_contribution`, `teacher_contribution`, `teacher_contribution_note`, `billing_status`, `payment_method`, `paid_at`, `transaction_id`, `credit_transaction_id` |
| `private_billing_records` + `private_billing_splits` | Confirmation workflow (`teacher_confirmed`, `admin_confirmed`, `billing_split_confirmed`) and per-split `split_amount`, `billing_account_id`, `billing_account_suggested`, `billing_account_override`, `waiver_reason`, `dispute_notes` |

**`market_rate` / `market_value` and `studio_contribution` appear at both the session level and the per-student level.** Two places to write the same fact, no rule about which wins. **Pick one owner before anything writes to either.**

Recommendation: `private_sessions` owns the *event* (when, who taught, how long, what it lists for). `private_session_billing` owns *money per student*. The session-level `session_rate` / `market_rate` / `studio_contribution` columns become the list price and the per-student rows carry the actual charge. `private_billing_records` / `private_billing_splits` is a third representation of the same split and should be **audited before extension** — it may predate `private_session_billing` entirely.

### 2.2 The packs model is anticipated in three places and sold in none

Already in the CHECK constraints:

- `private_sessions.billing_model` allows `bundle`
- `private_session_billing.payment_method` allows `credit_pack`
- `private_session_billing.billing_status` allows `deducted_from_pack`
- `credit_transactions.type` allows `purchase`, `charge`, `refund`, `adjustment`, **`expiry`**

`credit_accounts` holds `balance`, `lifetime_earned`, `lifetime_spent`, scoped by both `student_id` and `family_id`. `credit_transactions` is a typed ledger with `balance_after` and `reference_id`.

**What does not exist:** any pack SKU, any purchase path, any price per pack, any cost basis per point. The spend side is modeled; the buy side is absent. Since the discount happens **at purchase**, the buy side is precisely where the family-facing savings figure originates.

Note `expiry` in the transaction types: expiration was anticipated. See §4.3 — it conflicts with the weighted-average decision.

### 2.3 `teacher_rate_cards` is the price list, not a payroll table

Descoped from payroll by `PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.2, and correctly so — it is keyed per teacher, per `session_type`, with `standard_rate_30/45/60`, `market_rate_30/45/60`, `point_cost`, and a cancellation policy. That is a **billing** artifact. Re-scope it here rather than retiring it.

It also has `tenant_id`, which `teachers` does not.

**Collection problem.** `session_type` allows five values (`solo`, `duet`, `group`, `pilates`, `hybrid`) × three durations × standard-and-market = **30 numbers per teacher, 600 across 20 staff.** Asking Amanda to fill that is not viable. Structure it as **studio-level defaults by session type and duration, with per-teacher overrides only where someone differs** — the same shape as the pay-rate workbook.

### 2.4 The cancellation policy already has an opinion nobody chose

`teacher_rate_cards` defaults: `cancellation_notice_hours = 24`, `late_cancel_charge_pct = 100`, `no_show_charge_pct = 100`, plus a free-text `cancellation_policy_note`.

Those are somebody's placeholder, not Amanda's decision — and open question #2 in the session pickup ("is a cancelled/no-show private billable?") is blocked on exactly this. **The structure exists; only the answer is missing.** `private_sessions.status` already allows `cancelled` and `no_show`, so enforcement has both inputs.

### 2.5 Live state

Five `private_sessions` rows exist, and per `SESSION_2026-07-21_FINDINGS.md` they have already drifted against an unstated cancellation policy. `teacher_rate_cards` is empty. `credit_accounts` and `credit_transactions` are empty.

`private_sessions.studio` is **free text** carrying values like `'Studio 1'` with no FK to `rooms` — the third place that name collides, alongside `schedule_instances` and the retired-room renames (session pickup §5.3).

---

## 3. Decisions settled

| Decision | Detail |
|---|---|
| **Private pricing varies by teacher** | Per-teacher rate cards are the right shape. `teacher_rate_cards` is re-scoped to billing, not retired |
| **Packs are priced in points** | A lesson costs N points; N varies by teacher via `point_cost`. One pack works studio-wide without maintaining parallel dollar prices — and an expensive teacher costs more points, so there is no cheap-pack/expensive-teacher arbitrage |
| **Refunds are at point value, not list** | What the family actually paid per point |
| **Cost basis is weighted average** | One average cost per point per account, recomputed on each purchase. Simpler than lot tracking; see §4.3 for the caveat |
| **The savings callout is billing-side only** | Standard price minus what the family was actually charged. No pay rate participates. A family inverting the arithmetic learns only their own discount, which they already know |

---

## 4. Design

### 4.1 Price list

Two levels:

```
studio_private_prices          -- tenant defaults
  tenant_id, session_type, duration_minutes,
  list_price_cents, point_cost, is_active

teacher_rate_cards             -- existing table, per-teacher override
  (unchanged shape; rows only where a teacher differs from the default)
```

Resolution: teacher override if present, else studio default. Absent both, the lesson cannot be priced and must fail loudly rather than charge zero.

**Open — `standard` vs `market`.** `teacher_rate_cards` carries both `standard_rate_*` and `market_rate_*`, both nullable, neither read by any code. The likely intent is that `standard` is what the studio charges and `market` is the independent going rate, used as the benchmark the savings figure is measured against. That is inference. §6 question 1.

### 4.2 Packs

```
credit_packs                   -- the SKU
  tenant_id, name, points, price_cents, is_active,
  valid_from, valid_to         -- promotional windows

credit_purchases               -- one per transaction
  tenant_id, account_id, pack_id,
  points_purchased, price_paid_cents,
  purchased_at, stripe_payment_intent_id
```

On purchase: insert `credit_transactions` (`type = 'purchase'`), increment `credit_accounts.balance`, and recompute weighted average cost:

```
new_avg = (old_balance × old_avg + points_purchased × price_paid)
          / (old_balance + points_purchased)
```

`credit_accounts` needs one new column: `avg_cost_cents` (numeric, not integer — the average will not divide evenly, and rounding it per-purchase compounds).

On spend: `credit_transactions` (`type = 'charge'`), decrement balance, leave `avg_cost_cents` unchanged. Weighted average is unaffected by consumption.

On refund: points × `avg_cost_cents`, `type = 'refund'`.

**Deferred revenue.** A purchased point is cash received for a service not yet delivered — a liability until the lesson happens. The double-entry ledger from §9 billing is where this belongs, and points must not be recognized as revenue at purchase. This is the single most consequential accounting consequence of selling packs and it should be modeled before the first pack sells, not reconciled afterward.

### 4.3 Weighted average vs expiry — an unresolved tension

`credit_transactions.type` already allows `expiry`, and expiration is inherently **per-lot**: a point bought in January expires before one bought in June. Weighted average discards which purchase a point came from, so it cannot answer "which points expired."

Weighted average is the settled choice and is correct **if packs do not expire.** If Amanda wants expiration, lot tracking is unavoidable and building weighted average first is wasted work. §6 question 2 — and it should be answered before Phase 2, not after.

### 4.4 Discount attribution and the family-facing callout

`private_session_billing` already carries the whole model:

```
market_value          -- what it would list at
studio_contribution   -- absorbed by the studio
teacher_contribution  -- absorbed by the teacher
teacher_contribution_note
amount_owed           -- what the family actually pays
```

The callout is `market_value − amount_owed`. Attribution between studio and teacher is a **finance-only** view — it is how owner subsidy becomes visible as a real cost rather than invisible generosity — but the family sees a single savings figure.

**Reason codes, not one label.** "Scholarship" implies awarded financial aid and a family may treat a documented scholarship as tax-relevant. Use a reason picklist — the pattern `refunds.reason_id` already establishes — so `scholarship`, `owner_discount`, `promotional`, and `sibling` are distinguishable. Only genuine awarded aid should surface to a family as a scholarship.

### 4.5 Cancellation enforcement

Read `cancellation_notice_hours`, `late_cancel_charge_pct`, `no_show_charge_pct` from the resolved rate card. On a `cancelled` or `no_show` session, compute the charge and write a `private_session_billing` row with the appropriate `billing_status`. The defaults (24h / 100% / 100%) must be **replaced with Amanda's actual policy before enforcement ships** — enforcing a placeholder against five already-drifted live sessions would generate charges nobody agreed to.

---

## 5. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Decide the owner of session-level vs per-student money columns (§2.1); audit whether `private_billing_records` is superseded | Decision |
| **2** | Answer the expiry question (§4.3) — gates the cost-basis model | Decision. **Before code** |
| **3** | `studio_private_prices` + resolution helper; collect prices from Amanda | Low |
| **4** | Pack SKUs, purchase path, weighted-average cost basis on `credit_accounts` | Medium |
| **5** | Deferred-revenue treatment in the double-entry ledger (§4.2) | Medium. Do not defer past Phase 4 |
| **6** | Charge a private: resolve price → `private_session_billing` row → card or `credit_pack` | Medium |
| **7** | Discount attribution + reason codes (§4.4) | Low |
| **8** | Family-facing savings callout | Low. Depends on 7 |
| **9** | Cancellation enforcement (§4.5) — after Amanda's policy replaces the defaults | Low |
| **10** | Refunds at weighted-average point value | Low |
| **11** | Resolve `private_sessions.studio` free text to a `rooms` FK | Cleanup; overlaps `_INDEX.md` task 19 |

**RLS ships with each phase, not after.** A family sees their own account and their own charges. `credit_accounts` is scoped by both `student_id` and `family_id` — the policy must handle a student in two households without exposing either to the other.

---

## 6. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **`standard` vs `market` on the rate cards** — which is charged, which is the benchmark? The savings figure is measured against one of them | Phase 3 |
| 2 | **Do packs expire?** `credit_transactions.type` allows `expiry`. If yes, weighted average is not viable and lot tracking is required instead | Phase 2. **Answer before Phase 4** |
| 3 | **Pack pricing** — how many points, at what price, and what discount versus buying singly? | Phase 4 |
| 4 | **Cancellation policy** — is a late-cancelled or no-show private billable, and at what percentage? The table defaults say 24h/100%/100%; nobody chose those. Five live sessions have already drifted | Phase 9, and session pickup Q2 |
| 5 | **Prices per teacher** — confirm studio defaults plus overrides rather than 30 numbers per teacher (§2.3) | Phase 3 |
| 6 | **Sibling discounts** — ~50% off 2nd+ registration is settled for enrollment. Does it extend to privates? | Phase 7 |

### For counsel, not Amanda

**Selling prepaid lesson packages is a regulated product in California.** The Dance Studio Act (Civil Code §1812.50 et seq.) governs prepaid dance instruction contracts — it addresses contract value, duration, and cancellation rights, and exists because studios sold large prepaid lesson packages. Whether it reaches a modest points pack is not something anyone on this project can determine. Separately, expiration dates on prepaid value have their own constraints.

**No one here is a lawyer.** The narrow questions: *does selling a prepaid pack of private lessons create a regulated contract, and may purchased points carry an expiration date?* Both should be answered before packs go on sale, not after.

---

## 7. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` — the cost side. §3.2 descopes `teacher_rate_cards` from payroll; this spec is where it lands. §3.3 is the rate visibility rule this spec must not violate
- `BILLING_GENERALIZATION_SPEC_V2.md` — the double-entry ledger deferred revenue depends on
- `FINANCIAL_ANOMALY_DETECTION.md` — a pack sold and never consumed is a liability that ages
- `TEACHER_RATE_MANAGEMENT.md` — describes the rate-card override hierarchy. Re-scope to billing rather than retire
- `_INDEX.md` task 19 — occurrence generator; overlaps the `studio` free-text cleanup
