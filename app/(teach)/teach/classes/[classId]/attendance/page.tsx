import { requireTeacher } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireTeacher();
  const { classId } = await params;
  const supabase = createAdminClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .single();

  // Get tenant_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id ?? "";

  // Fetch enrolled students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      status,
      student:students (
        id, first_name, last_name, avatar_url
      )
    `)
    .eq("class_id", classId)
    .in("status", ["active", "trial"]);

  const students = (enrollments ?? [])
    .filter((e) => e.student)
    .map((e) => {
      const s = e.student as any;
      return {
        id: s.id,
        firstName: s.first_name as string,
        lastName: s.last_name as string,
        avatarUrl: s.avatar_url as string | null,
        enrollmentStatus: e.status,
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  // Fetch today's attendance records
  const today = new Date().toISOString().split("T")[0];
  const { data: records } = await supabase
    .from("attendance_records")
    .select("id, student_id, status, notes")
    .eq("class_id", classId)
    .eq("date", today);

  const existingRecords = (records ?? []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    status: r.status,
    notes: r.notes,
  }));

  // Pre-marked absences reported by parents for today's session
  const { data: absences } = await supabase
    .from("absence_records")
    .select("student_id, parent_note")
    .eq("class_id", classId)
    .eq("absence_date", today);

  const preMarkedAbsences: Record<string, string | null> = {};
  for (const a of absences ?? []) {
    preMarkedAbsences[a.student_id] = a.parent_note;
  }

  return (
    <AttendanceClient
      classId={classId}
      className={cls?.name ?? "Class"}
      students={students}
      existingRecords={existingRecords}
      tenantId={tenantId}
      teacherId={user.id}
      preMarkedAbsences={preMarkedAbsences}
    />
  );
}
