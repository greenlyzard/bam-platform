import { createClient } from "@/lib/supabase/server";

// Re-export types and constants from types.ts (safe for client imports)
export type { ScheduleClass, ClassSession, AdminTask, ScheduleInstance } from "./types";
export {
  CLASS_TYPE_COLORS,
  CLASS_TYPE_BG,
  PRIORITY_BADGES,
  TASK_TYPE_LABELS,
  LEVEL_COLORS,
  getLevelColor,
} from "./types";

import type { ScheduleClass, ClassSession, AdminTask, ScheduleInstance } from "./types";

// ── Query functions ────────────────────────────────────────────

export async function getScheduleClasses(filters?: {
  classType?: string;
  programDivision?: string;
  status?: string;
  teacherId?: string;
}): Promise<ScheduleClass[]> {
  const supabase = await createClient();

  let query = supabase
    .from("classes")
    .select(
      `id, tenant_id, full_name, simple_name, short_name, display_name, name,
       class_type, program_division, levels, min_age, max_age,
       start_date, end_date, room, lead_teacher_id, assistant_teacher_ids,
       max_enrollment, min_enrollment, enrollment_count, production_id,
       status, is_published, is_open_enrollment, trial_eligible,
       trial_requires_approval, trial_max_per_class, back_to_back_class_ids,
       color_code, created_at`
    )
    .order("created_at", { ascending: false });

  if (filters?.classType) query = query.eq("class_type", filters.classType);
  if (filters?.programDivision) query = query.eq("program_division", filters.programDivision);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.teacherId) query = query.eq("lead_teacher_id", filters.teacherId);

  const { data: classes, error } = await query;

  if (error) {
    console.error("[schedule:getClasses]", error);
    return [];
  }

  // Enrich with teacher names
  const teacherIds = [...new Set(
    (classes ?? []).map((c) => c.lead_teacher_id).filter(Boolean) as string[]
  )];
  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (classes ?? []).map((c) => ({
    ...c,
    enrollment_count: c.enrollment_count ?? 0,
    teacherName: c.lead_teacher_id ? (teacherNames[c.lead_teacher_id] ?? null) : null,
  }));
}

export async function getScheduleClassById(classId: string): Promise<ScheduleClass | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .single();

  if (error || !data) return null;

  // Get teacher name
  let teacherName: string | null = null;
  if (data.lead_teacher_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", data.lead_teacher_id)
      .single();
    if (p) teacherName = [p.first_name, p.last_name].filter(Boolean).join(" ");
  }

  return { ...data, enrollment_count: data.enrollment_count ?? 0, teacherName };
}

export async function getRecurrenceRules(classId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_recurrence_rules")
    .select("*")
    .eq("class_id", classId);
  return data ?? [];
}

