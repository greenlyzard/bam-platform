import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

const CART_COOKIE = "bam_cart_token";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

/**
 * POST — create Stripe Checkout Session from server-side cart
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(CART_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "No cart found" }, { status: 400 });
    }

    const supabase = await createClient();

    // Load cart
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

    // Load items with class details
    const { data: items } = await supabase
      .from("enrollment_cart_items")
      .select(`
        *,
        class:classes(
          id, name, season, day_of_week, start_time, end_time,
          teacher:profiles!teacher_id(first_name, last_name)
        )
      `)
      .eq("cart_id", cart.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Optionally get customer email if logged in
    let customerEmail: string | undefined;
    const body = await req.json().catch(() => ({}));
    if (body.email) {
      customerEmail = body.email;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        customerEmail = user.email;
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";

    // Build Stripe line items
    const lineItems = items.map((item) => {
      const cls = item.class as Record<string, unknown> | null;
      const teacherRaw = cls?.teacher as unknown;
      const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
        first_name: string;
        last_name: string;
      } | null;

      const dayOfWeek = cls?.day_of_week as number | undefined;
      const startTime = cls?.start_time as string | undefined;
      const season = cls?.season as string | undefined;
      const className = (cls?.name as string) ?? "Class";

      const nameParts = [className];
      if (season) nameParts.push(`\u2014 ${season}`);

      const descParts: string[] = [];
      if (dayOfWeek !== undefined && startTime) {
        descParts.push(`${DAYS[dayOfWeek]}s ${formatTime(startTime)}`);
      }
      if (teacher) {
        descParts.push(`with ${teacher.first_name} ${teacher.last_name}`);
      }
      if (item.student_name) {
        descParts.push(`for ${item.student_name}`);
      }

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: nameParts.join(" "),
            description: descParts.join(" ") || undefined,
          },
          unit_amount: item.price_cents,
        },
        quantity: 1,
      };
    });

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${appUrl}/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/enroll/cart`,
      customer_email: customerEmail,
      metadata: {
        cart_id: cart.id,
        tenant_id: cart.tenant_id,
      },
    });

    // Update cart with Stripe session ID and status
    await supabase
      .from("enrollment_carts")
      .update({
        stripe_session_id: checkoutSession.id,
        status: "checked_out",
      })
      .eq("id", cart.id);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout:create]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
