import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: classRows, error: classErr } = await supabase
    .from("class_teachers")
    .select(
      "role, is_primary, classes(id, name, discipline, day_of_week, days_of_week, start_time, end_time, room_id, enrolled_count, max_enrollment, is_active, season, season_id)"
    )
    .eq("teacher_id", id);

  if (classErr) {
    return NextResponse.json({ error: classErr.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classes = (classRows ?? [] as any[])
    .map((ct: any) => ({
      ...ct.classes,
      teacher_role: ct.role,
      is_primary: ct.is_primary,
    }))
    .filter((c: any) => c.id)
    .sort((a: any, b: any) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      const da = a.day_of_week ?? 99;
      const db = b.day_of_week ?? 99;
      if (da !== db) return da - db;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

  const { data: sessions, error: sessErr } = await supabase
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
