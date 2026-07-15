# Ledger Foundation — Adversarial Review & Corrective Design (Double-Entry)

**Doc:** `docs/LEDGER_FOUNDATION_REVIEW.md` · **Status:** Draft for review · **Supersedes:** §11 of `COMMERCE_BILLING_ARCHITECTURE.md` v3.1 and the ledger portions of `COMMERCE_BILLING_ADDENDUM_v4.md` where they conflict · **Date:** 2026-07-15

**Scope note / verification caveat.** The two spec documents were not attached to this review; §11-specific findings below are keyed to the stated ground truth (live `ledger_entries` is single-entry with `direction IN ('revenue','expense')`, `charge_status` includes `'charged'` not `'captured'`, partial unique index `UNIQUE(event_id, account, direction) WHERE event_id IS NOT NULL`, existing checkout webhook writes single-entry revenue rows). Before merging this doc, diff §11.2's recipe tables against Section 3 below line-by-line in the repo. **Implementation gate:** every migration and query derived from this doc goes through the `bam-schema-sync` skill workflow in Claude Code (read `types/database.types.ts` → migrate via `supabase db push` → regenerate types → `tsc --noEmit`) before any application code is written.

---

## 1. FINDINGS (severity-ranked)

### P0 — will corrupt the books or already violates a hard requirement

**F-01 · Live schema cannot represent double-entry at all.**
`direction CHECK ('revenue','expense')` is a category axis, not a posting side. There is no way to express DR `accounts_receivable` / CR `revenue_tuition`, no balance-sheet accounts, and therefore no trial balance, no roll-forward, no tick-and-tie (hard req. b). Every §11.2 recipe is unpostable against the live table. This is not an ALTER-in-place fix; it is a rebuild (Section 4 exploits the near-zero row count to do it cleanly).

**F-02 · Idempotency hole covers exactly the rows that matter most.**
The partial unique index `UNIQUE(event_id, account, direction) WHERE event_id IS NOT NULL` gives **zero** protection to tuition, merch, fee, and payment rows — anything with `event_id IS NULL`, i.e., the majority of postings. Stripe redelivers webhooks (at-least-once, with retries over days); Vercel functions can be retried; duplicates are a certainty, not a risk. Worse, where the index *does* apply it is also **too strong**: two legitimate distinct sales against the same event, same account, same direction (two ticket orders for the *Sylvia* show) collide and the second silently fails or errors. The index is simultaneously too weak and too strict. Replace with a posting-key on the economic event (Section 2.4).

**F-03 · Nothing ties the legs of one economic event together or forces them to balance.**
Even after adding debit/credit, a crash or timeout between two INSERTs leaves a permanently unbalanced ledger, and no constraint detects it. Postgres CHECK constraints can't span rows; this needs (a) a `ledger_entry_groups` parent row, (b) all legs inserted in one transaction via a single RPC, and (c) a `DEFERRABLE INITIALLY DEFERRED` constraint trigger that asserts Σdebits = Σcredits per group at commit (Section 2.5). Without this, requirement (e) is unmet under concurrency.

**F-04 · `charge_status` conflict is a symptom of a deeper bug: mutable state on an append-only ledger.**
Live domain has `'charged'`; spec assumes `'captured'`. But the real problem is that any lifecycle transition modeled as a status change (`succeeded → returned` on ACH) implies an UPDATE on a ledger row, which violates hard requirement (e/f append-only). Resolution: `charge_status` becomes an **immutable snapshot of payment state at posting time**; state transitions are represented by **new reversing entry groups**, never by updates. Canonical value is `'captured'`; the legacy `'charged'` value is remapped during migration (Section 4). Authoritative, mutable payment state lives on the payments/charges record, not the ledger.

**F-05 · Sales tax would currently be booked as revenue.**
The existing webhook posts the full charge amount to a revenue account. Route any taxable merch/snack sale through that path and collected tax lands in income — an overstatement of revenue, an understatement of liabilities, and a CDTFA compliance problem. No `sales_tax_payable` or `use_tax_payable` account exists anywhere in the live schema or (per stated ground truth) the spec's chart of accounts. Fixed in Sections 2.1 and 3.10–3.13.

**F-06 · ACH lifecycle unmodeled.**
ACH is not card: `processing → succeeded → (possibly) returned` days later. Required behavior: cash hits `cash_clearing` only on `succeeded`; a return posts a **reversing group** (mirror legs, `reversal_of_group_id` set) that reopens AR, plus a separate group for the return fee expense. If the spec (or any handler) resolves a return by updating the original rows, that is a P0 defect. Recipe in Section 3.8.

### P1 — breaks a hard requirement in practice, or guarantees a failed close

**F-07 · No reversal linkage.** Without `reversal_of_group_id`, refunds and ACH returns are unmatchable to their originals; the tax-liability report (refund must claw back the tax leg) and audit trace both fail.

**F-08 · Liability-on-sale / revenue-on-consumption is undefined for bundles, points, and deposits.** If recognition happens at sale (which is what a single-entry revenue row does), the liabilities in §11 never come into existence and can never balance. Must define: sale posts to liability; explicit **consumption events** (class attended, deposit applied) move liability → revenue; **breakage** (expired/unused) is an accountant-decision policy (Section 7).

**F-09 · Stripe fees and payouts unmodeled → bank rec can never tie.** Stripe nets fees and pays out in batches. If the ledger records only gross revenue, `cash` never matches the bank statement and requirement (b) fails at the first month-end. Need: fee expense legs sourced from balance transactions, and payout entries `DR cash_operating / CR cash_clearing` (Section 3.4–3.5). `cash_clearing` must independently reconcile to the Stripe balance.

