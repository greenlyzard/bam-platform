import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if caller is admin
  const { data: role } = await supabase
    .from("profile_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin", "studio_admin", "finance_admin", "studio_manager"])
    .limit(1)
    .maybeSingle();

  const isAdmin = !!role;
  const teacherIdParam = request.nextUrl.searchParams.get("teacherId");

  // Admin can query any teacher's classes; teacher sees their own
  const teacherId = isAdmin && teacherIdParam ? teacherIdParam : user.id;

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time")
    .eq("teacher_id", teacherId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[api/teach/classes]", error);
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }

  const formatted = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    day_of_week: c.day_of_week,
    day_name: c.day_of_week != null ? DAY_NAMES[c.day_of_week] : null,
    start_time: c.start_time,
    end_time: c.end_time,
  }));

  return NextResponse.json({ classes: formatted });
}
