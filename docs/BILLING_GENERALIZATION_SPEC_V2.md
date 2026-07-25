# Billing Generalization v2 — Payers, Splits, Offline Payments, Tagging

**Status:** DRAFT — supersedes v1 (`0233bc7`)
**Author:** Derek Shaw
**Date:** 2026-07-25
**Schema verified against live DB:** 2026-07-25

---

## 0. What changed from v1

v1 was written from a code investigation and got five things wrong. All corrected here.

| v1 claim | Reality |
|---|---|
| ADD `family_id`, `student_id` to charge items | Already exist — nullable, no FK. Work is ALTER, not ADD |
| ADD `charge_item_type` | Duplicates live `item_type`, already NOT NULL + CHECK |
| Backfill via `students.parent_id` | Points at `profiles`. Correct column is `students.family_id` |
| `credit_accounts` holds money credit | Points-denominated, student-scoped. Money lives in `families.account_credit` |
| Ledger needs new accounts for costumes/merch | Already exist. Only `undeposited_funds` is missing |

**Scope added since v1:** multi-payer with per-charge splits, processor-agnostic vaulting, ledger tagging.

**The window:** `charges`, `enrollment_charge_items`, `productions`, and `timesheet_entries` are all **empty**. `ledger_entries` holds 3 rows from one test checkout. There is no backfill and no data risk. Structural changes are free right now and expensive after go-live.

---

## 1. Problem

Every admin path that enrolls a student enrolls them **for free**. The sole writer of billing artifacts is `app/api/enrollment/webhook/route.ts:491` — the Stripe checkout webhook. Admin placement and the money path are disjoint.

Worse than absent: the class roster enroll modal **collects** proration method, billing override, amount, and reason, writes them to `enrollments`, and nothing reads them. An admin fills in a billing override, sees it save, and no money moves.

### 1.1 What is actually blocked

| Need | Blocker |
|---|---|
| Costume / competition / late fees | `item_type` CHECK has no such values; `enrollment_id` NOT NULL |
| Ad-hoc fee with a human label | No `description` column anywhere on charge items |
| Admin places student, family has no card | No admin-side billing path at all |
| Payment by Venmo / Zelle / cash / check | No table records money arriving outside a processor |
| Partial payment | No allocation layer |
| Divorced parents, grandparents paying | One card per family, hardcoded to Stripe columns |
| Second processor (Square, Authorize.net) | `families.stripe_*` columns; ledger account named "Cash – Stripe Clearing" |
| Revenue by production or location | Ledger dimensions exist but posting code leaves them null |

### 1.2 Live copy problem (Amanda decision)

Checkout consent at `app/(portal)/portal/enrollment/cart/cart-view.tsx:216` and `app/(public)/enroll/cart/cart-view.tsx:268` has parents agreeing to recurring charges for "registration, costumes, competitions, and adjustments." **Costumes and competitions cannot be billed.** Same class as the trial/refund promise removed in `d74fa15`.

---

## 2. Core decisions

1. **The family is the billing anchor.** A charge item is money a family owes. It *may* attribute to an enrollment, student, or class. It is not *defined* by any of them.
2. **The split is the chargeable unit, not the charge item.** Every charge item has ≥1 split. An intact family is one split at 100%. This removes all `if split then X else Y` branching downstream.
3. **Payers decouple from family membership.** A grandparent pays but has no `students.parent_id` row.
4. **Tag the ledger, not the charge item.** P&L is built from the ledger. Tagging only revenue means expenses can never carry the same tag.
5. **Tags are written at posting time, never derived at read time.** If a class moves from San Clemente to RSM in October, September's revenue stays tagged San Clemente.

---

## 3. Schema

> All column names below were verified against the live DB on 2026-07-25. Re-verify before implementing — `bam-schema-sync` still applies.

### 3.1 `enrollment_charge_items` — ALTER, not rebuild

Already present and unused by any code: `family_id` (nullable), `student_id` (nullable), `class_id` (nullable), `item_type` (NOT NULL, CHECK).

