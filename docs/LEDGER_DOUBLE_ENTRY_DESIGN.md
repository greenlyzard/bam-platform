# Ledger Foundation — Double-Entry Corrective Design & Adversarial Review

**Status:** Design + findings doc (no code). Corrective design for the double-entry ledger.
**Decision context:** Option A (true double-entry) is **already chosen** — this doc makes it correct, complete, and safe to migrate to. It is not a re-litigation of single vs double.
**Specs:** `COMMERCE_BILLING_ARCHITECTURE.md` v3.1 §11 + `COMMERCE_BILLING_ADDENDUM_v4.md` (addendum wins on conflict).
**Verified against live DB (`niabwaofqsirfsktyyff`, 2026-07-15):** `ledger_entries.direction` CHECK = `('revenue','expense')`; `charge_status` CHECK = `('pending','approved','charged','failed','void','recorded')` (**no `captured`**); partial index `UNIQUE(event_id, account, direction) WHERE event_id IS NOT NULL`; Layer-1 checkout webhook already writes single-entry rows (`direction='revenue'`, `account='tuition'`, `charge_status='charged'`); ledger row count ≈ 0.

> All money is **integer cents**. Postgres/Supabase. RLS via `SECURITY DEFINER` helpers over `profile_roles` (join `user_id`). Migrations via `supabase db push` only.

---

## 1. FINDINGS (severity-ranked)

### P0 — Blocking / correctness-critical

**P0-1 — The Layer-2 idempotency index is not just insufficient, it is actively wrong.**
`UNIQUE(event_id, account, direction) WHERE event_id IS NOT NULL` (spec §11.4 / live index) has **two** fatal problems:
- **No protection for the common case.** Tuition, registration, payment, merch, payroll — the vast majority of postings — have `event_id IS NULL`, so the partial index protects *nothing*. Retries/concurrent webhook deliveries double-post silently (violates req (e)).
- **It rejects legitimate entries for the event case.** For an event (e.g. "Nutcracker @ San Juan Hills"), the key `(event_id, account, direction)` permits **only one** `revenue_costume` credit *ever*. The second family's costume revenue for the same event → unique violation → insert fails. A real ledger has *many* entries per event/account. This index makes correct operation impossible. **Must be dropped** and replaced with a per-leg `posting_key` (P0-4).

**P0-2 — `direction ∈ ('revenue','expense')` cannot represent double-entry.** Balance-sheet legs (`accounts_receivable`, `cash_clearing`, `deferred_revenue`, all liabilities) are neither revenue nor expense. §11.2 recipes (DR AR / CR revenue; DR cash / CR AR) are unrepresentable. `direction` domain must become **`('debit','credit')`**.

**P0-3 — Changing the `direction` CHECK will break live checkout unless sequenced with a code change.** The Layer-1 webhook inserts `direction='revenue'`. The moment the CHECK becomes `('debit','credit')`, those inserts throw → **checkout finalization breaks in production**. Migration MUST be coordinated with repointing/disabling that webhook (see §4). This is the single biggest operational hazard.

**P0-4 — No idempotency key and no leg-grouping → non-idempotent, un-auditable, un-reversible.** There is no way to (a) dedupe a replayed posting atomically under concurrency, (b) tie the legs of one economic event together, or (c) reverse a whole transaction. Requires `posting_key` (unique, deterministic), `entry_group_id` (ties legs), `reversal_of` (points a reversing group at the original). Check-then-insert is not enough under concurrency — only a DB `UNIQUE` constraint is race-safe.

**P0-5 — `postInvoiceFinalized` cannot be "per line: DR AR / CR revenue_*".** Reduction lines (`discount`, `scholarship`, `credit_applied`) *reduce* AR and must be `DR contra|liability / CR accounts_receivable`. Deferral/liability lines (`tuition_prepaid`, `deposit`, `bundle`, `points_pack`, `costume_rental_deposit`) must credit **liability** accounts, not revenue. A blanket recipe 1 mis-states revenue and unbalances the invoice. The finalize posting must be **line-type-aware** (§3).

**P0-6 — Credit issuance (recipe §11.2.8) is written as a single leg (`CR customer_credit_liability`).** A one-legged entry never balances. Credit issuance needs a debit counterparty that depends on *source*: goodwill (DR an expense/`discounts_contra`), refund-to-credit (DR `refunds_contra`), or overpayment (DR `cash_clearing`). Must be three distinct balanced recipes (§3).

