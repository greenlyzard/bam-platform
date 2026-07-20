# Commerce & Billing Architecture

> ## ⛔ SUPERSEDED — 2026-07-20. DO NOT IMPLEMENT FROM THIS DOC.
> This draft's money model (the invoices / invoice_line_items / payments / payment_allocations /
> refunds family) has been superseded. The canonical specs are **`docs/COMMERCE_AND_BILLING.md`**
> (ledger_entries spine) and **`docs/BILLING_APPROVAL_AND_DRAW.md`** (charges-based money record +
> refunds). Neither uses the payments/invoices table family described here.
> Its Layer-3 tables (§4.1–4.5), created by `20260715140000_billing_canonical_tables.sql`, were
> **dropped by migration `20260720100000_retire_legacy_billing_family.sql`**. Retained for history only.

**Status:** ⛔ SUPERSEDED 2026-07-20 — was: Draft spec — not yet implemented
**Owner:** Derek Shaw (Green Lyzard)
**Version:** v3.1 — adds standard ACH Direct Debit as the preferred tuition rail (async settlement + return handling) and generalizes fee recovery to per-tender dual pricing. (v3: recurring monthly tuition, commitment terms, awards/scholarship engine, points, per-item costumes, tax, CA-compliant fee recovery.)

**Scope (locked):** Unified money layer — enrollment, private lessons, Pilates, shop/merch, credits, awards, and payroll labor all reconcile onto `ledger_entries`.
**Tuition model (locked):** Recurring monthly, billed on the 15th, prorated for partial months. Pay-in-full is an alternative path.
**Line-item types (locked):** Tuition + registration fee + deposits/costumes + bundles/passes/points + merch.

> Spec-first. No code until committed to `docs/`. Implementation follows §22. All money is **integer cents**.

---

## 0. Decisions Locked (this round)

1. **Registration fee** — season default, per family per season; overridable at class level (exempt or custom amount); waivable per student/family via awards.
2. **Tuition** — recurring monthly on the **15th**, prorated for partial months; schedule generated per season. Pay-in-full alternative.
3. **Commitment term** — `month_to_month` (rec) vs `annual` (Company / Studio Company), with admin exceptions.
4. **Drop proration** — month-to-month: admin case-by-case (refund *or* credit); annual: early-exit handling with override.
5. **Costumes/deposits** — per-item: purchase | rental | flat_fee (sometimes per dance); refundable flag + optional deadline; rental deposits are liabilities.
6. **Bundles** — sibling/multi-class discounts + class packs + unlimited passes; packs apply to group, **Pilates, and privates**.
7. **Points** — customer points, both prepaid packs and pay-per-use; teacher-tiered cost; a point has a fixed dollar value.
8. **Awards/discounts engine** — finance_admin+ manages named awards (Cobb Scholarship full/partial, Military, Early-bird w/ override, promos); scholarships surface a prominent parent-facing value total.
9. **Teacher classification** — per teacher: W-2 (`wages_expense`) or 1099 (`contractor_expense`).
10. **Teacher private pay** — flat rate per teacher (no comp-points).
11. **Revenue recognition** — prepaid amounts are liabilities recognized **on consumption**; refunds draw from the unused balance.
12. **Labor attribution** — by scheduled class time.
13. **Sales tax** — on tangible retail goods (merch, snacks, future products); costumes/tuition untaxed.
14. **Fee recovery** — recovered per tender via CA-compliant dual pricing (ACH shown cheaper than card); ACH fees passed through too; debit never surcharged; card capped to cost; counsel-gated. Tuition rail = **standard ACH Direct Debit**.
15. **Failed payments** — keep enrollment active, flag finance_admin; no auto freeze/drop.
16. **Stripe** — credentials in hand.
17. **Drop-ins** — supported as one-time paid attendance; per-class rate via `class_pricing_rules` (label='drop_in'); `drop_ins_enabled` per class; no schedule, no reg fee, recognized immediately; counts toward class capacity; per-student cap (`students.drop_in_limit`, admin-set, null = unlimited).

---

## 1. Design Principles