| Change | Detail |
|---|---|
| ALTER | `enrollment_id` → **nullable** |
| ALTER | `family_id` → **NOT NULL**, add FK → `families` |
| ADD FK | `student_id` → `students`, `class_id` → `classes` (both currently unconstrained) |
| ADD | `description text` — nullable. Required for ad-hoc items ("Nutcracker costume — Clara") |
| EXTEND | `item_type` CHECK vocabulary |

**`item_type` vocabulary.** Live values are `registration | first_tuition | one_time_fee | private_pack`. Extend — do **not** introduce a second discriminator:

```
registration | first_tuition | recurring_tuition | one_time_fee
private_pack | costume | competition | merchandise | late_fee | adjustment
```

Keep existing spellings (`first_tuition`, `private_pack`) rather than renaming to v1's `tuition`/`private_package` — the code already writes them.

**Table rename** `enrollment_charge_items` → `charge_items`: recommended, optional. The name is a lie once it holds a costume fee. Zero rows, so cost is code references only.

### 3.2 `enrollment_cart_items`

| Change | Detail |
|---|---|
| ALTER | `class_id` → **nullable** (currently NOT NULL with FK → `classes`) |
| ADD | `item_type` NOT NULL, same vocabulary as §3.1 |
| ADD | `reference_id` nullable — polymorphic target (package, product) |
| ADD | `description text` nullable |

⚠️ **Vocabulary mismatch to resolve:** `charge_timing` exists on both tables with different CHECKs — cart uses `immediate | scheduled`, charge items use `charge_now | deferred`. Same concept, two vocabularies, silent translation between them. Unify on the charge-item spelling.

### 3.3 `payment_methods` — new, replaces `families.stripe_*`

```
id, tenant_id, family_id
owner_profile_id        -- whose card this is
processor               -- stripe | authorize_net | square | braintree
processor_customer_id
processor_method_id
processor_mandate_id
label                   -- "Visa ••4242", "Grandma's card"
is_default
created_at, archived_at
```

Migrate `families.stripe_customer_id`, `stripe_payment_method_id`, `stripe_mandate_id` in as one row per family, then **drop those columns**. Also resolve: `stripe_customer_id` currently exists on both `families` and `profiles` with no stated precedence.

This is what gives §5's `vaultToken() -> payment_method_id` a neutral column to write to.

### 3.4 `family_payers` — new

Payer ≠ family member. A grandparent pays without being a parent.

```
id, tenant_id, family_id, profile_id
relationship      -- parent | grandparent | guardian | other
can_view_billing  -- boolean; gates the family-wide view
is_active
```

### 3.5 `charge_item_splits` — new

```
id, tenant_id, charge_item_id
payer_profile_id
amount_cents
payment_method_id   -- nullable; falls back to payer default
status              -- pending | charged | paid | waived | failed
```

**Amounts, not percentages.** Three payers at 33.33% of $300 leaves a penny unassigned, and drift compounds every time proration adjusts the parent amount.

**Enforce exactly:** deferrable constraint trigger asserting `SUM(splits.amount_cents) = charge_items.approved_amount_cents` — same pattern as `trg_ledger_group_balanced`.

**Every charge item has ≥1 split**, including intact families. No unsplit case exists.

### 3.6 `payment_receipts` — new

Money that arrived, any channel.

```
id, tenant_id, family_id
payer_profile_id  -- nullable; who handed it over
method            -- card | cash | check | venmo | zelle | ach | other
reference         -- check number, Venmo handle, note (nullable)
amount_cents
received_date     -- when money arrived
recorded_by, recorded_at
notes
```

`received_date` distinct from `recorded_at` is load-bearing — a Venmo payment on the 3rd entered on the 9th ages against the 3rd.

### 3.7 `receipt_allocations` — new

> **Named `receipt_allocations`, not `payment_allocations`.** That name was created 2026-07-15 and dropped 2026-07-20 with different semantics (payments→invoices). Reusing it puts two incompatible definitions five days apart in migration history.

