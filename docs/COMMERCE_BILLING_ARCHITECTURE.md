# Commerce & Billing Architecture

**Status:** Draft spec — not yet implemented
**Owner:** Derek Shaw (Green Lyzard)
**Scope decision (locked):** Full unified money layer — class enrollment, private lessons, shop/merch, and credits all reconcile onto `ledger_entries`.
**Billing model (locked):** Pay-in-full **and** installment plans at Fall 2026 go-live.
**Line-item types (locked):** Tuition + registration fee + deposits/costumes.

> Spec-first document. No code is written until this is reviewed and committed to `docs/`. Implementation is handled by Claude Code against the build sequence in §17. All money is stored as **integer cents** unless explicitly noted.

---

## 1. Design Principles

1. **Two layers, cleanly separated.**
   - *Money-movement layer* talks to a payment processor and is swappable per tenant.
   - *Accounting layer* (`ledger_entries`) is an immutable double-entry general ledger and is the single source of truth for reporting and QBO export. Nothing reads Stripe to answer "what does this family owe" — it reads the ledger.
2. **Installments are the general case.** Pay-in-full is a plan with `num_installments = 1` due today. One intake path, one idempotent charge path.
3. **Processor-agnostic by construction.** No Stripe-specific assumptions leak into the ledger or the invoice model. Stripe is the first implementation of a `PaymentProcessor` interface, not the architecture.
4. **Cents everywhere.** Integer cents in every money column. The current `numeric` dollar columns are migrated (see §11).
5. **Family is the billing account.** `families` carries the processor customer reference and is the unit that invoices, plans, and credits attach to.
6. **Location is a filter dimension, never an RLS boundary.** `ledger_entries.location_id` is for reporting/splits; it does not gate access.
7. **Idempotency is mandatory at every write** — webhook ingestion, off-session charges, and ledger posting all dedupe on a natural key.
8. **Tenant isolation** on every table via `tenant_id`; parent reads scoped to their family; `finance_admin` for write/reconcile.

---

## 2. Current Schema Reality

Verified against project `niabwaofqsirfsktyyff`. Four payment surfaces already exist:

### 2.1 Class enrollment (Stripe Checkout path)
- `enrollment_carts` — `family_id`, `session_token`, `status`, `stripe_session_id`, `expires_at` (2h TTL).
- `enrollment_cart_items` — `cart_id`, `class_id`, `student_id`, `student_name`, `price_cents`.
- `enrollments` — `stripe_payment_intent_id`, `amount_paid_cents`, `billing_plan_type`, `enrollment_type` (`'full'` default), `family_id`, `enrolled_by`.
- `families` — `stripe_customer_id`, `account_credit` (numeric), `billing_email`, `billing_phone`, `primary_contact_id`.
- `class_pricing_rules` — deadline-tiered pricing per class: `label`, `deadline`, `amount` (numeric), `discount_type`, `discount_value`, `is_base_price`. (13 rows.)
- `bundle_configs` — sibling / multi-class discounts: `trigger_type`, `trigger_value`, `discount_type`, `discount_value`, `is_unlimited`.
- `seasons` — `registration_open`, `is_active`, `program`, `period`; season-scoped enrollment.
- `trial_history` + `enrollments.trial_class_date` — free trial → conversion.

### 2.2 Private lessons — **SPLIT-BRAIN (two models coexist)**
- `private_session_billing` (flat, 2 rows) — `session_id`, `student_id`, `family_id`, `split_percentage`, `amount_owed`, `points_owed`, `market_value`, `studio_contribution`, `teacher_contribution`, `billing_status`, `credit_transaction_id`.
- `private_billing_records` + `private_billing_splits` — a different split-based model with its own `billing_status` **enum** and confirmation flags.

### 2.3 Shop / merch — self-contained, **does not post to ledger**
- `shop_configs`, `products` (`price_cents`, `stripe_price_id`), `shop_orders` (`order_number`, `items` jsonb, `subtotal_cents`/`tax_cents`/`discount_cents`/`total_cents`, `payment_status`, `stripe_payment_intent_id`).

### 2.4 Credits — **TWO representations**
- `families.account_credit` — numeric dollars.
- `credit_accounts` (`balance`, `lifetime_earned`, `lifetime_spent`) + `credit_transactions` (`type`, `amount`, `balance_after`, `reference_id`) — integer.

