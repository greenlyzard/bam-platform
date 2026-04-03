import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getMyStudents } from "@/lib/queries/portal";
import { PortalScheduleView } from "./schedule-view";

export default async function PortalSchedulePage() {
  const user = await requireParent();
  const supabase = await createClient();

  // Get students (includes guardian-linked students)
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);

  // Get active enrollments with class info
  let enrollments: Array<{
    id: string;
    student_id: string;
    class_id: string;
    status: string;
    classes: {
      id: string;
      name: string;
      style: string | null;
      level: string | null;
      day_of_week: number | null;
      start_time: string | null;
      end_time: string | null;
      room: string | null;
      teacher_id: string | null;
      max_students: number | null;
      enrolled_count: number;
    } | null;
  }> = [];

  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("enrollments")
      .select(
        `id, student_id, class_id, status,
         classes (id, name, style, level, day_of_week, start_time, end_time, room, teacher_id, max_students, enrolled_count)`
      )
      .in("student_id", studentIds)
      .in("status", ["active", "trial"]);

    enrollments = (data ?? []).map((e) => ({
      ...e,
      classes: Array.isArray(e.classes) ? e.classes[0] : e.classes,
    }));
  }

  // Get upcoming schedule instances for enrolled classes (next 30 days)
  const enrolledClassIds = [...new Set(enrollments.map((e) => e.class_id))];
  const nowDate = new Date();
  const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;
  const future = new Date(nowDate);
  future.setDate(future.getDate() + 30);
  const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;

  let instances: Array<{
    id: string;
    class_id: string;
    event_date: string;
    start_time: string;
    end_time: string;
    status: string;
    room_id: string | null;
    teacher_id: string | null;
    notes: string | null;
  }> = [];

  if (enrolledClassIds.length > 0) {
    const { data } = await supabase
      .from("schedule_instances")
      .select("id, class_id, event_date, start_time, end_time, status, room_id, teacher_id, notes")
      .in("class_id", enrolledClassIds)
      .gte("event_date", today)
      .lte("event_date", futureStr)
      .neq("status", "cancelled")
      .order("event_date")
      .order("start_time");
    instances = data ?? [];
  }

  // Get teacher names for enrolled classes + instances
  const allTeacherIds = new Set<string>();
  for (const e of enrollments) {
    if (e.classes?.teacher_id) allTeacherIds.add(e.classes.teacher_id);
  }
  for (const i of instances) {
    if (i.teacher_id) allTeacherIds.add(i.teacher_id);
  }
  const teacherNames: Record<string, string> = {};
  if (allTeacherIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...allTeacherIds]);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  // Get room names
  const roomIds = [...new Set(instances.map((i) => i.room_id).filter(Boolean) as string[])];
  const roomNames: Record<string, string> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds);
    for (const r of rooms ?? []) {
      roomNames[r.id] = r.name;
    }
  }

  // Get recommended classes: active, not already enrolled, matching age/level
  let recommended: Array<{
    id: string;
    name: string;
    style: string | null;
    level: string | null;
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    room: string | null;
    teacher_id: string | null;
    max_students: number | null;
    enrolled_count: number;
    age_min: number | null;
    age_max: number | null;
  }> = [];

  if (students && students.length > 0) {
    const { data: allClasses } = await supabase
      .from("classes")
      .select("id, name, style, level, day_of_week, start_time, end_time, room, teacher_id, max_students, enrolled_count, age_min, age_max")
      .eq("is_active", true)
      .order("name");

    // Calculate student ages
    const studentAges = (students ?? []).map((s) => {
      if (!s.date_of_birth) return null;
      const dob = new Date(s.date_of_birth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return { ...s, age };
    });

    const studentLevels = new Set((students ?? []).map((s) => s.current_level).filter(Boolean));

    recommended = (allClasses ?? []).filter((cls) => {
      // Exclude already enrolled
      if (enrolledClassIds.includes(cls.id)) return false;
      // Exclude full classes
      if (cls.max_students && cls.enrolled_count >= cls.max_students) return false;

      // Check age/level match for any student
      let matchesAny = false;
      for (const sa of studentAges) {
        if (!sa) continue;
        const ageOk =
          (!cls.age_min || sa.age >= cls.age_min) &&
          (!cls.age_max || sa.age <= cls.age_max);
        const levelOk = !cls.level || !sa.current_level || cls.level === sa.current_level || studentLevels.has(cls.level);
        if (ageOk && levelOk) {
          matchesAny = true;
          break;
        }
      }
      return matchesAny;
    });
  }

  // Check if any teacher has private lesson availability
  const { count: privateCount } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .ilike("style", "%private%");

  const hasPrivateLessons = (privateCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PortalScheduleView
        userId={user.id}
        students={students ?? []}
        enrollments={enrollments}
        instances={instances}
        teacherNames={teacherNames}
        roomNames={roomNames}
        recommended={recommended}
        hasPrivateLessons={hasPrivateLessons}
      />
    </div>
  );
}
