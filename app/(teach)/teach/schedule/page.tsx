import { requireTeacher } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ScheduleClient } from "./schedule-client";

export default async function TeacherSchedulePage() {
  const user = await requireTeacher();
  const supabase = await createClient();

  // Fetch classes assigned to this teacher via class_teachers
  const { data: assignments } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", user.id);

  const classIds = (assignments ?? []).map((a) => a.class_id);

  if (classIds.length === 0) {
    return (
      <ScheduleClient classes={[]} />
    );
  }

  // Fetch class details
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, room, levels, max_enrollment, max_students")
    .in("id", classIds)
    .eq("is_active", true);

  // Fetch enrollment counts per class
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .in("class_id", classIds)
    .in("status", ["active", "trial"]);

  const countMap: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1;
  }

  const mapped = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    dayOfWeek: c.day_of_week as number,
    startTime: c.start_time as string,
    endTime: c.end_time as string,
    room: c.room as string | null,
    levels: c.levels as string[] | null,
    enrolled: countMap[c.id] ?? 0,
    capacity: c.max_enrollment ?? c.max_students ?? 10,
  }));

  return <ScheduleClient classes={mapped} />;
}