```
id, tenant_id
payment_receipt_id
charge_item_split_id   -- allocates to the SPLIT, not the charge item
amount_cents
```

**Constraints:**
- `SUM(allocations) <= payment_receipts.amount_cents`
- `SUM(allocations) <= charge_item_splits.amount_cents`
- Unallocated remainder → `families.account_credit`, backed by ledger account `2000 customer_credit_liability`

**Derived at read time, never stored** (consistent with `is_partial` omission on `refunds`):
`amount_paid_cents`, `payment_status` = `unpaid | partially_paid | paid`

### 3.8 Tagging — `tags` + `ledger_entry_tags`

Controlled vocabulary, not free text. Free-form rots into "Nutcracker" / "nutcracker" / "NC26" and reporting silently lies.

```
tags
  id, tenant_id
  slug, label
  tag_type        -- production | location | season | program | campaign | custom
  parent_tag_id   -- "Nutcracker 2026" under "Nutcracker"
  source_table    -- 'productions' | 'studio_locations' | 'seasons' | null
  source_id       -- the record that spawned it
  is_active, archived_at
```

`source_table`/`source_id` drives **auto-tagging**: creating a production auto-creates its tag. Nobody types anything.

```
ledger_entry_tags
  id, tenant_id
  ledger_entry_id
  tag_id
  applied_by      -- 'auto' | profile_id
```

**Junction is mandatory, not stylistic.** `trg_ledger_entries_immutable` fires BEFORE UPDATE OR DELETE. A tag column on `ledger_entries` could never be corrected without a reversing entry. The junction sits outside the trigger.

**Existing dimension columns stay.** `ledger_entries` already carries `family_id`, `student_id`, `class_id`, `location_id`, `event_id`, `teacher_id`, `product_id`, `award_id`, `discount_id` — all nullable, all currently **unpopulated by the posting code** (`location_id` is null on all 3 live rows). These are immutable-at-posting facts and belong as columns. Tags are the editable, spanning layer on top.

**Fix the posting code to populate them.** `lib/billing/ledger-posting.ts` and callers must set `location_id`, `class_id`, `student_id`, `family_id` on every entry. This is a bug, not a feature request.

### 3.9 Cleanup folded in

| Item | Action |
|---|---|
| `ledger_entries.invoice_id`, `payment_id`, `line_item_id` | Vestigial — point at tables dropped 2026-07-20. Drop them |
| Ledger account `1010` "Cash – Stripe Clearing" | Rename to "Cash – Processor Clearing". Wrong the moment tenant #2 uses Square |
| Ledger account `undeposited_funds` | **Missing.** Add — asset/debit. Required by §6 |
| `productions.tenant_id` | **Does not exist.** Multi-tenant hole — productions cannot be tenant-filtered. Add NOT NULL + FK |
| `productions.season` | Text, not FK to `seasons.id`. "All Nutcracker costs this season" is unexpressible. Convert |
| `timesheet_entries.production_id` | No FK constraint — orphan/typo risk. Add it |

---

## 4. Admin placement — three modes

| Mode | Owed | Charge items | Settlement |
|---|---|---|---|
| **Comp** | $0 | Full amount + waive adjustment | Never |
| **Manual** | Full | Full amount, no processor intent | Via `payment_receipts` |
| **Vault request** | Full | Full amount, armed | Auto-charge on vault completion |

### 4.1 Comp
Scholarship, staff child, promo. Create charge items **at full amount** and apply a waive via `lib/billing/adjustments.ts` (basis-points convention). Never zero-amount items — reporting must answer both "what would we have charged" and "what did we waive." Posts to `4910 scholarships_awards` or `4900 discounts_given`.

### 4.2 Manual
Venmo, Zelle, cash, check. Full amount owed, ages normally, appears in outstanding balances, satisfied by a `payment_receipt` allocation. **Not comp** — comp means nothing is owed.

### 4.3 Vault request
Parent invited to add a method. **On vault completion → auto-charge.** The admin already did the approval work at placement. Routing back through `/admin/enrollment/approvals` makes Amanda approve her own placement.

