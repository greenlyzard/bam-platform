// Authorization-checkout line logic (docs/AUTHORIZATION_CHECKOUT.md §4).
// Pure/deterministic: split cart lines into `immediate` (charged now) vs `scheduled` (recorded as
// tuition intent, drawn later), and build the Stripe Checkout Session params that VAULT the card.
// No DB, no Stripe calls — the route/webhook consume these shapes.

import type Stripe from "stripe";

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
 * Build the Stripe Checkout Session params for the authorization checkout:
 * mode=payment, card-only (this slice), VAULT the card (setup_future_usage='off_session'),
 * customer attached, line items = the immediate lines, metadata carries family/tenant/cart +
 * the scheduled intents (for provenance).
 */
export function buildAuthorizationSessionParams(args: {
  immediate: ImmediateLine[];
  customerId: string;
  appUrl: string;
  metadata: Record<string, string>;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    payment_method_types: ["card"], // card-only this slice; ACH authorization is a later slice
    customer: args.customerId,
    payment_intent_data: { setup_future_usage: "off_session" }, // vault the card for reuse
    line_items: args.immediate.map((l) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: l.amountCents,
        product_data: { name: l.label },
      },
    })),
    success_url: `${args.appUrl}/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.appUrl}/enroll/cart`,
    metadata: args.metadata,
  };
}
