# Commerce & Billing — Master Architecture

**Status:** Draft architecture — awaiting approval
**Last updated:** 2026-07-10
**Scope:** the platform's entire financial backbone — payments, the dimensioned financial ledger, revenue billing (review-and-approve cycle), expense capture, P&L reporting, QuickBooks export, the pricing/bundle/discount engine, admin commerce tools, and the Angelina upsell layer. Designed multi-tenant.
**Related:** `_INDEX.md` task 19 (occurrence generator — NOT a blocker for payment); `docs/CLASS_MEETINGS.md` (`allow_single_day` is a pricing input); the payment reality-map findings (2026-07-10).

> **This is the largest and highest-stakes system in the platform.** It handles money and feeds accounting. It must be built in ordered, independently-shippable slices, spec-first, never one monolithic build. This document is the master map; each layer/slice gets its own build with its own review.

---

## 0. Guiding principles

1. **One dimensioned financial ledger is the spine.** Every chargeable/costable thing — revenue and expense — is a ledger entry tagged with the accounting dimensions. Reporting, billing, and QBO export all read from it. Modules *feed* it; they don't each hold their own money truth.
2. **Design-for-later, build-now-in-order.** Overhead allocation and rentals are *designed for* (the ledger accommodates them) but not built until their dependencies land. Getting the ledger's dimensions right now is what makes them additive later instead of a rebuild.
3. **Review before charge.** No blind auto-pay. Charges are assembled, reviewed/approved (risk-based batching), then run against saved payment methods.
4. **Reconcile, don't fork.** Two half-built payment paths, an unused cart, and an unconsumed pricing table already exist. Everything converges onto one ledger + one checkout spine. No third parallel implementation.
5. **Finance rules are captured, not invented.** Chart of accounts, QBO mapping, discount stacking, bundle tiers, and overhead-allocation methodology are decisions for Derek + Amanda + a bookkeeper. Flagged in §11, not guessed.

---

## 1. Current reality (from the payment reality-map, 2026-07-10)

**Exists / real:** Stripe SDK + config (`lib/stripe.ts`, single key, no test/live split); two one-time payment paths — PaymentIntent (chat) and Checkout Session (cart); a **fully-wired Checkout-Session → webhook → creates enrollment + email** path (Path B); `enrollments` with `stripe_payment_intent_id`, `amount_paid_cents`, `billing_plan_type`; `classes.fee_cents` (all 63 populated); `class_pricing_rules` (13 real rows — tiers + early-bird discounts, **unconsumed**); `bundle_configs`, `credit_accounts`, `credit_transactions`, `enrollment_carts`, `enrollment_cart_items` (all real, **empty**).

**Broken / stubbed:** the live `/enroll` chat path — request-contract mismatch (no charge) + phantom `enrollment_count` column in finalization (no record); `payment_intent.succeeded` webhook is a stub; client-side, non-idempotent finalization. **0 enrollments, 0 carts, 0 payments ever.**

**Not present:** Stripe Customers, saved payment methods, Subscriptions; any expense/ledger/invoice tables; consumption of `class_pricing_rules`/`bundle_configs`.

**Not blocked by task 19:** payment/enrollment creation is independent of the broken occurrence stack. (Only post-enrollment "upcoming sessions" display depends on task 19.)

---

## 2. The spine — dimensioned financial ledger

A single ledger where every revenue and expense entry lands, carrying the dimensions accounting needs.

**`ledger_entries` (new):**
| Field | Notes |
|-------|-------|
| `id`, `tenant_id` | |
| `direction` | `revenue` \| `expense` |
| `account` / `category` | e.g. revenue: tuition, registration, costume, production, competition, private, rental; expense: costume_cost, venue, staff_pay, rent, utilities, insurance, props. Maps to chart of accounts (§11). |
| `event_id` | nullable → production/competition/season the entry belongs to (enables event P&L) |
| `class_id` | nullable → class the entry belongs to (enables per-class P&L, incl. allocated overhead later) |
| `location_id` | nullable → `studio_locations` (per-location P&L; QBO class dimension) |
| `family_id` | nullable → for revenue (who owes/paid); null for most expenses |
| `amount_cents`, `currency` | signed by `direction` in reporting |
| `period` | billing/accounting period (e.g. 2026-08) |
| `occurred_at` / `posted_at` | |
| `source` | which module created it (enrollment, private, production, expense_entry, allocation, rental) |
| `discount_id` | nullable → applied discount |
| `review_tier` | `auto` \| `review` — drives the approval workflow (§4) |
| `charge_status` | `pending` \| `approved` \| `charged` \| `failed` \| `void` (revenue); `recorded` (expense) |
| `stripe_reference` | payment intent / charge id when charged |
| `qbo_export_ref` | set when exported/synced (§7) |