**F-10 · Payroll absent from the ledger.** Requirement (d) needs accrual (`DR wages_expense / CR wages_payable` per teacher, allocated to class/location/event dimensions from `timesheet_entries`) and disbursement (`DR wages_payable / CR cash_operating` when Square Payroll drafts), plus employer-tax legs. Without teacher/class stamps on the wage legs, per-class and per-teacher P&L (req. c) is impossible.

**F-11 · No period-close mechanism.** Anyone can post into January in June; roll-forward (b) is then unprovable. Need `ledger_period_closes` + trigger rejecting postings whose `occurred_at` falls in a closed period; late adjustments post into the current open period with an `adjusts_period` stamp (standard practice). Section 6.

**F-12 · Dimension integrity is unenforced.** With every dimension nullable and no per-event-type requirements, teacher/class P&L silently degrades to "unallocated." Section 3's recipe table specifies required dimensions per event type; enforce in the posting RPC, not per-column NOT NULL.

**F-13 · Tax rounding rule undefined.** Integer cents + jurisdictional rates require an explicit rule. Decision: compute tax **per line**, `round half up` to the cent, sum lines (matches receipt display and CDTFA line-item audit expectations). Never derive tax by back-calculating from a total.

**F-14 · "Costumes untaxed" is probably wrong in California.** Costumes sold to families are tangible personal property; California generally taxes clothing/costumes. Tuition and true service fees are fine untaxed. This is stated as a premise in the requirements but must be confirmed by the accountant before launch — if wrong, it is financially a P0 (uncollected tax is owed by the studio). Carried to Section 7.

### P2 — correctness debt

**F-15 · No QBO export tracking.** Nothing prevents double-export. Section 5 adds `qbo_exports` + `qbo_export_lines` with uniqueness on the group.

**F-16 · `charge_status` belongs on payments long-term.** Keep on ledger as immutable snapshot for now (cheap provenance); plan to make it nullable and authoritative on the payments table.

**F-17 · Fee-recovery surcharges are legally and tax-wise loaded.** California regulates card surcharges (disclosure/pricing rules), and a surcharge attached to a **taxable** sale is generally itself part of the taxable base. Recipe 3.14 includes the surcharge in the tax base when the underlying items are taxable; legality/format is an accountant+counsel flag (Section 7).

---

## 2. CORRECTED LEDGER DESIGN

### 2.1 Chart of accounts (authoritative)

Accounts live in a reference table `ledger_accounts` (FK target for entries) so the chart is data, not string convention. Codes follow standard numbering.

| Code | Account (slug) | Type | Normal balance | Notes |
|---|---|---|---|---|
| 1000 | `cash_operating` | asset | debit | Bank account; only payouts/remittances/payroll touch it |
| 1010 | `cash_clearing` | asset | debit | Stripe balance; reconciles to Stripe independently |
| 1100 | `accounts_receivable` | asset | debit | Per-family subledger via `family_id` dimension |
| 1200 | `inventory_merch` | asset | debit | Phase 2 (only if merch inventory is tracked at cost) |
| 2000 | `customer_credit_liability` | liability | credit | Store credit issued/applied |
| 2010 | `deposits_liability` | liability | credit | Event/registration deposits held |
| 2020 | `bundle_liability` | liability | credit | Deferred revenue: class packs / points |
| 2030 | `deferred_revenue_tuition` | liability | credit | **Only if** tuition billed materially in advance of service — accountant decision; otherwise unused |
| 2100 | `sales_tax_payable` | liability | credit | Tax collected from customers; never revenue |
| 2110 | `use_tax_payable` | liability | credit | Self-assessed tax on untaxed purchases consumed |
| 2200 | `wages_payable` | liability | credit | Accrued teacher/staff wages |
| 2210 | `payroll_tax_payable` | liability | credit | Accrued employer payroll taxes |
| 4000 | `revenue_tuition` | revenue | credit | |
| 4010 | `revenue_fees` | revenue | credit | Registration, late, admin fees |
| 4020 | `revenue_private_lessons` | revenue | credit | Ties to `private_billing_records` |
| 4030 | `revenue_costumes` | revenue | credit | Taxability pending F-14 |
| 4040 | `revenue_merch` | revenue | credit | Taxable by default |
| 4050 | `revenue_events` | revenue | credit | Tickets, performance fees |
| 4060 | `revenue_fee_recovery` | revenue | credit | Card surcharge income (see F-17) |
| 4900 | `discounts_given` | contra-revenue | debit | Stamped with `discount_id` |
| 4910 | `scholarships_awards` | contra-revenue | debit | Stamped with `award_id` |
| 5000 | `payroll_wages_expense` | expense | debit | Stamped with `teacher_id` (+ class/location) |
| 5010 | `payroll_tax_expense` | expense | debit | Employer share |
| 5100 | `processing_fees_expense` | expense | debit | Stripe fees, ACH return fees |
| 5200 | `supplies_expense` | expense | debit | Use-tax accrual debits land here (or the underlying expense) |
| 5210 | `cogs_merch` | expense | debit | Phase 2, pairs with 1200 |

Rules: no account may be posted to unless it exists in `ledger_accounts` with `is_active = true`. Adding an account is a migration, not an INSERT from app code.

### 2.2 `direction` domain

`direction IN ('debit','credit')`. `amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)` — sign lives in `direction`, never in the amount. Signed value for reporting is derived: `CASE WHEN direction='debit' THEN amount_cents ELSE -amount_cents END` (debit-positive convention).

### 2.3 `charge_status` domain

