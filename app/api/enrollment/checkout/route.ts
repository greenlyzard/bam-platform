import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  splitCheckoutLines,
  immediateTotalCents,
  buildAuthorizationSessionParams,
  type CartLineInput,
} from "@/lib/billing/checkout-lines";
import { resolveClassPriceCents } from "@/lib/billing/resolve-price";

const CART_COOKIE = "bam_cart_token";

/**
 * POST — Authorization checkout (docs/AUTHORIZATION_CHECKOUT.md Slice 1).
 * Splits the cart into immediate (charge now: registration fee) vs scheduled (tuition intent),
 * vaults the card on the family's Stripe Customer, and charges only the immediate lines.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(CART_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "No cart found" }, { status: 400 });
    }

    const supabase = await createClient();

    // Load cart (ownership via the session-token cookie).
    const { data: cart } = await supabase
      .from("enrollment_carts")
      .select("*")
      .eq("session_token", sessionToken)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!cart) {
      return NextResponse.json({ error: "Cart not found or expired" }, { status: 400 });
    }

    // Admin client: cart ownership was validated above; use the service role to read line items
    // (incl. the new charge_timing), studio settings, and the family.
    const admin = createAdminClient();

    const { data: itemRows } = await admin
      .from("enrollment_cart_items")
      .select("class_id, student_id, student_name, charge_timing")
      .eq("cart_id", cart.id);

    if (!itemRows || itemRows.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Authorization checkout REQUIRES a family — the vaulted card is attached to and persisted on
    // the family's Stripe Customer. The cart flow sets family_id when a signed-in parent checks out.
    if (!cart.family_id) {
      return NextResponse.json(
        { error: "Please sign in before checkout so we can save your payment method." },
        { status: 400 }
      );
    }

    // Optional email for the Customer.
    let customerEmail: string | undefined;
    const body = await req.json().catch(() => ({}));
    if (body.email) {
      customerEmail = body.email;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) customerEmail = user.email;
    }

    const stripe = getStripe();

    // Create or reuse the family's Stripe Customer (the vaulting target).
    const { data: family } = await admin
      .from("families")
      .select("id, stripe_customer_id, billing_email, family_name")
      .eq("id", cart.family_id)
      .single();
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 400 });
    }
    let customerId: string = family.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail ?? family.billing_email ?? undefined,
        name: family.family_name ?? undefined,
        metadata: { family_id: family.id, tenant_id: cart.tenant_id },
      });
      customerId = customer.id;
      await admin.from("families").update({ stripe_customer_id: customerId }).eq("id", family.id);
    }

    // Registration fee (studio-wide config; spec §1).
    const { data: settings } = await admin
      .from("studio_settings")
      .select("registration_fee_cents")
      .limit(1)
      .maybeSingle();
    const registrationFeeCents = (settings?.registration_fee_cents as number | undefined) ?? 0;

    // Re-resolve tuition per class at checkout time (do NOT trust the stored cart price_cents).
    // Registration stays a separate, server-derived studio-level input (above).
    const resolved = await Promise.all(
      (itemRows as Array<Record<string, unknown>>).map(async (r) => ({
        row: r,
        priceCents: await resolveClassPriceCents(r.class_id as string, admin),
      }))
    );

    // An unpriced class must not be purchasable — refuse the whole checkout.
    if (resolved.some((x) => x.priceCents == null)) {
      return NextResponse.json(
        {
          error:
            "One or more classes in your cart no longer have a price set. Please remove them or contact the studio.",
        },
        { status: 409 }
      );
    }

    // Split immediate (charge now) vs scheduled (record intent, drawn on the 15th later).
    const lineInputs: CartLineInput[] = resolved.map(({ row: r, priceCents }) => ({
      classId: r.class_id as string,
      studentId: (r.student_id as string | null) ?? null,
      studentName: (r.student_name as string | null) ?? null,
      priceCents: priceCents as number,
      chargeTiming: (r.charge_timing as "immediate" | "scheduled") ?? "scheduled",
    }));
    const { immediate, scheduled } = splitCheckoutLines({ items: lineInputs, registrationFeeCents });

    if (immediateTotalCents(immediate) <= 0) {
      return NextResponse.json(
        { error: "Nothing to charge now (no registration fee or immediate lines configured)." },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";

    // Card-only this slice; VAULTS the card (setup_future_usage='off_session'); charges only the
    // immediate lines; metadata carries the scheduled tuition intents for provenance.
    const checkoutSession = await stripe.checkout.sessions.create(
      buildAuthorizationSessionParams({
        immediate,
        customerId,
        appUrl,
        metadata: {
          cart_id: cart.id,
          tenant_id: cart.tenant_id,
          family_id: cart.family_id,
          scheduled_intents: JSON.stringify(scheduled),
        },
      })
    );

    await supabase
      .from("enrollment_carts")
      .update({ stripe_session_id: checkoutSession.id, status: "checked_out" })
      .eq("id", cart.id);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout:create]", err);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