### 2.5 The spine — `ledger_entries` (0 rows)
Dimensioned double-entry GL, nothing posts to it yet:
`direction`, `account`, `category`, `amount_cents`, `currency`, `period`, `occurred_at`, `posted_at`, `source`, `charge_status` (`'pending'`), `review_tier` (`'auto'`), `stripe_reference`, `qbo_export_ref`, plus dimensions `event_id`, `class_id`, `location_id`, `family_id`, `discount_id`.

---

## 3. Target Architecture

```
                        INTAKE SURFACES
   enrollment cart   private session   shop cart   admin adjustment
          |                 |              |              |
          v                 v              v              v
  +--------------------------------------------------------------+
  |            CANONICAL BILLING LAYER                           |
  |   invoices  ->  invoice_line_items                          |
  |   installment_plans -> installment_schedule                |
  |   payments  ->  payment_allocations                        |
  |   credits (credit_accounts / credit_transactions)          |
  |   refunds                                                   |
  +--------------------------------------------------------------+
          |  (posting service: economic events -> entries)
          v
  +--------------------------------------------------------------+
  |            LEDGER  (ledger_entries)  — source of truth       |
  |            double-entry, dimensioned, QBO-exportable         |
  +--------------------------------------------------------------+
          ^
          |  (normalized webhook events)
  +--------------------------------------------------------------+
  |   PaymentProcessor interface  (per-tenant config)            |
  |   Stripe impl | Authorize.net | Square | PayPal              |
  +--------------------------------------------------------------+
```

The intake surfaces stay surface-specific (an enrollment cart is not a merch cart), but they all **materialize a canonical `invoice`** before any money moves. The processor only ever sees invoices/payments. The ledger only ever sees normalized economic events.

---

## 4. Canonical Data Model (new tables)

All new tables: `id uuid pk`, `tenant_id uuid not null`, `created_at`, `updated_at`, RLS on. Money = integer cents.

### 4.1 `invoices`
| column | type | notes |
|---|---|---|
| family_id | uuid | billing account |
| season_id | uuid null | for tuition invoices |
| source | text | `enrollment` \| `private` \| `shop` \| `manual` |
| status | text | `draft` \| `open` \| `partially_paid` \| `paid` \| `void` \| `refunded` |
| subtotal_cents | int | sum of line items pre-discount |
| discount_cents | int | total discounts applied |
| credit_applied_cents | int | customer credit tendered |
| tax_cents | int | default 0 (services untaxed; merch may tax) |
| total_cents | int | amount payable after discount/credit |
| amount_paid_cents | int | running total from payments |
| currency | text | `usd` |
| location_id | uuid null | reporting dimension |
| finalized_at | timestamptz null | when it left `draft` |
| created_by | uuid null | |

### 4.2 `invoice_line_items`
| column | type | notes |
|---|---|---|
| invoice_id | uuid | |
| line_type | text | see §5 taxonomy |
| description | text | human label |
| class_id | uuid null | tuition lines |
| enrollment_id | uuid null | set post-enrollment |
| product_id | uuid null | merch lines |
| private_session_id | uuid null | private lines |
| student_id | uuid null | who it's for |
| quantity | int | default 1 |
| unit_price_cents | int | resolved price (see §6) |
| pricing_rule_id | uuid null | `class_pricing_rules.id` used |
| discount_id | uuid null | bundle/coupon applied |
| discount_cents | int | default 0 |
| amount_cents | int | `quantity*unit_price - discount` |

### 4.3 `payments`
A money receipt. Many payments may satisfy one invoice (installments/partials).
| column | type | notes |
|---|---|---|
| family_id | uuid | |
| processor | text | `stripe` (per tenant) |
| processor_payment_ref | text | e.g. Stripe PaymentIntent id |
| method | text | `card` \| `credit` \| `cash` \| `check` \| `ach` |
| amount_cents | int | |
| status | text | `pending` \| `succeeded` \| `failed` \| `refunded` \| `partially_refunded` |
| installment_schedule_id | uuid null | set for scheduled charges |
| idempotency_key | text unique | dedupe (see §15) |
| captured_at | timestamptz null | |