export async function getClassSessions(filters: {
  startDate: string;
  endDate: string;
  classType?: string;
  teacherId?: string;
  room?: string;
}): Promise<ClassSession[]> {
  const supabase = await createClient();

  let query = supabase
    .from("class_sessions")
    .select(
      `id, tenant_id, class_id, session_date, start_time, end_time,
       duration_minutes, room, lead_teacher_id, assistant_teacher_ids,
       substitute_teacher_id, is_substitute_session, status, is_cancelled,
       cancellation_reason, needs_coverage, session_notes, attendance_locked_at`
    )
    .gte("session_date", filters.startDate)
    .lte("session_date", filters.endDate)
    .order("session_date")
    .order("start_time");

  const { data: sessions, error } = await query;

  if (error) {
    console.error("[schedule:getSessions]", error);
    return [];
  }

  if (!sessions || sessions.length === 0) return [];

  // Get class info
  const classIds = [...new Set(sessions.map((s) => s.class_id))];
  const { data: classes } = await supabase
    .from("classes")
    .select("id, simple_name, full_name, name, class_type, enrollment_count")
    .in("id", classIds);

  const classMap: Record<string, { name: string; classType: string; enrollmentCount: number }> = {};
  for (const c of classes ?? []) {
    classMap[c.id] = {
      name: c.simple_name ?? c.full_name ?? c.name,
      classType: c.class_type ?? "regular",
      enrollmentCount: c.enrollment_count ?? 0,
    };
  }

  // Get teacher names
  const teacherUserIds = new Set<string>();
  for (const s of sessions) {
    if (s.lead_teacher_id) teacherUserIds.add(s.lead_teacher_id);
    if (s.substitute_teacher_id) teacherUserIds.add(s.substitute_teacher_id);
  }

  const teacherNames: Record<string, { name: string; initials: string }> = {};
  if (teacherUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...teacherUserIds]);
    for (const p of profiles ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      const initials = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("");
      teacherNames[p.id] = { name, initials };
    }
  }

  let enriched = sessions.map((s) => ({
    ...s,
    className: classMap[s.class_id]?.name ?? null,
    classType: classMap[s.class_id]?.classType ?? "regular",
    teacherName: s.lead_teacher_id ? (teacherNames[s.lead_teacher_id]?.name ?? null) : null,
    teacherInitials: s.lead_teacher_id ? (teacherNames[s.lead_teacher_id]?.initials ?? null) : null,
    subTeacherName: s.substitute_teacher_id ? (teacherNames[s.substitute_teacher_id]?.name ?? null) : null,
    enrollmentCount: classMap[s.class_id]?.enrollmentCount ?? 0,
  }));

  // Apply filters
  if (filters.classType) {
    enriched = enriched.filter((s) => s.classType === filters.classType);
  }
  if (filters.teacherId) {
    enriched = enriched.filter(
      (s) => s.lead_teacher_id === filters.teacherId ||
             s.substitute_teacher_id === filters.teacherId ||
             (s.assistant_teacher_ids ?? []).includes(filters.teacherId!)
    );
  }
  if (filters.room) {
    enriched = enriched.filter((s) => s.room === filters.room);
  }

  return enriched;
}

export async function getSessionById(sessionId: string): Promise<ClassSession | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) return null;

  // Get class info
  const { data: cls } = await supabase
    .from("classes")
    .select("simple_name, full_name, name, class_type, enrollment_count, back_to_back_class_ids")
    .eq("id", data.class_id)
    .single();

  // Get teacher names
  let teacherName: string | null = null;
  let teacherInitials: string | null = null;
  if (data.lead_teacher_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", data.lead_teacher_id)
      .single();
    if (p) {
      teacherName = [p.first_name, p.last_name].filter(Boolean).join(" ");
      teacherInitials = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("");
    }
  }

  return {
    ...data,
    className: cls?.simple_name ?? cls?.full_name ?? cls?.name ?? null,
    classType: cls?.class_type ?? "regular",
    teacherName,
    teacherInitials,
    subTeacherName: null,
    enrollmentCount: cls?.enrollment_count ?? 0,
  };
}

export async function getAdminTasks(filters?: {
  taskType?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
}): Promise<AdminTask[]> {
  const supabase = await createClient();

  let query = supabase
    .from("admin_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.taskType) query = query.eq("task_type", filters.taskType);
  if (filters?.priority) query = query.eq("priority", filters.priority);
  if (filters?.status) query = query.eq("status", filters.status);
  else query = query.in("status", ["open", "in_progress"]);
  if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);

  const { data: tasks, error } = await query;

  if (error) {
    console.error("[schedule:getTasks]", error);
    return [];
  }

  // Enrich with class/teacher names
  const classIds = [...new Set(
    (tasks ?? []).map((t) => t.related_class_id).filter(Boolean) as string[]
  )];
  const teacherIds = [...new Set(
    (tasks ?? []).map((t) => t.related_teacher_id).filter(Boolean) as string[]
  )];

  const classNames: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, simple_name, full_name, name")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classNames[c.id] = c.simple_name ?? c.full_name ?? c.name;
    }
  }

  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (tasks ?? []).map((t) => ({
    ...t,
    className: t.related_class_id ? (classNames[t.related_class_id] ?? null) : null,
    teacherName: t.related_teacher_id ? (teacherNames[t.related_teacher_id] ?? null) : null,
  }));
}

export async function getOpenTaskCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("admin_tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);
  return count ?? 0;
}

export async function getApprovedTeachers(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ["teacher", "admin", "super_admin"])
    .order("first_name");

  return (data ?? []).map((p) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id,
  }));
}

export async function getProductions(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");
  return data ?? [];
}

// ── Schedule Instances (actual schedule data) ────────────────

