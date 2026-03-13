import { createClient } from "@/lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────

export interface ScheduleClass {
  id: string;
  tenant_id: string;
  full_name: string | null;
  simple_name: string | null;
  short_name: string | null;
  display_name: string | null;
  name: string; // original column
  class_type: string;
  program_division: string | null;
  levels: string[] | null;
  min_age: number | null;
  max_age: number | null;
  start_date: string | null;
  end_date: string | null;
  room: string | null;
  lead_teacher_id: string | null;
  assistant_teacher_ids: string[] | null;
  max_enrollment: number | null;
  min_enrollment: number | null;
  enrollment_count: number;
  production_id: string | null;
  status: string;
  is_published: boolean;
  is_open_enrollment: boolean;
  trial_eligible: boolean;
  trial_requires_approval: boolean;
  trial_max_per_class: number;
  back_to_back_class_ids: string[] | null;
  color_code: string | null;
  created_at: string;
  // enriched
  teacherName?: string | null;
  productionName?: string | null;
}

export interface ClassSession {
  id: string;
  tenant_id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  room: string | null;
  lead_teacher_id: string | null;
  assistant_teacher_ids: string[] | null;
  substitute_teacher_id: string | null;
  is_substitute_session: boolean;
  status: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  needs_coverage: boolean;
  session_notes: string | null;
  attendance_locked_at: string | null;
  // enriched
  className?: string | null;
  classType?: string | null;
  teacherName?: string | null;
  teacherInitials?: string | null;
  subTeacherName?: string | null;
  enrollmentCount?: number;
}

export interface AdminTask {
  id: string;
  tenant_id: string;
  task_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  related_class_id: string | null;
  related_session_id: string | null;
  related_teacher_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  // enriched
  className?: string | null;
  teacherName?: string | null;
}

// ── Color constants ────────────────────────────────────────────

export const CLASS_TYPE_COLORS: Record<string, string> = {
  regular: "bg-[#9C8BBF]/15 text-[#6B5A99] border-[#9C8BBF]/30",
  rehearsal: "bg-[#D4A843]/15 text-[#9B7A2E] border-[#D4A843]/30",
  performance: "bg-[#5B2D8E]/15 text-[#5B2D8E] border-[#5B2D8E]/30",
  competition: "bg-[#E8735A]/15 text-[#C4503A] border-[#E8735A]/30",
  private: "bg-[#2D9B8E]/15 text-[#1A7568] border-[#2D9B8E]/30",
  workshop: "bg-[#6B7FA3]/15 text-[#4A5B7A] border-[#6B7FA3]/30",
  intensive: "bg-[#6B7FA3]/15 text-[#4A5B7A] border-[#6B7FA3]/30",
  cancelled: "bg-cloud text-mist",
};

export const CLASS_TYPE_BG: Record<string, string> = {
  regular: "#9C8BBF",
  rehearsal: "#D4A843",
  performance: "#5B2D8E",
  competition: "#E8735A",
  private: "#2D9B8E",
  workshop: "#6B7FA3",
  intensive: "#6B7FA3",
};

export const PRIORITY_BADGES: Record<string, string> = {
  urgent: "bg-error/10 text-error",
  normal: "bg-info/10 text-info",
  low: "bg-cloud text-slate",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  makeup_needed: "Makeup Needed",
  class_at_risk: "Class At Risk",
  coverage_needed: "Coverage Needed",
  cancellation_pay_decision: "Pay Decision",
  timesheet_review: "Timesheet Review",
  other: "Other",
};

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
