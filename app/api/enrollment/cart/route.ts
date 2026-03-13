import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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
        id, name, style, level, day_of_week, start_time, end_time, room, season,
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
        class_level: cls?.level ?? "",
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
  const sessionToken = cookieStore.get(CART_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json({ cart: null, items: [], total_cents: 0 });
  }

  const supabase = await createClient();
  const cart = await getCartWithItems(supabase, sessionToken);

  if (!cart) {
    return NextResponse.json({ cart: null, items: [], total_cents: 0 });
  }

  return NextResponse.json(cart);
}

/**
 * POST — add item to cart
 */
const addItemSchema = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid().optional(),
  student_name: z.string().optional(),
  price_cents: z.number().int().min(0),
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
      .select("id, name, max_students, is_active")
      .eq("id", parsed.data.class_id)
      .single();

    if (!cls || !cls.is_active) {
      return NextResponse.json({ error: "Class not found or inactive" }, { status: 404 });
    }

    // Get or create cart
    const cookieStore = await cookies();
    let sessionToken = cookieStore.get(CART_COOKIE)?.value;
    let cartId: string;

    if (sessionToken) {
      const { data: existingCart } = await supabase
        .from("enrollment_carts")
        .select("id, status, expires_at")
        .eq("session_token", sessionToken)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .single();

      if (existingCart) {
        cartId = existingCart.id;
      } else {
        // Cart expired or checked out — create new
        sessionToken = crypto.randomUUID();
        const { data: newCart, error: cartErr } = await supabase
          .from("enrollment_carts")
          .insert({
            tenant_id: tenantId,
            session_token: sessionToken,
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
      price_cents: parsed.data.price_cents,
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
