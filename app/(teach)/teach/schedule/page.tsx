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
    return <ScheduleClient classes={[]} userId={user.id} />;
  }

  // Fetch class details
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, room, levels, max_enrollment, max_students, location_id")
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

  // Resolve each class's home studio name (class-level location — spec §6 teacher)
  const locationIds = [
    ...new Set((classes ?? []).map((c) => c.location_id).filter(Boolean) as string[]),
  ];
  const locationNames: Record<string, string> = {};
  if (locationIds.length > 0) {
    const { data: locs } = await supabase
      .from("studio_locations")
      .select("id, name")
      .in("id", locationIds);
    for (const l of locs ?? []) locationNames[l.id] = l.name;
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
    location: c.location_id ? (locationNames[c.location_id] ?? null) : null,
  }));

  return <ScheduleClient classes={mapped} userId={user.id} />;
}
