import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classId = req.nextUrl.searchParams.get("classId");
  const date = req.nextUrl.searchParams.get("date");

  if (!classId) {
    return NextResponse.json(
      { error: "classId is required" },
      { status: 400 }
    );
  }

  // Verify teacher owns this class
  const { data: classData } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    // Also allow admins
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch roster
  const { data: roster } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      student_id,
      students (id, first_name, last_name, current_level, medical_notes)
    `
    )
    .eq("class_id", classId)
    .in("status", ["active", "trial"])
    .order("created_at");

  // Fetch existing attendance for this date
  let attendance: { id: string; student_id: string; status: string }[] = [];
  if (date) {
    const { data: att } = await supabase
      .from("attendance")
      .select("id, student_id, status")
      .eq("class_id", classId)
      .eq("class_date", date);
    attendance = att ?? [];
  }

  return NextResponse.json({ roster: roster ?? [], attendance });
}