Domain: `('pending','authorized','captured','succeeded','failed','refunded','returned')`, nullable (non-payment groups leave it NULL). **Canonical for a settled card capture is `'captured'`; the legacy `'charged'` is remapped in migration.** Semantics: immutable snapshot of the payment's state *at the moment this group posted*. An ACH return does not update the original group's `'succeeded'`; it posts a new group with `charge_status='returned'` and `reversal_of_group_id` set.

### 2.4 New structure: groups + legs

**`ledger_entry_groups`** (one row per economic event):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | RLS anchor |
| `posting_key` | text NOT NULL | Idempotency key; `UNIQUE (tenant_id, posting_key)` |
| `event_type` | text NOT NULL | e.g. `invoice_finalized`, `payment_captured`, `ach_returned`, `payroll_accrued`, `sales_tax_remitted` — FK to `ledger_event_types` or CHECK list |
| `occurred_at` | timestamptz NOT NULL | Economic date (drives period) |
| `posted_at` | timestamptz NOT NULL DEFAULT now() | |
| `source_system` | text NOT NULL | `stripe`, `app`, `square_payroll`, `manual` |
| `source_ref` | text | Stripe event id, invoice id, pay_period id… |
| `reversal_of_group_id` | uuid NULL FK → self | Set on refunds/returns/corrections |
| `adjusts_period` | date NULL | Set when a late adjustment economically belongs to a closed month |
| `memo` | text | |

**Posting-key format:** `{source_system}:{source_event_or_object_id}:{event_type}` — e.g. `stripe:evt_1P9xK…:payment_captured`, `app:invoice_8f3a…:invoice_finalized`, `app:pay_period_2026-07A:payroll_accrued`. Because Stripe event ids are unique per delivery attempt *series*, retries collide on the key and no-op. This replaces the partial index entirely (fixes both halves of F-02).

**`ledger_entries`** (legs; ≥2 per group):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | Must equal group's (enforced by trigger/RPC) |
| `entry_group_id` | uuid NOT NULL FK | |
| `account` | text NOT NULL FK → `ledger_accounts(slug)` | |
| `direction` | text NOT NULL CHECK ('debit','credit') | |
| `amount_cents` | bigint NOT NULL CHECK (> 0) | |
| `charge_status` | text NULL | Snapshot; see 2.3 |
| `occurred_at` | timestamptz NOT NULL | Copied from group for index locality |
| Dimensions | uuid NULL each | `family_id, student_id, class_id, location_id, event_id, teacher_id, award_id, discount_id, product_id, invoice_id, payment_id, line_item_id` |
| `jurisdiction_code` | text NULL | Required on tax-account legs, e.g. `CA-ORANGE-SAN_CLEMENTE` (config-driven) |
| `tax_rate_bps` | int NULL | Rate applied, basis points, snapshot at posting |

Old `event_id` semantics are preserved as the `event_id` dimension (performance/event), no longer doing idempotency duty.

### 2.5 Invariants and how they're enforced

1. **Balanced groups:** `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` on `ledger_entries` asserting, at commit, `Σ(debits) = Σ(credits)` and leg-count ≥ 2 for each touched group. (SQL in Section 4.)
2. **Append-only:** `BEFORE UPDATE OR DELETE` trigger on both tables raising an exception, plus `REVOKE UPDATE, DELETE` from app roles. QBO export refs live in separate tables (Section 5) so the ledger never needs mutation.
3. **Atomic posting:** single RPC `post_ledger_group(p_tenant, p_posting_key, p_event_type, p_occurred_at, p_source_system, p_source_ref, p_legs jsonb, p_reversal_of uuid default null)`, SECURITY DEFINER. It inserts the group with `ON CONFLICT (tenant_id, posting_key) DO NOTHING`; if no row returned, the event was already posted → return existing group id and insert **no** legs (idempotent under concurrent duplicate webhooks — the losing transaction sees the conflict). Legs insert in the same transaction; the deferred trigger validates at commit.
4. **Configurable tax rates:** `tax_rates(tenant_id, jurisdiction_code, rate_bps, tax_type CHECK('sales','use'), effective_from, effective_to)` — never hardcode; the RPC callers resolve rate by location + date and stamp `tax_rate_bps` on the tax leg.
5. **Tenant isolation:** RLS on both tables; policies call SECURITY DEFINER helpers over `profile_roles` (join on `user_id`), consistent with the existing `is_admin()` pattern — never query `profiles` inside policies (known recursion failure mode).
6. **Closed periods:** insert trigger rejects legs with `occurred_at` inside a row of `ledger_period_closes` for the tenant (Section 6).

---

## 3. POSTING RECIPES

Conventions: all amounts integer cents; every leg stamps `family_id` where a family is involved; tax legs additionally stamp `jurisdiction_code` + `tax_rate_bps`. Each recipe shows debit-positive net = 0. "Req dims" = dimensions the posting RPC must require for that event type (F-12).

### 3.1 `invoice_finalized` (tuition, fees, private lessons — untaxed services)
Gross method so discounts are visible in P&L.

| Leg | Account | DR/CR | Amount | Req dims |
|---|---|---|---|---|
| 1 | `accounts_receivable` | DR | net due | family, invoice |
| 2 | `discounts_given` | DR | discount total | family, invoice, discount |
| 3 | `scholarships_awards` | DR | award total | family, student, award |
| 4 | `revenue_tuition` (or 4010/4020 per line) | CR | gross per line | family, student, class, location, invoice, line_item |

Net: (net + discount + award) − gross = 0. Legs 2–3 omitted when zero.

### 3.2 `payment_captured` (card against an invoice)
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `cash_clearing` | DR | gross charge |
| 2 | `accounts_receivable` | CR | gross charge |

Dims: family, invoice, payment. `charge_status='captured'`. Posting key from the Stripe event id.

