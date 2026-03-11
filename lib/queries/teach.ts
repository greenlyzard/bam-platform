import { createClient } from "@/lib/supabase/server";

/**
 * Fetch classes assigned to the current teacher.
 */
export async function getMyClasses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", user.id)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[teach:getMyClasses]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch today's classes for the teacher.
 */
export async function getTodaysClasses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const today = new Date().getDay(); // 0=Sun, 6=Sat

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", user.id)
    .eq("is_active", true)
    .eq("day_of_week", today)
    .order("start_time");

  if (error) {
    console.error("[teach:getTodaysClasses]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch enrolled students for a specific class.
 */
export async function getClassRoster(classId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      student_id,
      students (id, first_name, last_name, date_of_birth, current_level, medical_notes, age_group)
    `
    )
    .eq("class_id", classId)
    .in("status", ["active", "trial"])
    .order("created_at");

  if (error) {
    console.error("[teach:getClassRoster]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch attendance records for a class on a specific date.
 */
export async function getClassAttendance(classId: string, date: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, status, teacher_notes")
    .eq("class_id", classId)
    .eq("class_date", date);

  if (error) {
    console.error("[teach:getClassAttendance]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch teacher's logged hours for a date range.
 */
export async function getMyHours(startDate: string, endDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("teacher_hours")
    .select(
      `
      id,
      date,
      hours,
      category,
      notes,
      approved,
      class_id,
      classes (name)
    `
    )
    .eq("teacher_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("[teach:getMyHours]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch teacher's pay rates.
 */
export async function getMyPayRates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select(
      "class_rate_cents, private_rate_cents, rehearsal_rate_cents, admin_rate_cents"
    )
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[teach:getMyPayRates]", error);
    return null;
  }

  return data;
}

/**
 * Count total students across all of a teacher's classes.
 */
export async function getMyStudentCount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  // Get teacher's class IDs
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("is_active", true);

  if (!classes?.length) return 0;

  const classIds = classes.map((c) => c.id);

  const { count, error } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("class_id", classIds)
    .in("status", ["active", "trial"]);

  if (error) {
    console.error("[teach:getMyStudentCount]", error);
    return 0;
  }

  return count ?? 0;
}
