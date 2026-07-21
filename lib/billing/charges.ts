// Approval-time charge assembly (docs/BILLING_APPROVAL_AND_DRAW.md §3.2, §6.2).
// Pure/deterministic: given the (post-adjustment) approved charge items for a pending enrollment,
// assemble what money moves at approval — the single off-session PaymentIntent amount, one `charges`
// row per charged item (§6.2), the CR revenue sale-lines for the ledger, and the recurring
// tuition-intent arming. No DB, no Stripe, no clock. The approval route creates the PI, inserts the
// charges rows (stamping the Stripe ids), calls buildDirectSaleGroup(piId, …) → post_ledger_group,
// and writes charge_id back onto the charge items.
//
// EVERY amount here is integer CENTS. The one DOLLARS value in the system —
// `class_pricing_rules.amount` — is converted to cents upstream by lib/billing/resolve-price.ts and
// reaches this layer only as `monthly_amount_cents` / `proration.full_month_cents`. It must NEVER
// enter this module raw: there is no `amount`/dollars field on any input type below.

import { nextAnchorDate, type ProrationBlob } from "./proration.ts";
import type { SaleLine } from "./ledger-posting.ts";
import { buildPendingChargeItems, type PendingChargeItemInput } from "./checkout-lines.ts";
import { netApprovedCents } from "./adjustments.ts";

/** An enrollment_charge_item joined with its post-adjustment approved amount (subset of the Row). */
export interface ApprovedChargeItem {
  id: string;
  item_type: string; // registration | first_tuition | one_time_fee | private_pack
  recurrence_type: string; // recurring | one_time
  recommended_amount_cents: number;
  approved_amount_cents: number | null;
  charge_timing: string | null; // charge_now | deferred
  class_id: string | null;
  student_id: string | null;
  proration: ProrationBlob | null; // present on first_tuition (carries full_month_cents)
  status: string;
}

/** A `charges` insert shape minus the Stripe ids + final status the route stamps post-charge (§6.2). */
export interface ChargeInsert {
  tenant_id: string;
  family_id: string;
  enrollment_id: string;
  student_id: string | null;
  class_id: string | null;
  // Always null at assembly. The approval ROUTE (not this assembler) patches intent_id onto the
  // first_tuition charge row AFTER it arms the tuition_schedule_intent — the intent id only exists
  // once the route has written/armed it. Route responsibility, by design.
  intent_id: string | null;
  kind: string; // chargeKindForItemType(item_type)
  amount_cents: number;
  currency: string; // 'usd'
  status: string; // 'created' — route flips to succeeded/failed on the PI result
  source: string; // 'approval'
  billing_period: null; // approval charges are not a monthly draw (that's the draw engine, §5)
  created_by: string; // admin uuid
  metadata: Record<string, unknown> | null;
}

/** The tuition_schedule_intent.Update applied when an enrollment is approved (§3.2.4). */
export interface IntentArming {
  class_id: string | null;
  student_id: string | null;
  status: "active";
  monthly_amount_cents: number; // FULL month (proration.full_month_cents) — NOT the prorated draw
  anchor_day: number;
  next_draw_at: string; // resolveInitialNextDrawAt(startDate, anchorDay) — start-date anchor safe
  deferred_addition_cents: number; // deferred first-draw catch-up folded into next draw, else 0
}

export interface AssembledApprovalCharge {
  /** Σ charge-now approved amounts. 0 ⇒ the route creates NO PaymentIntent (all waived/deferred). */
  paymentIntentAmountCents: number;
  /** One row per CHARGED item (§6.2), so partial refunds/drop-credits target a specific item. */
  chargeRows: ChargeInsert[];
  /** CR revenue legs; the route feeds these to buildDirectSaleGroup(piId, familyId, lines). */
  capturedSaleLines: SaleLine[];
  /** One arming per recurring (first_tuition) item. */
  intentArmings: IntentArming[];
}

/** charges.kind for a charge item's item_type. */
export function chargeKindForItemType(itemType: string): string {
  return itemType; // 1:1 today (registration | first_tuition | one_time_fee | private_pack)
}

/** Ledger revenue account (ledger_accounts.slug) for a charge item's item_type. */
export function ledgerAccountForItemType(itemType: string): string {
  return itemType === "registration" ? "revenue_registration" : "revenue_tuition";
}

/**
 * (a) Start-on-anchor arming (§4.1 / §3.2.4). next_draw_at MUST be the anchor ON the start date when
 * start == anchor — never the following month's anchor — or the $0 prorated first draw plus a
 * next-month first real draw would give the family one FREE month. This delegates to
 * proration.nextAnchorDate (the single source of anchor math), which is INCLUSIVE of the start date:
 * start == anchor ⇒ returns startDate. Invariant (asserted in tests): the returned value equals the
 * first_tuition item's proration blob `next_anchor_date`. The draw engine's "not already drawn this
 * period" guard (keyed on billing_period) makes drawing on the start-date anchor safe.
 */
export function resolveInitialNextDrawAt(startDate: string, anchorDay: number): string {
  return nextAnchorDate(startDate, anchorDay);
}

/**
 * Assemble the approval charge from the (already adjustment-resolved) charge items. Pure.
 *
 * Partition by charge_timing:
 *  - charge_now items with net > 0 → a charge row + a CR sale-line + into the PI total.
 *  - deferred first_tuition       → NOT charged now; its net folds into the intent's
 *                                   deferred_addition_cents (§3.2.2).
 * Recurring (first_tuition) items always produce an arming (status→active, full-month amount,
 * start-date-anchored next_draw_at). Deferring a one_time item is rejected (no intent to fold into).
 */