### 3.3 `direct_sale_captured` (checkout with no invoice — the current webhook path, non-taxable lines)
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `cash_clearing` | DR | total |
| 2 | `revenue_*` per line | CR | per line |

### 3.4 `processing_fee` (from the Stripe balance transaction; card and ACH)
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `processing_fees_expense` | DR | fee |
| 2 | `cash_clearing` | CR | fee |

Dims: payment (and family, for per-family net-revenue analysis). Separate group from 3.2 because Stripe reports the fee on the balance transaction; keys off `txn_…` id.

### 3.5 `stripe_payout`
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `cash_operating` | DR | payout amount |
| 2 | `cash_clearing` | CR | payout amount |

Key: `stripe:po_…:stripe_payout`. After this, `cash_clearing` balance = Stripe pending balance; `cash_operating` ties to the bank.

### 3.6 `credit_issued` (goodwill/service-recovery store credit)
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `discounts_given` | DR | credit amount |
| 2 | `customer_credit_liability` | CR | credit amount |

(Credit issued *in lieu of a cash refund* instead reverses revenue: DR `revenue_*` / CR `customer_credit_liability`, with `reversal_of_group_id` → original sale.)

### 3.7 `credit_applied`
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `customer_credit_liability` | DR | applied amount |
| 2 | `accounts_receivable` | CR | applied amount |

### 3.8 ACH lifecycle
**`ach_succeeded`** — identical shape to 3.2 (DR `cash_clearing` / CR `accounts_receivable`), `charge_status='succeeded'`. Post **only** on Stripe `payment_intent.succeeded` for ACH — never at initiation.

**`ach_returned`** (days later):
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `accounts_receivable` | DR | gross (AR reopens) |
| 2 | `cash_clearing` | CR | gross |

`reversal_of_group_id` → the `ach_succeeded` group; `charge_status='returned'`. Return fee posts as a separate 3.4-shaped group. **No update or delete ever touches the original group.**

### 3.9 Deposits & bundles (liability on sale, revenue on consumption — F-08)
**`deposit_received`:** DR `cash_clearing` / CR `deposits_liability` (dims: family, event).
**`deposit_applied`:** DR `deposits_liability` / CR `accounts_receivable` (or `revenue_events` if applied directly at consumption).
**`bundle_sold`:** DR `cash_clearing` / CR `bundle_liability` (family, product).
**`bundle_consumed`** (class attended / points redeemed): DR `bundle_liability` / CR `revenue_tuition` at the per-unit value (family, student, class, location, teacher). This is the entry that makes per-class/per-teacher P&L work for bundle customers.
**`bundle_breakage`** (expiry, per policy — Section 7): DR `bundle_liability` / CR `revenue_fees`.

### 3.10 `merch_sale_captured` (taxable — the tax-critical recipe)
Example: $40.00 shirt, 7.75% ⇒ tax $3.10, charge $43.10.

| Leg | Account | DR/CR | Amount | Dims |
|---|---|---|---|---|
| 1 | `cash_clearing` | DR | 4310 | family, payment |
| 2 | `revenue_merch` | CR | 4000 | family, product, location, line_item |
| 3 | `sales_tax_payable` | CR | 310 | location, jurisdiction_code, tax_rate_bps |

