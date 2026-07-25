# Billing Generalization — Admin Placement, Offline Payments, Non-Class Charges

**Status:** DRAFT — not yet committed
**Author:** Derek Shaw
**Date:** 2026-07-25
**Supersedes:** the "admin-placement billing mode" line item in `SESSION_PICKUP.md` §5.2, which scoped this as a pay-link-vs-comp decision. It is not. It requires schema change.

---

## 1. Problem

Every admin path that enrolls a student enrolls them **for free**.

The sole writer of billing artifacts in the system is `app/api/enrollment/webhook/route.ts:491` — the Stripe checkout webhook. Admin placement and the money path are entirely disjoint. Verified 2026-07-25:

| Admin path | Enrollment row | Charge items | Ledger |
|---|---|---|---|
| Class roster enroll modal | ✅ | ❌ | ❌ |
| Student profile enroll | ✅ | ❌ | ❌ |
| Lead → student convert | ❌ | ❌ | ❌ |
| Placement release | ❌ | ❌ | ❌ |

Worse than absent: the class roster enroll modal **collects** proration method, billing override, override amount, and override reason, writes them to the `enrollments` row, and nothing ever reads them. An admin fills in a billing override, sees it save, and no money moves. Silent failure that looks like success.

### 1.1 The structural blocker

Two NOT NULL columns encode the assumption that **every dollar traces to a class enrollment**:

- `enrollment_cart_items.class_id` — the cart cannot hold a private package, a fee, or merchandise
- `enrollment_charge_items.enrollment_id` — a standalone costume or competition fee is unrepresentable

That assumption held when parent self-checkout was the only money path. It does not hold for a studio that places students directly, sells private packages, and bills costume and competition fees — all of which Studio Pro does today and the platform must do before Fall go-live.

### 1.2 Live copy problem (Amanda decision, not a code fix)

Checkout consent text at `app/(portal)/portal/enrollment/cart/cart-view.tsx:216` and `app/(public)/enroll/cart/cart-view.tsx:268` has parents agreeing to recurring charges for "registration, costumes, competitions, and adjustments." **Costumes and competitions have no billing mechanism anywhere in the codebase.** Parents are consenting to charges the platform cannot produce. Same class of issue as the trial/refund promise removed in `d74fa15`.

---

## 2. Core decision — the family is the billing anchor

Do not build a parallel billing system for non-class charges. That yields two money paths and defeats the double-entry ledger. Generalize the existing spine instead.

**A charge item is money a family owes.** It *may* be attributable to an enrollment, a student, or a class. It is not *defined* by any of them.

---

## 3. Schema changes

> ⚠️ **All column names below must be verified against live schema before implementation** per `bam-schema-sync`. This spec was written from a code investigation, not from a full schema dump. Treat every column reference as a hypothesis until `supabase gen types` confirms it.

### 3.1 `enrollment_charge_items` → generalize

| Change | Column | Notes |
|---|---|---|
| ALTER | `enrollment_id` → **nullable** | Present for tuition/registration, null otherwise |
| ADD | `family_id` **NOT NULL** | The payer. The anchor. FK to `families` |
| ADD | `student_id` **nullable** | Who it's *for*. Costume fee is per-student, paid by family |
| ADD | `charge_item_type` **NOT NULL** | Discriminator, CHECK-constrained |

`charge_item_type` values:
`tuition | registration | private_package | costume | competition | late_fee | merchandise | adjustment`

**Backfill:** existing rows get `family_id` resolved via `enrollments.student_id → students.parent_id` (note: `enrollments` has no `parent_profile_id`), `student_id` from the enrollment, and `charge_item_type` derived from existing type/description columns. Pre-flight `DO` block must `RAISE EXCEPTION` if any row fails to resolve a `family_id`.

**Table rename — recommended, optional:** `enrollment_charge_items` → `charge_items`. The current name becomes a lie the moment it holds a costume fee. Production data is test-only per `SESSION_PICKUP.md` §4, so the cost is code references, not data risk. If deferred, note the misnomer in `CLAUDE.md` so it doesn't mislead later.

### 3.2 `enrollment_cart_items` → generalize

| Change | Column | Notes |
|---|---|---|
| ALTER | `class_id` → **nullable** | |
| ADD | `item_type` **NOT NULL** | Same enum as `charge_item_type` |
| ADD | `reference_id` **nullable** | Polymorphic target (package id, product id) |

`price_cents`, `student_id`, `student_name`, `charge_timing` already exist and carry over unchanged.

### 3.3 New: `payment_receipts`

Money that arrived. One row per payment event, regardless of channel.