export function assembleApprovalCharge(args: {
  context: { tenantId: string; familyId: string; enrollmentId: string; adminId: string };
  items: ApprovedChargeItem[];
  anchorDay: number;
  startDate: string; // 'YYYY-MM-DD'
}): AssembledApprovalCharge {
  const { tenantId, familyId, enrollmentId, adminId } = args.context;
  const chargeRows: ChargeInsert[] = [];
  const capturedSaleLines: SaleLine[] = [];
  const armingByKey = new Map<string, IntentArming>();
  let paymentIntentAmountCents = 0;

  for (const item of args.items) {
    if (item.status === "declined") continue;

    const isRecurring = item.recurrence_type === "recurring";
    const isDeferred = item.charge_timing === "deferred";
    const net = netApprovedCents(item);

    if (isDeferred && !isRecurring) {
      throw new Error(
        `Charge item ${item.id} (${item.item_type}) is one_time and cannot be deferred — ` +
          `there is no tuition intent to fold the catch-up into`
      );
    }

    if (isRecurring) {
      if (!item.proration) {
        throw new Error(
          `Recurring charge item ${item.id} (${item.item_type}) is missing its proration blob ` +
            `(needed for the full-month intent amount)`
        );
      }
      const key = `${item.class_id ?? "null"}|${item.student_id ?? "null"}`;
      armingByKey.set(key, {
        class_id: item.class_id,
        student_id: item.student_id,
        status: "active",
        monthly_amount_cents: item.proration.full_month_cents,
        anchor_day: args.anchorDay,
        next_draw_at: resolveInitialNextDrawAt(args.startDate, args.anchorDay),
        deferred_addition_cents: isDeferred ? net : 0,
      });
    }

    // Deferred items move no money now (folded into the intent above).
    if (isDeferred) continue;

    // Charge-now with something to charge → one charge row + one CR sale-line + into the PI.
    if (net > 0) {
      paymentIntentAmountCents += net;
      chargeRows.push({
        tenant_id: tenantId,
        family_id: familyId,
        enrollment_id: enrollmentId,
        student_id: item.student_id,
        class_id: item.class_id,
        intent_id: null,
        kind: chargeKindForItemType(item.item_type),
        amount_cents: net,
        currency: "usd",
        status: "created",
        source: "approval",
        billing_period: null,
        created_by: adminId,
        metadata: { charge_item_id: item.id, item_type: item.item_type },
      });
      capturedSaleLines.push({
        account: ledgerAccountForItemType(item.item_type),
        amountCents: net,
        familyId,
        studentId: item.student_id,
        classId: item.class_id,
      });
    }
  }

  return {
    paymentIntentAmountCents,
    chargeRows,
    capturedSaleLines,
    intentArmings: [...armingByKey.values()],
  };
}

// ── Shared pending_setup intent builder (requirement b) ────────────────────────────────

/** A pending_setup tuition_schedule_intent insert. next_draw_at stays null until approval arms it. */
export interface PendingIntentInsert {
  tenant_id: string;
  family_id: string;
  student_id: string | null;
  class_id: string;
  monthly_amount_cents: number;
  anchor_day: number;
  status: "pending_setup";
  source_ref: string | null;
  enrollment_id: string;
}

/**
 * (b) The one place a pending_setup tuition intent is shaped — used by BOTH the checkout webhook and
 * the waitlist→pending promotion, so promotion cannot drift from checkout (§3.3). Arming
 * (status→active, next_draw_at) happens later at approval via assembleApprovalCharge.
 */
export function buildPendingIntent(args: {
  tenantId: string;
  familyId: string;
  studentId: string | null;
  classId: string;
  monthlyAmountCents: number;
  anchorDay: number;
  sourceRef: string | null;
  enrollmentId: string;
}): PendingIntentInsert {
  return {
    tenant_id: args.tenantId,
    family_id: args.familyId,
    student_id: args.studentId,
    class_id: args.classId,
    monthly_amount_cents: args.monthlyAmountCents,
    anchor_day: args.anchorDay,
    status: "pending_setup",
    source_ref: args.sourceRef,
    enrollment_id: args.enrollmentId,
  };
}

/**
 * (b) Waitlist→pending promotion payload (§3.3). A waitlisted enrollment has NO charge items and NO
 * intent; on promotion it must get exactly what a fresh pending enrollment would. This composes the
 * SAME builders the webhook uses — buildPendingChargeItems (registration per mode + prorated first
 * tuition) and buildPendingIntent — so the two paths stay identical. The route computes proration
 * (async) first and passes the results in, keeping this pure.
 */
export function assembleWaitlistPromotion(args: {
  registration: { amountCents: number; studentId: string | null } | null;
  firstTuition: {
    classId: string;
    studentId: string | null;
    recommendedCents: number;
    proration: ProrationBlob;
  }[];
  intent: Parameters<typeof buildPendingIntent>[0];
}): { chargeItems: PendingChargeItemInput[]; intent: PendingIntentInsert } {
  return {
    chargeItems: buildPendingChargeItems({
      registration: args.registration,
      firstTuition: args.firstTuition,
    }),
    intent: buildPendingIntent(args.intent),
  };
}