Invoiced variant: leg 1 becomes DR `accounts_receivable`; payment later via 3.2. Tax computed per line, round-half-up (F-13). Mixed carts simply emit one revenue leg per line and one tax leg per jurisdiction (sum of taxable lines' tax).

### 3.11 `merch_refund` (or any refund)
Mirror the original group proportionally, `reversal_of_group_id` set:

| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `revenue_merch` | DR | refunded price |
| 2 | `sales_tax_payable` | DR | refunded tax |
| 3 | `cash_clearing` | CR | refunded total |

Debiting the same revenue account (rather than a contra) keeps per-dimension P&L exact; if the accountant prefers a visible `refunds_given` contra account, swap leg 1's account — decision flagged in Section 7.

### 3.12 `sales_tax_remitted` (CDTFA filing paid)
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `sales_tax_payable` | DR | remitted amount |
| 2 | `cash_operating` | CR | remitted amount |

Dims: jurisdiction_code; `source_ref` = filing/confirmation number. Rounding difference on the return (whole-dollar filings) posts a small companion leg to `revenue_fees` (over-collection) or `supplies_expense` (under) — keeps the payable at exactly zero for the filed period.

### 3.13 Use tax
**`use_tax_accrued`** (studio consumed taxable goods bought untaxed — out-of-state supplies, inventory pulled for studio use):
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `supplies_expense` (or the underlying expense/asset account) | DR | tax amount |
| 2 | `use_tax_payable` | CR | tax amount |

(If inventory is tracked: pulling stock for studio use is DR `supplies_expense` / CR `inventory_merch` at cost, plus this accrual on that cost.)
**`use_tax_remitted`:** DR `use_tax_payable` / CR `cash_operating` — same shape as 3.12, filed on the same CDTFA return.

### 3.14 `fee_recovery` (card surcharge, if adopted — see F-17)
Included as a line on the charge: DR `cash_clearing` (total incl. surcharge) / CR `revenue_fee_recovery` (surcharge) alongside the sale's other CR legs. **If the underlying sale is taxable, the surcharge joins the taxable base** — its tax goes into leg 3.10-3's amount.

### 3.15 Payroll
**`payroll_accrued`** (pay period approved in Timesheets — one group per pay period, legs per teacher/allocation):
| Leg | Account | DR/CR | Amount | Dims |
|---|---|---|---|---|
| 1..n | `payroll_wages_expense` | DR | per teacher-allocation | teacher, class, location (event for performance work) |
| n+1 | `payroll_tax_expense` | DR | employer taxes | (teacher optional) |
| n+2 | `wages_payable` | CR | Σ wages | — |
| n+3 | `payroll_tax_payable` | CR | Σ employer taxes | — |

Allocations derive from `timesheet_entries` (class/location already known there); private-lesson wages stamp via `private_billing_splits`.
**`payroll_disbursed`** (Square Payroll drafts the bank):
| Leg | Account | DR/CR | Amount |
|---|---|---|---|
| 1 | `wages_payable` | DR | net + EE withholdings remitted by Square |
| 2 | `payroll_tax_payable` | DR | employer taxes remitted |
| 3 | `cash_operating` | CR | total draft |

If Square's draft splits (net pay vs. tax impound) hit the bank as two debits, post two groups keyed to each draft so the bank rec ties line-for-line.

Every recipe above nets to zero by construction; the deferred trigger enforces it for anything hand-posted.

---

## 4. MIGRATION PLAN

Row count is near-zero ⇒ take the clean path: **quarantine the legacy table, build the correct one fresh, re-post legacy economics from Stripe source data.** No in-place ALTER contortions.

### 4.0 Sequence (BAM workflow: one migration file, `supabase db push`, never MCP; then bam-schema-sync Steps 5a–5d)

### 4.1 Migration SQL (guarded, re-runnable)

```sql
-- ============ 1. Quarantine legacy single-entry table ============
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ledger_entries')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ledger_entries'
               AND column_name='entry_group_id') THEN
    ALTER TABLE public.ledger_entries RENAME TO ledger_entries_legacy_single;
  END IF;
END $$;

-- ============ 2. Chart of accounts ============
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  slug            text PRIMARY KEY,
  code            int  NOT NULL UNIQUE,
  name            text NOT NULL,
  acct_type       text NOT NULL CHECK (acct_type IN
                    ('asset','liability','revenue','contra_revenue','expense')),
  normal_balance  text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_active       boolean NOT NULL DEFAULT true
);
INSERT INTO public.ledger_accounts (slug, code, name, acct_type, normal_balance) VALUES
  ('cash_operating',1000,'Cash – Operating','asset','debit'),
  ('cash_clearing',1010,'Cash – Stripe Clearing','asset','debit'),
  ('accounts_receivable',1100,'Accounts Receivable','asset','debit'),
  ('customer_credit_liability',2000,'Customer Credits','liability','credit'),
  ('deposits_liability',2010,'Customer Deposits','liability','credit'),
  ('bundle_liability',2020,'Deferred Revenue – Bundles/Points','liability','credit'),
  ('deferred_revenue_tuition',2030,'Deferred Revenue – Tuition','liability','credit'),
  ('sales_tax_payable',2100,'Sales Tax Payable','liability','credit'),
  ('use_tax_payable',2110,'Use Tax Payable','liability','credit'),
  ('wages_payable',2200,'Wages Payable','liability','credit'),
  ('payroll_tax_payable',2210,'Payroll Tax Payable','liability','credit'),
  ('revenue_tuition',4000,'Tuition Revenue','revenue','credit'),
  ('revenue_fees',4010,'Fees Revenue','revenue','credit'),
  ('revenue_private_lessons',4020,'Private Lesson Revenue','revenue','credit'),
  ('revenue_costumes',4030,'Costume Revenue','revenue','credit'),
  ('revenue_merch',4040,'Merchandise Revenue','revenue','credit'),
  ('revenue_events',4050,'Event Revenue','revenue','credit'),
  ('revenue_fee_recovery',4060,'Fee Recovery Income','revenue','credit'),
  ('discounts_given',4900,'Discounts Given','contra_revenue','debit'),
  ('scholarships_awards',4910,'Scholarships & Awards','contra_revenue','debit'),
  ('payroll_wages_expense',5000,'Wages Expense','expense','debit'),
  ('payroll_tax_expense',5010,'Payroll Tax Expense','expense','debit'),
  ('processing_fees_expense',5100,'Payment Processing Fees','expense','debit'),
  ('supplies_expense',5200,'Supplies Expense','expense','debit')
ON CONFLICT (slug) DO NOTHING;

-- ============ 3. Tax rates (configurable, never hardcoded) ============
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  jurisdiction_code text NOT NULL,
  tax_type text NOT NULL CHECK (tax_type IN ('sales','use')),
  rate_bps int NOT NULL CHECK (rate_bps >= 0),
  effective_from date NOT NULL,
  effective_to date,
  UNIQUE (tenant_id, jurisdiction_code, tax_type, effective_from)
);

-- ============ 4. Groups ============
CREATE TABLE IF NOT EXISTS public.ledger_entry_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  posting_key text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  source_system text NOT NULL,
  source_ref text,
  reversal_of_group_id uuid REFERENCES public.ledger_entry_groups(id),
  adjusts_period date,
  memo text,
  UNIQUE (tenant_id, posting_key)
);

-- ============ 5. Entries (legs) ============
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entry_group_id uuid NOT NULL REFERENCES public.ledger_entry_groups(id),
  account text NOT NULL REFERENCES public.ledger_accounts(slug),
  direction text NOT NULL CHECK (direction IN ('debit','credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  charge_status text CHECK (charge_status IN
    ('pending','authorized','captured','succeeded','failed','refunded','returned')),
  occurred_at timestamptz NOT NULL,
  family_id uuid, student_id uuid, class_id uuid, location_id uuid,
  event_id uuid, teacher_id uuid, award_id uuid, discount_id uuid,
  product_id uuid, invoice_id uuid, payment_id uuid, line_item_id uuid,
  jurisdiction_code text,
  tax_rate_bps int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_group   ON public.ledger_entries (entry_group_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_acct_dt ON public.ledger_entries (tenant_id, account, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_family  ON public.ledger_entries (tenant_id, family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_teacher ON public.ledger_entries (tenant_id, teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_class   ON public.ledger_entries (tenant_id, class_id)   WHERE class_id   IS NOT NULL;

-- ============ 6. Balance enforcement (deferred, at commit) ============
CREATE OR REPLACE FUNCTION public.ledger_assert_group_balanced()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_dr bigint; v_cr bigint; v_ct int;
BEGIN
  SELECT COALESCE(SUM(amount_cents) FILTER (WHERE direction='debit'),0),
         COALESCE(SUM(amount_cents) FILTER (WHERE direction='credit'),0),
         COUNT(*)
    INTO v_dr, v_cr, v_ct
    FROM public.ledger_entries WHERE entry_group_id = NEW.entry_group_id;
  IF v_dr <> v_cr OR v_ct < 2 THEN
    RAISE EXCEPTION 'Unbalanced ledger group % (DR % / CR %, % legs)',
      NEW.entry_group_id, v_dr, v_cr, v_ct;
  END IF;
  RETURN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_group_balanced') THEN
    CREATE CONSTRAINT TRIGGER trg_ledger_group_balanced
      AFTER INSERT ON public.ledger_entries
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION public.ledger_assert_group_balanced();
  END IF;
END $$;

-- ============ 7. Append-only enforcement ============
CREATE OR REPLACE FUNCTION public.ledger_forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger is append-only (% on %)', TG_OP, TG_TABLE_NAME; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_entries_immutable') THEN
    CREATE TRIGGER trg_ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON public.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION public.ledger_forbid_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_groups_immutable') THEN
    CREATE TRIGGER trg_ledger_groups_immutable
      BEFORE UPDATE OR DELETE ON public.ledger_entry_groups
      FOR EACH ROW EXECUTE FUNCTION public.ledger_forbid_mutation();
  END IF;
END $$;

REVOKE UPDATE, DELETE ON public.ledger_entries, public.ledger_entry_groups
  FROM anon, authenticated;

-- ============ 8. Period close ============
CREATE TABLE IF NOT EXISTS public.ledger_period_closes (
  tenant_id uuid NOT NULL,
  period date NOT NULL,            -- first day of month
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  total_debits bigint NOT NULL,
  total_credits bigint NOT NULL,
  PRIMARY KEY (tenant_id, period)
);

CREATE OR REPLACE FUNCTION public.ledger_reject_closed_period()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ledger_period_closes
             WHERE tenant_id = NEW.tenant_id
               AND period = date_trunc('month', NEW.occurred_at)::date) THEN
    RAISE EXCEPTION 'Period % is closed; post to the open period with adjusts_period set',
      date_trunc('month', NEW.occurred_at)::date;
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_closed_period') THEN
    CREATE TRIGGER trg_ledger_closed_period
      BEFORE INSERT ON public.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION public.ledger_reject_closed_period();
  END IF;
END $$;

-- ============ 9. RLS (helpers follow existing profile_roles pattern) ============
ALTER TABLE public.ledger_entry_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates           ENABLE ROW LEVEL SECURITY;
-- Policies: SELECT for finance_admin/super_admin of the tenant via a
-- SECURITY DEFINER helper over profile_roles (user_id join); INSERT only via
-- the post_ledger_group RPC role. Exact policy SQL to be written against the
-- live profile_roles helpers per bam-schema-sync before push.
```

The `post_ledger_group` RPC (SECURITY DEFINER; inserts group `ON CONFLICT (tenant_id, posting_key) DO NOTHING`; on conflict returns the existing group id and inserts no legs; otherwise inserts all legs and lets the deferred trigger validate at commit) ships in the same migration — implementation in Claude Code after schema verification.

### 4.2 Legacy row reconciliation (the existing single-entry webhook rows)

Decision: **re-post, then deprecate** — do not backfill-in-place.

1. Legacy rows are already quarantined in `ledger_entries_legacy_single` (step 1 above). Export to CSV for the archive.
2. For each legacy row (`direction='revenue'`, `charge_status='charged'`), pull the originating Stripe object (checkout session / payment intent) and post a proper group via the RPC: recipe 3.3 (or 3.2 if an invoice exists), posting key `stripe:{event_or_pi_id}:payment_captured`, `charge_status='captured'`, `occurred_at` = original charge time — **before** closing any period, so the closed-period trigger doesn't block it. Post the matching 3.4 fee groups from the balance transactions so clearing ties from day one.
3. Verify: trial balance for the affected months; `cash_clearing` activity = Stripe balance history; legacy-row count = re-posted revenue-leg count.
4. Update the checkout webhook to call the RPC exclusively (its Stripe-event posting key makes redelivery a no-op — closes F-02).
5. After validation on a throwaway Supabase project (matches the rebaseline workflow already in flight) and one clean month, drop `ledger_entries_legacy_single` in a later migration.

Because the new table is created fresh, no `'charged'→'captured'` UPDATE is ever needed — the remap happens in the re-post.


---

## 5. QBO EXPORT MAPPING

### 5.1 Account map

| Ledger account | QBO account | QBO type / detail type |
|---|---|---|
| `cash_operating` | Checking – Operating | Bank / Checking |
| `cash_clearing` | Stripe Clearing | Bank / Cash on hand (or Other Current Asset — accountant preference) |
| `accounts_receivable` | Accounts Receivable | Accounts Receivable |
| `customer_credit_liability` | Customer Credits | Other Current Liability |
| `deposits_liability` | Customer Deposits | Other Current Liability |
| `bundle_liability` | Deferred Revenue – Bundles | Other Current Liability / Deferred Revenue |
| `deferred_revenue_tuition` | Deferred Revenue – Tuition | Other Current Liability / Deferred Revenue |
| `sales_tax_payable` | **Sales Tax Payable (manual)** | Other Current Liability | 
| `use_tax_payable` | **Use Tax Payable** | Other Current Liability |
| `wages_payable` | Wages Payable | Other Current Liability / Payroll liabilities |
| `payroll_tax_payable` | Payroll Tax Payable | Other Current Liability / Payroll liabilities |
| `revenue_tuition` / `_fees` / `_private_lessons` / `_costumes` / `_merch` / `_events` / `_fee_recovery` | Income sub-accounts under "Studio Income" | Income / Service or Sales of Product Income |
| `discounts_given`, `scholarships_awards` | Discounts & Scholarships | Income (contra) / Discounts-Refunds Given |
| `payroll_wages_expense`, `payroll_tax_expense` | Payroll Expenses | Expense / Payroll expenses |
| `processing_fees_expense` | Merchant Processing Fees | Expense / Bank charges |
| `supplies_expense` | Supplies | Expense / Supplies & materials |

**Tax never lands in income:** both tax payables map to *Other Current Liability* accounts explicitly. Important QBO quirk: QBO's Automated Sales Tax center uses a system-controlled "Sales tax payable" account that journal entries can't post into cleanly. Since BAM's platform is the tax system of record, use a **manual liability account** in QBO and do not enable AST for these transactions — confirm with the accountant (Section 7).

### 5.2 Journal entry shape

One `ledger_entry_group` → one QBO JournalEntry: each leg → one Line with `PostingType` = Debit/Credit, `AccountRef` from the map, `Description` = memo + key dims, `Amount` = cents/100. Dimensions map to QBO **Class** (location: San Clemente / RSM / venue) and optionally **Location** tracking; finer dims (family/class/teacher) stay in the platform — QBO gets the GL truth, the platform stays the analytics layer. `TxnDate` = `occurred_at` date; `DocNumber` = short hash of the group id (drill-back key).

### 5.3 Batching & duplicate prevention

Default: **per-day summary mode** — one JournalEntry per (date × account × Class), lines aggregated, to keep QBO readable; detail mode (one JE per group) available per accountant preference. Tracking tables:

```sql
CREATE TABLE IF NOT EXISTS public.qbo_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  period date NOT NULL,
  mode text NOT NULL CHECK (mode IN ('summary','detail')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE TABLE IF NOT EXISTS public.qbo_export_lines (
  export_id uuid NOT NULL REFERENCES public.qbo_exports(id),
  entry_group_id uuid NOT NULL REFERENCES public.ledger_entry_groups(id),
  qbo_journal_id text,
  PRIMARY KEY (entry_group_id)          -- a group can be exported exactly once
);
```

The PK on `entry_group_id` **is** `qbo_export_ref`: a group already present can never be re-exported, and the ledger itself stays untouched (append-only preserved). Export candidate query = groups in period NOT IN `qbo_export_lines`. Reversing groups export as their own JEs — QBO shows the return/refund the same way the ledger does.

---

## 6. TICK-AND-TIE / CLOSE DESIGN

### 6.1 Trial balance (proves Σdebits = Σcredits every period)

```sql
CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT e.tenant_id,
       date_trunc('month', e.occurred_at)::date AS period,
       e.account, a.acct_type, a.normal_balance,
       SUM(e.amount_cents) FILTER (WHERE e.direction='debit')  AS debits_cents,
       SUM(e.amount_cents) FILTER (WHERE e.direction='credit') AS credits_cents,
       SUM(CASE WHEN e.direction='debit' THEN e.amount_cents ELSE -e.amount_cents END)
         AS net_debit_cents
FROM public.ledger_entries e
JOIN public.ledger_accounts a ON a.slug = e.account
GROUP BY 1,2,3,4,5;
-- Close check: SELECT period, SUM(net_debit_cents) FROM v_trial_balance
--   WHERE tenant_id=$1 GROUP BY 1;  -- must be 0 for every period
```

### 6.2 Balance roll-forward (balance-sheet accounts)

```sql
CREATE OR REPLACE VIEW public.v_balance_rollforward AS
SELECT tenant_id, period, account,
       SUM(net_debit_cents) OVER (PARTITION BY tenant_id, account ORDER BY period
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)      AS opening_cents,
       net_debit_cents                                            AS activity_cents,
       SUM(net_debit_cents) OVER (PARTITION BY tenant_id, account ORDER BY period)
                                                                  AS closing_cents
FROM public.v_trial_balance
WHERE acct_type IN ('asset','liability');
-- opening + activity = closing by construction; closing(month N) = opening(month N+1).
```

### 6.3 Period activity by category × date group (summary → entry traceability)

```sql
CREATE OR REPLACE VIEW public.v_period_activity AS
SELECT e.tenant_id,
       date_trunc('month', e.occurred_at)::date AS period,
       e.occurred_at::date                      AS activity_date,
       a.acct_type, e.account, g.event_type,
       COUNT(DISTINCT e.entry_group_id)         AS group_count,
       SUM(CASE WHEN e.direction='debit' THEN e.amount_cents ELSE -e.amount_cents END)
         AS net_debit_cents
FROM public.ledger_entries e
JOIN public.ledger_accounts a     ON a.slug = e.account
JOIN public.ledger_entry_groups g ON g.id = e.entry_group_id
GROUP BY 1,2,3,4,5,6;
-- Every summary figure decomposes to groups (event_type) and then to legs by
-- filtering ledger_entries on the same keys — nothing in a summary is untraceable.
```

Dimensional P&L (req. c) is the same query grouped by `class_id` / `teacher_id` / `family_id` / `event_id` restricted to `acct_type IN ('revenue','contra_revenue','expense')` — one ledger, every P&L.

### 6.4 Close procedure

1. Post period-end accruals (payroll 3.15, use tax 3.13).
2. Run trial-balance zero check; run roll-forward continuity check vs. prior close.
3. Reconcile `cash_clearing` to Stripe balance and `cash_operating` to bank.
4. Insert `ledger_period_closes` row (stores the period's total debits/credits as the tamper-evident snapshot). The insert trigger from §4.1-8 then blocks any posting dated inside the period; late items post to the open month with `adjusts_period` set.
5. Run QBO export for the period.

### 6.5 Tax liability report (files the return, ties the payment)

```sql
CREATE OR REPLACE VIEW public.v_tax_liability_report AS
SELECT e.tenant_id,
       date_trunc('month', e.occurred_at)::date AS period,
       e.jurisdiction_code,
       e.account,                                   -- sales_tax_payable | use_tax_payable
       SUM(e.amount_cents) FILTER (WHERE e.direction='credit'
           AND g.event_type NOT IN ('sales_tax_remitted','use_tax_remitted'))
         AS accrued_collected_cents,                -- tax collected on sales / use tax accrued
       SUM(e.amount_cents) FILTER (WHERE e.direction='debit'
           AND g.reversal_of_group_id IS NOT NULL)
         AS refund_adjustments_cents,               -- tax clawed back on refunds/returns
       SUM(e.amount_cents) FILTER (WHERE e.direction='debit'
           AND g.event_type IN ('sales_tax_remitted','use_tax_remitted'))
         AS remitted_cents,
       SUM(CASE WHEN e.direction='credit' THEN e.amount_cents ELSE -e.amount_cents END)
         AS period_net_cents                        -- + roll-forward = payable balance
FROM public.ledger_entries e
JOIN public.ledger_entry_groups g ON g.id = e.entry_group_id
WHERE e.account IN ('sales_tax_payable','use_tax_payable')
GROUP BY 1,2,3,4;
```

Reading a filing period: opening payable (from roll-forward) + collected/accrued − refund adjustments − remitted = closing payable. Each figure filters directly back to legs (and via `entry_group_id` to the originating sale, refund, or remittance with its `source_ref` confirmation number), so the CDTFA return amounts and the remittance payment tie out entry-by-entry. `tax_rate_bps` on each leg lets the return's rate-by-jurisdiction breakdown be reproduced exactly as charged, even across rate changes.

---

## 7. OPEN QUESTIONS / RISKS (human + accountant decisions)

**Accountant decisions (block tax go-live, not the ledger migration):**
1. **Costume taxability (F-14).** CA generally taxes costumes as tangible personal property. Confirm before selling a single costume through the platform; if taxable, flip the `taxable` flag on costume products — the recipes already handle it.
2. **Snack/food taxability.** CA food rules are notoriously specific (cold to-go vs. hot vs. carbonated). Per-product `taxable` flags must be set by the accountant, not defaulted.
3. **Jurisdiction rates & filing cadence.** Combined CA + Orange County + district rate for San Clemente, a second jurisdiction row for RSM when it opens, and CDTFA filing frequency (likely quarterly at BAM's volume). Seed `tax_rates` from the accountant's numbers; the schema deliberately has no default.
4. **QBO sales-tax handling.** Manual liability account (recommended here) vs. QBO Automated Sales Tax as system of record.
5. **Refund presentation.** Reverse into the same revenue account (this doc's default, exact dimensional P&L) vs. a visible `refunds_given` contra account.
6. **Bundle breakage policy** — recognize on expiry, on dormancy, or never (escheatment exposure if never).
7. **Deferred tuition** — is monthly tuition recognized when billed (simple, current behavior) or deferred and recognized over the service month? Determines whether account 2030 is used at all.
8. **Cash vs. accrual basis** for the tax return — doesn't change the ledger, changes which QBO reports the accountant files from.

**Counsel/accountant jointly:**
9. **Card surcharges (F-17).** CA disclosure/pricing rules and the surcharge joining the taxable base on taxable sales. Recommend deferring `revenue_fee_recovery` activation until reviewed.

**Engineering risks:**
10. **Spec text unverified** — §11.2 recipes must be diffed against Section 3 in the repo before this doc merges (the two spec docs were not attached to this review).
11. **Stripe fee timing.** Balance-transaction fees can land after the charge event; the 3.4 group posts when the balance transaction is observed. `cash_clearing` is only fully reconciled once fee groups are in — the payout reconciliation in 6.4-3 is the backstop.
12. **Multi-tenant future.** Everything here is `tenant_id`-scoped; when the platform goes multi-studio, tax jurisdiction becomes per-location per-tenant — already supported by `tax_rates` + `jurisdiction_code`, but RLS policies must be re-audited then.
13. **Rebaseline sequencing.** This migration lands **after** the in-flight rebaseline completes (baseline in `supabase/migrations/`, seed built, throwaway-project validation, history reconciled) and after the exposed DB password is rotated. Do not interleave.
14. **Performance of the per-row deferred balance trigger.** Fine at BAM volume; if bulk backfills ever slow, switch to a statement-level transition-table trigger — noted, not needed now.

---

*End of doc. Next actions: (1) diff Section 3 against §11.2 in the repo; (2) accountant review of Section 7 items 1–8; (3) implement migration + `post_ledger_group` RPC in Claude Code following `bam-schema-sync`, after the rebaseline and password rotation are done.*