```
id, tenant_id, family_id,
method            -- card | cash | check | venmo | zelle | ach | other
reference         -- check number, Venmo handle, transaction note (free text, nullable)
amount_cents      -- total received
received_date     -- when the money arrived (NOT when it was recorded)
recorded_by       -- profile id of the admin
recorded_at
notes
```

`received_date` distinct from `recorded_at` is load-bearing — a Venmo payment on the 3rd entered on the 9th ages correctly against the 3rd.

### 3.4 New: `payment_allocations`

Which receipt satisfies which charge item. Many-to-many, enabling partial payment.

```
id, tenant_id,
payment_receipt_id,
charge_item_id,
amount_cents
```

**Constraints:**
- `SUM(allocations.amount_cents) <= payment_receipts.amount_cents` for a given receipt
- `SUM(allocations.amount_cents) <= charge_items.amount_cents` for a given charge item
- Unallocated receipt remainder = **credit on the family account** (surfaces in `credit_accounts`, which already exists)

**Derived at read time, never stored** (consistent with the `is_partial` decision on `refunds`):
- `charge_item.amount_paid_cents` = `SUM(allocations)`
- `charge_item.payment_status` = `unpaid | partially_paid | paid`

---

## 4. Admin placement — three modes, not two

Earlier framing collapsed "comp/manual" into one mode. They are meaningfully different and both are needed on day one. Conflating them would corrupt revenue reporting.

| Mode | Amount owed | Charge items created | Settlement |
|---|---|---|---|
| **Comp** | $0 | Full amount + waive adjustment | Never — waived |
| **Manual** | Full | Full amount, no processor intent | Later, via `payment_receipts` |
| **Vault request** | Full | Full amount, armed | Auto-charge on vault completion |

### 4.1 Comp

Scholarship, staff child, promotional placement. Create charge items **at full amount** and apply a **waive adjustment** using the existing adjustment machinery (`lib/billing/adjustments.ts`, basis-points convention). Do not create zero-amount charge items.

Rationale: reporting must be able to answer "what would we have charged?" and "what did we waive?" Zero-amount items destroy both. The waive path also already has an audit trail.

### 4.2 Manual

Family pays by Venmo, Zelle, cash, or check. Full amount owed. Charge item ages normally, appears in outstanding balances, and is satisfied when an admin records a `payment_receipt` and allocates it.

**This is not comp.** Comp means nothing is owed. Manual means the full amount is owed and arrived by another route.

### 4.3 Vault request

Parent has no card on file. Admin places the student; parent receives an invitation to add a payment method.

**On vault completion → auto-charge.** The admin already did the approval work at placement: chose the class, set proration, adjusted amounts. Routing it back through `/admin/enrollment/approvals` makes Amanda approve her own placement — a redundant gate she will resent.

Mechanically this is still the one charge engine (`lib/billing/approval-repo.ts`). The approval decision is recorded at placement time; the trigger is the vault event rather than a button click.

**Staleness guard:** placement carries `placement_expires_at` (tenant config, default 14 days). If the parent vaults after expiry, the placement does **not** auto-charge — it drops into the approvals queue for a fresh look, because the proration computed at placement is no longer correct. Requires a cron; pairs naturally with the hold-expiry cron already scoped in Phase 3.

---

## 5. Admin-side card entry — processor-hosted only

Amanda takes card numbers over the phone and at the front desk. This must be supported. It must **never** be a form field the platform renders.

**Hard rule: no card data may touch platform-controlled inputs or the platform server.** An admin typing a PAN into an input the server can see puts the platform in PCI DSS scope as a card-data environment — SAQ D, annual audit burden, real liability, multiplied across every tenant studio onboarded.

**Pattern:** the card field on the admin page is an **element rendered by the processor**, embedded in the platform's UI. Card data goes browser → processor. The platform server receives a token only.

All four target processors support this identically:

| Processor | Element |
|---|---|
| Stripe | Elements |
| Authorize.net | Accept.js |
| Square | Web Payments SDK |
| PayPal | Braintree Hosted Fields |

This satisfies the pluggable-processor requirement cleanly. Each adapter exposes the same two operations:

```
renderCardElement(container, options)
vaultToken(elementResult) -> payment_method_id
```

The UI is the platform's. The collection is the processor's.

**Two caveats to carry forward:**
1. Keyed/card-not-present transactions carry higher chargeback liability than parent-initiated ones. Amanda should have written parent authorization on file. Consider a consent capture at vault time.
2. **Not compliance advice.** Before onboarding tenant studio #2, this needs an hour with someone who does PCI professionally.

---

## 6. Ledger treatment

Every path below posts a balanced double-entry pair. The DB-enforced balance constraint is unchanged.

