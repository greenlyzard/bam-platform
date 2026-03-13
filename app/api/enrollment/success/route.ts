import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET — fetch enrolled class details after successful checkout
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ classes: [] });
  }

  const supabase = await createClient();

  // Find cart by Stripe session ID
  const { data: cart } = await supabase
    .from("enrollment_carts")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .single();

  if (!cart) {
    return NextResponse.json({ classes: [] });
  }

  // Get items with class details
  const { data: items } = await supabase
    .from("enrollment_cart_items")
    .select(`
      class:classes(
        name, day_of_week, start_time, end_time,
        teacher:profiles!teacher_id(first_name, last_name)
      )
    `)
    .eq("cart_id", cart.id);

  const classes = (items ?? []).map((item) => {
    const cls = item.class as unknown as Record<string, unknown> | null;
    const teacherRaw = cls?.teacher as unknown;
    const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
      first_name: string;
      last_name: string;
    } | null;

    return {
      class_name: (cls?.name as string) ?? "",
      day_of_week: (cls?.day_of_week as number) ?? 0,
      start_time: (cls?.start_time as string) ?? "",
      end_time: (cls?.end_time as string) ?? "",
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
    };
  });

  return NextResponse.json({ classes });
}
