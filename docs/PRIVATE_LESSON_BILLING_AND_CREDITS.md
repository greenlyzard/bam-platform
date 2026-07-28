# Private Lesson Billing & Credits

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Revised:** 2026-07-28 — added §4.8 (session confirmation, pay/billing split, no repricing); rewritten against Gem's rate grid and the old rate matrix; credits re-denominated in dollars; pricing generalized for multi-tenant
**Investigated against live DB:** 2026-07-28

---

## 1. Why this exists

The platform can say what a private lesson **costs** — teacher pay, covered by `PAYROLL_CORRECTNESS_AND_REPORTING.md`. It has no working representation of what a lesson **sells for**.

That blocks three things:

1. Families cannot be charged for privates through the platform
2. The scholarship/discount callout has no honest source — computing it from a teacher's pay rate would be wrong (pay is cost, not price) and would leak rates, which §3.3 of the payroll spec restricts to `can_manage_pay()`
3. Packs of privates cannot be sold at all

Most of the tables exist. Almost none are wired.

---

## 2. Findings

### 2.1 Three overlapping billing families for one lesson

| Table | Carries |
|---|---|
| `private_sessions` (35 cols) | `session_rate`, `market_rate`, `studio_contribution`, `contribution_note`, `billing_model`, `billing_status` |
| `private_session_billing` (19 cols) | Per student: `split_percentage`, `amount_owed`, `points_owed`, `market_value`, `studio_contribution`, `teacher_contribution`, `teacher_contribution_note`, `billing_status`, `payment_method`, `paid_at`, `transaction_id`, `credit_transaction_id` |
| `private_billing_records` + `private_billing_splits` | Confirmation workflow (`teacher_confirmed`, `admin_confirmed`, `billing_split_confirmed`) and per-split `split_amount`, `billing_account_id`, `billing_account_suggested`, `billing_account_override`, `waiver_reason`, `dispute_notes` |

`market_rate` / `market_value` and `studio_contribution` appear at **both** the session level and the per-student level. Two places to write the same fact, no rule about which wins.

Recommendation: `private_sessions` owns the *event*; `private_session_billing` owns *money per student*. `private_billing_records` / `private_billing_splits` is a third representation of the same split and should be **audited before extension** — it may predate `private_session_billing` entirely.

### 2.2 The packs model is anticipated in three places and sold in none

Already in the CHECK constraints: `private_sessions.billing_model` allows `bundle`; `private_session_billing.payment_method` allows `credit_pack`; `billing_status` allows `deducted_from_pack`; `credit_transactions.type` allows `purchase`, `charge`, `refund`, `adjustment`, `expiry`.

`credit_accounts` holds `balance`, `lifetime_earned`, `lifetime_spent`, scoped by both `student_id` and `family_id`.

**What does not exist:** any pack SKU, purchase path, price, or cost basis. The spend side is modeled; the buy side is absent — and since the discount happens *at purchase*, the buy side is where the family-facing savings figure originates.

### 2.3 Gem's rate grid decodes to a formula

`Teachers__Information.xlsx` → *Teacher List*, columns G–R: SOLO / DUO / TRIO × 30 / 45 / 60 / 90 minutes, for 20 teachers. Verified across every row:

> **Duo per student = (solo rate + $10) ÷ 2**
> **Trio per student = (solo rate + $15) ÷ 3**

The uplift is **per session, not per duration** — a 90-minute duo at Adelyn's $150 solo is (150 + 10) ÷ 2 = $80, and this holds for all four durations and all twenty teachers.

Consequences:

- The price list is **four numbers per teacher** (one per duration), not a 12-cell matrix. `teacher_rate_cards` needs no duo/trio columns
- Durations are **30 / 45 / 60 / 90**. The existing table has 30/45/60 only — no 90
- Solo rates must be **stored per duration, not derived**. The ×1.5 / ×2 / ×3 pattern holds for most teachers but Amanda's 45 is $100 where the pattern predicts $112.50

