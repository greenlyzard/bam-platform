import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { sendEnrollmentConfirmation } from "@/lib/email/enrollment-confirmation";
import type Stripe from "stripe";

/**
 * POST — handle Stripe webhook events for enrollment checkout
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
    console.error("[enrollment:webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const cartId = session.metadata?.cart_id;
      const tenantId = session.metadata?.tenant_id;

      if (!cartId || !tenantId) {
        console.error("[enrollment:webhook] Missing cart_id or tenant_id in metadata");
        return NextResponse.json({ received: true });
      }

      // Load cart items
      const { data: items } = await supabase
        .from("enrollment_cart_items")
        .select(`
          *,
          class:classes(
            id, name, day_of_week, start_time, end_time, room,
            teacher:profiles!teacher_id(first_name, last_name),
            enrolled_count
          )
        `)
        .eq("cart_id", cartId);

      if (!items || items.length === 0) {
        console.error("[enrollment:webhook] No items found for cart", cartId);
        return NextResponse.json({ received: true });
      }

      // Load cart to get family_id
      const { data: cart } = await supabase
        .from("enrollment_carts")
        .select("family_id")
        .eq("id", cartId)
        .single();

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      // Create enrollment records
      const enrolledClasses: {
        name: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        room: string | null;
        teacherName: string | null;
      }[] = [];

      for (const item of items) {
        const cls = item.class as Record<string, unknown> | null;
        const teacherRaw = cls?.teacher as unknown;
        const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
          first_name: string;
          last_name: string;
        } | null;

        // Create enrollment
        const { error: enrollErr } = await supabase.from("enrollments").insert({
          tenant_id: tenantId,
          family_id: cart?.family_id ?? null,
          student_id: item.student_id ?? null,
          class_id: item.class_id,
          status: "active",
          enrollment_type: "paid",
          stripe_payment_intent_id: paymentIntentId,
          amount_paid_cents: item.price_cents,
        });

        if (enrollErr) {
          console.error("[enrollment:webhook] Failed to create enrollment", enrollErr);
          continue;
        }

        // Update enrolled_count
        if (cls && typeof cls.enrolled_count === "number") {
          await supabase
            .from("classes")
            .update({ enrolled_count: cls.enrolled_count + 1 })
            .eq("id", item.class_id);
        }

        enrolledClasses.push({
          name: (cls?.name as string) ?? "Class",
          dayOfWeek: (cls?.day_of_week as number) ?? 0,
          startTime: (cls?.start_time as string) ?? "",
          endTime: (cls?.end_time as string) ?? "",
          room: (cls?.room as string) ?? null,
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
        });
      }

      // Update cart status
      await supabase
        .from("enrollment_carts")
        .update({ status: "completed" })
        .eq("id", cartId);

      // Send confirmation email
      const customerEmail = session.customer_email ?? session.customer_details?.email;
      const customerName = session.customer_details?.name ?? null;

      if (customerEmail) {
        await sendEnrollmentConfirmation({
          to: customerEmail,
          parentName: customerName,
          classes: enrolledClasses,
        }).catch((err) => {
          console.error("[enrollment:webhook] Failed to send confirmation email", err);
        });
      }

      console.log(
        "[enrollment:webhook] Checkout completed:",
        cartId,
        `${enrolledClasses.length} enrollments created`
      );
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const cartId = session.metadata?.cart_id;

      if (cartId) {
        await supabase
          .from("enrollment_carts")
          .update({ status: "expired" })
          .eq("id", cartId);

        console.log("[enrollment:webhook] Checkout expired:", cartId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