export async function getRooms(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("id, name")
    .order("name");
  return data ?? [];
}

export async function getScheduleInstances(filters: {
  startDate: string;
  endDate: string;
  teacherId?: string;
  level?: string;
  style?: string;
  roomId?: string;
  dayOfWeek?: string;
  tenantId?: string;
}): Promise<ScheduleInstance[]> {
  const supabase = await createClient();

  let query = supabase
    .from("schedule_instances")
    .select("id, tenant_id, class_id, teacher_id, room_id, event_type, event_date, start_time, end_time, status, cancellation_reason, substitute_teacher_id, notes, is_trial_eligible, production_id")
    .gte("event_date", filters.startDate)
    .lte("event_date", filters.endDate)
    .order("event_date")
    .order("start_time");

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }
  if (filters.teacherId) {
    query = query.eq("teacher_id", filters.teacherId);
  }
  if (filters.roomId) {
    query = query.eq("room_id", filters.roomId);
  }

  const { data: instances, error } = await query;

  if (error) {
    console.error("[schedule:getInstances]", error);
    return [];
  }

  if (!instances || instances.length === 0) return [];

  // Get class info for enrichment
  const classIds = [...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[])];
  const classMap: Record<string, { name: string; level: string | null; style: string | null; enrolled_count: number; max_students: number | null }> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, level, style, enrolled_count, max_students")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classMap[c.id] = {
        name: c.name,
        level: c.level,
        style: c.style,
        enrolled_count: c.enrolled_count ?? 0,
        max_students: c.max_students,
      };
    }
  }

  // Get room names
  const roomIds = [...new Set(instances.map((i) => i.room_id).filter(Boolean) as string[])];
  const roomMap: Record<string, string> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds);
    for (const r of rooms ?? []) {
      roomMap[r.id] = r.name;
    }
  }

  // Get teacher names
  const teacherIds = new Set<string>();
  for (const i of instances) {
    if (i.teacher_id) teacherIds.add(i.teacher_id);
    if (i.substitute_teacher_id) teacherIds.add(i.substitute_teacher_id);
  }
  const teacherMap: Record<string, { name: string; initials: string }> = {};
  if (teacherIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...teacherIds]);
    for (const p of profiles ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      const initials = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("");
      teacherMap[p.id] = { name, initials };
    }
  }

  let enriched: ScheduleInstance[] = instances.map((i) => ({
    ...i,
    is_trial_eligible: i.is_trial_eligible ?? false,
    className: i.class_id ? (classMap[i.class_id]?.name ?? null) : null,
    classLevel: i.class_id ? (classMap[i.class_id]?.level ?? null) : null,
    classStyle: i.class_id ? (classMap[i.class_id]?.style ?? null) : null,
    teacherName: i.teacher_id ? (teacherMap[i.teacher_id]?.name ?? null) : null,
    teacherInitials: i.teacher_id ? (teacherMap[i.teacher_id]?.initials ?? null) : null,
    subTeacherName: i.substitute_teacher_id ? (teacherMap[i.substitute_teacher_id]?.name ?? null) : null,
    roomName: i.room_id ? (roomMap[i.room_id] ?? null) : null,
    enrolledCount: i.class_id ? (classMap[i.class_id]?.enrolled_count ?? 0) : 0,
    maxStudents: i.class_id ? (classMap[i.class_id]?.max_students ?? null) : null,
  }));

  // Client-side filters that need enriched data
  if (filters.level) {
    enriched = enriched.filter((i) =>
      i.classLevel?.toLowerCase().includes(filters.level!.toLowerCase())
    );
  }
  if (filters.style) {
    enriched = enriched.filter((i) =>
      i.classStyle?.toLowerCase().includes(filters.style!.toLowerCase())
    );
  }
  if (filters.dayOfWeek) {
    const dow = parseInt(filters.dayOfWeek, 10);
    enriched = enriched.filter((i) => {
      const d = new Date(i.event_date + "T00:00:00");
      return d.getDay() === dow;
    });
  }

  return enriched;
}

export async function getDistinctLevels(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("level")
    .eq("is_active", true)
    .not("level", "is", null);

  const levels = [...new Set((data ?? []).map((c) => c.level).filter(Boolean) as string[])];
  return levels.sort();
}