**Modal rates** — ten of twenty teachers sit exactly here, and these become the studio defaults:

| Duration | Default |
|---|---|
| 30 min | $50 |
| 45 min | $75 |
| 60 min | $100 |
| 90 min | $150 |

**Column S is unlabeled** and is exactly 50% of the 30-minute solo rate for every teacher. It matches no one's pay rate. Ask Gem before importing anything that depends on it.

### 2.4 A student-type tier exists that no spec accounted for

The *Old Private Rate Matrix* sheet is keyed on `Teacher · Time (Min) · Private Size · # of Students · Student Type`, where **Student Type is `Company` or `Non-Company`**, with separate `Rate (Reg.)` and `Rate (Discounted)` per row.

Company students pay less — Amanda's 60-minute solo is $130 company against $150 non-company. This is a **systematic pricing tier**, not a per-family adjustment. It likely explains `teacher_rate_cards.standard_rate_*` vs `market_rate_*`.

The discounts are **irregular**, not a clean percentage, so the tier must carry its own rates rather than a multiplier off the base.

Eligibility is currently a hand-maintained note in the spreadsheet: *"Company Discounted: Ruby Turner, Gwen Johnson, Willow Anderson, Violet Fitzpatrick."* That belongs on the student record.

**Open:** Gem's current grid has **no tier columns at all** — one rate set only. Either the tier was retired or it is applied by hand now. Confirm before modeling a discount that may be dead (§6 q1).

### 2.5 The cancellation policy has an opinion nobody chose

`teacher_rate_cards` defaults: `cancellation_notice_hours = 24`, `late_cancel_charge_pct = 100`, `no_show_charge_pct = 100`, plus free-text `cancellation_policy_note`. Placeholders, not decisions — and session-pickup question 2 is blocked on exactly this.

The old matrix carries real fee columns (*"Sick Late Cancellation Fee 60 mins"*, *"Late Cancellation Fee 60 mins"*), which is actual data rather than a guess. `private_sessions.status` already allows `cancelled` and `no_show`, so enforcement has its inputs.

### 2.6 Roster drift between the sheet and the database

| Issue | Disposition |
|---|---|
| **Cara Hansvick** (sheet) = **Cara Matchett** (DB) | Former name. Same person |
| Adelyn Haderlie, Mikhail Prieto, Melissa Chyba in sheet, not in DB | **Ignore for now** |
| Kailey Luebrecht, Melanie Seeley in DB, not in sheet | **Studio default rates** |
| Derek Shaw in DB with a `teachers` row and an active `teacher` role | **Not a teacher.** Remove the role and the row — he surfaces in staff and payroll reports otherwise |
| Spelling drift: Cambell/Campbell, Moorea/Morea, Catherine/Kiki, Eliza/Ellie, Paola/Pie, Samantha/Sam | Match on email, never on name, when importing |

### 2.7 Live state

Five `private_sessions` rows exist and have already drifted against an unstated cancellation policy. `teacher_rate_cards`, `credit_accounts`, and `credit_transactions` are all empty.

`private_sessions.studio` is **free text** carrying values like `'Studio 1'` with no FK to `rooms` — the third place that name collides.

---

## 3. Decisions settled

