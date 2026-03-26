import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EvaluationClassList } from "./evaluation-class-list";

export default async function TeacherEvaluationsPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // Fetch classes assigned to this teacher
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", user.id);

  if (!classTeachers || classTeachers.length === 0) {
    return <EvaluationClassList classes={[]} />;
  }

  const classIds = classTeachers.map((ct) => ct.class_id);

  // Fetch class details
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, levels")
    .in("id", classIds)
    .order("day_of_week")
    .order("start_time");

  if (!classes || classes.length === 0) {
    return <EvaluationClassList classes={[]} />;
  }

  // Fetch enrolled student counts per class
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id, student_id")
    .in("class_id", classIds)
    .eq("status", "active");

  const studentCountMap: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    studentCountMap[e.class_id] = (studentCountMap[e.class_id] ?? 0) + 1;
  }

  // Fetch evaluation status counts per class
  const { data: evals } = await supabase
    .from("student_evaluations")
    .select("class_id, status")
    .in("class_id", classIds);

  const evalCountMap: Record<string, { draft: number; submitted: number; approved: number; published: number }> = {};
  for (const ev of evals ?? []) {
    if (!evalCountMap[ev.class_id]) {
      evalCountMap[ev.class_id] = { draft: 0, submitted: 0, approved: 0, published: 0 };
    }
    const status = ev.status as keyof typeof evalCountMap[string];
    if (status in evalCountMap[ev.class_id]) {
      evalCountMap[ev.class_id][status]++;
    }
  }

  const classData = classes.map((c) => ({
    id: c.id,
    name: c.name,
    dayOfWeek: c.day_of_week,
    startTime: c.start_time,
    endTime: c.end_time,
    levels: c.levels,
    studentCount: studentCountMap[c.id] ?? 0,
    evalCounts: evalCountMap[c.id] ?? { draft: 0, submitted: 0, approved: 0, published: 0 },
  }));

  return <EvaluationClassList classes={classData} />;
}