1. Two layers: swappable processor money-movement vs immutable `ledger_entries` accounting truth.
2. The ledger carries **revenue AND labor** on one dimension set → true per-class/location/production/teacher P&L.
3. **Prepaid = liability until consumed.** Tuition-in-advance, packs, and points sit in liability accounts and recognize on use; refunds are clean.
4. **Recurring is the tuition default;** pay-in-full is a special case, not the base model.
5. Cents everywhere. Processor-agnostic by construction. Family is the billing account.
6. Enrollment is fluid: add/drop/transfer are first-class financial events honoring commitment terms.
7. Every economic event stamps dimensions: `family / class / location / event / teacher / award / discount / period`.
8. Idempotency at every write; tenant isolation on every table; `finance_admin` owns billing/ledger/payroll/awards.

---

## 2. Current Schema Reality (verified — project `niabwaofqsirfsktyyff`)

- **Enrollment:** `enrollment_carts` → `enrollment_cart_items` → `enrollments` (`stripe_payment_intent_id`, `amount_paid_cents`, `billing_plan_type`, `enrollment_type`, `family_id`, `dropped_at`). `families.stripe_customer_id`/`account_credit`. `class_pricing_rules` = deadline-tiered. `bundle_configs` (`is_unlimited`). `seasons` (`registration_open`).
- **Private:** split-brain — `private_session_billing` (`teacher_contribution`, `points_owed`, `market_value`, `studio_contribution`) vs `private_billing_records`/`private_billing_splits`.
- **Shop:** `shop_configs`, `products` (`stripe_price_id`), `shop_orders` — not on ledger.
- **Credits:** `families.account_credit` (numeric) vs `credit_accounts`/`credit_transactions` (integer).
- **Payroll v2:** `pay_periods`, `timesheets`, `timesheet_entries`, `teacher_rate_cards`, `teacher_hours` — not on ledger.
- **Productions:** `productions`, `dances`, `production_dances`, `casting`, `rehearsals` — natural `event_id` referents.
- **Spine:** `ledger_entries` (0 rows) — dimensioned double-entry GL; **needs a `teacher_id` dimension and an `event_id` FK** (§4.20).

---

## 3. Target Architecture

```
   enrollment   private/pilates   shop   payroll approval   award grant   admin adj.
       |             |             |            |               |             |
       v             v             v            v               v             v
 +--------------------------------------------------------------------------------+
 |                          CANONICAL BILLING LAYER                               |
 |  invoices -> line_items      recurring tuition schedule    award_grants        |
 |  installment/plan (pay-in-full)   bundle_entitlements/consumptions (pts/class) |
 |  payments -> allocations     credits    refunds            costume_fees        |
 +--------------------------------------------------------------------------------+
       |   posting service (revenue)                    |  payroll posting service
       v                                                v
 +--------------------------------------------------------------------------------+
 |   LEDGER (ledger_entries): revenue + labor, one truth                          |
 |   dims: family / class / location / EVENT / TEACHER / AWARD / discount / period|
 +--------------------------------------------------------------------------------+
       ^ normalized webhook events
 +--------------------------------------------------------------------------------+
 |  PaymentProcessor (per tenant): Stripe first | Authorize.net | Square | PayPal |
 |  tenders: card | ACH (preferred for tuition) | credit | points | cash          |
 +--------------------------------------------------------------------------------+
```

---

## 4. Canonical Data Model

New tables: `id`, `tenant_id`, `created_at`, `updated_at`, RLS. Money = cents.

### 4.1 `invoices`
`family_id`, `season_id?`, `event_id?`, `source` (`enrollment|private|pilates|shop|manual|tuition_run`), `status` (`draft|open|partially_paid|paid|void|refunded`), `subtotal_cents`, `discount_cents`, `scholarship_cents`, `credit_applied_cents`, `tax_cents`, `surcharge_cents`, `total_cents`, `amount_paid_cents`, `currency`, `location_id?`, `period?` (e.g. `2026-09` for a tuition run), `finalized_at?`, `created_by?`.

### 4.2 `invoice_line_items`
`invoice_id`, `line_type` (§5), `description`, `class_id?`, `enrollment_id?`, `product_id?`, `private_session_id?`, `costume_fee_id?`, `bundle_entitlement_id?`, `award_id?`, `event_id?`, `dance_id?`, `student_id?`, `quantity`, `unit_price_cents`, `pricing_rule_id?`, `discount_cents`, `taxable` (bool), `tax_cents`, `amount_cents`.

