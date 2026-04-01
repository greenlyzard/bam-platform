import { createClient } from "@/lib/supabase/server";

/**
 * Get all class IDs assigned to the current teacher,
 * via both the legacy classes.teacher_id and the class_teachers junction table.
 */
async function getTeacherClassIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  const [{ data: legacyClasses }, { data: junctionRows }] = await Promise.all([
    supabase.from("classes").select("id").eq("teacher_id", userId).eq("is_active", true),
    supabase.from("class_teachers").select("class_id").eq("teacher_id", userId),
  ]);
  const ids = new Set<string>();
  for (const c of legacyClasses ?? []) ids.add(c.id);
  for (const ct of junctionRows ?? []) ids.add(ct.class_id);
  return [...ids];
}

/**
 * Fetch classes assigned to the current teacher.
 */
export async function getMyClasses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const classIds = await getTeacherClassIds(supabase, user.id);
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .in("id", classIds)
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
 * Checks both day_of_week (legacy) and days_of_week (array) columns.
 */
export async function getTodaysClasses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const todayDow = new Date().getDay(); // 0=Sun, 6=Sat
  const classIds = await getTeacherClassIds(supabase, user.id);
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .in("id", classIds)
    .eq("is_active", true)
    .or(`day_of_week.eq.${todayDow},days_of_week.cs.{${todayDow}}`)
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

  const classIds = await getTeacherClassIds(supabase, user.id);
  if (classIds.length === 0) return 0;

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
