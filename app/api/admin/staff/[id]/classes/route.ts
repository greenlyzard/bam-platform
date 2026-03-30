import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  // Query 1: get class_ids for this teacher
  const { data: ctRows, error: ctErr } = await admin
    .from("class_teachers")
    .select("class_id, role, is_primary")
    .eq("teacher_id", id);

  if (ctErr) {
    return NextResponse.json({ error: ctErr.message }, { status: 500 });
  }

  if (!ctRows || ctRows.length === 0) {
    // Still fetch private sessions even if no classes
    const { data: sessions } = await admin
      .from("private_sessions")
      .select("id, session_date, start_time, end_time, status, studio, student_ids, session_notes")
      .eq("primary_teacher_id", id)
      .neq("status", "cancelled")
      .order("session_date", { ascending: false })
      .limit(50);

    return NextResponse.json({ classes: [], privateSessions: sessions ?? [] });
  }

  const classIds = ctRows.map((ct) => ct.class_id);

  // Query 2: get the actual classes
  const { data: classRows, error: classErr } = await admin
    .from("classes")
    .select("id, name, discipline, day_of_week, days_of_week, start_time, end_time, room_id, enrolled_count, max_enrollment, is_active, season, season_id")
    .in("id", classIds)
    .order("is_active", { ascending: false })
    .order("day_of_week")
    .order("start_time");

  if (classErr) {
    return NextResponse.json({ error: classErr.message }, { status: 500 });
  }

  // Merge teacher role info back in
  const classes = (classRows ?? []).map((c) => ({
    ...c,
    teacher_role: ctRows.find((ct) => ct.class_id === c.id)?.role ?? null,
    is_primary: ctRows.find((ct) => ct.class_id === c.id)?.is_primary ?? false,
  }));

  // Private sessions
  const { data: sessions, error: sessErr } = await admin
    .from("private_sessions")
    .select("id, session_date, start_time, end_time, status, studio, student_ids, session_notes")
    .eq("primary_teacher_id", id)
    .neq("status", "cancelled")
    .order("session_date", { ascending: false })
    .limit(50);

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }

  return NextResponse.json({ classes, privateSessions: sessions ?? [] });
}