**Why dimensioned now:** with `event_id` + `class_id` + `category` on every entry, both revenue *and* cost of the same event/class share dimensions → true event and per-class P&L. Overhead allocation (Layer 4) and rentals (Layer 5) become "new sources writing tagged entries," not schema changes.

---

## 3. Layer 1 — Checkout spine (BUILD FIRST)

**Goal:** one reconciled path where a real charge produces a real record. Delivers the "test registering and paying" milestone. Unblocked; independent of everything below.

- **Reconcile to Path B's model:** server-side, idempotent finalization via the Checkout-Session webhook (`checkout.session.completed`) as the single source of record creation. Retire the chat's client-side `completeRegistration` + the stubbed `payment_intent.succeeded` path.
- **Fix the finalization bug:** phantom `enrollment_count` → `enrolled_count` (same class of bug already fixed in the catalog).
- **Write ledger + enrollment together:** a completed checkout creates the `enrollments` row(s) *and* the corresponding `ledger_entries` (revenue: tuition/registration), server-side, idempotent (keyed on the Stripe event/session id).
- **Add Stripe test/live config** (key-prefix or explicit env) so it can be tested with test keys.
- **Add Stripe Customers + save payment method** at first checkout — prerequisite for later batch charging (§4) and one-click.
- **Test milestone:** a real (test-mode) registration → charge → `enrollments` row + `ledger_entries` row + confirmation email. Verified in the live DB.

---

## 4. Layer 2 — Revenue billing: the review-and-approve cycle

**Goal:** assemble each family's charges for a period, review with risk-based batching, then batch-charge saved payment methods. **No auto-pay subscriptions** — the review gate is the point.

- **Assembly:** a periodic (monthly) job creates `pending` revenue `ledger_entries` per family from all revenue sources (tuition from enrollments, privates from `private_sessions`, production/competition/costume/registration from their modules), with discounts applied.
- **Review tiers (risk-based batching):**
  - `auto` — flat, predictable charges (once-a-week adult, baby classes, standard flat tuition). Bulk-approvable / default-approve.
  - `review` — variable charges (privates, production/competition, costume, multi-class bundles with stacked discounts). Require eyes.
- **Review UI:** admin filters the batch (e.g. "families with privates", "families with production charges", "flat tuition only"), bulk-approves the safe segments, and reviews/adjusts/holds the variable ones. Default posture: **nothing charges until approved**, but `auto`-tier can be bulk-approved in one action so it doesn't require per-family clicks.
- **Batch charge:** approved entries charge against saved Stripe Customers/payment methods. Failures are recorded (`failed`) and surfaced for retry — never silently swallowed.
- **Idempotency + audit:** every charge keyed and logged; who approved what, when.

---

## 5. Layer 3 — Expenses + event P&L + QBO export

**Goal:** capture expenses so P&L is real, and export cleanly to QuickBooks Online.

- **Expense entry (admin):** create expense `ledger_entries` — props, venue/costume costs, teacher fees — tagged with `category`, `event_id`/`class_id`, `period`. Teacher fees tie in from the existing timesheet/pay concepts.
- **P&L reporting:** revenue − expense grouped by `event_id`, `category`, `class_id`, `location_id`, `period`. Event P&L ("did the Spring Production net positive after costumes/venue/staff") falls out of the shared dimensions.
- **QBO export (design-now, integrate-later):** export ledger entries mapped to QuickBooks Online — `account`/`category` ↔ QBO chart of accounts, `location_id`/`event_id` ↔ QBO classes/locations. **Start with clean CSV/IIF-style export**; a live QBO API integration is a later slice built on the same mapping. The `qbo_export_ref` field + a defined mapping table make the eventual API integration additive.

---

## 6. Layer 4 — Overhead allocation → per-class P&L (DESIGNED-FOR, NOT BUILT)

**Goal:** allocate fixed overhead (rent/mortgage, utilities, insurance) across classes by usage to get true per-class P&L.

- **Model:** allocation rules generate expense `ledger_entries` tagged to `class_id` (and `location_id`), drawing from high-level overhead figures, apportioned by an **allocation basis**.
- **Why deferred:** the allocation methodology is genuinely hard and is a *finance* decision (§11): what basis (scheduled class-hours? enrolled students? room-hours × square footage?), how unused/empty room-time absorbs cost, fixed vs. variable treatment. Guessing this produces precise-looking, wrong numbers.
- **Design-for:** because Layer 2/3 entries already carry `class_id`/`location_id`/`period`, allocation is "a rule that writes tagged expense entries" — additive, no ledger rebuild. **Build only after Layers 1–3 and after the methodology is set with a bookkeeper.**

