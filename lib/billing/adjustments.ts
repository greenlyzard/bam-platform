// Charge-item adjustments (docs/BILLING_APPROVAL_AND_DRAW.md §3.2, §4.4).
// Pure/deterministic: turn a charge item's recommended_amount_cents + an admin's waive / $-off / %-off
// into an approved amount, shape the append-only charge_item_adjustments log row, and total net
// worths across items. No DB, no clock — the approval route does the inserts.
//
// UNIT CONVENTIONS (single source of truth — the admin UI converts at its edge):
//   - amount_off  → `value` is CENTS to subtract.
//   - percent_off → `value` is BASIS POINTS (2500 = 25%; 10000 = 100%). Integer, no fractional %.
//   - waive       → `value` is ignored (approved = 0).
// Every amount here is integer cents. Rounding is Math.round, clamped to [0, recommended]
// (consistent with proration.ts `proratedFirstDrawCents`).

export type AdjustmentType = "waive" | "amount_off" | "percent_off";

/** An admin adjustment on one charge item. `reason` is required (§3.2, §4.4). */
export interface AdjustmentInput {
  type: AdjustmentType;
  /** CENTS for amount_off · BASIS POINTS for percent_off · ignored for waive (see file header). */
  value: number;
  reason: string;
}

const BPS_FULL = 10000; // 100% in basis points

function clamp(cents: number, full: number): number {
  return Math.max(0, Math.min(cents, full));
}

/**
 * Approved amount = recommendation − adjustment, clamped to [0, recommended]. Pure.
 * - waive:       → 0
 * - amount_off:  recommended − value(cents)  (over-discount clamps to 0)
 * - percent_off: round(recommended × (10000 − value_bps) / 10000)
 */
export function applyAdjustment(recommendedCents: number, adj: AdjustmentInput): number {
  switch (adj.type) {
    case "waive":
      return 0;
    case "amount_off":
      return clamp(recommendedCents - adj.value, recommendedCents);
    case "percent_off":
      return clamp(
        Math.round((recommendedCents * (BPS_FULL - adj.value)) / BPS_FULL),
        recommendedCents
      );
  }
}

/**
 * Throw unless the adjustment is well-formed. Call before buildAdjustmentRow / any charge.
 * - reason must be non-empty (trimmed).
 * - value must be ≥ 0 (a negative "discount" is a surcharge — not supported here).
 * - percent_off value must be ≤ 10000 bps (100%).
 * amount_off exceeding the recommendation is allowed (clamps to a full waive).
 */
export function validateAdjustment(recommendedCents: number, adj: AdjustmentInput): void {
  if (!adj.reason || adj.reason.trim().length === 0) {
    throw new Error("Adjustment requires a non-empty reason");
  }
  if (adj.value < 0) {
    throw new Error(`Adjustment value must be ≥ 0 (got ${adj.value})`);
  }
  if (adj.type === "percent_off" && adj.value > BPS_FULL) {
    throw new Error(`percent_off value must be ≤ ${BPS_FULL} bps (100%); got ${adj.value}`);
  }
  if (recommendedCents < 0) {
    throw new Error(`recommendedCents must be ≥ 0 (got ${recommendedCents})`);
  }
}

/** The append-only charge_item_adjustments insert shape (§4.4; snake_case, no updated_at). */
export interface AdjustmentRow {
  tenant_id: string;
  charge_item_id: string;
  admin_id: string;
  adjustment_type: AdjustmentType;
  value: number;
  recommended_cents: number;
  approved_cents: number;
  reason: string;
}

/** Validate, compute approved_cents, and shape the immutable log row. Pure. */
export function buildAdjustmentRow(args: {
  tenantId: string;
  chargeItemId: string;
  adminId: string;
  recommendedCents: number;
  adjustment: AdjustmentInput;
}): AdjustmentRow {
  validateAdjustment(args.recommendedCents, args.adjustment);
  return {
    tenant_id: args.tenantId,
    charge_item_id: args.chargeItemId,
    admin_id: args.adminId,
    adjustment_type: args.adjustment.type,
    value: args.adjustment.value,
    recommended_cents: args.recommendedCents,
    approved_cents: applyAdjustment(args.recommendedCents, args.adjustment),
    reason: args.adjustment.reason,
  };
}

// ── Totaling ─────────────────────────────────────────────────────────────────────────

/** The minimum an item exposes for net-worth math (a subset of enrollment_charge_items.Row). */
export interface NetChargeItem {
  approved_amount_cents: number | null;
  recommended_amount_cents: number;
  status: string;
}

/**
 * Net worth of one charge item: the admin-approved amount if set, else the recommendation.
 * A declined item is worth 0.
 */
export function netApprovedCents(item: NetChargeItem): number {
  if (item.status === "declined") return 0;
  return item.approved_amount_cents ?? item.recommended_amount_cents;
}

/** Plain sum of net-approved across items (display / sanity totals). */
export function totalApprovedCents(items: NetChargeItem[]): number {
  return items.reduce((sum, it) => sum + netApprovedCents(it), 0);
}
