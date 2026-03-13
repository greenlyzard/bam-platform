import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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
    console.error("[stripe:webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      console.log(
        "[stripe:webhook] Payment succeeded:",
        pi.id,
        pi.metadata
      );
      // TODO: Create enrollments in Supabase, send confirmation email
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      console.log(
        "[stripe:webhook] Payment failed:",
        pi.id,
        pi.last_payment_error?.message
      );
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