### 4.4 `payment_allocations`
Allocates a payment across invoice line items (needed for installments and partial pays).
`payment_id`, `invoice_id`, `invoice_line_item_id` (null = invoice-level), `amount_cents`.

### 4.5 `installment_plans`
| column | type | notes |
|---|---|---|
| family_id | uuid | |
| invoice_id | uuid | the invoice being financed |
| total_cents | int | must equal invoice.total_cents |
| num_installments | int | `1` = pay-in-full |
| cadence | text | `monthly` \| `custom` |
| status | text | `active` \| `completed` \| `defaulted` \| `cancelled` |
| processor_payment_method_ref | text null | vaulted card token |
| created_by | uuid null | |

### 4.6 `installment_schedule`
| column | type | notes |
|---|---|---|
| plan_id | uuid | |
| seq | int | 1..n |
| due_date | date | |
| amount_cents | int | |
| status | text | `scheduled` \| `paid` \| `failed` \| `skipped` \| `refunded` |
| payment_id | uuid null | fk once charged |
| attempts | int | default 0 |
| last_attempt_at | timestamptz null | |
| next_retry_at | timestamptz null | dunning |

### 4.7 `refunds`
`payment_id`, `amount_cents`, `reason`, `destination` (`card` \| `credit`), `processor_refund_ref`, `created_by`, `status`.

### 4.8 `tenant_payment_config` (white-label)
Mirrors the existing `tenant_assistant_config` pattern.
`tenant_id`, `processor` (`stripe`|`authorize_net`|`square`|`paypal`), `mode` (`test`|`live`), `credentials_ref` (pointer to secret in env/secret store — **never store raw keys in DB**), `is_active`, `supports_installments bool`, `statement_descriptor`.

### 4.9 Processor customer/price refs (de-Stripe-ing)
Replace hardcoded `families.stripe_customer_id` and `products.stripe_price_id` reliance with a small mapping so a tenant on Square isn't stuck with Stripe columns:
`processor_customer_refs` (`family_id`, `processor`, `customer_ref`) and `processor_product_refs` (`product_id`, `processor`, `price_ref`).
*Migration keeps the existing Stripe columns readable but treats them as the `stripe` row of these tables. Non-breaking.*

---

## 5. Line-Item Taxonomy (`line_type`)

| line_type | revenue account | notes |
|---|---|---|
| `tuition` | `revenue_tuition` | season/class; may be deferred (see §8) |
| `registration_fee` | `revenue_registration` | per-family or per-student, per season |
| `deposit` | `deposit_liability` | held as liability until applied/forfeited |
| `costume` | `revenue_costume` | production costumes |
| `merch` | `revenue_merch` | shop products; tax-eligible |
| `private_lesson` | `revenue_private` | see §10.2 |
| `credit_applied` | (contra) | negative line; tenders customer credit |
| `discount` | `discounts_contra` | negative line; bundle/coupon |
| `adjustment` | `revenue_adjustment` | admin manual +/- |

---

## 6. Pricing Resolution

Order of operations when building an invoice line for a class:

1. **Base price** — `class_pricing_rules` where `is_base_price = true` for the `class_id`.
2. **Deadline tier** — among rules with a `deadline >= today`, pick the applicable early-bird `amount` (lowest-priced still-valid tier, by `sort_order`). Record the winning `pricing_rule_id` on the line.
3. **Registration fee** — one `registration_fee` line per family per season (dedupe against existing paid invoices for that season). *Amount = Amanda decision, see §16.*
4. **Bundle discount** — after all class lines are added, evaluate `bundle_configs`:
   - `trigger_type` = `sibling_count` or `class_count`; if `trigger_value` met, apply `discount_type`/`discount_value` as a `discount` line.
   - Bundles apply at the **invoice** level across students in a family.
5. **Credit** — if the family has a positive credit balance and elects to apply it, add a `credit_applied` line up to the remaining balance.
6. `total_cents = subtotal - discount - credit_applied + tax`.

All amounts resolved to **cents** at line creation and frozen on the line (immune to later rule edits).

---

## 7. Installment Engine