**P0-7 — `charge_status='captured'` is rejected by the live CHECK,** and more fundamentally, a *charge lifecycle* status does not belong on an immutable GL line. Ledger entries are facts; their only lifecycle is **posted → reversed**. Charge/settlement status belongs on `payments`/`invoices`. Repurpose to a ledger `status ∈ ('posted','reversed')` and stop overloading `charge_status` (§2).

**P0-8 — Taxable sales have no tax liability path.** Selling merch currently would credit only `revenue_merch`; there is no `sales_tax_payable`. Collected sales tax booked as revenue overstates income and mis-states the tax return. Needs `sales_tax_payable` (+ `use_tax_payable`) and split recipes (§3).

### P1 — Serious

**P1-1 — §11.1 misclassifies two accounts.** `payment_fee_recovery` (fee-recovery **income**, normal credit) and `processing_fees` (an **expense**, normal debit) are listed under "Cash/asset." If treated as assets they will never appear on the P&L and `cash_clearing` won't tie out. Reclassify (§2).

**P1-2 — `cash_clearing` is overloaded and never drained to a real bank account.** It is used for Stripe settlement *and* payroll disbursement (§11.3.14). No recipe moves `cash_clearing → cash_operating` (bank) on a Stripe payout. It will accumulate forever and the trial balance won't reconcile to the bank. Add a distinct **`cash_operating`** (bank) account and a **payout** recipe; pay payroll from `cash_operating`, not `cash_clearing` (§3).

**P1-3 — Invoice-time vs cash-time legs are inconsistent across recipes.** Recipes 1/4 go through AR; recipes 2/6/7 jump straight to `cash_clearing`, skipping AR. This double-standard makes AR meaningless and breaks tick-and-tie. Standardize: **invoice finalize always hits AR; payment always moves AR→cash** (§3).

**P1-4 — No equity/opening-balance account → periods can't close or roll forward.** Tick-and-tie (req (b)) needs balances to roll into a closing/opening figure. Without `opening_balance_equity` / `retained_earnings`, month-close and year roll-forward have nowhere to land (§2, §6).

**P1-5 — Append-only is asserted but not enforced.** RLS `USING` gates row *visibility*, not immutability. Blocking `UPDATE`/`DELETE` needs an explicit trigger or `REVOKE`. Without it "append-only" (req (f)) is aspirational.

**P1-6 — Deferred-revenue recognition needs an idempotent driver.** Recognizing prepaid tuition monthly (DR `deferred_revenue` / CR `revenue_tuition`) must be keyed per `(prepaid_term, period)` so a re-run of the recognition job doesn't double-recognize. Coherent *only* with `posting_key` (P0-4).

**P1-7 — Refund uses a single `refunds_contra` bucket,** losing which revenue account/period was refunded. Acceptable for a contra rollup but weakens per-category P&L and period matching; note for reporting.

### P2 — Watch

- **P2-1 — Single currency assumed.** `currency` exists but recipes/trial-balance assume USD; cross-currency legs can't net. Constrain to USD for now; document.
- **P2-2 — `event_id` FK is mid-repoint.** Layer-2 set `event_id → productions`; addendum §J supersedes to `event_id → event_tags` (leaf, roll-up at query). Orthogonal to double-entry but the P&L views (§6) must roll up the tag tree, not join productions.
- **P2-3 — `amount_cents` must stay positive;** signed adjustments are expressed by flipping `direction`, never by negative amounts (keeps `Σdebit==Σcredit` and trial balance sane).
- **P2-4 — Jurisdiction for tax is not a ledger dimension.** Tax rate is jurisdictional; the ledger has `location_id` but no explicit tax-jurisdiction. Use `location_id` as the jurisdiction proxy + a config table (§2/§6); confirm CA rules with an accountant.

---

## 2. CORRECTED LEDGER DESIGN

### 2.1 Column changes to `ledger_entries`

