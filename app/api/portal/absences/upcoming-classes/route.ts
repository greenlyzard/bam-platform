import { NextRequest, NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/portal/absences/upcoming-classes?student_id=<id>
 * Returns the next 14 days of class sessions for a student the parent owns.
 */
export async function GET(req: NextRequest) {
  const user = await requireParent();
  const studentId = req.nextUrl.searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ error: "student_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify ownership
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_id")
    .eq("id", studentId)
    .single();

  if (!student || student.parent_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .in("status", ["active", "trial"]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  if (classIds.length === 0) {
    return NextResponse.json({ student, classes: [] });
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 14);
  const futureStr = future.toISOString().split("T")[0];

  const { data: instances } = await supabase
    .from("schedule_instances")
    .select("id, class_id, event_date, start_time, end_time, status")
    .in("class_id", classIds)
    .gte("event_date", todayStr)
    .lte("event_date", futureStr)
    .neq("status", "cancelled")
    .order("event_date")
    .order("start_time");

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);

  const classMap = new Map<string, string>();
  for (const c of classes ?? []) classMap.set(c.id, c.name);

  // Filter out classes already reported absent
  const instanceIds = (instances ?? []).map((i) => i.id);
  const { data: existingAbsences } = await supabase
    .from("absence_records")
    .select("schedule_instance_id")
    .eq("student_id", studentId)
    .in("schedule_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const reportedSet = new Set(
    (existingAbsences ?? []).map((a) => a.schedule_instance_id).filter(Boolean) as string[]
  );

  const items = (instances ?? [])
    .filter((i) => !reportedSet.has(i.id))
    .map((i) => ({
      schedule_instance_id: i.id,
      class_id: i.class_id,
      class_name: classMap.get(i.class_id) ?? "Class",
      event_date: i.event_date,
      start_time: i.start_time,
      end_time: i.end_time,
    }));

  return NextResponse.json({ student, classes: items });
}
