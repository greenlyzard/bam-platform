import "server-only";
import type { createClient } from "@/lib/supabase/server";

// Shared read model for the persistent enrollment cart (enrollment_carts + enrollment_cart_items).
// Used by the /api/enrollment/cart GET route and the portal cart page so both resolve a cart the
// same way: by the browser's bam_cart_token cookie first, then (for a signed-in parent) by family.
// The family fallback makes a cart discoverable even without a cookie — e.g. a future admin-curated
// cart assembled server-side for a family (see docs; not built here). Read-only: no cookie writes.

type SB = Awaited<ReturnType<typeof createClient>>;

export interface PortalCartItem {
  id: string;
  class_id: string;
  student_id: string | null;
  student_name: string | null;
  price_cents: number;
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_name: string | null;
}

export interface PortalCartData {
  id: string;
  session_token: string;
  status: string;
  expires_at: string;
  items: PortalCartItem[];
  total_cents: number;
}

interface CartRow {
  id: string;
  session_token: string;
  status: string;
  expires_at: string;
}

async function buildCart(supabase: SB, cart: CartRow): Promise<PortalCartData> {
  const { data: items } = await supabase
    .from("enrollment_cart_items")
    .select(
      `
      id, class_id, student_id, student_name, price_cents,
      class:classes(
        id, name, day_of_week, start_time, end_time, room,
        teacher:profiles!teacher_id(first_name, last_name)
      )
    `
    )
    .eq("cart_id", cart.id);

  const mapped: PortalCartItem[] = (items ?? []).map((item) => {
    const clsRaw = item.class as unknown;
    const cls = (Array.isArray(clsRaw) ? clsRaw[0] : clsRaw) as Record<string, unknown> | null;
    const teacherRaw = cls?.teacher as unknown;
    const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
      first_name: string;
      last_name: string;
    } | null;

    return {
      id: item.id as string,
      class_id: item.class_id as string,
      student_id: (item.student_id as string | null) ?? null,
      student_name: (item.student_name as string | null) ?? null,
      price_cents: (item.price_cents as number | null) ?? 0,
      class_name: (cls?.name as string | undefined) ?? "",
      day_of_week: (cls?.day_of_week as number | undefined) ?? 0,
      start_time: (cls?.start_time as string | undefined) ?? "",
      end_time: (cls?.end_time as string | undefined) ?? "",
      room: (cls?.room as string | null) ?? null,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
    };
  });

  const totalCents = mapped.reduce((sum, i) => sum + i.price_cents, 0);

  return {
    id: cart.id,
    session_token: cart.session_token,
    status: cart.status,
    expires_at: cart.expires_at,
    items: mapped,
    total_cents: totalCents,
  };
}

/**
 * Resolve the active cart for this request: by cookie session token first, then (for a signed-in
 * parent) the family's most recent active cart. `viaFamily` tells a caller in a mutation context
 * (the route handler) that it should adopt the cart into this browser by setting the cookie.
 */
export async function resolvePortalCart(
  supabase: SB,
  opts: { sessionToken?: string | null; familyId?: string | null }
): Promise<{ cart: PortalCartData | null; viaFamily: boolean }> {
  const now = new Date().toISOString();

  if (opts.sessionToken) {
    const { data: row } = await supabase
      .from("enrollment_carts")
      .select("id, session_token, status, expires_at")
      .eq("session_token", opts.sessionToken)
      .eq("status", "active")
      .gt("expires_at", now)
      .maybeSingle();
    if (row) return { cart: await buildCart(supabase, row as CartRow), viaFamily: false };
  }

  if (opts.familyId) {
    const { data: row } = await supabase
      .from("enrollment_carts")
      .select("id, session_token, status, expires_at")
      .eq("family_id", opts.familyId)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) return { cart: await buildCart(supabase, row as CartRow), viaFamily: true };
  }

  return { cart: null, viaFamily: false };
}
