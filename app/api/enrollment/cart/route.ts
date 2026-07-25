import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyFamily } from "@/lib/queries/portal";
import { resolveClassPriceCents } from "@/lib/billing/resolve-price";
import { resolvePortalCart } from "@/lib/queries/enrollment-cart";
import { isClassOpenForEnrollment } from "@/lib/classes/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { BLOCKING_ENROLLMENT_STATUSES } from "@/lib/billing/enrollment-ledger";
import { z } from "zod";

const CART_COOKIE = "bam_cart_token";
const CART_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

async function getTenantId() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  return data?.id ?? null;
}

async function getCartWithItems(supabase: Awaited<ReturnType<typeof createClient>>, sessionToken: string) {
  const { data: cart } = await supabase
    .from("enrollment_carts")
    .select("*")
    .eq("session_token", sessionToken)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!cart) return null;

  const { data: items } = await supabase
    .from("enrollment_cart_items")
    .select(`
      *,
      class:classes(
        id, name, style, levels, day_of_week, start_time, end_time, room, season,
        teacher:profiles!teacher_id(first_name, last_name)
      )
    `)
    .eq("cart_id", cart.id);

  const totalCents = (items ?? []).reduce((sum, item) => sum + (item.price_cents ?? 0), 0);

  return {
    id: cart.id,
    status: cart.status,
    expires_at: cart.expires_at,
    items: (items ?? []).map((item) => {
      const cls = item.class as Record<string, unknown> | null;
      const teacherRaw = cls?.teacher as unknown;
      const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
        first_name: string;
        last_name: string;
      } | null;

      return {
        id: item.id,
        class_id: item.class_id,
        student_id: item.student_id,
        student_name: item.student_name,
        price_cents: item.price_cents,
        class_name: cls?.name ?? "",
        class_style: cls?.style ?? "",
        class_level: Array.isArray(cls?.levels) ? (cls.levels[0] ?? "") : "",
        day_of_week: cls?.day_of_week ?? 0,
        start_time: cls?.start_time ?? "",
        end_time: cls?.end_time ?? "",
        room: cls?.room ?? null,
        season: cls?.season ?? null,
        teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
      };
    }),
    total_cents: totalCents,
  };
}

/**
 * GET — get current cart from session cookie
 */
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CART_COOKIE)?.value ?? null;

  const supabase = await createClient();
  // Signed-in parent → resolve/adopt the family's active cart even without a cookie (cookie lost,
  // or a future admin-curated cart created server-side for the family). Anonymous → cookie only.
  const familyId = (await getMyFamily())?.id ?? null;

  const { cart, viaFamily } = await resolvePortalCart(supabase, { sessionToken, familyId });

  if (!cart) {
    return NextResponse.json({ cart: null, items: [], total_cents: 0 });
  }

  // Adopt a family-resolved cart into this browser so cookie-based checkout can find it.
  if (viaFamily && cart.session_token) {
    cookieStore.set(CART_COOKIE, cart.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CART_TTL_MS / 1000,
      path: "/",
    });
  }

  return NextResponse.json(cart);
}

/**
 * POST — add item to cart
 */
