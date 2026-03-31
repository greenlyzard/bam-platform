import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const studio = req.nextUrl.searchParams.get("studio");

  if (!date || !studio) {
    return NextResponse.json({ classes: [], privates: [] });
  }

  const supabase = createAdminClient();
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  // Find room by name
  const { data: roomRow } = await supabase
    .from("rooms")
    .select("id")
    .eq("name", studio)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // Classes on that day_of_week in that room
  let classes: any[] = [];
  if (roomRow) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, start_time, end_time")
      .eq("room_id", roomRow.id)
      .eq("is_active", true)
      .contains("days_of_week", [dayOfWeek]);

    // Also check legacy day_of_week field
    const { data: legacy } = await supabase
      .from("classes")
      .select("id, name, start_time, end_time")
      .eq("room_id", roomRow.id)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek);

    const seen = new Set<string>();
    for (const c of [...(data ?? []), ...(legacy ?? [])]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        classes.push(c);
      }
    }
  }

  // Private sessions on that date in that studio
  const { data: privates } = await supabase
    .from("private_sessions")
    .select("id, start_time, end_time, session_type")
    .eq("session_date", date)
    .eq("studio", studio)
    .neq("status", "cancelled");

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      start_time: c.start_time,
      end_time: c.end_time,
      type: "class",
    })),
    privates: (privates ?? []).map((p) => ({
      id: p.id,
      name: `Private (${p.session_type})`,
      start_time: p.start_time,
      end_time: p.end_time,
      type: "private",
    })),
  });
}