### 7.1 Why custom, not Stripe Subscriptions
Season tuition is a **fixed total split into known installments**, not open-ended recurring billing. A custom engine (vaulted card + scheduled off-session charges) gives the studio control over cadence, retries, and dunning, and — decisively — **ports to Authorize.net CIM, Square Cards-on-File, and PayPal Vault**. Stripe Subscriptions would lock the white-label product to Stripe.

### 7.2 Flow
1. At checkout, parent selects pay-in-full or a plan. Both create an `invoice` + an `installment_plan` (`num_installments = 1` for pay-in-full).
2. **First charge** goes through a Stripe **Checkout Session** with `setup_future_usage = off_session`, which both collects installment #1 and **vaults the card** onto the family's processor customer. Store the payment-method token in `plan.processor_payment_method_ref`.
3. Generate `installment_schedule` rows: due dates by `cadence`, amounts summing exactly to `total_cents` (put any rounding remainder on installment #1).
4. **Vercel cron (daily)** selects `installment_schedule` rows where `status='scheduled'` and `due_date <= today`, and creates an **off-session PaymentIntent** per row. Idempotency key = `installment_schedule.id` (see §15).
5. On success → mark row `paid`, insert `payment` + `payment_allocations`, post ledger (§8). On failure → `attempts += 1`, set `next_retry_at` (T+1, T+3, T+5). After 3 failures → plan `status='defaulted'`, notify `finance_admin` + parent via existing notifications infra.
6. When the last row is `paid` → plan `status='completed'`, invoice `status='paid'`.

### 7.3 Reconciliation with enrollment
`enrollments.billing_plan_type` records `pay_in_full` | `installment`. Enrollment is created on **first successful payment** (installment #1), not on plan creation — a plan with no first payment never enrolls the student. This preserves the "no enrollment without money" invariant.

---

## 8. Ledger Posting Contract

### 8.1 Accounts (`ledger_entries.account` values)
`accounts_receivable`, `deferred_revenue`, `revenue_tuition`, `revenue_registration`, `revenue_costume`, `revenue_merch`, `revenue_private`, `revenue_adjustment`, `deposit_liability`, `cash_clearing`, `processing_fees`, `customer_credit_liability`, `discounts_contra`, `refunds_contra`.

### 8.2 Event → entry recipes
Each economic event posts a balanced set of entries sharing one `event_id`. Dimensions (`family_id`, `class_id`, `location_id`, `discount_id`, `period`) are stamped on every entry.

1. **Invoice finalized** — per line: `DR accounts_receivable` / `CR revenue_*` (or `deferred_revenue` for tuition if deferral is chosen, §8.3). Discount lines: `DR discounts_contra` / `CR accounts_receivable`. `charge_status='pending'`.
2. **Payment succeeded** — `DR cash_clearing` / `CR accounts_receivable`. Stamp `stripe_reference`, set `charge_status='captured'`.
3. **Processing fee** (at payout reconciliation) — `DR processing_fees` / `CR cash_clearing`.
4. **Credit issued** (goodwill or refund-to-credit) — `DR refunds_contra` (or `revenue_*` reversal) / `CR customer_credit_liability`.
5. **Credit applied** to an invoice — `DR customer_credit_liability` / `CR accounts_receivable`.
6. **Refund to card** — `DR refunds_contra` / `CR cash_clearing`.
7. **Deposit taken** — `DR cash_clearing` / `CR deposit_liability`. **Deposit applied/forfeited** — `DR deposit_liability` / `CR revenue_*`.

### 8.3 Revenue recognition (Amanda/accountant decision, §16)
- **Simple (recommended v1):** recognize tuition revenue at payment. Easiest QBO mapping.
- **Deferred:** post tuition to `deferred_revenue` at invoice, recognize monthly over the season via a cron. Better accrual accuracy; more moving parts. Flag for the accountant.

### 8.4 Idempotent posting
Add a unique guard so an event can't double-post: unique index on `ledger_entries (event_id, account, direction)`. The posting service computes `event_id` deterministically from `(source, source_ref, event_kind)` so a replayed webhook re-derives the same id and no-ops.

---

## 9. Payment Processor Abstraction

Interface (TypeScript, in the app layer — not the DB):

```
interface PaymentProcessor {
  createCheckoutSession(invoice, opts): { url, sessionRef }   // vault on off-session opt
  vaultPaymentMethod(customerRef): methodRef
  chargeOffSession(methodRef, amountCents, idempotencyKey): PaymentResult
  refund(paymentRef, amountCents): RefundResult
  verifyWebhook(payload, sig): boolean
  normalizeWebhook(payload): InternalPaymentEvent   // -> payment.succeeded/failed/refunded
}
```

- Resolved per tenant from `tenant_payment_config`. Stripe is `StripeProcessor`; the interface is the contract new processors implement.
- **Webhook normalization** is the key seam: every processor's webhook maps to a small set of `InternalPaymentEvent`s. The posting service (§8) consumes only normalized events and never touches processor SDKs.
- Credentials resolved from env/secret store via `credentials_ref`; **raw keys never in Postgres**.

---

## 10. Unifying the Four Surfaces

### 10.1 Enrollment
`enrollment_carts`/`enrollment_cart_items` become **draft-invoice builders**. On checkout, materialize an `invoice` (source=`enrollment`) with `tuition` + `registration_fee` (+ `deposit`/`costume` if applicable) lines, create the plan, charge. Post-payment, create `enrollments` and backfill `invoice_line_items.enrollment_id`.

### 10.2 Private lessons — resolve the split-brain
- **Keep** `private_session_billing` as the *economic record* of a session (market value, studio/teacher contribution, points) — it carries data the invoice doesn't.
- **Route the family-facing charge** through the canonical layer: each session produces one or more `invoice_line_items` (`line_type='private_lesson'`), one per paying family. Semi-private splits = multiple line items on **separate family invoices** referencing the same `private_session_id` (this is what `private_billing_splits` was reaching for).
- **Deprecate** `private_billing_records` + `private_billing_splits` as a *charging* mechanism; migrate their open rows into invoice line items. (See §11.)

### 10.3 Shop / merch
`shop_orders` keeps its own intake UX but, on payment, **posts to the ledger** via `merch` lines (currently it doesn't). Two options: (a) generate a lightweight `invoice` mirror per order, or (b) teach the posting service to accept `shop_orders` as a source directly. Recommend (a) for uniformity — one posting path.

### 10.4 Credits — resolve the split-brain
- **Winner:** `credit_accounts` + `credit_transactions`, in **integer cents**.
- **Deprecate** `families.account_credit`; migrate its balance into `credit_accounts` and stop writing it (keep as read-only shadow for one release, then drop).
- Credit is a **tender**, not revenue: applying it hits `customer_credit_liability` (§8), never a revenue account.

---

## 11. Landmine Resolutions & Migration Approach

| Landmine | Resolution |
|---|---|
| Mixed money units (`class_pricing_rules.amount`, credit/private `numeric`) | Convert all to integer cents. Add `*_cents` columns, backfill `round(x*100)`, cut readers over, drop old columns in a later migration. |
| Two private-billing models | Consolidate per §10.2; migrate `private_billing_splits` → `invoice_line_items`. |
| Two credit stores | Consolidate per §10.4; migrate `families.account_credit` → `credit_accounts`. |
| `shop_orders` not on ledger | Post via §10.3(a). |
| Stripe-specific columns | Shadow into `processor_*_refs` per §4.9 (non-breaking). |

**Migration safety (house rules):**
- Every migration `IF NOT EXISTS`; no forward FK references to unconfirmed tables.
- Pre-flight `DO` block validating row integrity before altering constraints; `RAISE EXCEPTION` on bad rows.
- Applied via `supabase db push` (regular terminal) — **never** MCP `apply_migration`. Repair with `supabase migration repair` if drift occurs.
- Regenerate types + `tsc --noEmit` after each schema change.
- Money-unit conversions ship as **add → backfill → cutover → drop** across separate migrations, never a single destructive alter.

---

## 12. Refunds, Credits, Dunning

- **Refund destination** is a choice per refund: back to card (`refunds_contra`/`cash_clearing`) or to customer credit (`refunds_contra`/`customer_credit_liability`). Studios usually prefer credit.
- **Dunning** on installment failure: retry schedule T+1/T+3/T+5, parent + `finance_admin` notifications, plan `defaulted` after 3. Enrollment status on default = Amanda decision (freeze vs drop).
- **Proration** on mid-season drop = Amanda policy (§16); model as an `adjustment` line + refund/credit.

---

## 13. RLS & Roles

- All new tables `tenant_id`-scoped; helper predicates are `SECURITY DEFINER` functions over `profile_roles` (avoids the known RLS recursion).
- **Parent:** read own family's invoices/payments/plans/credits; initiate checkout; no ledger read.
- **finance_admin:** full read/write on billing + ledger, reconciliation, refunds, manual adjustments.
- **admin/super_admin:** as today.
- `ledger_entries` is **append-only** for everyone except a reconciliation service role; corrections are reversing entries, never updates/deletes.
- `profile_roles` joins on `user_id` (not `profile_id`).

---

## 14. QBO Export

- `ledger_entries.qbo_export_ref` marks synced entries.
- Map internal accounts → QBO chart of accounts (config table or `tenant_payment_config` extension).
- Export cadence: batch by `period`; push journal entries (or invoices+payments) per QBO's model; stamp `qbo_export_ref` on success; never re-export a stamped entry.
- Deferred to a later phase (§17) — the ledger design makes it additive.

---

## 15. Idempotency & Reconciliation

- **Webhook ingestion:** dedupe on processor event id; store processed ids.
- **Off-session charges:** `idempotency_key = installment_schedule.id` passed to the processor AND unique on `payments.idempotency_key`.
- **Ledger posting:** deterministic `event_id` + unique `(event_id, account, direction)` index (§8.4).
- **Payout reconciliation:** daily job matches processor payouts to `cash_clearing`, posts `processing_fees`, flags mismatches for `finance_admin` (`review_tier` on the ledger supports this).

---

## 16. Open Decisions for Amanda / Accountant

Blockers marked ⛔ (needed before that piece ships); others can default.

1. ⛔ **Registration fee** — amount, per-family vs per-student, per-season vs annual.
2. ⛔ **Installment cadence & count** — e.g. monthly over the season? Any plan/finance fee? First payment due at checkout?
3. ⛔ **Deposit/costume policy** — refundable? forfeited when? applied to which production?
4. **Revenue recognition** — simple (at payment) vs deferred over season (§8.3). Accountant call.
5. **Refund/proration policy** on mid-season drop.
6. **Default policy** — freeze vs drop enrollment after installment default.
7. **Merch tax** — collect sales tax on shop orders? (Stripe Tax later if yes.)
8. **Verify BAM's existing Stripe account credentials** before wiring test keys.

---

## 17. Layered Build Sequence (for Claude Code)

Each layer is independently shippable and testable. Do not start a layer until the prior one's types regenerate clean.

1. **Money-unit normalization** — cents migrations for `class_pricing_rules`, credit tables, private tables (add→backfill only; cutover later).
2. **Canonical tables** — `invoices`, `invoice_line_items`, `payments`, `payment_allocations`, `refunds` (+ RLS, `finance_admin` policies).
3. **Pricing resolver** — service that turns a cart into invoice lines (§6), unit-tested against the 13 `class_pricing_rules` rows.
4. **Ledger posting service** — event→entry recipes (§8), idempotent index (§8.4). Post from a finalized invoice + a manual payment first (no processor yet).
5. **Processor interface + Stripe impl** — `tenant_payment_config`, `processor_*_refs`, Checkout Session with vaulting, webhook normalization.
6. **Enrollment checkout wired end-to-end** — cart → invoice → Checkout → webhook → payment → ledger → enrollment. (This is "turn checkout on," now on the unified spine.)
7. **Installment engine** — `installment_plans`/`installment_schedule`, Vercel cron off-session charges, dunning + notifications.
8. **Credit consolidation** — migrate `families.account_credit`, wire credit-as-tender.
9. **Private-lesson consolidation** — route through invoices, migrate `private_billing_splits`.
10. **Shop ledger posting** — mirror `shop_orders` into invoices/ledger.
11. **Payout reconciliation** — fees + mismatch flags.
12. **QBO export** — mapping + batch sync.

Payment can go live after **layer 6**; installments after **7**; the rest hardens and unifies without blocking revenue.

---

## 18. Non-Goals (this spec)

- Multi-currency (usd only for now; `currency` column reserved).
- Real-time sales-tax calculation (deferred).
- Second processor implementation (interface only; Stripe first).
- Dunning UI beyond notifications (finance_admin manual tools first).
