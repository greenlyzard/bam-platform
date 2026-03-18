import { createClient } from "@/lib/supabase/server";

/**
 * Fetch all students with enrollment counts and guardian info.
 */
export async function getStudents(filters?: {
  search?: string;
  mediaConsent?: "yes" | "no" | "";
}) {
  const supabase = await createClient();

  let query = supabase
    .from("students")
    .select(
      "id, first_name, last_name, preferred_name, date_of_birth, current_level, active, avatar_url, media_consent, family_id, parent_id"
    )
    .order("last_name")
    .order("first_name");

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,preferred_name.ilike.%${filters.search}%`
    );
  }

  if (filters?.mediaConsent === "yes") {
    query = query.eq("media_consent", true);
  } else if (filters?.mediaConsent === "no") {
    query = query.eq("media_consent", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[students:getStudents]", error);
    return [];
  }

  // Get enrollment counts
  const studentIds = (data ?? []).map((s) => s.id);
  if (studentIds.length === 0) return data ?? [];

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .in("student_id", studentIds)
    .in("status", ["active", "trial"]);

  const enrollMap: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    enrollMap[e.student_id] = (enrollMap[e.student_id] ?? 0) + 1;
  }

  return (data ?? []).map((s) => ({
    ...s,
    enrollment_count: enrollMap[s.id] ?? 0,
  }));
}

/**
 * Fetch a single student by ID with full details.
 */
export async function getStudentById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[students:getById]", error);
    return null;
  }
  return data;
}

/**
 * Get all enrollments for a student with class details.
 */
export async function getStudentEnrollments(studentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrollment_type,
      enrolled_at,
      dropped_at,
      class_id,
      classes (id, name, simple_name, day_of_week, start_time, end_time, room, teacher_id, fee_cents, level, style)
    `
    )
    .eq("student_id", studentId)
    .order("enrolled_at", { ascending: false });

  if (error) {
    console.error("[students:getEnrollments]", error);
    return [];
  }

  // Enrich with teacher names
  const teacherIds = [
    ...new Set(
      (data ?? [])
        .map((e) => {
          const cls = Array.isArray(e.classes) ? e.classes[0] : e.classes;
          return cls?.teacher_id;
        })
        .filter(Boolean) as string[]
    ),
  ];

  let teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);

    for (const t of teachers ?? []) {
      teacherMap[t.id] = [t.first_name, t.last_name].filter(Boolean).join(" ");
    }
  }

  return (data ?? []).map((e) => {
    const cls = (Array.isArray(e.classes) ? e.classes[0] : e.classes) as {
      id: string;
      name: string;
      simple_name: string | null;
      day_of_week: number | null;
      start_time: string | null;
      end_time: string | null;
      room: string | null;
      teacher_id: string | null;
      fee_cents: number | null;
      level: string | null;
      style: string | null;
    } | null;
    return {
      ...e,
      class: cls,
      teacherName: cls?.teacher_id ? teacherMap[cls.teacher_id] ?? null : null,
    };
  });
}

/**
 * Get this week's schedule for a student (classes + rehearsals).
 */
export async function getStudentSchedule(
  studentId: string,
  weekOffset = 0
) {
  const supabase = await createClient();

  // Get enrolled class IDs
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .in("status", ["active", "trial"]);

  const classIds = (enrollments ?? []).map((e) => e.class_id);

  // Calculate week start/end
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDate = monday.toISOString().split("T")[0];
  const endDate = sunday.toISOString().split("T")[0];

  if (classIds.length === 0) return [];

  const { data: instances, error } = await supabase
    .from("schedule_instances")
    .select(
      "id, class_id, teacher_id, room_id, event_type, event_date, start_time, end_time, status, notes"
    )
    .in("class_id", classIds)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .neq("status", "cancelled")
    .order("event_date")
    .order("start_time");

  if (error) {
    console.error("[students:getSchedule]", error);
    return [];
  }

  // Enrich with class names, teacher names, room names
  const allClassIds = [
    ...new Set((instances ?? []).map((i) => i.class_id).filter(Boolean)),
  ] as string[];
  const teacherIds = [
    ...new Set((instances ?? []).map((i) => i.teacher_id).filter(Boolean)),
  ] as string[];
  const roomIds = [
    ...new Set((instances ?? []).map((i) => i.room_id).filter(Boolean)),
  ] as string[];

  const [classesRes, teachersRes, roomsRes] = await Promise.all([
    allClassIds.length > 0
      ? supabase
          .from("classes")
          .select("id, name, simple_name")
          .in("id", allClassIds)
      : { data: [] },
    teacherIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", teacherIds)
      : { data: [] },
    roomIds.length > 0
      ? supabase.from("rooms").select("id, name").in("id", roomIds)
      : { data: [] },
  ]);

  const classMap: Record<string, string> = {};
  for (const c of classesRes.data ?? []) {
    classMap[c.id] = c.simple_name || c.name;
  }

  const teacherMap: Record<string, string> = {};
  for (const t of teachersRes.data ?? []) {
    teacherMap[t.id] = [t.first_name, t.last_name].filter(Boolean).join(" ");
  }

  const roomMap: Record<string, string> = {};
  for (const r of roomsRes.data ?? []) {
    roomMap[r.id] = r.name;
  }

  return (instances ?? []).map((i) => ({
    ...i,
    className: i.class_id ? classMap[i.class_id] ?? null : null,
    teacherName: i.teacher_id ? teacherMap[i.teacher_id] ?? null : null,
    roomName: i.room_id ? roomMap[i.room_id] ?? null : null,
  }));
}

/**
 * Get guardians for a student from student_guardians.
 */
export async function getStudentGuardians(studentId: string) {
  const supabase = await createClient();

  const { data: guardians, error } = await supabase
    .from("student_guardians")
    .select(
      "id, student_id, profile_id, relationship, is_primary, is_billing, is_emergency, portal_access, created_at"
    )
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false });

  if (error || !guardians?.length) return [];

  const profileIds = guardians.map((g) => g.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone, email_opt_in, sms_opt_in"
    )
    .in("id", profileIds);

  const profileMap: Record<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      email_opt_in: boolean;
      sms_opt_in: boolean;
    }
  > = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  return guardians.map((g) => {
    const profile = profileMap[g.profile_id];
    return {
      ...g,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      email_opt_in: profile?.email_opt_in ?? true,
      sms_opt_in: profile?.sms_opt_in ?? true,
    };
  });
}

/**
 * Get extended contacts for a student.
 */
export async function getStudentExtendedContacts(studentId: string) {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("extended_contact_students")
    .select("extended_contact_id")
    .eq("student_id", studentId);

  if (!links?.length) return [];

  const contactIds = links.map((l) => l.extended_contact_id);

  const { data, error } = await supabase
    .from("extended_contacts")
    .select("*")
    .in("id", contactIds)
    .order("last_name");

  if (error) {
    console.error("[students:getExtendedContacts]", error);
    return [];
  }

  return data ?? [];
}