| Decision | Detail |
|---|---|
| **Credits are denominated in dollars** | Not points. A pack sold as "10 for the price of 9" credits face value and debits actual lesson price. Liability is always exactly the sum of unredeemed balances |
| **Displayed as a punch card** | Progress bar, not discrete punches — see §4.5 |
| **Credits float across teachers** | Not locked to the teacher the pack was priced from. A pricier teacher consumes more credit; a departing teacher strands no balance |
| **Privates only** | Credits are not redeemable against tuition, merchandise, or fees. Enforced at spend time |
| **Refund at purchase ratio** | Cash paid ÷ face value, applied to the unused balance |
| **Group pricing is a formula** | Uplift then divide (§2.3), stored as tenant configuration |
| **Durations include 90 minutes** | And duration is an integer, not an enum |
| **Prices vary by teacher, with studio defaults** | Defaults per §2.3; per-teacher override where they differ |
| **Booked privates pre-load as draft timesheet entries** | Teacher confirms per-student attendance; billing queues for finance confirmation (§4.8) |
| **No repricing when a student misses** | Attendees pay as booked; the absent student is charged per the no-show policy (§4.8) |
| **Teacher is not paid when nobody attends** | Studio default. One-off exceptions exist and require an explicit override (§4.8) |
| **Packs are not treated as regulated contracts** | Amanda's decision, 2026-07-28, recorded. The operational consequence stands regardless: unredeemed credit is a refundable obligation, which is why exact liability tracking is a requirement rather than a nicety |

---

## 4. Design

### 4.1 Pricing — three small config tables, not a wide matrix

BAM's formula is BAM's, not a universal rule. Another studio may price semis as a percentage, or per-student flat, or not offer them; may run 55-minute lessons; may have Competition Team instead of Company, or no tiers at all. **None of it can be columns or code.**

```
student_tiers                        -- per tenant
  tenant_id, key, label, sort_order, is_default, is_active
  -- BAM seeds: 'company', 'non_company' (default)
  -- a studio with no tiers seeds one row and never thinks about it

group_pricing_rules                  -- per tenant
  tenant_id, student_count,
  uplift_cents, multiplier, divide_across_students (bool),
  is_active
  -- BAM seeds: (2, +1000, null, true), (3, +1500, null, true)
  -- percentage studios store multiplier instead of uplift
  -- studios charging each student full price set divide = false

private_lesson_prices
  tenant_id, teacher_id (null = studio default),
  duration_minutes (int), tier_id,
  price_cents, valid_from, valid_to, is_active
```

**Resolution order:** teacher + duration + tier → studio default + duration + tier → fail loudly. Never charge zero for a missing price.

**Group price** = apply the matching `group_pricing_rules` row to the resolved base: `(base + uplift) ÷ n`, or `base × multiplier`, or `base` where `divide = false`.

`teacher_rate_cards` is superseded by this shape. Retire it or narrow it to the cancellation policy it also carries — it cannot express 90 minutes or tiers as built.

**Effective dating** matters as much here as for pay: a price change must not silently reprice history. Same close-row-and-insert discipline as `teacher_rates`.

### 4.2 Packs and credits

```
credit_packs                         -- the SKU
  tenant_id, name, face_value_cents, price_cents,
  is_active, valid_from, valid_to

credit_purchases
  tenant_id, account_id, pack_id,
  face_value_cents, price_paid_cents,
  purchased_at, stripe_payment_intent_id
```

"10 privates for the cost of 9" against a $70 lesson = `face_value_cents` 70000, `price_cents` 63000.

On purchase: `credit_transactions` (`type = 'purchase'`), increment `credit_accounts.balance` by face value, recompute the **weighted-average purchase ratio**:

```
new_ratio = (old_balance × old_ratio + face_added × (price_paid / face_added))
            / (old_balance + face_added)
```

`credit_accounts` needs one new column: `purchase_ratio` (numeric — it will not divide evenly; rounding per-purchase compounds).

On spend: `type = 'charge'`, decrement by the actual lesson price, ratio unchanged. On refund: `unused_balance × purchase_ratio`.

**Deferred revenue.** A sold credit is cash received for a service not yet delivered — a liability until the lesson happens, and refundable while it sits. It must not be recognized as revenue at purchase. The double-entry ledger from §9 billing is where this belongs, and it should be modeled before the first pack sells.

**Redemption scope is enforced, not documented.** `privates only` is a check at spend time. `payment_method = 'credit_pack'` must be rejected anywhere but a private session.

### 4.3 Expiry — still open, and it constrains the cost basis

