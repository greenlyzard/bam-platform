# Commerce & Billing — Addendum v4

**Status:** Addendum to `docs/COMMERCE_BILLING_ARCHITECTURE.md` (v3.1). Not yet merged.
**Purpose:** Captures decisions + new scope from the pricing/ops session. Extends or supersedes specific v3.1 sections as noted.

> **MERGE INSTRUCTION (do this, don't let it drift):** This file is a staging document. The final step is to fold these sections into the canonical `COMMERCE_BILLING_ARCHITECTURE.md` (bumping it to v4) via Claude Code, then delete or mark this addendum "MERGED". Do not maintain two living docs — the doc-drift we already hit is exactly what this avoids. Until merged, the canonical doc + this addendum together are the spec, with this addendum winning on any conflict.

All money = integer cents. Where a section says "supersedes," the v3.1 text is replaced by this on merge.

---

## A. Locked Numbers & Decisions (this session)

1. **Registration fee** — **$50** per family, per season (default; class override and award waivers still apply).
2. **Tuition** — recurring monthly on the 15th; **per-level class-count tier ladders** (§B), not a flat per-class rate. Early-bird numbers captured; **standard (higher) rates pending from Amanda**.
3. **Point value** — **1 point = $1**. Points are **entitlement-only** (§D) — not a general tender.
4. **Bundle savings** — show "you're saving $X vs à la carte" at **checkout and in the portal** (§E).
5. **Tuition run** — reviewable monthly batch: draft → review/adjust → approve → run-all; hybrid trigger (auto-draft + manual) (§F).
6. **Adjustments** — persist forward as new default **and** are flagged as anomalies for reporting (§G).
7. **Reporting** — sliceable by charge type, grouping, and every ledger tag (§H).
8. **Charge categories** — add `performance`, `competition`, `private`; performances/competitions tag events (§I).
9. **Event tags** — governed, hierarchical, drag-drop managed, icon-decorated, roll-up P&L (§J).
10. **Stripe** — credentials in hand; launch in **test mode** first to troubleshoot the pipe (§L).

**Still pending from Amanda (non-blocking for launch):** standard tuition schedule; costume/Nutcracker fees; competition fees; annual early-exit policy; transfer fee; sales-tax handling; per-teacher private flat payout + point cost; CA counsel sign-off on fee recovery.

---

## B. Per-Level Tuition Tier Model  *(supersedes §6 tuition pricing; §4 gains tables)*

Tuition is a **class-count ladder that varies by level**. Each level/program defines its own schedule and its own **Unlimited cap**. Early-bird and standard are **deadline tiers** on the same schedule.

Observed San Clemente 2026–27 **early-bird** shape (illustrative — each level owns its own rows):

| Classes/mo | Typical total |
|---|---|
| 1 | $125 |
| 2 | $200 |
| 3 | $250 |
| 4 | $300 |
| 5 | $350 |
| 6 | $400 |
| 7 | $450 |
| 8 | $500 |
| 9 | $550 |

Unlimited cap by level (early-bird): Baby&Me/Morning Petites $300 · Minis/Level 1 $350 · 2B/Pre-Co $400 · 2C $425 · 3B $500 · 3C/4B/4C/4D $550. Unlimited "includes all classes at your level and below."

**Why new tables:** `class_pricing_rules` holds a *per-class* amount and can't express count-based tiers, level-specific caps, or company packages. Keep `class_pricing_rules` for the **drop-in** rate (`label='drop_in'`) and any true per-class pricing; move tuition tiers to:

### B.1 `tuition_price_schedules`
`level_id` (or `program_id`), `location_id`, `season_id`, `rate_tier` (`early_bird|standard`), `effective_deadline?` (early-bird valid through), `is_active`.

### B.2 `tuition_price_tiers`
`schedule_id`, `class_count` (int, nullable), `is_unlimited` (bool), `price_cents`. Rows encode the ladder; one row with `is_unlimited=true` sets the cap.

**Resolution (extends §6):** given student's level + location + season + today's date (→ early_bird vs standard by `effective_deadline`) + enrolled class count → look up `price_cents`. Unlimited election or count ≥ cap-equivalent → unlimited price.

### B.3 Company packages — `company_packages`
Flat monthly with mandatory days + per-extra-day upgrade to Unlimited.
`level_id`, `location_id`, `season_id`, `name`, `rate_tier`, `base_price_cents`, `mandatory_days` (text[] or int count), `extra_day_price_cents`, `unlimited_price_cents`, `is_active`.
Observed (early-bird): Mini Star $200 · Pre-Co (2B) $300 · Teen Co $250 · 3B $350 (+$75/day) · 3C $425 · 4B $450 (+$50/day) · 4C/4D $500 (+$50 Fri = Unlimited).

*Tiers and packages are per **location** — San Clemente and RSM can differ.*

---

## C. À La Carte vs Bundle

"À la carte" = the per-class tier price; a **bundle** (multi-class total, company package, or unlimited) is the discounted total. This makes savings a pure computation (§E).

---

## D. Points — Entitlement-Only  *(supersedes the "pay-per-use points as tender" framing in v3.1 §8/§12)*

Points exist **only inside pre-purchased packages**: private packs and Pilates class packs. **1 point = $1.**
- A points pack is a `bundle_entitlements` row (`denomination='points'`, `points_total/remaining`), purchased and held in `points_liability` until consumed (recognized on use per v3.1 §11).
- Booking a private/Pilates against a pack debits the teacher's **point cost** (1pt = $1) from the balance.
- **Pay-per-use** privates (no pack) charge **dollars directly** — no points involved.
- There is **no general points wallet** and points are **not a tender** for tuition/fees.

---

## E. Bundle Savings Display

`savings_cents = (Σ à la carte class-tier prices for the selected classes) − bundle/package price`.
Shown at **checkout** (as the family builds the bundle) and in the **parent portal** finance module. Computed at display; optionally snapshotted onto the invoice for the receipt record. Never negative-displayed (floor at $0).

---

## F. Tuition Run — Review-then-Run  *(extends §7)*

A monthly tuition charge is a **reviewable batch**, not a silent cron.

### F.1 `tuition_runs`
`period` (`YYYY-MM`), `location_id?`, `status` (`draft|reviewed|approved|executed|partially_executed`), `trigger` (`auto|manual`), `drafted_at`, `drafted_by?`, `approved_at?`, `approved_by?`, `executed_at?`, `executed_by?`, `family_count`, `total_cents`, `notes`.

### F.2 `tuition_run_lines` (per family/student review rows)
`run_id`, `family_id`, `student_id`, `computed_amount_cents` (from tiers §B), `adjusted_amount_cents?`, `adjustment_id?` (§G), `is_anomaly` (bool), `status` (`pending|reviewed|held|charged|failed`), `invoice_id?`, `payment_id?`, `note?`.

### F.3 Lifecycle
1. **Draft** — hybrid trigger: auto-drafts ahead of the 15th **or** an admin starts it manually. Draft resolves each family/student to `computed_amount_cents`, applies active persistent adjustments (§G), proration, awards/scholarships, credits.
2. **Review/adjust** — finance_admin reviews per family/student, edits amounts (each edit → an adjustment §G), holds anyone.
3. **Approve** — locks reviewed amounts for the period.
4. **Run all** — one action generates that month's invoices + charges card/ACH on file for the whole studio (the 15th run), off approved figures. Failures follow v3.1 dunning (keep active + flag).

This makes the recurring engine (v3.1 §7) **admin-gated and previewable** before money moves.

---

## G. Persistent, Flagged Adjustments + Anomalies

### G.1 `tuition_adjustments`
`family_id`, `student_id?`, `adjustment_type` (`waiver|custom_rate|credit|override`), `amount_cents` or `override_amount_cents`, `reason`, `is_anomaly` (bool, default true for any off-book value), `persist` (bool, default true), `effective_from`, `effective_to?`, `is_active`, `created_by`.

- **Persists:** active adjustments auto-apply to each future run's draft — no re-entry.
- **Flagged:** every deviation from the standard tier price is an anomaly with a reason + who set it — it never hides.
- **Anomaly report:** all active adjustments joined to families/students = "every family paying something other than book rate, and why" (§H).

---

## H. Reporting Layer  *(new)*

Because the ledger is dimensioned (`family / student / class / location / event / teacher / award / discount / period` + charge-type account + the anomaly flag), reports are **queries against `ledger_entries`** — no separate reporting store.

- **Slice by charge type:** tuition / registration / private / performance / competition / costume / merch / drop-in.
- **Group by:** family, student, level, location, season, teacher, **event (rolled up the tag tree §J)**, award/scholarship, commitment type, anomaly flag.
- **Standard reports:** monthly revenue by type; per-family statement; anomaly/non-standard tuition summary; **per-event P&L** (revenue − teacher labor, §I/§J); teacher economics.
- Expose as SQL views (`v_revenue_by_type`, `v_event_pnl`, `v_tuition_anomalies`, …).

---

## I. Charge Categories + Event-Linked P&L  *(extends §5 taxonomy, §11 accounts)*

Add line types / accounts: `performance` → `revenue_performance`; `competition` → `revenue_competition`; `private` → `revenue_private` (existing).
- **Performances and competitions tag the event** (§J leaf).
- **Teacher hours worked for an event tag the same event** (payroll posting stamps `event_id`), so per-event P&L = Σ revenue(event) − Σ teacher labor(event). This is the whole point of the `event_id` + `teacher_id` ledger dimensions.

---

## J. Event-Tag Hierarchy  *(supersedes §10 event tagging + the Layer-2 `event_id → productions` FK)*

Events are a **governed, hierarchical tag tree** — like blog categories.

### J.1 `event_tags`
`parent_id?` (self-FK), `name`, `slug`, `kind` (`root|category|event|instance`), `icon_id?` → `icon_library`, `production_id?`, `venue_location_id?`, `event_date?`, `path` (materialized path for fast rollup), `sort_order`, `is_active`, `created_by`.

Example tree:
```
Performances
└─ Nutcracker 2026
   └─ Nutcracker @ San Juan Hills   ← leaf; ledger entries tag this
Competitions
└─ [Comp Name] 2026
   └─ [specific competition]         ← leaf
```

### J.2 Rules
- **Governed vocabulary:** only Admin creates/authorizes tags — keeps reporting consistent (no free-typed duplicates).
- **Leaf tagging + roll-up:** ledger/line `event_id` points at a **leaf**; P&L rolls **up** at query time (materialized `path` or recursive CTE). A leaf's revenue/labor counts at every ancestor.
- **Reparenting is retroactive by design:** moving a node re-rolls its history under the new parent instantly — no re-tagging, because entries tag the leaf and rollup is at query time.
- **Venue tie-in:** an instance node links `venue_location_id` (partner venues like San Juan Hills) and optionally `production_id`.
- **Icons:** `icon_id` from the existing `icon_library` (33 rows), rendered on dashboards.
- **Safe delete/merge:** a node with ledger history **cannot hard-delete** — it must be archived or its entries reassigned/merged to another node.

### J.3 Admin tree manager (UI)
Central view of the whole tree with **drag-and-drop** reparent/reorder; editing `parent_id`/`path`/`sort_order`. Icon picker per node. This is where the taxonomy is shaped.

### J.4 Ledger reconciliation (important)
Layer-2 added `ledger_entries.event_id → productions(id)`. This is **superseded**: repoint `event_id → event_tags(id)`. Migration path: create `event_tags`, seed nodes (productions become `kind='event'`/`instance` nodes or link via `production_id`), **drop the `productions` FK, add the `event_tags` FK**. Guard as always; ledger has 0–low rows so it's safe.

---

## K. Schema Reconciliation Summary (what changes vs current DB)

| Area | Current | v4 resolution |
|---|---|---|
| Tuition pricing | `class_pricing_rules` (per-class) | Keep for drop-in/per-class; add `tuition_price_schedules` + `tuition_price_tiers` + `company_packages` |
| Event dimension | `ledger_entries.event_id → productions` (Layer 2) | Repoint → `event_tags`; productions become/link nodes |
| Points | v3.1 hinted at points-as-tender | Entitlement-only (`bundle_entitlements` points denom) |
| Monthly charge | v3.1 cron | Wrapped in reviewable `tuition_runs` batch |
| Adjustments | ad hoc | `tuition_adjustments` (persist + anomaly flag) |
| Charge types | tuition/reg/costume/merch/private | + `performance`, `competition` |

---

## L. Revised Build Sequence — Fast Launch  *(supersedes §22 ordering)*

Goal: get one real charge through the whole pipe in **test mode** ASAP to troubleshoot integration, then layer richness on.

**PIPE (launch-to-troubleshoot target):**
1. **L2 — ledger dimensions** ✅ shipped.
2. **L3 — canonical tables** (invoices, line_items, payments, allocations, refunds) — *in progress*.
3. **L5 — ledger posting service** (revenue recipes; post from a finalized invoice + manual payment).
4. **L6 — processor + Stripe + standard ACH** (Checkout, vaulting, ACH mandate + `succeeded→returned`, webhook normalization; `tenant_payment_config`).
5. **★ LAUNCH TEST** — thin flow: create invoice with a known amount → charge (card + ACH) in **test mode** → webhook → payment → ledger. **Troubleshoot the integration here.**

**MAKE IT REAL:**
6. **L4 — tuition tiers + company packages** (§B) + pricing resolver + drop-in.
7. **L7 — recurring monthly + tuition runs** (§F) + persistent/flagged adjustments (§G).

**RICHNESS:**
8. Event-tag hierarchy + tree manager + icons (§J); repoint `event_id`.
9. Charge categories + per-event P&L + teacher-hour event tagging (§I).
10. Points-as-entitlements (§D); awards/scholarships; bundle-savings display (§E).
11. Reporting layer + anomaly report (§H).
12. Private/Pilates/shop consolidation; credit consolidation; QBO export.

Revenue can move (test) after **step 5**; real tuition after **7**; full P&L after **9**.

---

## M. Open Numbers for Amanda (memo)

- **Standard tuition schedule** (full per-level ladder + caps; early-bird already captured).
- **Costume / Nutcracker fees** (per dance vs flat; participation + costume).
- **Competition fees** (entry, costume, participation).
- **Annual (Company) early-exit policy** + any **transfer fee**.
- **Sales tax** handling for merch/snacks/retail.
- **Per-teacher private flat payout** + **point cost per teacher**.
- **CA counsel sign-off** on fee recovery (gates surcharge/dual-pricing only; ACH-default needs none).