| Event | Debit | Credit |
|---|---|---|
| Charge item created | Accounts Receivable | Deferred Revenue |
| Card charge succeeds | Processor Clearing | Accounts Receivable |
| Offline payment recorded | Undeposited Funds | Accounts Receivable |
| Comp / waive applied | Discounts & Waivers (contra-revenue) | Accounts Receivable |
| Partial payment | Undeposited Funds | Accounts Receivable (partial) |

Partial payment requires no special ledger handling — it credits A/R partially and the charge item's derived `payment_status` becomes `partially_paid`.

> ⚠️ **Account names above are proposed, not verified.** The existing ledger account structure must be read before implementation. If accounts like "Undeposited Funds" or "Discounts & Waivers" don't exist, they need to be added to the chart of accounts as part of this work.

---

## 7. Explicitly out of scope

**Stripe-hosted invoices / pay links — rejected.** Hardcodes Stripe into the settlement flow and violates the pluggable-processor requirement. The processor-agnostic replacement is a **payment request page** native to the parent portal: shows what's owed, pay button routes through the tenant's configured adapter. Worth specifying, but not required for go-live if comp/manual and vault request cover Amanda.

**Private packages — separate spec.** This spec unblocks them by generalizing charge items, but the package concept itself (definition, purchase, credit balance, deduction-on-session) is its own design. Groundwork exists: `credit_accounts` is a real table, and `private_session_billing.billing_status` already emits `deducted_from_pack` — a status naming a table that does not exist. See §8.

**Merchandise.** `products` and `shop_orders` exist with zero code references; `app/(shop)/shop/page.tsx` is a nine-line placeholder. Generalized charge items make it possible. Nothing more here.

**`unlimited_plans`.** Referenced by `checkBillingPlan` at `app/(admin)/admin/students/[id]/profile/actions.ts:457-499` and by `hasUnlimitedPlan` in the privates flow. **The table does not exist.** Both lookups sit inside `try {} catch {}` and silently no-op. Either build the concept or delete the dead checks — do not leave code that pretends to verify billing eligibility and doesn't.

---

## 8. Known dead code and silent failures to resolve

| Item | Location | Action |
|---|---|---|
| Billing override fields collected, never read | `families/actions.ts:395-400` | Wire to charge items, or remove from modal |
| `checkBillingPlan` always no-ops | `students/[id]/profile/actions.ts:457-499` | Delete or build `unlimited_plans` |
| Billing result never sent to server | `add-to-class-modal.tsx` `handleConfirm` | Fix or remove the step |
| Missing `enrolled_count` increment | `students/[id]/profile/actions.ts` | Add — roster counts silently drift |
| `deducted_from_pack` names no table | `privates/actions.ts:226-233` | Resolve in package spec |
| Placement release enrolls nobody | `lib/placements/release.ts` | Decide: bridge to enrollments, or rename the feature |

---

## 9. Open questions for Amanda

1. **Comp reasons** — should comp require a picklist reason (scholarship / staff / promo / other)? Recommend yes; `refunds.reason_id` is already NOT NULL by the same logic.
2. **Late fees** — does the studio charge them? If so, automatic on aging or admin-applied?
3. **Costume and competition fees** — per-student flat, or per-production? Determines whether they hang off `student_id` alone or need a production reference.
4. **Credit on account** — when an overpayment leaves a credit, does it auto-apply to the next charge or wait for admin allocation? Recommend auto-apply with admin override.
5. **The consent copy** (§1.2) — what should it say, given costumes and competitions can't currently be billed?

---

## 10. Build phases

| Phase | Scope | Blocks |
|---|---|---|
| **A** | Charge item + cart generalization, backfill, type regen | Everything below |
| **B** | Admin placement: comp, manual, vault request + expiry cron | Go-live |
| **C** | `payment_receipts` + `payment_allocations`, partial allocation, admin UI | Go-live |
| **D** | Admin-side card vaulting via processor elements | Go-live |
| **E** | Dead code cleanup (§8) | — |
| **F** | Payment request page, private packages, merchandise | Post-go-live |

A is a hard prerequisite. B, C, and D are independent of each other once A lands.

---

## 11. Migration discipline

Per `CLAUDE.md` and `bam-schema-sync`:

- Supabase MCP is **read-only**. All DDL via `supabase db push` in Regular Terminal.
- Every migration: `IF NOT EXISTS` guards, pre-flight `DO` block with `RAISE EXCEPTION` on unresolvable data.
- `supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts` after each schema change.
- `tsc --noEmit` before committing.
- No FK references to tables not confirmed present in the remote DB.
- Phase A's backfill touches financial records. `tenant_id` FKs on financial tables use NO ACTION by standing rule — do not introduce CASCADE.