---

## 7. Layer 5 — Studio rentals billing (DESIGNED-FOR, NOT BUILT)

**Goal:** use the platform to bill studio/room rentals.

- **Model:** rentals are another **revenue source** feeding the same ledger (`category=rental`, tagged `location_id`/`room_id`, `family_id` or an external renter), charged through the same checkout/charge spine.
- **Design-for:** additive once the ledger + charge spine exist. Room/location data already exists (`rooms`, `studio_locations`). Build after Layers 1–2.

---

## 8. Pricing / bundle / discount engine

**Goal:** admin-configurable pricing that checkout and Angelina both read.

- **À la carte / drop-in:** per-class and drop-in rates (build on `class_pricing_rules`, currently unconsumed; `classes.fee_cents` is today's flat price).
- **Bundles:** volume tiers (2/3/4/5/6/7/8/unlimited per month) as admin-built `bundle_configs` data, each with price and **level/placement gates** (via studio levels/programs). Fixed packages first; dynamic "any N classes" pricing is a later refinement.
- **Discounts:** typed (early-enrollment/time-based, military/eligibility-based, scholarship/admin-granted) with a **stacking/precedence engine** (which combine, which exclude) — §11 decision.
- **Resolver:** a single pricing resolver answers "what does this cart cost, with which discounts, and what's the next-tier/marginal cost" — consumed by checkout *and* Angelina.

---

## 9. Commerce surfaces & admin tools

- **In-portal catalog + cart + checkout:** logged-in families browse bundles-made-of-classes, add to cart (`enrollment_carts`), one-click checkout (saved customer), get upsold. **Not gated behind the Angelina lead funnel** — commerce is a platform primitive.
- **Admin cart-builder → send-to-parent:** admin assembles a cart (classes/bundles/charges) and sends it to a family to verify and pay (quote-to-pay).
- **Admin direct-charge:** admin charges a family directly against a saved method (feeds the ledger like any charge, subject to review-tier rules).
- **Cart as a shared primitive:** same cart model serves admin-built and parent-built flows.

---

## 10. Angelina upsell layer (CAPSTONE)

- Angelina is **not** a checkout surface — she is a conversational advisory layer over the pricing resolver (§8), for **new and existing** families.
- Reads cart + pricing state to nudge: "one more class reaches unlimited," "you've saved $200 bundling these three — add a Jazz class?"
- **Hard dependency:** requires the pricing/bundle engine (§8) to exist — she can only be as smart as the resolver she queries. Build last.

---

## 11. Open items — need Derek / Amanda / bookkeeper (DO NOT GUESS)

- **Chart of accounts** + the revenue/expense `category` list (finance + QBO decision).
- **QBO mapping:** which categories ↔ which QBO accounts; `location_id`/`event_id` ↔ QBO classes/locations.
- **Bundle tiers + exact prices** (BAM's real pricing sheet) and their **level/placement gates**.
- **Discount stacking/precedence** rules (early + military + scholarship: which stack, which exclude, order of application).
- **Overhead allocation methodology** (Layer 4): allocation basis, empty-time treatment, fixed vs. variable — a bookkeeper/CPA decision.
- **Review workflow specifics:** exactly which charge types are `auto` vs. `review`; who approves; retry policy on failed charges.
- **Auto-pay stance confirmed:** review-and-approve batch charging, NOT subscriptions. (Confirmed 2026-07-10.)

---

## 12. Build sequence (dependency order)

1. **Layer 1 — checkout spine** (one reconciled path, real charge → ledger + enrollment, saved customers, test keys). ← start here; testable-payment milestone.
2. **Ledger foundation** — `ledger_entries` schema + Layer 1 writes revenue entries.
3. **Layer 2 — review-and-approve billing** (assembly, review tiers, batch charge).
4. **Pricing engine (§8)** — resolver + bundles + discounts wired into checkout.
5. **Layer 3 — expenses + event P&L + QBO export.**
6. **Commerce surfaces + admin tools (§9).**
7. **Angelina upsell (§10).**
8. **Layer 5 — rentals**, then **Layer 4 — overhead allocation** (after methodology is set).

Each is its own spec'd, tested, reviewed slice. `class_meetings` (A-full) proceeds in parallel — it's the scheduling foundation and independent of billing, though `allow_single_day` becomes a pricing input at step 4.