### 4.3 `payments`
`family_id`, `processor`, `processor_payment_ref`, `method` (`card|ach|credit|points|cash|check`), `amount_cents`, `fee_cents` (processor cost), `status` (`pending|processing|succeeded|failed|returned|refunded`), `recurring_charge_id?`, `idempotency_key` (unique), `settlement_expected_at?`, `captured_at?`, `returned_at?`, `return_code?`.
*ACH is asynchronous: a payment can sit `processing` for ~4 business days and, rarely, go `succeeded → returned` days later. The `returned` path triggers a ledger reversal (§11.2) and a `finance_admin` reflag.*

### 4.4 `payment_allocations`
`payment_id`, `invoice_id`, `invoice_line_item_id?`, `amount_cents`.

### 4.5 `refunds`
`payment_id`, `amount_cents`, `reason`, `destination` (`card|credit`), `processor_refund_ref?`, `status`, `created_by`.

### 4.6 Recurring tuition — `tuition_schedules`
Per active enrollment (or per family+season). `family_id`, `season_id`, `anchor_day` (default 15), `monthly_amount_cents`, `commitment_type` (`month_to_month|annual`), `status` (`active|paused|ended`), `start_date`, `end_date?`, `processor_payment_method_ref?`, `preferred_tender` (`ach|card`).

### 4.7 `tuition_charges` (the generated calendar of 15ths)
`schedule_id`, `enrollment_id`, `period` (`YYYY-MM`), `due_date`, `amount_cents` (prorated where partial), `proration_note?`, `status` (`scheduled|invoiced|paid|failed|skipped|superseded|credited`), `invoice_id?`, `payment_id?`, `attempts`, `next_retry_at?`, `supersedes_id?`.

### 4.8 Pay-in-full — `prepaid_terms`
Alternative to recurring. `family_id`, `season_id`, `total_cents`, `covered_from`, `covered_to`, `deferred_balance_cents` (unrecognized remainder), `status`. Recognized monthly against delivery (§11.3).

### 4.9 Registration fee config
- `seasons.registration_fee_cents` (season default, per family per season).
- `classes.registration_fee_override_cents` (nullable) + `classes.requires_registration_fee` (bool, default true). A family owing at least one fee-bearing class pays the fee once per season; families in only-exempt classes owe nothing.
- `classes.drop_ins_enabled` (bool, default false) gates whether a class accepts drop-ins; the drop-in price lives in `class_pricing_rules` (label='drop_in').
- `students.drop_in_limit` (int, nullable, admin-set) caps drop-ins before enrollment is required; null = unlimited.

### 4.10 `award_definitions` (scholarships / discounts / comps)
`code`, `name`, `award_class` (`scholarship|discount|comp`), `method` (`percent|fixed|full_waiver|force_price_tier`), `value?`, `scope` (`registration_fee|tuition|private|pilates|merch|all`), `eligibility` (`manual|category|date_based`), `is_scholarship` (bool → counts toward parent banner), `stackable` (bool), `valid_from?`, `valid_to?`, `is_active`.

### 4.11 `award_grants` (instances)
`definition_id`, `family_id?`, `student_id?`, `season_id?`, `granted_by`, `override_reason?`, `status` (`active|expired|revoked`), `effective_from?`, `effective_to?`. Applying a grant emits tagged reduction lines; `award_id` on the line is this grant.

### 4.12 `costume_fees`
`event_id` (production), `dance_id?`, `fee_type` (`purchase|rental|flat_fee`), `amount_cents`, `refundable` (bool), `refund_deadline?`, `label`, `is_active`.

### 4.13 `bundle_entitlements`
`family_id`, `bundle_config_id`, `invoice_id`, `denomination` (`class_count|unlimited|points`), `applies_to` (`group|pilates|private|any`), `credits_total?`, `credits_remaining?`, `points_total?`, `points_remaining?`, `is_unlimited`, `valid_from`, `valid_to`, `status` (`active|expired|exhausted|cancelled`).

### 4.14 `bundle_consumptions`
`entitlement_id`, `enrollment_id?`, `private_session_id?`, `class_id?`, `student_id`, `units?` (class packs), `points_consumed?` (points packs), `consumed_at`, `reversal_of?`.