// price_cents is intentionally NOT accepted from the client — tuition is resolved server-side
// from the class's price (class_pricing_rules → classes.fee_cents). Trusting a client price would
// let the browser set any amount.
const addItemSchema = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid().optional(),
  student_name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Studio not found" }, { status: 500 });
    }

    const supabase = await createClient();

    // Validate class exists and has capacity
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, max_students, is_active, end_date")
      .eq("id", parsed.data.class_id)
      .single();

    if (!cls || !cls.is_active) {
      return NextResponse.json({ error: "Class not found or inactive" }, { status: 404 });
    }

    // Date-eligibility guard (parity with checkout/enroll actions): don't let an ended class be
    // added to the cart in the first place.
    if (!isClassOpenForEnrollment(cls)) {
      return NextResponse.json(
        { error: "This class has ended and is no longer open for enrollment." },
        { status: 409 }
      );
    }

    // Duplicate-enrollment guard: the DB enforces a global unique (student_id, class_id), so a
    // student already in this class can never get a second row. Reject at add-to-cart rather than
    // letting the parent check out and the webhook silently skip the item. Service-role read — the
    // anon/RLS client would fail OPEN on an anonymous cart and wave the duplicate straight through.
    // Status set matches the corrected in-flight convention (pending_payment was never real).
    if (parsed.data.student_id) {
      const { data: priorEnrollment } = await createAdminClient()
        .from("enrollments")
        .select("id")
        .eq("student_id", parsed.data.student_id)
        .eq("class_id", parsed.data.class_id)
        .in("status", [...BLOCKING_ENROLLMENT_STATUSES])
        .maybeSingle();

      if (priorEnrollment) {
        return NextResponse.json(
          { error: "This student is already enrolled or has a pending request for this class." },
          { status: 409 }
        );
      }
    }

    // Resolve tuition server-side (service role — pricing rules are authenticated-only under RLS).
    // An unpriced class must not be purchasable.
    const priceCents = await resolveClassPriceCents(parsed.data.class_id);
    if (priceCents == null) {
      return NextResponse.json(
        {
          error:
            "This class doesn't have a price set yet, so it can't be added to the cart. Please contact the studio.",
        },
        { status: 409 }
      );
    }

    // Link the cart to the signed-in parent's family so Slice-1 checkout can tie
    // the enrollment to the right family. Anonymous (signed-out) carts stay null.
    const familyId = (await getMyFamily())?.id ?? null;

    // Get or create cart
    const cookieStore = await cookies();
    let sessionToken = cookieStore.get(CART_COOKIE)?.value;
    let cartId: string;

    if (sessionToken) {
      const { data: existingCart } = await supabase
        .from("enrollment_carts")
        .select("id, status, expires_at, family_id")
        .eq("session_token", sessionToken)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .single();

      if (existingCart) {
        cartId = existingCart.id;
        // Backfill family_id on a stale cart created before the parent signed in
        // (e.g. an anonymous cart left over from an earlier visit this session).
        if (familyId && !existingCart.family_id) {
          await supabase
            .from("enrollment_carts")
            .update({ family_id: familyId, updated_at: new Date().toISOString() })
            .eq("id", cartId);
        }
      } else {
        // Cart expired or checked out — create new
        sessionToken = crypto.randomUUID();
        const { data: newCart, error: cartErr } = await supabase
          .from("enrollment_carts")
          .insert({
            tenant_id: tenantId,
            session_token: sessionToken,
            family_id: familyId,
            expires_at: new Date(Date.now() + CART_TTL_MS).toISOString(),
          })
          .select("id")
          .single();

        if (cartErr || !newCart) {
          console.error("[cart:create]", cartErr);
          return NextResponse.json({ error: "Failed to create cart" }, { status: 500 });
        }
        cartId = newCart.id;
      }
    } else {
      sessionToken = crypto.randomUUID();
      const { data: newCart, error: cartErr } = await supabase
        .from("enrollment_carts")
        .insert({
          tenant_id: tenantId,
          session_token: sessionToken,
          family_id: familyId,
          expires_at: new Date(Date.now() + CART_TTL_MS).toISOString(),
        })
        .select("id")
        .single();

      if (cartErr || !newCart) {
        console.error("[cart:create]", cartErr);
        return NextResponse.json({ error: "Failed to create cart" }, { status: 500 });
      }
      cartId = newCart.id;
    }

    // Check if class already in cart
    const { data: existing } = await supabase
      .from("enrollment_cart_items")
      .select("id")
      .eq("cart_id", cartId)
      .eq("class_id", parsed.data.class_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Class already in cart" }, { status: 409 });
    }

    // Add item
    const { error: itemErr } = await supabase.from("enrollment_cart_items").insert({
      cart_id: cartId,
      tenant_id: tenantId,
      class_id: parsed.data.class_id,
      student_id: parsed.data.student_id ?? null,
      student_name: parsed.data.student_name ?? null,
      price_cents: priceCents,
    });

    if (itemErr) {
      console.error("[cart:add-item]", itemErr);
      return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
    }

    // Set cookie
    cookieStore.set(CART_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CART_TTL_MS / 1000,
      path: "/",
    });

    // Return updated cart
    const cart = await getCartWithItems(supabase, sessionToken);
    return NextResponse.json(cart);
  } catch (err) {
    console.error("[cart:post]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE — remove item from cart
 */
const removeSchema = z.object({
  item_id: z.string().uuid(),
});

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const parsed = removeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(CART_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "No cart found" }, { status: 404 });
    }

    const supabase = await createClient();

    // Get cart
    const { data: cart } = await supabase
      .from("enrollment_carts")
      .select("id")
      .eq("session_token", sessionToken)
      .eq("status", "active")
      .single();

    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // Remove item (only if it belongs to this cart)
    const { error: delErr } = await supabase
      .from("enrollment_cart_items")
      .delete()
      .eq("id", parsed.data.item_id)
      .eq("cart_id", cart.id);

    if (delErr) {
      console.error("[cart:remove]", delErr);
      return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
    }

    const updated = await getCartWithItems(supabase, sessionToken);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[cart:delete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
