// Authorization-checkout line logic (docs/AUTHORIZATION_CHECKOUT.md §4).
// Pure/deterministic: split cart lines into `immediate` (charged now) vs `scheduled` (recorded as
// tuition intent, drawn later), and build the Stripe Checkout Session params that VAULT the card.
// No DB, no Stripe calls — the route/webhook consume these shapes.

import type Stripe from "stripe";
import type { ProrationBlob } from "./proration.ts";

export type ChargeTiming = "immediate" | "scheduled";

/** A cart line = one class enrollment at its monthly tuition, with its admin-set charge_timing. */
export interface CartLineInput {
  classId: string;
  studentId: string | null;
  studentName: string | null;
  priceCents: number; // monthly tuition for the class
  chargeTiming: ChargeTiming; // default 'scheduled' (tuition); admin may flip a class to 'immediate'
}

/** An immediately-charged line (goes into the Checkout Session + the direct_sale_captured ledger). */
export interface ImmediateLine {
  lineType: "registration" | "tuition";
  amountCents: number;
  account: string; // ledger account slug
  classId: string | null;
  studentId: string | null;
  label: string;
}

/** A deferred tuition line (recorded as a pending_setup intent; the 15th engine draws it later). */
export interface ScheduledIntent {
  lineType: "tuition";
  classId: string;
  studentId: string | null;
  monthlyAmountCents: number;
  anchorDay: number;
}

export interface SplitResult {
  immediate: ImmediateLine[];
  scheduled: ScheduledIntent[];
}

/**
 * Split a checkout into immediate vs scheduled lines.
 * - Registration fee (studio-wide) → one `immediate` line (revenue_registration) when > 0.
 * - Each class line → `scheduled` tuition intent by default; if its charge_timing is 'immediate'
 *   (admin-flipped) it becomes an immediate tuition line (revenue_tuition).
 */
export function splitCheckoutLines(args: {
  items: CartLineInput[];
  registrationFeeCents: number;
}): SplitResult {
  const immediate: ImmediateLine[] = [];
  const scheduled: ScheduledIntent[] = [];

  if (args.registrationFeeCents > 0) {
    immediate.push({
      lineType: "registration",
      amountCents: args.registrationFeeCents,
      account: "revenue_registration",
      classId: null,
      studentId: null,
      label: "Registration fee",
    });
  }

  for (const it of args.items) {
    if (it.chargeTiming === "immediate") {
      immediate.push({
        lineType: "tuition",
        amountCents: it.priceCents,
        account: "revenue_tuition",
        classId: it.classId,
        studentId: it.studentId,
        label: `Tuition — ${it.studentName ?? "Student"}`,
      });
    } else {
      scheduled.push({
        lineType: "tuition",
        classId: it.classId,
        studentId: it.studentId,
        monthlyAmountCents: it.priceCents,
        anchorDay: 15,
      });
    }
  }

  return { immediate, scheduled };
}

/** Total cents charged now (0 → nothing to charge; caller must not create an empty session). */
export function immediateTotalCents(lines: ImmediateLine[]): number {
  return lines.reduce((sum, l) => sum + l.amountCents, 0);
}

/**
 * Build the Stripe Checkout Session params for the VAULT-ONLY authorization checkout (§1.2):
 * mode='setup' — capture/vault the card and charge NOTHING now (no line_items). The saved card is
 * used for off-session draws later; the registration fee + prorated first tuition become
 * enrollment_charge_items (§2), charged at admin approval (§3.2), never at checkout.
 */
export function buildAuthorizationSessionParams(args: {
  customerId: string;
  appUrl: string;
  metadata: Record<string, string>;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "setup",
    payment_method_types: ["card"], // card-only this slice; ACH mandate is a later slice
    customer: args.customerId,
    // Vault the card; carry cart/tenant/family provenance on the SetupIntent itself.
    setup_intent_data: { metadata: args.metadata },
    success_url: `${args.appUrl}/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.appUrl}/enroll/cart`,
    metadata: args.metadata,
  };
}

/** A pending enrollment_charge_item to insert at webhook time (§2, §9.1). Pure shape — no DB. */
export interface PendingChargeItemInput {
  item_type: "registration" | "first_tuition" | "one_time_fee" | "private_pack";
  recurrence_type: "recurring" | "one_time";
  recommended_amount_cents: number;
  charge_timing: "charge_now" | "deferred";
  class_id: string | null;
  student_id: string | null;
  proration: ProrationBlob | null;
}

/**
 * Build the pending charge items an admin will approve (§2). Registration is a one-time charge-now
 * line (only when the studio fee > 0); each class's first tuition is a recurring charge-now line
 * carrying its proration blob (the recommendation the admin sees). Pure — the webhook does the DB
 * insert and computes each first-tuition recommendation via lib/billing/proration.ts.
 */
export function buildPendingChargeItems(args: {
  registrationFeeCents: number;
  firstTuition: {
    classId: string;
    studentId: string | null;
    recommendedCents: number;
    proration: ProrationBlob;
  }[];
}): PendingChargeItemInput[] {
  const items: PendingChargeItemInput[] = [];

  if (args.registrationFeeCents > 0) {
    items.push({
      item_type: "registration",
      recurrence_type: "one_time",
      recommended_amount_cents: args.registrationFeeCents,
      charge_timing: "charge_now",
      class_id: null,
      student_id: null,
      proration: null,
    });
  }

  for (const t of args.firstTuition) {
    items.push({
      item_type: "first_tuition",
      recurrence_type: "recurring",
      recommended_amount_cents: t.recommendedCents,
      charge_timing: "charge_now", // default recommendation; admin may DEFER at approval (§3.2)
      class_id: t.classId,
      student_id: t.studentId,
      proration: t.proration,
    });
  }

  return items;
}