`credit_transactions.type` allows `expiry`. Expiration is inherently **per-lot** — a credit bought in January expires before one bought in June — and the weighted-average ratio discards which purchase a dollar came from.

Weighted average is settled and correct **if credits do not expire.** If they do, lot tracking is required instead and building the ratio first is wasted work. §6 q2, and it must be answered before Phase 4.

### 4.4 Discount attribution and the savings callout

`private_session_billing` already carries the model: `market_value`, `studio_contribution`, `teacher_contribution`, `teacher_contribution_note`, `amount_owed`.

The callout is `market_value − amount_owed`. Attribution between studio and teacher is **finance-only** — it is how owner subsidy becomes a visible cost rather than invisible generosity — but the family sees one savings figure.

**Reason codes, not one label.** "Scholarship" implies awarded financial aid and a family may treat a documented scholarship as tax-relevant. Use a picklist — the pattern `refunds.reason_id` establishes — with `scholarship`, `owner_discount`, `promotional`, `company_tier`, `sibling` distinguishable. Only genuine awarded aid surfaces as a scholarship.

Note the tier discount (§2.4) is **pricing**, not a contribution — a company student's lower rate is the list price for that student, not a discount off it. Do not double-count it in the savings figure.

### 4.5 Parent/student dashboard

**Progress bar, not punches.** A card priced off a $70 teacher and spent on a $60 teacher leaves a fractional remainder; discrete punches would have to lie or show halves. A bar tolerates it and still reads as a card.

Show: remaining balance as the primary figure, an approximate lesson count as context ("about 8 more 60-minute lessons at your usual rate"), and purchase date. Where a family has several accounts, list all balances with a combined total.

**Reload prompts, with two guardrails:**

- **Passive, not pushed.** They appear where a balance is displayed. No notification, email, or text telling a parent they are running low
- **Never when the balance is zero and an invoice is unpaid.** Asking someone who is behind to prepay more is the wrong moment

**Multi-child scoping needs a decision.** `credit_accounts` is scoped by both `student_id` and `family_id`. A family with two dancers may have one shared balance or two separate ones, and a shared balance displayed per-student will double-count. Decide which is authoritative before the dashboard renders it (§6 q5).

### 4.6 Price administration in the platform