| Column | Change | Rationale |
|---|---|---|
| `direction` | CHECK → **`('debit','credit')`** | double-entry legs (P0-2) |
| `amount_cents` | keep `integer NOT NULL`, **always > 0** | sign carried by `direction` (P2-3) |
| `account` | keep `text NOT NULL` (was nullable) — value from the chart in §2.2 | every leg names a GL account |
| `status` | **ADD** `text NOT NULL DEFAULT 'posted'` CHECK `('posted','reversed')` | ledger lifecycle (P0-7) |
| `charge_status` | **deprecate** (drop NOT NULL; stop writing) | belongs on `payments`/`invoices` (P0-7) |
| `entry_group_id` | **ADD** `uuid NOT NULL` | ties the legs of one economic event; unit of balance, reversal, QBO journal (P0-4) |
| `posting_key` | **ADD** `text NOT NULL` | deterministic per-leg idempotency key (P0-4) |
| `reversal_of` | **ADD** `uuid NULL` → self (`entry_group_id` of the original) | ACH return / refund reversing entries (req (e)) |
| `source` | keep `text` — `enrollment\|tuition_run\|private\|pilates\|shop\|payroll\|payout\|manual\|adjustment\|tax_remittance` | which producer emitted it |
| `event_id` | unchanged here; repoint to `event_tags` per addendum §J (separate migration, P2-2) | — |
| dims | keep `family_id, student_id?, class_id, location_id, event_id, teacher_id, award_id, discount_id, period` | P&L (req (c)) |

**Indexes:** DROP `idx_ledger_entries_event_account_direction`. ADD `UNIQUE(tenant_id, posting_key)` (race-safe idempotency), `INDEX(entry_group_id)`, `INDEX(tenant_id, period, account)` (trial balance), `INDEX(tenant_id, account, direction)`.

**`posting_key` construction (deterministic):** `"{source}:{source_ref}:{leg}"`, e.g. `inv:{invoice_id}:ar`, `inv:{invoice_id}:line:{line_id}:rev`, `pay:{payment_id}:cash`, `pay:{payment_id}:ar`, `achret:{payment_id}:ar`, `recog:{prepaid_term_id}:{period}:def`. A replay produces the same key → `UNIQUE` rejects the duplicate → caught and treated as no-op.

### 2.2 Authoritative Chart of Accounts

Normal balance: **D** = increased by debit (assets, expenses, contra-revenue), **C** = increased by credit (liabilities, revenue, equity).

| Account | Type | Normal | Notes |
|---|---|---|---|
| `accounts_receivable` | Asset | **D** | family owes; opened at invoice finalize, cleared at payment |
| `cash_clearing` | Asset | **D** | Stripe in-transit (post on `succeeded`, not initiation) |
| `cash_operating` | Asset | **D** | **NEW** — real bank; Stripe payout & payroll land here (P1-2) |
| `discounts_contra` | Contra-revenue | **D** | ordinary promo/bundle discounts |
| `scholarship_contra` | Contra-revenue | **D** | scholarships/comps; feeds parent banner; `award_id` |
| `refunds_contra` | Contra-revenue | **D** | refunds/returns |
| `revenue_tuition` | Revenue | **C** | |
| `revenue_registration` | Revenue | **C** | |
| `revenue_private` | Revenue | **C** | dollar or points-funded |
| `revenue_costume` | Revenue | **C** | |
| `revenue_merch` | Revenue | **C** | net of tax |
| `revenue_performance` | Revenue | **C** | addendum §I |
| `revenue_competition` | Revenue | **C** | addendum §I |
| `revenue_adjustment` | Revenue | **C** | manual/add-drop proration |
| `payment_fee_recovery` | Revenue | **C** | **reclassified** from "cash/asset" (P1-1) |
| `deferred_revenue` | Liability | **C** | prepaid tuition; recognized on delivery |
| `deposit_liability` | Liability | **C** | deposits / rental deposits |
| `bundle_liability` | Liability | **C** | class packs/passes; recognized per use |
| `points_liability` | Liability | **C** | points packs (entitlement-only, addendum §D) |
| `customer_credit_liability` | Liability | **C** | account credit as a tender |
| `wages_payable` | Liability | **C** | accrued unpaid labor |
| `sales_tax_payable` | Liability | **C** | **NEW** — collected sales tax; never revenue (P0-8) |
| `use_tax_payable` | Liability | **C** | **NEW** — self-assessed use tax owed on consumed goods |
| `wages_expense` | Expense | **D** | W-2 labor |
| `contractor_expense` | Expense | **D** | 1099 labor |
| `overhead_wages` | Expense | **D** | admin labor |
| `processing_fees` | Expense | **D** | **reclassified** from "cash/asset" (P1-1) |
| `use_tax_expense` | Expense | **D** | **NEW** — cost side of a use-tax accrual |
| `opening_balance_equity` | Equity | **C** | **NEW** — period close / roll-forward landing (P1-4) |
| `retained_earnings` | Equity | **C** | **NEW** — year-end net income close |