### 4.15 Points config
- Tenant-level `point_value_cents` (fixed dollar value of one point).
- `teacher_private_rates`: `teacher_id`, `point_cost` (customer points to book a private with this teacher), `flat_payout_cents` (teacher's pay per private — §12.3). Pay-per-use price = `point_cost × point_value_cents`.

### 4.16 `enrollment_changes`
`enrollment_id`, `change_type` (`add|drop|transfer`), `effective_date`, `commitment_type` (copied), `proration_method` (`by_remaining_days|by_remaining_sessions|none`), `gross_adjustment_cents`, `adjustment_kind` (`charge|credit|refund|none`), `adjustment_invoice_id?`, `credit_transaction_id?`, `refund_id?`, `schedule_amended` (bool), `related_change_id?`, `override_reason?`, `created_by`.

### 4.17 Teacher fields
`teachers.payroll_classification` (`w2|1099`). Private payout via `teacher_private_rates.flat_payout_cents`.

### 4.18 Tax
`products.taxable` (bool) + category default; `invoice_line_items.taxable`/`tax_cents`; tuition/costume default untaxed.

### 4.19 `tenant_payment_config` (white-label + fee recovery)
`processor`, `mode`, `credentials_ref` (secret pointer — never raw keys), `is_active`, `ach_enabled` (bool), `ach_type` (`standard`), `preferred_recurring_tender` (`ach`), `fee_recovery_mode` (`none|dual_pricing`), `card_fee_pct` + `card_fee_cap_pct` (≤ actual cost), `ach_fee_pct` + `ach_fee_cap_cents` (mirror Stripe 0.8%/$5), `exclude_debit` (always true), `ca_counsel_approved` (bool — **gates any customer-facing fee**, card or ACH), `statement_descriptor`. Plus `processor_customer_refs` / `processor_product_refs` (de-Stripe-ing).

### 4.20 `ledger_entries` additions
Add dimension **`teacher_id`** and **`award_id`**; add FK **`event_id`** → `productions(id)`. All nullable; migrations §16.

---

## 5. Line-Item Taxonomy

| line_type | account | notes |
|---|---|---|
| `tuition_monthly` | `revenue_tuition` | recognized in the month billed |
| `tuition_prepaid` | `deferred_revenue` | recognized monthly on delivery (§11.3) |
| `drop_in` | `revenue_tuition` | single paid class attendance; one-time, no schedule |
| `registration_fee` | `revenue_registration` | season default / class override |
| `deposit` | `deposit_liability` | until applied/forfeited |
| `costume` | `revenue_costume` | purchase; tags event/dance |
| `costume_rental_deposit` | `deposit_liability` | refundable on return |
| `bundle` | `bundle_liability` | pack/pass; recognized per use |
| `points_pack` | `points_liability` | recognized per private used |
| `private_lesson` | `revenue_private` | dollar or points-funded |
| `merch` | `revenue_merch` | taxable |
| `credit_applied` | (contra) | tenders customer credit |
| `scholarship` | `scholarship_contra` | tagged award; feeds parent banner |
| `discount` | `discounts_contra` | ordinary promo/bundle discount |
| `payment_fee` | `payment_fee_recovery` | per-tender (card or ACH) recovery; dual-pricing display |
| `adjustment` | `revenue_adjustment` | add/drop proration, manual |

---

## 6. Pricing Resolution (per invoice)

1. **Base + deadline tier** from `class_pricing_rules`; record `pricing_rule_id`. An `award_grant` with `force_price_tier` can grant an expired early-bird tier (logged exception).
   - **Drop-in:** if a class has `drop_ins_enabled` and the booking is a single attendance (not an enrollment), price from the class's `class_pricing_rules` row where `label='drop_in'`. Drop-ins skip the registration fee and create no `tuition_schedule`. A drop-in counts toward the class's capacity for that date (capacity check = enrolled + drop-in attendances). Enforce the per-student cap: if `students.drop_in_limit` is set and the student's drop-in attendance count has reached it, block the drop-in and require enrollment.
2. **Registration fee** — season default or class override; once per family per season; skipped if all classes exempt.
3. **Bundle covering** — active pack/points/unlimited entitlement covers the line → charge resolves to $0 (class pack) or points debit (private); consumption row written.
4. **Automatic discount bundles** — sibling/multi-class → `discount` line.
5. **Awards** — apply active `award_grants` (scholarship/military/promo) as `scholarship` or `discount` lines, tagged `award_id`.
6. **Credit** — optional `credit_applied` line.
7. **Tax** — per taxable line.
8. **Card-fee recovery** — only in dual-pricing/surcharge mode and only for card tender (§13).
9. Totals frozen on lines at creation.

---

## 7. Recurring Monthly Tuition (primary flow)

- On enrollment, create/attach a `tuition_schedule` (`anchor_day=15`, `commitment_type`, `preferred_tender=ach`). Generate `tuition_charges` for the season's months.
- **Proration** — first month (late join) and any partial month computed `by_remaining_days` (Amanda may switch to sessions). Full months = `monthly_amount_cents`.
- **Charge run (Vercel cron, daily):** find `tuition_charges` due on/before today with `status='scheduled'` → materialize a monthly `invoice` (`source='tuition_run'`, `period`) → charge the card/ACH on file off-session (idempotency key = `tuition_charge.id`) → post ledger.
- **First payment** at checkout via Stripe Checkout with `setup_future_usage=off_session` to vault the tender; ACH mandate + bank verification collected at setup (Financial Connections, ~$1.50 one-time, or microdeposits).
- **ACH settlement (standard):** charges confirm/settle in ~4 business days; a `tuition_charge` sits `processing` until then. Post `cash_clearing` on `succeeded`, not on initiation. A late **return** (`succeeded → returned`) fires a ledger reversal (§11.2) and reflags `finance_admin` — the same review queue as a hard failure.
- **Failure:** dunning T+1/T+3/T+5; after cycle, **keep enrollment active**, flag `finance_admin` (review queue) — no auto freeze/drop.
- **Commitment:** `month_to_month` charges only while active; `annual` continues the schedule through season end (early exit handled in §9 with override).
- **Drop-ins (one-time):** a single class attendance is a one-time invoice + single payment + an `attendance` record — no `tuition_schedule`, no commitment, no registration fee. Revenue recognized immediately (consumed same day), so it posts to `revenue_tuition`, not `deferred_revenue`. Drop-ins count toward class capacity for that date. A per-student cap (`students.drop_in_limit`, nullable, admin-set; null = unlimited) gates how many drop-ins a student may take before enrollment is required.

**Pay-in-full alternative:** one invoice for the covered term → `prepaid_terms` with `deferred_balance_cents`; recognized monthly (§11.3); no `tuition_charges`.

---

## 8. Bundles, Passes & Points

- **Discount bundle** — pricing-time only (§6.4).
- **Class pack** — `denomination='class_count'`, `applies_to` group/pilates/private; enrollment/booking consumes 1 unit ($0 line), drop reverses.
- **Unlimited pass** — `denomination='unlimited'` within validity; covered enrollments = $0.
- **Points pack** — `denomination='points'`; booking a private debits `teacher_private_rates.point_cost`; **pay-per-use** books without a pack and charges `point_cost × point_value_cents` in dollars.
- **Recognition:** packs/points held in `bundle_liability`/`points_liability`; move to revenue per consumption (§11). Financing: a pack invoice can itself be pay-in-full or (rarely) split.

---

## 9. Add / Drop / Transfer

Captured in `enrollment_changes`.
- **Add** — prorated `adjustment`/`tuition` line from `effective_date`; amend the tuition schedule (supersede future `tuition_charges`, never paid ones); pay-in-full → prorated charge now; pass-covered → consume, $0.
- **Drop (month-to-month)** — compute prorated unused portion; **admin routes it case-by-case as refund or credit** (or waive). Stop future charges; `enrollments.status='dropped'`.
- **Drop (annual)** — schedule continues by default; early exit is an admin action with `override_reason` (owe remaining / fee / waive per Amanda policy).
- **Transfer** — two linked changes (drop A + add B), net difference to one charge/credit; optional transfer fee.
- Pass-covered drops reverse the consumption.

---

## 10. Event & Performance Tagging

`ledger_entries.event_id` and line `event_id` → `productions(id)` (Nutcracker, spring show, intensives). Costume/deposit/performance/merch lines and **all rehearsal/performance payroll** tag the event → `v_event_pnl` = Σ revenue(event) − Σ labor & costs(event). Generalizable to a `billable_events` table later without ledger change.

---

## 11. Ledger Posting Contract

### 11.1 Accounts
Revenue: `revenue_tuition`, `revenue_registration`, `revenue_costume`, `revenue_merch`, `revenue_private`, `revenue_adjustment`.
Liabilities/deferral: `deferred_revenue`, `bundle_liability`, `points_liability`, `deposit_liability`, `customer_credit_liability`.
Contra: `scholarship_contra`, `discounts_contra`, `refunds_contra`.
Cash/asset: `accounts_receivable`, `cash_clearing`, `payment_fee_recovery`, `processing_fees`.
Labor: `wages_expense`, `contractor_expense`, `wages_payable`, `overhead_wages`.
(Removed: `teacher_points_liability` — teachers paid flat cash.)

### 11.2 Revenue & payment recipes (balanced, share one `event_id`; stamp all dims)
1. **Monthly tuition invoiced** — `DR accounts_receivable` / `CR revenue_tuition` (dims class/family/period).
2. **Prepaid tuition taken** — `DR cash_clearing` / `CR deferred_revenue`; **monthly recognition** — `DR deferred_revenue` / `CR revenue_tuition`.
3. **Payment succeeded** — `DR cash_clearing` / `CR accounts_receivable`; stamp ref, `charge_status='captured'`.
4. **Registration fee** — `DR accounts_receivable` / `CR revenue_registration`.
5. **Scholarship/award** — `DR scholarship_contra` (scholarship) or `DR discounts_contra` (discount) / `CR accounts_receivable`; tag `award_id`.
6. **Deposit / rental deposit** — `DR cash_clearing` / `CR deposit_liability`; applied/forfeited → `DR deposit_liability` / `CR revenue_costume`.
7. **Pack/points purchased** — `DR cash_clearing` / `CR bundle_liability`|`points_liability`; **consumed** — `DR bundle_liability`|`points_liability` / `CR revenue_tuition`|`revenue_private`.
8. **Credit** — issue `CR customer_credit_liability`; apply `DR customer_credit_liability` / `CR accounts_receivable`.
9. **Refund** — card `DR refunds_contra` / `CR cash_clearing`; to-credit `DR refunds_contra` / `CR customer_credit_liability`.
10. **Fee recovery** (if enabled, per tender) — `DR cash_clearing` / `CR payment_fee_recovery`.
11. **Processing fee** — `DR processing_fees` / `CR cash_clearing` (payout recon).
12. **ACH return** (late failure after `succeeded`) — reverse recipe 3: `DR accounts_receivable` / `CR cash_clearing`; set payment `returned`, reflag `finance_admin`. (Never delete the original entries — post reversing ones.)

### 11.3 Labor recipes (payroll)
13. **Pay period approved** — per `timesheet_entry`: `DR wages_expense` (W-2) or `contractor_expense` (1099) / `CR wages_payable`. Dims teacher/class/location/event/period. Rate from `teacher_rate_cards` × hours; **multi-class blocks split by scheduled time**.
14. **Payroll disbursed** — `DR wages_payable` / `CR cash_clearing`.
15. **Private payout** — `teacher_private_rates.flat_payout_cents` → `DR contractor_expense`|`wages_expense` / `CR wages_payable`.

### 11.4 Idempotency
Unique `ledger_entries (event_id, account, direction)`; `event_id` derived deterministically from `(source, source_ref, event_kind)`.

---

## 12. Payroll Integration (mandatory)

- Payroll posting service reads approved `timesheets`/`timesheet_entries` → recipes §11.3, stamping the same dims as revenue.
- **Attribution:** class hours → class(es) taught by scheduled time; rehearsal/performance hours → `event_id`; admin → `overhead_wages`.
- **Private rev-share:** revenue side (`revenue_private`, funded by dollars or points) and payout side (flat `contractor/wages_expense`) are two sides of one session; `studio_contribution` is the retained margin.
- **Outputs:** P&L by class, production, and teacher; QBO export carries revenue AND wages → accrual P&L.
- **Reconciliation:** `Σ wages_payable(period) == payroll CSV total`; mismatch → `finance_admin` flag via `review_tier`.

---

## 13. Tax & Card-Fee Recovery (CA-compliant)

### 13.1 Sales tax
Taxable = tangible retail goods (merch, snacks, future products) via `products.taxable`/category. Tuition, fees, costumes untaxed. `tax_cents` per taxable line; Stripe Tax optional later.

### 13.2 Payment-fee recovery — California (card AND ACH)
Recover processing cost on **both tenders** via **dual pricing**, never a surprise checkout fee. CA's all-in pricing law (SB 478) is tender-agnostic: whatever price a customer sees must be the total, so a dripped-in fee is the risk — for cards *and* ACH. Card-network surcharge caps/bans apply only to credit cards; **ACH is not a card**, so those don't bind it, but SB 478 display rules still do. **Design:**
- **Dual pricing by tender** — show each method's all-in total. ACH is displayed **cheaper than card** (ACH ~0.8%/$5-cap vs card ~3%), which both recovers cost and steers families to ACH.
- **Recurring tuition defaults to ACH** (`preferred_recurring_tender='ach'`) — cheapest rail on the largest, most predictable charges.
- `exclude_debit` always true; card fee capped to actual acceptance cost; ACH fee mirrors Stripe (0.8%, $5 cap); disclosed as a `payment_fee` line where itemized.
- **`ca_counsel_approved` gates go-live of any customer-facing fee** (card or ACH). **Not legal advice — confirm current CA rules with counsel before enabling.**

### 13.3 ACH settlement & returns (standard Direct Debit)
- **Async by design:** ~4-business-day confirmation/settlement; a charge sits `processing` until then. Don't recognize cash or treat tuition as paid until `succeeded`.
- **Returns after success:** a payment can go `succeeded → returned` days later (e.g. insufficient funds). Handle via recipe §11.2.12 (reversing entry) + `finance_admin` reflag — the same queue as a hard failure, which is why the "keep enrollment active, flag admin" policy fits ACH cleanly.
- **Setup:** mandate authorization + bank verification once per family (Financial Connections ~$1.50, or microdeposits). New-account ACH draft limits apply for the first 120 days; not a concern while cards remain the majority.

---

## 14. Processor Abstraction

`PaymentProcessor` interface (createCheckoutSession w/ vaulting, ACH mandate, chargeOffSession, refund, verifyWebhook, normalizeWebhook→InternalPaymentEvent). Resolved per tenant from `tenant_payment_config`. Stripe first (Checkout + `us_bank_account` for ACH). Credentials from secret store; raw keys never in Postgres.

---

## 15. Unifying the Surfaces

- **Enrollment** → tuition schedule + registration/costume/bundle lines → recurring charges.
- **Private/Pilates** → keep `private_session_billing` as the economic record; family charge via `private_lesson`/points; payout per §12. Deprecate `private_billing_records`/`splits` as a charging mechanism (migrate).
- **Shop** → mirror `shop_orders` into `invoice` (source=`shop`) with `merch` lines so it posts to the ledger; tag `event_id` for production merch.
- **Credits** → winner is `credit_accounts`/`credit_transactions` (cents); deprecate `families.account_credit`; credit is a tender.

---

## 16. Landmines & Migration

Mixed money units → cents (add→backfill→cutover→drop). Two private models → consolidate. Two credit stores → consolidate. Shop not on ledger → post. Stripe-only columns → shadow into `processor_*_refs`. Ledger missing `teacher_id`/`award_id`/`event_id` FK → add (nullable).
**House rules:** `IF NOT EXISTS`; pre-flight `DO` validation + `RAISE EXCEPTION`; `supabase db push` (regular terminal), never MCP `apply_migration`; regenerate types + `tsc --noEmit`; money conversions add→backfill→cutover→drop.

---

## 17. RLS & Roles

Tenant-scoped; `SECURITY DEFINER` predicates over `profile_roles` (joins on `user_id`). Parent: own family's invoices/payments/schedule/credits/entitlements + **scholarship banner**; add/drop requests; no ledger read. `finance_admin`: billing/ledger/payroll/awards write, refunds, adjustments, dunning queue. `ledger_entries` append-only except reconciliation role; corrections are reversing entries.

---

## 18. Parent Finance Module

Prominent **scholarship-value banner** at top: `Σ` scholarship-tagged reductions (`scholarship_contra`, `is_scholarship` awards) across tuition + privates + fees, per season and lifetime. Below: current balance, upcoming monthly charge + date (the 15th), payment method, entitlement balances (classes/points), invoice/payment history, credit balance.

---

## 19. QBO Export

`ledger_entries.qbo_export_ref` marks synced. Map revenue AND wage accounts → QBO chart; batch by `period`; never re-export. Yields real accrual P&L. Later phase (§22).

---

## 20. Idempotency & Reconciliation

Webhooks dedupe on processor event id. Off-session charges keyed on `tuition_charge.id`. Ledger keyed on `(event_id, account, direction)`. Schedule amendments supersede-not-mutate. Payout recon matches processor payouts to `cash_clearing`, posts fees, flags mismatches; payroll recon per §12.

---

## 21. Open Items

**Numbers to confirm (Amanda):**
- Season registration fee amount.
- Monthly tuition amounts (per class/program) — feeds `tuition_schedules`.
- Point dollar value (`point_value_cents`) and per-teacher `point_cost` + `flat_payout_cents`.
- Costume fee amounts per production/dance.

**Policies to confirm (Amanda / accountant / counsel):**
- Annual early-exit rule (owe remaining vs fee vs waive) and transfer fee.
- Whether **promotions** also show a value to parents or stay silent (scholarships already do).
- Tuition proration basis: calendar days vs class sessions.
- 15th billing-period boundary: covers upcoming vs current month.
- Sales-tax registration/rate handling for retail goods.
- ⛔ **CA counsel sign-off** before enabling any customer-facing fee — card *or* ACH dual pricing. (Defaulting tuition to ACH with **no** added fee needs no sign-off.)

**Resolved:** teacher classification (per-teacher W-2/1099), private pay (flat), revenue recognition (on consumption), labor attribution (scheduled time), failed-payment policy (keep active + flag), Stripe credentials (in hand).

---

## 22. Build Sequence (for Claude Code)

1. Money-unit normalization (cents migrations).
2. Ledger dimensions — `teacher_id`, `award_id`, `event_id` FK; idempotent index.
3. Canonical tables — invoices, line_items, payments, allocations, refunds (+RLS, finance_admin).
4. Registration-fee config (season default + class override) + pricing resolver (§6) and drop-in resolution (per-class `drop_in` rate, per-student cap enforcement, capacity counting), tested vs `class_pricing_rules`. One-time drop-in checkout rides the same one-time invoice+payment path used for pay-in-full (available once Layer 7's checkout lands).
5. Ledger posting service — revenue recipes (§11.2), post from finalized invoice + manual payment.
6. Processor interface + Stripe (Checkout, vaulting, **standard ACH Direct Debit** w/ mandate + verification + `succeeded→returned` handling, webhook normalization); `tenant_payment_config`, `processor_*_refs`.
7. **Recurring monthly tuition** — schedules/charges, proration, cron off-session, dunning + admin flag. *(Revenue live.)*
8. Pay-in-full + deferred recognition.
9. Awards/discounts engine (§4.10–4.11) + scholarship banner (§18).
10. Bundles, passes & points (§8), incl. Pilates/private packs + teacher point costs.
11. Add/drop/transfer (§9), schedule amendment, commitment handling.
12. **Payroll posting service** (§11.3, §12). *(True P&L live.)*
13. Private/Pilates consolidation + rev-share; migrate `private_billing_splits`.
14. Credit consolidation; credit-as-tender.
15. Shop ledger posting.
16. Tax + per-tender fee recovery (dual pricing, card + ACH), counsel-gated.
17. Event/class/teacher P&L views.
18. Payout + payroll reconciliation.
19. QBO export.

Revenue after **7**; awards/points by **10**; true P&L after **12**; the rest hardens without blocking revenue.

---

## 23. Non-Goals

Multi-currency; real-time tax engine; second processor implementation (interface only); dunning UI beyond notifications + queue; teacher payroll self-service.
