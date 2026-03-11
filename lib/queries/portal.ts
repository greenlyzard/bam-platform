import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the current parent's children (students).
 */
export async function getMyStudents() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("parent_id", user.id)
    .eq("active", true)
    .order("first_name");

  if (error) {
    console.error("[portal:getMyStudents]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch enrollments for a parent's children, with class details.
 */
export async function getMyEnrollments() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Get student IDs first
  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("parent_id", user.id)
    .eq("active", true);

  if (!students?.length) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrolled_at,
      student_id,
      students (id, first_name, last_name),
      class_id,
      classes (id, name, style, level, day_of_week, start_time, end_time, room, teacher_id)
    `
    )
    .in("student_id", studentIds)
    .in("status", ["active", "trial"])
    .order("enrolled_at", { ascending: false });

  if (error) {
    console.error("[portal:getMyEnrollments]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch recent attendance for a parent's children.
 */
export async function getRecentAttendance(limit = 10) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("parent_id", user.id);

  if (!students?.length) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from("attendance")
    .select(
      `
      id,
      class_date,
      status,
      student_id,
      students (first_name, last_name),
      classes (name)
    `
    )
    .in("student_id", studentIds)
    .order("class_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[portal:getRecentAttendance]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch badges earned by a parent's children.
 */
export async function getMyStudentBadges() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("parent_id", user.id);

  if (!students?.length) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from("student_badges")
    .select(
      `
      id,
      awarded_at,
      notes,
      student_id,
      students (first_name, last_name),
      badge_id,
      badges (name, description, category, tier, icon_url)
    `
    )
    .in("student_id", studentIds)
    .order("awarded_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[portal:getMyStudentBadges]", error);
    return [];
  }

  return data ?? [];
}