Same requirement as pay rates (`PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.9): **bulk, not one at a time.**

- Grid: teachers down, durations across, one tier at a time. Studio defaults shown as the fallback row
- Bulk actions: percentage increase across a selection, set an effective date across a batch
- Import: template pre-filled with current prices → upload → preview with per-row errors inline → commit. Never direct-to-database. **Match on email, not name** (§2.6)
- Every write effective-dated, closing the prior row rather than updating in place
- Guarded by whoever governs *pricing* — which may not be the pay-management set, since a price is not compensation (§6 q6)

### 4.7 Cancellation enforcement

Read `cancellation_notice_hours`, `late_cancel_charge_pct`, `no_show_charge_pct` from the resolved policy. On a `cancelled` or `no_show` session, compute the charge and write a `private_session_billing` row with the appropriate `billing_status`.

The old matrix distinguishes a **sick** late cancellation from an ordinary one, which the current single-percentage model cannot express. Defaults must be replaced with Amanda's actual policy **before enforcement ships** — enforcing a placeholder against five already-drifted live sessions would generate charges nobody agreed to.

---

### 4.8 Session confirmation — the bridge between pay and billing

Booked privates pre-load as draft timesheet entries. The teacher confirms who actually attended. That single confirmation produces **two independent outcomes**, and treating it as one is the main way this goes wrong.

#### What exists

| Piece | State |
|---|---|
| `timesheet_entries.session_id` | Column exists, unwritten. This is the join that replaces the manual cross-reference |
| `timesheet_entries.is_auto_populated` | Exists, unwritten. Marks a pre-created draft |
| `private_billing_records.teacher_confirmed` / `admin_confirmed` / `billing_split_confirmed` | Two-stage confirmation, modeled, unwired |
| `private_session_billing` | Already per-student: `split_percentage`, `amount_owed`, `billing_status`, `credit_transaction_id` |
| `private_sessions.status` | Allows `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show` |

#### What does not exist

**Per-student attendance has no home.** `private_sessions.student_ids` is an array and `timesheet_entries.attendance_status` is one value for the whole entry. There is nowhere to record that two of three students showed.

Proposed:

```
private_session_students
  session_id, student_id,
  attendance_status,        -- attended | absent | excused
  marked_by, marked_at
```

A junction rather than an attendance column on `private_session_billing`: attendance is a fact about the lesson, and should not exist only because a billing row does. It also gives the per-student rows something to hang off when a session is comped and no billing row is created.

#### Pay and billing are computed separately

| Situation | Teacher | Family |
|---|---|---|
| All students attend | Paid | Charged as booked |
| Some attend, some do not | Paid in full — the session happened | Attendees charged as booked; absentees charged per `no_show_charge_pct` |
| Nobody attends | **Not paid** (studio default) | Charged per `no_show_charge_pct` |
| Nobody attends, one-off exception | Paid — requires an explicit override | Sometimes charged |
| Session cancelled with notice | Not paid | Not charged, subject to `cancellation_notice_hours` |

The third and fourth rows are the reason this cannot be one computation. A no-show produces *no pay and a charge* — the exact inverse of the normal case.

#### No repricing

**Settled 2026-07-28: a trio that becomes a duo does not reprice.** Attendees pay what they booked; the absent student is charged per the no-show policy.

The arithmetic is why. A trio collects `solo + $15` — $65 on a $50 solo, $21.67 each. Repricing to duo makes the two who came pay $30 each: a **38% increase because of a third family's absence**, which is a support call and reads as a penalty for someone else's behaviour. Without repricing and with the no-show charged, the studio collects exactly `solo + $15` — the full session value — and nobody pays more than they agreed to.

This also simplifies the build: **the price is fixed at booking.** Confirmation never recalculates an amount. It answers two questions only — is the absent student charged, and is the teacher paid.

#### The billing queue

Teacher confirmation does **not** charge a family. It populates a queue that `finance_admin` and above confirm, matching the existing `teacher_confirmed` → `admin_confirmed` shape.

This is deliberate. A mistaken teacher confirmation would otherwise bill a family directly, and reversing a charge costs more than reviewing one. The queue is also where the one-off exceptions in the table above get applied.

#### What this replaces

Today an administrator reads every timesheet and cross-references it against the schedule in BAND, then charges clients by hand. Once an entry carries `session_id`, **the cross-reference is the join** — the queue is populated rather than assembled, and the reconciliation step disappears rather than being automated.

## 5. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Decide the owner of session-level vs per-student money columns (§2.1); audit whether `private_billing_records` is superseded | Decision |
| **2** | Answer expiry (§4.3) and the tier question (§2.4) — both gate schema | Decision. **Before code** |
| **3** | `student_tiers`, `group_pricing_rules`, `private_lesson_prices`; seed BAM's defaults and formula | Medium |
| **4** | Import Gem's grid: solo rates per teacher per duration, matched on email | Low. Depends on 3 |
| **5** | Price resolution helper + group formula | Low |
| **6** | Pack SKUs, purchase path, weighted-average purchase ratio | Medium |
| **7** | Deferred-revenue treatment in the double-entry ledger (§4.2) | Medium. Do not defer past 6 |
| **8** | Charge a private: resolve price → `private_session_billing` → card or credit | Medium |
| **9** | Discount attribution + reason codes (§4.4) | Low |
| **10** | Parent dashboard: progress bar, balances, reload prompts (§4.5) | Low |
| **11** | Price administration grid + import (§4.6) | Medium |
| **12** | `private_session_students` junction; per-student attendance capture (§4.8) | Low |
| **13** | Pre-created draft entries from booked privates, `session_id` + `is_auto_populated` (§4.8) | Medium |
| **14** | Billing queue: teacher confirm → finance confirm → charge (§4.8) | Medium |
| **15** | Cancellation enforcement (§4.7) — after Amanda's policy replaces the defaults | Low |
| **16** | Refunds at purchase ratio | Low |
| **17** | Resolve `private_sessions.studio` free text to a `rooms` FK | Cleanup; overlaps task 19 |

**RLS ships with each phase.** A family sees their own account and their own charges. `credit_accounts` is scoped by student and family both — the policy must handle a student in two households without exposing either to the other.

---

## 6. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Is the Company / Non-Company tier still in use?** Gem's current grid has no tier columns; only the old matrix does. If retired, `student_tiers` seeds one row and the discount model simplifies | Phase 2 |
| 2 | **Do credits expire?** If yes, weighted average is not viable and lot tracking is required | Phase 2. **Before Phase 6** |
| 3 | **Pack sizes and pricing** — "10 for the cost of 9" against which teacher's rate? Or a fixed face value | Phase 6 |
| 4 | **Column S** in Gem's grid — unlabeled, exactly 50% of the 30-minute solo rate, matches no pay rate. Ask Gem | Phase 4 |
| 5 | **Family or student credit balance?** `credit_accounts` supports both. A shared balance shown per-student double-counts | Phase 10 |
| 6 | **Who administers prices?** The pay-management set (`can_manage_pay()`), or a wider one? A price is not compensation | Phase 11 |
| 7 | **Cancellation policy**, including the sick-vs-ordinary distinction the old matrix carries. Five live sessions have already drifted | Phase 12, and session-pickup q2 |
| 8 | **What is `no_show_charge_pct` actually?** The table default is 100%. With no repricing, this is the whole of what a missed lesson costs a family | Phase 14 |
| 9 | **Who confirms the billing queue** — `finance_admin` and above, or may a studio manager? Note `can_manage_pay()` includes `studio_manager` while `requireFinance()` does not | Phase 14 |
| 10 | **How is the "pay the teacher anyway" exception recorded?** A flag on the entry, or a manual entry with `rate_override`? It needs to be visible on the payroll report either way | Phase 13 |
| 11 | **Sibling discounts** — settled for enrollment at ~50% off 2nd+ registration. Do they extend to privates? | Phase 9 |

---

## 7. Multi-tenant notes

Everything tenant-specific is data:

| BAM's rule | Where it lives | Another studio |
|---|---|---|
| Duo +$10 ÷ 2, trio +$15 ÷ 3 | `group_pricing_rules` | Percentage multiplier, or no divide, or no semis |
| Company / Non-Company | `student_tiers` | Any tiers, or one |
| 30 / 45 / 60 / 90 | `duration_minutes` integer | Any durations, no migration |
| $50 / $75 / $100 / $150 | `private_lesson_prices` with null `teacher_id` | Own defaults |
| Credits for privates only | Redemption scope config | Could permit tuition |

No BAM-specific value appears in code. The seed migration carries BAM's configuration; a new tenant gets an onboarding wizard or an empty set.

---

## 8. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` — the cost side. §3.3 is the rate visibility rule this spec must not violate; §3.9 is the bulk-administration pattern §4.6 mirrors
- `BILLING_GENERALIZATION_SPEC_V2.md` — the double-entry ledger deferred revenue depends on
- `FINANCIAL_ANOMALY_DETECTION.md` — a pack sold and never consumed is a liability that ages
- `TEACHER_RATE_MANAGEMENT.md` — superseded by §4.1; retire or narrow to cancellation policy
- `_INDEX.md` task 19 — occurrence generator; overlaps the `studio` free-text cleanup
- `Teachers__Information.xlsx` — Gem's rate grid and the old rate matrix; source for Phase 4
