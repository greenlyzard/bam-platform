import { createClient } from "@/lib/supabase/server";

// ── Enrollment Stats ──────────────────────────────────

export async function getEnrollmentStats() {
  const supabase = await createClient();

  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const { count: totalEnrollments } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "trial"]);

  const { count: waitlistCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "waitlist");

  const { count: trialCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "trial");

  return {
    totalStudents: totalStudents ?? 0,
    totalEnrollments: totalEnrollments ?? 0,
    waitlistCount: waitlistCount ?? 0,
    trialCount: trialCount ?? 0,
  };
}

// ── Classes with enrollment counts ────────────────────

export async function getAllClasses() {
  const supabase = await createClient();

  const { data: classes, error } = await supabase
    .from("classes")
    .select(
      `
      id,
      name,
      style,
      level,
      day_of_week,
      start_time,
      end_time,
      room,
      max_students,
      is_active,
      teacher_id,
      age_min,
      age_max
    `
    )
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[admin:getAllClasses]", error);
    return [];
  }

  // Get enrollment counts per class
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .in("status", ["active", "trial"]);

  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    enrollmentCounts[e.class_id] =
      (enrollmentCounts[e.class_id] ?? 0) + 1;
  }

  // Get teacher names
  const teacherIds = [
    ...new Set(
      (classes ?? []).map((c) => c.teacher_id).filter(Boolean) as string[]
    ),
  ];
  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(" ");
    }
  }

  return (classes ?? []).map((c) => ({
    ...c,
    enrolledCount: enrollmentCounts[c.id] ?? 0,
    teacherName: c.teacher_id ? (teacherNames[c.teacher_id] ?? null) : null,
  }));
}

// ── Teachers with compliance & class counts ───────────

export async function getAllTeachers() {
  const supabase = await createClient();

  const { data: teachers, error } = await supabase
    .from("teachers")
    .select(
      `
      id,
      bio,
      specialties,
      certifications,
      hire_date,
      employment_type,
      class_rate_cents,
      private_rate_cents,
      rehearsal_rate_cents,
      admin_rate_cents,
      is_mandated_reporter_certified,
      mandated_reporter_cert_date,
      mandated_reporter_cert_expires_at,
      background_check_complete,
      background_check_expires_at,
      w9_on_file,
      can_be_scheduled
    `
    )
    .order("created_at");

  if (error) {
    console.error("[admin:getAllTeachers]", error);
    return [];
  }

  // Get profile names
  const ids = (teachers ?? []).map((t) => t.id);
  const profileNames: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", ids);
    for (const p of profiles ?? []) {
      profileNames[p.id] = {
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
      };
    }
  }

  // Get welcome_sent_at from teacher_profiles
  const welcomeMap: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: tps } = await supabase
      .from("teacher_profiles")
      .select("user_id, welcome_sent_at")
      .in("user_id", ids);
    for (const tp of tps ?? []) {
      welcomeMap[tp.user_id] = tp.welcome_sent_at;
    }
  }

  // Get class counts per teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("is_active", true);

  const classCounts: Record<string, number> = {};
  for (const c of classes ?? []) {
    if (c.teacher_id) {
      classCounts[c.teacher_id] = (classCounts[c.teacher_id] ?? 0) + 1;
    }
  }

  return (teachers ?? []).map((t) => ({
    ...t,
    firstName: profileNames[t.id]?.first_name ?? null,
    lastName: profileNames[t.id]?.last_name ?? null,
    email: profileNames[t.id]?.email ?? null,
    classCount: classCounts[t.id] ?? 0,
    welcomeSentAt: welcomeMap[t.id] ?? null,
  }));
}

// ── Expansion Markets ─────────────────────────────────

export async function getExpansionMarkets() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expansion_markets")
    .select("*")
    .order("readiness_score", { ascending: false });

  if (error) {
    console.error("[admin:getExpansionMarkets]", error);
    return [];
  }

  return data ?? [];
}

// ── Competitors ───────────────────────────────────────

export async function getCompetitors() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("competitor_studios")
    .select("*")
    .order("threat_level", { ascending: false })
    .order("name");

  if (error) {
    console.error("[admin:getCompetitors]", error);
    return [];
  }

  return data ?? [];
}

// ── Class capacity summary ────────────────────────────

export async function getCapacitySummary() {
  const classes = await getAllClasses();
  const active = classes.filter((c) => c.is_active);
  const atCapacity = active.filter(
    (c) => c.enrolledCount >= c.max_students
  );
  const totalCapacity = active.reduce((sum, c) => sum + c.max_students, 0);
  const totalEnrolled = active.reduce((sum, c) => sum + c.enrolledCount, 0);

  return {
    totalClasses: active.length,
    classesAtCapacity: atCapacity.length,
    capacityPercent:
      totalCapacity > 0
        ? Math.round((totalEnrolled / totalCapacity) * 100)
        : 0,
    totalCapacity,
    totalEnrolled,
  };
}
