import { requireTeacher } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireTeacher();
  const supabase = await createClient();
  const { classId } = await params;

  // Fetch class details
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, room")
    .eq("id", classId)
    .single();

  if (!cls) return notFound();

  // Verify teacher is assigned
  const { data: assignment } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .limit(1)
    .single();

  if (!assignment) return notFound();

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

  return (
    <AttendanceClient
      classId={classId}
      className={cls.name}
      students={students}
      existingRecords={existingRecords}
      tenantId={tenantId}
      teacherId={user.id}
    />
  );
}
