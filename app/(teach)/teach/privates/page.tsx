import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TeacherPrivatesClient } from "./teacher-privates-client";

export default async function TeacherPrivatesPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // Fetch sessions where this teacher is the primary teacher
  const { data: sessions } = await supabase
    .from("private_sessions")
    .select(
      "id, tenant_id, session_type, session_date, start_time, end_time, duration_minutes, studio, student_ids, co_teacher_ids, is_recurring, recurrence_rule, status, session_notes, parent_visible_notes"
    )
    .eq("primary_teacher_id", user.id)
    .order("session_date", { ascending: false });

  const rows = sessions ?? [];

  // Collect all unique student IDs across sessions
  const allStudentIds = Array.from(
    new Set(rows.flatMap((s) => (s.student_ids as string[]) ?? []))
  );

  // Fetch student names
  let studentMap: Record<string, string> = {};
  if (allStudentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", allStudentIds);

    if (students) {
      for (const s of students) {
        const name = [s.first_name, s.last_name].filter(Boolean).join(" ");
        studentMap[s.id] = name || "Unknown Student";
      }
    }
  }

  return (
    <TeacherPrivatesClient sessions={rows} studentMap={studentMap} />
  );
}
