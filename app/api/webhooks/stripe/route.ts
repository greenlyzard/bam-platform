import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * DEPRECATED — this endpoint no longer finalizes anything.
 *
 * Enrollment finalization is now the sole responsibility of the Checkout-Session
 * webhook at `/api/enrollment/webhook` (COMMERCE_AND_BILLING.md §3, Layer 1). This
 * route previously carried a stubbed `payment_intent.succeeded` handler with a
 * "TODO: create enrollments" that never ran — leaving a second, dead finalization
 * path. It is kept only so any Stripe endpoint still pointed here verifies its
 * signature and returns 200 instead of erroring. Do NOT add record-creation logic
 * here; point new Stripe webhook endpoints at `/api/enrollment/webhook`.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe:webhook:deprecated] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(
    "[stripe:webhook:deprecated] Ignoring",
    event.type,
    "— finalization handled by /api/enrollment/webhook"
  );
  return NextResponse.json({ received: true, deprecated: true });
}
