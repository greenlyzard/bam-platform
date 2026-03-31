import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScheduleInstances, getClassesAsScheduleInstances, getApprovedTeachers, getRooms, getDistinctLevels } from "@/lib/schedule/queries";
import { ScheduleCalendar } from "./schedule-calendar";

function getWeekRange(weekParam?: string): { startDate: string; endDate: string; weekStart: string } {
  let monday: Date;

  if (weekParam) {
    monday = new Date(weekParam + "T00:00:00");
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday = new Date(now);
    monday.setDate(now.getDate() + diff);
  }

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    startDate: fmt(monday),
    endDate: fmt(saturday),
    weekStart: fmt(monday),
  };
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    teacher?: string;
    level?: string;
    room?: string;
    day?: string;
  }>;
}) {
  const user = await requireAdmin();

  const params = await searchParams;
  const { startDate, endDate, weekStart } = getWeekRange(params.week);

  const filterParams = {
    startDate,
    endDate,
    teacherId: params.teacher,
    level: params.level,
    roomId: params.room,
    dayOfWeek: params.day,
    tenantId: user.tenantId ?? undefined,
  };

  const supabaseAdmin = createAdminClient();

  const [sessionInstances, classInstances, teachers, rooms, levels, { data: closureRows }, { data: privateRows }] = await Promise.all([
    getScheduleInstances(filterParams),
    getClassesAsScheduleInstances(filterParams),
    getApprovedTeachers(),
    getRooms(),
    getDistinctLevels(),
    supabaseAdmin
      .from("studio_closures")
      .select("closed_date, reason")
      .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
      .gte("closed_date", startDate)
      .lte("closed_date", endDate),
    supabaseAdmin
      .from("private_sessions")
      .select("id, session_date, start_time, end_time, studio, status, session_type, primary_teacher_id, student_ids, session_notes")
      .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
      .neq("status", "cancelled")
      .gte("session_date", startDate)
      .lte("session_date", endDate),
  ]);

  // Resolve student names for private sessions
  const allStudentIds = [...new Set((privateRows ?? []).flatMap((p: any) => p.student_ids ?? []))];
  const studentNameMap: Record<string, string> = {};
  if (allStudentIds.length > 0) {
    const { data: studentRows } = await supabaseAdmin
      .from("students")
      .select("id, first_name")
      .in("id", allStudentIds);
    for (const s of studentRows ?? []) studentNameMap[s.id] = s.first_name;
  }

  // Resolve teacher names for private sessions
  const teacherNameMap: Record<string, string> = {};
  for (const t of teachers) teacherNameMap[t.id] = t.name;

  // Convert private sessions to ScheduleInstance format
  const privateInstances = (privateRows ?? []).map((p: any) => {
    const names = ((p.student_ids as string[]) ?? []).map((id: string) => studentNameMap[id] ?? "Student").join(", ");
    return {
      id: p.id,
      tenant_id: "84d98f72-c82f-414f-8b17-172b802f6993",
      class_id: null,
      teacher_id: p.primary_teacher_id,
      room_id: null,
      event_type: "private_lesson",
      event_date: p.session_date,
      start_time: p.start_time,
      end_time: p.end_time,
      status: p.status,
      cancellation_reason: null,
      substitute_teacher_id: null,
      notes: p.session_notes,
      is_trial_eligible: false,
      production_id: null,
      className: `Private: ${names}`,
      classLevel: null,
      classStyle: p.session_type,
      teacherName: teacherNameMap[p.primary_teacher_id] ?? null,
      roomName: p.studio,
      enrolledCount: ((p.student_ids as string[]) ?? []).length,
      maxStudents: null,
    };
  });

  // Use session instances if available, otherwise fall back to recurring classes
  const baseInstances = sessionInstances.length > 0 ? sessionInstances : classInstances;
  const instances = [...baseInstances, ...privateInstances];
  const isRecurring = sessionInstances.length === 0;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <ScheduleCalendar
          instances={instances}
          teachers={teachers}
          rooms={rooms}
          levels={levels}
          weekStart={weekStart}
          isRecurring={isRecurring}
          closures={(closureRows ?? []).map(c => ({ closed_date: c.closed_date, reason: c.reason ?? "Closed" }))}
          initialFilters={{
            teacher: params.teacher || "",
            level: params.level || "",
            room: params.room || "",
            day: params.day || "",
          }}
        />
      </div>
    </div>
  );
}