The chart lives in a small governed table (`ledger_accounts`: `code` PK-ish, `account_type`, `normal_balance`, `qbo_account`, `is_active`) so the QBO mapping (§5) and view classification are data, not hardcoded. **Tax rate config** lives in `tax_rates` (`jurisdiction`, `location_id?`, `rate_bps`, `effective_from`, `kind ('sales'|'use')`, `is_active`) — configurable, not hardcoded (P2-4); confirm CA rates with an accountant.

### 2.3 `charge_status` reconciliation ('charged' vs 'captured')

Neither belongs on the ledger. Resolution: ledger carries only `status ∈ ('posted','reversed')`. The **payment** lifecycle (`pending → processing → succeeded → returned/refunded`) lives on `payments.status`; **invoice** lifecycle (`draft → open → partially_paid → paid → void → refunded`) on `invoices.status`. Backfill note: existing rows' `charge_status='charged'` → set `status='posted'` (§4).

---

## 3. POSTING RECIPES (balanced; every group nets to zero)

Convention: each row is `DR account` / `CR account` `amount`; every recipe is one `entry_group_id`; `Σ debit == Σ credit`. Dimensions stamped on each leg noted after `→`.

### Revenue & AR

**R1 — Invoice finalized (line-type-aware; corrects P0-5).** One group per invoice; one leg-pair per line, all sharing the AR account so the invoice nets to zero.
| Line type | Debit | Credit | Dims (both legs) |
|---|---|---|---|
| charge line (`tuition_monthly`,`registration_fee`,`revenue_costume`,`merch` net,`private_lesson`,`performance`,`competition`) | `accounts_receivable` | `revenue_*` | family/student/class/location/event/teacher/period |
| `tuition_prepaid` | `accounts_receivable` | `deferred_revenue` | family/period |
| `deposit`,`costume_rental_deposit` | `accounts_receivable` | `deposit_liability` | family/event |
| `bundle` | `accounts_receivable` | `bundle_liability` | family |
| `points_pack` | `accounts_receivable` | `points_liability` | family |
| **tax on taxable line** | `accounts_receivable` | `sales_tax_payable` | family/location(jurisdiction)/period |
| `discount` | `discounts_contra` | `accounts_receivable` | family/discount_id |
| `scholarship` | `scholarship_contra` | `accounts_receivable` | family/award_id |
| `credit_applied` | `customer_credit_liability` | `accounts_receivable` | family |
Net AR of the group = invoice `total_cents`; `Σdebit==Σcredit` by construction (every leg's counterparty is AR). Assert equality in code before insert.

**R2 — Payment succeeded (card, or ACH on settlement).** DR `cash_clearing` / CR `accounts_receivable` = `amount_cents`. → family; `posting_key = pay:{payment_id}:*`. (For ACH, post only on `succeeded`, never on initiation — P1-3/§13.3.) Balanced (1 DR, 1 CR).

**R3 — Stripe payout to bank (NEW; fixes P1-2).** DR `cash_operating` (net) + DR `processing_fees` (fees) / CR `cash_clearing` (gross). Nets to zero; drains the clearing account so it ties to the bank.

**R4 — Fee recovery collected (if enabled).** DR `cash_clearing` / CR `payment_fee_recovery`. Balanced; `payment_fee_recovery` is revenue (P1-1).

### Deferred & liability recognition

**R5 — Recognize prepaid tuition (monthly).** DR `deferred_revenue` / CR `revenue_tuition`, per `(prepaid_term, period)`. `posting_key = recog:{prepaid_term_id}:{period}:rev`. Idempotent per period.

**R6 — Deposit applied / forfeited.** DR `deposit_liability` / CR `revenue_costume` (applied) or `revenue_adjustment` (forfeited). Balanced.

**R7 — Bundle/points consumed.** DR `bundle_liability`|`points_liability` / CR `revenue_tuition`|`revenue_private`, at the per-use value. Balanced; `posting_key = consume:{entitlement_id}:{consumption_id}`.

### Credit (fixes P0-6 — three sourced recipes)

**R8a — Credit issued as goodwill.** DR `discounts_contra` (or a `promotions_expense` if preferred) / CR `customer_credit_liability`.
**R8b — Credit issued from a refund-to-credit.** DR `refunds_contra` / CR `customer_credit_liability` (this is the "to-credit" branch of R10).
**R8c — Credit from overpayment.** DR `cash_clearing` / CR `customer_credit_liability`.
**R8d — Credit applied to an invoice.** DR `customer_credit_liability` / CR `accounts_receivable` (also the `credit_applied` row in R1).
All balanced.

### Refunds & reversals (req (e) — reversing entries, never delete/update)

**R9 — Refund to card.** DR `refunds_contra` / CR `cash_clearing`. `reversal_of` = original payment group; `posting_key = refund:{refund_id}`.
**R10 — Refund to credit.** DR `refunds_contra` / CR `customer_credit_liability` (= R8b).
**R11 — ACH return (`succeeded → returned`).** Reverse R2: DR `accounts_receivable` / CR `cash_clearing`; new group, `status='posted'`, `reversal_of` = the R2 group; original stays untouched; set `payments.status='returned'`, reflag `finance_admin`. `posting_key = achret:{payment_id}:ar`. Balanced.

### Labor (req (d))

**R12 — Payroll accrued (period approved).** Per `timesheet_entry`: DR `wages_expense`|`contractor_expense`|`overhead_wages` / CR `wages_payable`. → teacher/class/location/event/period. Balanced.
**R13 — Payroll disbursed.** DR `wages_payable` / CR `cash_operating` (**bank**, not `cash_clearing` — P1-2). Balanced.

### Tax (NEW — req: sales & use tax)

**R14 — Taxable merch sale.** (Tax split shown inline in R1.) Standalone form: DR `accounts_receivable` (gross) / CR `revenue_merch` (net) + CR `sales_tax_payable` (tax). Gross = net + tax → balanced.
**R15 — Sales-tax remittance to the state.** DR `sales_tax_payable` / CR `cash_operating`. Balanced; drives the payable to zero for the filed period.
**R16 — Use-tax accrual** (studio consumes taxable goods with no tax charged). DR `use_tax_expense` / CR `use_tax_payable`. → location(jurisdiction)/period. Balanced.
**R17 — Use-tax remittance.** DR `use_tax_payable` / CR `cash_operating`. Balanced.

> Every recipe above is a single `entry_group_id` with `Σdebit==Σcredit`. The posting service asserts equality *before* insert and relies on `UNIQUE(tenant_id, posting_key)` for idempotency/concurrency.

---

## 4. MIGRATION PLAN

Ledger is ≈0 rows → favor the **clean correct path** (delete the single-entry rows; do not backfill fake counter-legs).

**Ordering hazard (P0-3): the CHECK change breaks the live webhook.** Sequence:
1. **Code first (separate task, must land before step 3):** repoint the Layer-1 checkout webhook to the new double-entry posting service (or feature-flag it off). Until then it writes `direction='revenue'`, which the new CHECK rejects → checkout 500s.
2. **Migration `<ts>_ledger_double_entry.sql` (guarded, re-runnable):**
   - `DELETE FROM ledger_entries;` (≈0 rows; guard: only proceed if `count < N` via a `DO $$ ... RAISE EXCEPTION` preflight, so we never wipe a populated ledger).
   - `DROP INDEX IF EXISTS idx_ledger_entries_event_account_direction;`
   - `ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_direction_check;`
     `ADD CONSTRAINT ledger_entries_direction_check CHECK (direction IN ('debit','credit'));`
   - `ADD COLUMN IF NOT EXISTS entry_group_id uuid;` `ADD COLUMN IF NOT EXISTS posting_key text;` `ADD COLUMN IF NOT EXISTS reversal_of uuid;` `ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';`
   - status CHECK `('posted','reversed')`; make `account` `NOT NULL`; `entry_group_id`/`posting_key` `NOT NULL` (safe now — table empty).
   - `ALTER COLUMN charge_status DROP NOT NULL;` (deprecate; stop writing).
   - `CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_posting_key ON ledger_entries(tenant_id, posting_key);`
   - `CREATE INDEX IF NOT EXISTS ix_ledger_group ON ledger_entries(entry_group_id);`
   - `CREATE INDEX IF NOT EXISTS ix_ledger_tb ON ledger_entries(tenant_id, period, account);`
   - append-only trigger: `BEFORE UPDATE OR DELETE` → `RAISE EXCEPTION` unless a `reconciliation` role (P1-5); corrections are reversing groups only.
   - seed `ledger_accounts` (chart §2.2) + `tax_rates` (empty; admin fills after accountant).
   - `NOTIFY pgrst, 'reload schema';`
3. **Type regen + `tsc`**, then the posting service (separate build) writes via §3 recipes.

Existing single-entry rows: **deleted, not migrated** (they carry no counter-leg, no `entry_group_id`; reconstructing balanced pairs from them is guesswork). Because count ≈ 0 and no month has closed, this is lossless in practice; the preflight `RAISE EXCEPTION` guard prevents accidental wipe if that assumption is ever false.

**event_id repoint (addendum §J):** separate migration (`event_id → event_tags`), independent of this one; do not couple.

---

## 5. QBO EXPORT MAPPING

Each **`entry_group_id`** → **one QBO Journal Entry** (its legs = the JE lines, each `Debit`/`Credit` = `direction`, `amount_cents/100`, `Account` = `ledger_accounts.qbo_account`, class/location = QBO Class/Location from dims). Batch **by `period`**; one export run per (tenant, period).

| Ledger account(s) | QBO account | QBO type |
|---|---|---|
| `revenue_*` | Income accounts (Tuition, Registration, Private, Costume, Merch, Performance, Competition) | Income |
| `payment_fee_recovery` | "Fee Recovery Income" | Income |
| `discounts_contra`,`scholarship_contra`,`refunds_contra` | contra-income / "Discounts", "Scholarships", "Refunds" | Income (contra) |
| `accounts_receivable` | Accounts Receivable | A/R |
| `cash_clearing` | "Undeposited Funds / Stripe Clearing" | Bank/Other Current Asset |
| `cash_operating` | Operating Checking | Bank |
| `deferred_revenue` | "Deferred Revenue" | Other Current Liability |
| `deposit_liability`,`bundle_liability`,`points_liability`,`customer_credit_liability` | matching liability accounts | Other Current Liability |
| `wages_payable` | "Payroll Liabilities" | Other Current Liability |
| **`sales_tax_payable`** | **"Sales Tax Payable"** | **Other Current Liability** (never Income) |
| **`use_tax_payable`** | **"Use Tax Payable"** | **Other Current Liability** |
| `wages_expense`,`contractor_expense`,`overhead_wages` | Payroll/Contractor expense | Expense |
| `processing_fees` | "Merchant Processing Fees" | Expense |
| `use_tax_expense` | "Use Tax Expense" | Expense |
| `opening_balance_equity`,`retained_earnings` | Opening Balance Equity / Retained Earnings | Equity |

**Re-export prevention:** set `qbo_export_ref` on **every leg of a group** when the group's JE is accepted by QBO (store the QBO JE id). Export queries filter `WHERE qbo_export_ref IS NULL`; a group is atomic (all legs get the ref or none). A reversing group exports as its own JE. Never mutate an exported group.

---

## 6. TICK-AND-TIE / CLOSE DESIGN (SQL views)

**V1 — Trial balance (proves `Σdebit==Σcredit`), per period × account:**
```sql
CREATE OR REPLACE VIEW v_ledger_trial_balance AS
SELECT tenant_id, period, account,
       SUM(amount_cents) FILTER (WHERE direction='debit')  AS debit_cents,
       SUM(amount_cents) FILTER (WHERE direction='credit') AS credit_cents,
       SUM(CASE direction WHEN 'debit' THEN amount_cents ELSE -amount_cents END) AS net_debit_cents
FROM ledger_entries WHERE status='posted'
GROUP BY tenant_id, period, account;
-- Close gate: for each (tenant, period), SUM(debit_cents)=SUM(credit_cents) MUST hold.
```

**V2 — Balance roll-forward (opening + activity = closing), per account:**
```sql
CREATE OR REPLACE VIEW v_account_rollforward AS
WITH activity AS (
  SELECT tenant_id, account, period,
         SUM(CASE direction WHEN 'debit' THEN amount_cents ELSE -amount_cents END) AS net_debit_cents
  FROM ledger_entries WHERE status='posted'
  GROUP BY tenant_id, account, period)
SELECT tenant_id, account, period, net_debit_cents,
       SUM(net_debit_cents) OVER (
         PARTITION BY tenant_id, account ORDER BY period
         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS opening_cents,
       SUM(net_debit_cents) OVER (
         PARTITION BY tenant_id, account ORDER BY period) AS closing_cents
FROM activity;
-- opening + period activity == closing, by construction → month closes, balances roll forward.
```

**V3 — P&L by dimension (req (c)):** revenue − expense grouped by `event_id` (rolled up the `event_tags` tree via recursive CTE / materialized `path`), `class_id`, `teacher_id`, `family_id`, `period`. Contra accounts subtract from revenue; `sales_tax_payable`/liabilities are excluded from P&L (balance sheet).

**V4 — TAX LIABILITY REPORT (per period × jurisdiction), traceable to entries:**
```sql
CREATE OR REPLACE VIEW v_tax_liability AS
SELECT tenant_id, location_id AS jurisdiction, period,
  -- sales tax
  SUM(amount_cents) FILTER (WHERE account='sales_tax_payable' AND direction='credit') AS sales_tax_collected_cents,
  SUM(amount_cents) FILTER (WHERE account='sales_tax_payable' AND direction='debit')  AS sales_tax_remitted_cents,
  SUM(CASE WHEN account='sales_tax_payable'
        THEN CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END END) AS sales_tax_payable_balance_cents,
  -- use tax
  SUM(amount_cents) FILTER (WHERE account='use_tax_payable' AND direction='credit') AS use_tax_accrued_cents,
  SUM(amount_cents) FILTER (WHERE account='use_tax_payable' AND direction='debit')  AS use_tax_remitted_cents,
  SUM(CASE WHEN account='use_tax_payable'
        THEN CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END END) AS use_tax_payable_balance_cents
FROM ledger_entries WHERE status='posted' AND account IN ('sales_tax_payable','use_tax_payable')
GROUP BY tenant_id, location_id, period;
```
Every figure drills to the underlying legs (`WHERE account='sales_tax_payable' AND period=…`), so a return is filed from `collected`, the remittance (R15/R17) is tied to `remitted`, and the `payable_balance` proves what's still owed. Jurisdiction = `location_id` proxy (P2-4) until a dedicated jurisdiction dim is warranted.

**Month-close procedure:** (1) V1 asserts balanced for the period; (2) V4 tax report filed/remitted; (3) mark period closed (a `ledger_periods` row `status='closed'`); (4) closed periods reject new non-reversing postings; corrections post to the open period as reversing groups.

---

## 7. OPEN QUESTIONS / RISKS

1. **Webhook cutover (P0-3):** confirm we repoint/disable the Layer-1 checkout webhook *before* the CHECK-change migration. Otherwise checkout breaks. Who owns that code change and when?
2. **CA sales/use tax rules (req):** rate(s), nexus, filing frequency, and whether snacks are taxable — **confirm with an accountant**; `tax_rates` stays empty until then. Use tax on studio-consumed inventory: confirm what's in scope (out-of-state purchases, supplies, inventory pulled for studio use).
3. **`cash_operating` vs `cash_clearing`:** confirm we model a real bank account and reconcile Stripe payouts to it (P1-2). Do we import Stripe payout reports, or reconcile manually at first?
4. **Equity accounts (P1-4):** confirm year-end close to `retained_earnings` and opening-balance handling with the accountant/QBO setup.
5. **Append-only enforcement (P1-5):** confirm the `reconciliation` role and that finance_admin cannot UPDATE/DELETE ledger rows (only post reversing groups).
6. **Refund granularity (P1-7):** single `refunds_contra` bucket vs per-revenue-account reversal — acceptable for now?
7. **event_id repoint (P2-2):** sequence the `event_tags` migration relative to this one; P&L rollup depends on it.
8. **Multi-tenant tax:** if white-label tenants operate in other states, `tax_rates` must key on tenant + jurisdiction; confirm before multi-state.

---

*This is a design + findings document only. No application code written, no migration applied, nothing deployed or committed. The migration in §4 is a plan, not an applied change — it must run via `supabase db push` in the regular terminal, coordinated with the webhook cutover in §7.1.*