Same charge engine (`lib/billing/approval-repo.ts`); the approval is recorded at placement, the trigger is the vault event.

**Staleness guard:** `placement_expires_at` (tenant config, default 14 days). Vault after expiry → drops into the approvals queue instead of auto-charging, because the proration is stale. Needs a cron; pairs with the hold-expiry cron already scoped in Phase 3.

---

## 5. Card entry — processor-hosted only

**Hard rule: no card data touches platform-controlled inputs or the platform server.** An admin typing a PAN into an input the server can see puts the platform in PCI DSS scope as a card-data environment — SAQ D, annual audit, real liability, multiplied per tenant.

The card field is an element rendered by the **processor**, embedded in platform UI. Card data goes browser → processor. Server receives a token.

| Processor | Element |
|---|---|
| Stripe | Elements |
| Authorize.net | Accept.js |
| Square | Web Payments SDK |
| PayPal | Braintree Hosted Fields |

Each adapter exposes:
```
renderCardElement(container, options)
vaultToken(elementResult) -> payment_method_id
```

**Caveats:** card-not-present keyed transactions carry higher chargeback liability — capture parent authorization at vault time. And this is **not compliance advice**; before tenant #2, spend an hour with someone who does PCI professionally.

---

## 6. Ledger treatment

| Event | Debit | Credit |
|---|---|---|
| Charge item created | `1100 accounts_receivable` | `2030 deferred_revenue_tuition` (or type-specific) |
| Card charge succeeds | `1010 cash_clearing` | `1100 accounts_receivable` |
| Offline payment recorded | `undeposited_funds` *(to add)* | `1100 accounts_receivable` |
| Comp / waive | `4900 discounts_given` / `4910 scholarships_awards` | `1100 accounts_receivable` |
| Overpayment remainder | `1010 cash_clearing` | `2000 customer_credit_liability` |

**Splits post individually.** A $300 charge across three payers is three A/R debits and three revenue credits, not one lump. Partial payment needs no special handling — it credits A/R partially and derived `payment_status` becomes `partially_paid`.

**Revenue accounts already exist** for the types §1.1 calls unrepresentable: `4020 revenue_private_lessons`, `4030 revenue_costume_purchase`, `4031 revenue_costume_rental`, `4040 revenue_merch`, `4050 revenue_events`. The ledger was built for this; only the charge-item layer wasn't.

---

## 7. Downstream consequences of split-as-unit

| System | Change |
|---|---|
| **Draw engine** (Phase 3, unbuilt) | Iterates splits, not charge items. Each hits its own payment method |
| **Dunning** | Per-payer. Dad's card fails → Dad gets +1/+3/+5. Mom never knows |
| **Allocation** | Receipts allocate to splits |
| **Approvals queue** | Shows charge item total; expandable to per-payer splits |
| **Receipts** | Per-payer, not per-family |

The draw engine being unbuilt is fortunate — split-aware from the start costs nothing; retrofitting would have been ugly.

---

## 8. RLS — hard requirement, not polish

A payer sees **their own splits and nothing else.** Grandma sees her $150 — not the family balance, not Dad's card, not Mom's payment history.

- `payment_methods` — visible to `owner_profile_id` and admins. Never to other payers
- `charge_item_splits` — visible to `payer_profile_id` and admins
- `payment_receipts` — visible to `payer_profile_id` and admins
- Family-wide billing view gated on `family_payers.can_view_billing`

Per existing rules: helper functions must be `SECURITY DEFINER` querying `profile_roles`, never `profiles` directly, to avoid recursion.

Get this wrong and it generates an angry phone call to Amanda.

---

## 9. Out of scope — separate specs

**Expense module / production P&L.** No expense table exists — no vendors, bills, or POs. Five expense accounts (`5000 payroll_wages_expense`, `5100 processing_fees_expense`, `5200 supplies_expense`, `5210 cogs_merch`, `5010 payroll_tax_expense`) with **no transactional way to post to any**. Timesheets carry `production_id`, `total_hours`, `rate_amount` — labor cost is arithmetically computable but never becomes an accounting entry.

