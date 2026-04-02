import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the current user's students via:
 * 1. Primary parent (students.parent_id)
 * 2. Guardian with portal_access (student_guardians)
 * Deduplicates by student id.
 */
export async function getMyStudents() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Path 1: Primary parent
  const { data: primaryStudents } = await supabase
    .from("students")
    .select("*")
    .eq("parent_id", user.id)
    .eq("active", true);

  // Path 2: Guardian with portal_access
  let guardianStudents: typeof primaryStudents = [];
  try {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("profile_id", user.id)
      .eq("portal_access", true);

    const guardianStudentIds = (guardianLinks ?? []).map((g) => g.student_id);
    if (guardianStudentIds.length > 0) {
      const { data } = await supabase
        .from("students")
        .select("*")
        .in("id", guardianStudentIds)
        .eq("active", true);
      guardianStudents = data ?? [];
    }
  } catch {
    // student_guardians may not exist yet
  }

  // Merge and deduplicate
  const all = [...(primaryStudents ?? []), ...(guardianStudents ?? [])];
  const seen = new Set<string>();
  return all
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .sort((a, b) => (a.first_name ?? "").localeCompare(b.first_name ?? ""));
}

/**
 * Fetch enrollments for all of the current user's students
 * (via parent_id + student_guardians), with class details.
 */
export async function getMyEnrollments() {
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return [];

  const supabase = await createClient();

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
 * Fetch recent attendance for the current user's students.
 */
export async function getRecentAttendance(limit = 10) {
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return [];

  const supabase = await createClient();

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
 * Fetch a single student's detail with enrolled classes.
 */
export async function getStudentDetail(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("parent_id", user.id)
    .single();

  if (error || !student) return null;

  // Get enrollments with class details
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrollment_type,
      enrolled_at,
      class_id,
      classes (id, name, simple_name, style, level, day_of_week, start_time, end_time, room)
    `
    )
    .eq("student_id", studentId)
    .in("status", ["active", "trial", "waitlist", "pending_payment"])
    .order("enrolled_at", { ascending: false });

  return { ...student, enrollments: enrollments ?? [] };
}

/**
 * Fetch attendance summary for a student (current month).
 */
export async function getStudentAttendanceSummary(studentId: string) {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .gte("class_date", monthStart);

  if (error) return { present: 0, absent: 0, excused: 0, late: 0, total: 0 };

  const counts = { present: 0, absent: 0, excused: 0, late: 0, total: 0 };
  for (const row of data ?? []) {
    counts.total++;
    if (row.status in counts) {
      counts[row.status as keyof typeof counts]++;
    }
  }
  return counts;
}

/**
 * Fetch family contacts for a student's family.
 */
export async function getStudentContacts(studentId: string) {
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("family_id")
    .eq("id", studentId)
    .single();

  if (!student?.family_id) return [];

  const { data, error } = await supabase
    .from("family_contacts")
    .select("*")
    .eq("family_id", student.family_id)
    .order("is_primary", { ascending: false })
    .order("first_name");

  if (error) return [];
  return data ?? [];
}

/**
 * Get the family record for the current user.
 * Checks primary_contact_id first, then falls back to
 * finding family via student_guardians → student → family_id.
 */
export async function getMyFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Path 1: Primary contact
  const { data: primaryFamily } = await supabase
    .from("families")
    .select("*")
    .eq("primary_contact_id", user.id)
    .maybeSingle();

  if (primaryFamily) return primaryFamily;

  // Path 2: Find family via students where parent_id matches
  const { data: ownStudent } = await supabase
    .from("students")
    .select("family_id")
    .eq("parent_id", user.id)
    .not("family_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (ownStudent?.family_id) {
    const { data } = await supabase
      .from("families")
      .select("*")
      .eq("id", ownStudent.family_id)
      .single();
    if (data) return data;
  }

  // Path 3: Guardian path via student_guardians
  try {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("profile_id", user.id)
      .eq("portal_access", true)
      .limit(1);

    if (guardianLinks?.length) {
      const { data: student } = await supabase
        .from("students")
        .select("family_id")
        .eq("id", guardianLinks[0].student_id)
        .single();

      if (student?.family_id) {
        const { data } = await supabase
          .from("families")
          .select("*")
          .eq("id", student.family_id)
          .single();
        return data ?? null;
      }
    }
  } catch {
    // student_guardians may not exist yet
  }

  return null;
}

/**
 * Fetch upcoming class sessions for a parent's enrolled students.
 * Returns sessions grouped by student_id via enrollment → class → class_sessions.
 */
export async function getUpcomingSessionsForStudents(studentIds: string[]) {
  if (!studentIds.length) return [];

  const supabase = await createClient();

  // Get active/trial enrollments for these students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, class_id")
    .in("student_id", studentIds)
    .in("status", ["active", "trial"]);

  if (!enrollments?.length) return [];

  const classIds = [...new Set(enrollments.map((e) => e.class_id))];

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: sessions, error } = await supabase
    .from("class_sessions")
    .select(
      `
      id,
      class_id,
      session_date,
      start_time,
      end_time,
      room,
      status,
      is_cancelled,
      classes (id, name, simple_name, style, level)
    `
    )
    .in("class_id", classIds)
    .gte("session_date", today)
    .eq("is_cancelled", false)
    .in("status", ["scheduled"])
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[portal:getUpcomingSessions]", error);
    return [];
  }

  // Map sessions to students via enrollments
  const classToStudents: Record<string, string[]> = {};
  for (const e of enrollments) {
    if (!classToStudents[e.class_id]) classToStudents[e.class_id] = [];
    if (!classToStudents[e.class_id].includes(e.student_id)) {
      classToStudents[e.class_id].push(e.student_id);
    }
  }

  return (sessions ?? []).map((s) => ({
    ...s,
    studentIds: classToStudents[s.class_id] ?? [],
  }));
}

/**
 * Fetch badges earned by the current user's students.
 */
export async function getMyStudentBadges() {
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return [];

  const supabase = await createClient();

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