Deferred because it is purely additive: no existing shape is wrong, and nothing degrades by waiting. **Tagging lands now** because untagged revenue is unreconstructable. When the expense module arrives, `ledger_entry_tags` already works for it — the junction is source-agnostic.

**Private packages.** `item_type` already includes `private_pack` and `credit_accounts` exists (points-denominated, student-scoped). Needs its own state machine. `private_session_billing.billing_status` emits `deducted_from_pack` — a status naming a table that does not exist.

**Payment request page** (processor-agnostic replacement for Stripe hosted invoices). UI over data that will already exist.

**Merchandise.** `products` and `shop_orders` exist, zero code references, `app/(shop)/shop/page.tsx` is a 9-line placeholder.

---

## 10. Dead code and silent failures

| Item | Location | Action |
|---|---|---|
| Billing override collected, never read | `families/actions.ts:395-400` | Wire to charge items or remove |
| `checkBillingPlan` always no-ops | `students/[id]/profile/actions.ts:457-499` | `unlimited_plans` does not exist — delete or build |
| Billing result never sent to server | `add-to-class-modal.tsx` `handleConfirm` | Fix or remove the step |
| Missing `enrolled_count` increment | `students/[id]/profile/actions.ts` | Add — roster counts drift |
| Placement release enrolls nobody | `lib/placements/release.ts` | Bridge to enrollments, or rename the feature |
| Ledger dimensions never populated | `lib/billing/ledger-posting.ts` | Set `location_id`, `class_id`, etc. on every entry |

---

## 11. Open questions for Amanda

1. **Grandparent portal access** — full login, or emailed receipts only? Determines whether payer profiles are full accounts or minimal records.
2. **Comp reasons** — picklist required? Recommend yes; `refunds.reason_id` is already NOT NULL by the same logic.
3. **Late fees** — charged? Automatic on aging or admin-applied?
4. **Costume / competition fees** — per-student flat, or per-production? Determines whether they need a production reference beyond the tag.
5. **Credit on account** — auto-apply to next charge, or wait for admin allocation? Recommend auto-apply with override.
6. **Consent copy** (§1.2) — what should it say?
7. **Default split behavior** — when a family has two payers and no explicit split, 50/50 or 100% to default payer? Recommend 100% to default; silent 50/50 will surprise people.

---

## 12. Build phases

| Phase | Scope | Blocks |
|---|---|---|
| **A** | Charge item + cart ALTERs, `item_type` vocabulary, `description`, FKs, §3.9 cleanup | Everything |
| **B** | `payment_methods` + migrate off `families.stripe_*`; `family_payers` | C, D |
| **C** | `charge_item_splits` + balance trigger; split-aware charge engine | Draw engine |
| **D** | `payment_receipts` + `receipt_allocations`; admin offline-payment UI | Go-live |
| **E** | Admin card vaulting via processor elements | Go-live |
| **F** | Admin placement modes + expiry cron | Go-live |
| **G** | `tags` + `ledger_entry_tags`; auto-tag on posting; populate dimensions | Reporting |
| **H** | RLS policies for payer visibility | **Go-live — do not ship C–F without it** |
| **I** | Dead code cleanup (§10) | — |

A is a hard prerequisite. B→C is ordered. G can run parallel to C–F. **H is not optional** — shipping splits without RLS exposes payers to each other.

---

## 13. Migration discipline

- Supabase MCP is **read-only**. All DDL via `supabase db push` in Regular Terminal.
- `IF NOT EXISTS` guards; pre-flight `DO` blocks with `RAISE EXCEPTION` on unresolvable data.
- `supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts` after each change.
- `tsc --noEmit` before committing.
- No FK references to tables not confirmed present in the remote DB.
- `tenant_id` FKs on financial tables use **NO ACTION** — financial records block tenant deletion, never cascade.
- All affected tables are currently **empty**. Backfill guards should still be written — they have teeth once real data exists.
