import { createClient } from "@/lib/supabase/server";
import { fetchLocationLabels } from "@/lib/locations/queries";
import type { LocationLabelRef } from "@/lib/locations/resolve";

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
       max_enrollment, min_enrollment, enrolled_count, production_id,
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
    console.error("[schedule:getClasses]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
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
    enrollment_count: c.enrolled_count ?? 0,
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

  return { ...data, enrollment_count: data.enrolled_count ?? 0, teacherName };
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
    console.error("[schedule:getSessions]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  if (!sessions || sessions.length === 0) return [];

  // Get class info
  const classIds = [...new Set(sessions.map((s) => s.class_id))];
  const { data: classes } = await supabase
    .from("classes")
    .select("id, simple_name, full_name, name, class_type, enrolled_count")
    .in("id", classIds);

  const classMap: Record<string, { name: string; classType: string; enrollmentCount: number }> = {};
  for (const c of classes ?? []) {
    classMap[c.id] = {
      name: c.simple_name ?? c.full_name ?? c.name,
      classType: c.class_type ?? "regular",
      enrollmentCount: c.enrolled_count ?? 0,
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
    .select("simple_name, full_name, name, class_type, enrolled_count, back_to_back_class_ids")
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
    enrollmentCount: cls?.enrolled_count ?? 0,
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
    console.error("[schedule:getTasks]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
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

/**
 * Rooms for the schedule filter. Carries `is_active` (the archive flag —
 * LOCATIONS_AND_FACILITIES.md §6.1) and the room's location, because room names
 * are only unique *within* a location: two studios each have a "Studio 1".
 *
 * `location_id` is returned alongside the label because the Day view's
 * add-a-private click needs the **id**, not the label: a private resolves back
 * to a room on the `(location_id, lower(studio))` pair (§3.1), and
 * `LocationLabelRef` is deliberately only `{name, abbreviation}`.
 */
export async function getRooms(): Promise<
  Array<{
    id: string;
    name: string;
    is_active: boolean;
    location_id: string | null;
    location: LocationLabelRef | null;
  }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("id, name, is_active, location_id")
    .order("name");

  const rooms = data ?? [];
  const locationMap = await fetchLocationLabels(
    supabase,
    rooms.map((r) => r.location_id)
  );

  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    is_active: r.is_active,
    location_id: r.location_id,
    location: r.location_id ? locationMap[r.location_id] ?? null : null,
  }));
}

// ── Private sessions on the Calendar ──────────────────────────
// PRIVATE_ADD_FROM_CALENDAR.md §3, D1: **union at read**. The week feed reads
// `private_sessions` directly and maps each row into the calendar-event shape.
// No `schedule_instances` row is ever written for a private — `private_sessions`
// stays the single source of truth, so an edit/cancel has exactly one place to
// land and there is no second table to drift.

/**
 * Private statuses that must not occupy the operational day.
 *
 * `cancelled` — the session is off (§3.1).
 * `rescheduled` — the row still carries the OLD date/time; its replacement is a
 * separate row, so rendering both double-books the studio.
 *
 * `completed` and `no_show` stay: those sessions happened, and the week they
 * happened in should say so.
 */
const PRIVATE_HIDDEN_STATUSES = ["cancelled", "rescheduled"];

/**
 * The Calendar title for a private — D6 / COMMUNICATIONS_HUB.md §6.2 and its
 * decision 2: the studio calendar shows "Private Reservation" and the teacher,
 * **never** the student name. Unconditional, not gated on
 * `students.privates_visible_in_group` — that flag governs the BAM PRIVATES
 * group feed, where the default is student-name-visible; the calendar has no
 * such default to opt out of.
 */
function privateReservationTitle(teacherName: string | null): string {
  return teacherName ? `Private Reservation — ${teacherName}` : "Private Reservation";
}

/**
 * Fetch the week's private sessions and map them into `ScheduleInstance`s.
 *
 * Room placement (§3.1): privates carry a free-text `studio` ("Studio 1") and no
 * `room_id`. Where that name resolves to a real `rooms` row **at the private's
 * own `location_id`**, we attach that `room_id` so the private shares the class
 * column — the name alone is not enough, since San Clemente and RSM each have a
 * "Studio 1". Where it does not resolve, the free-text name is kept and the
 * calendar groups it in its own `name:` lane (or "Unassigned" when there is no
 * studio at all). A private is never dropped for want of a room.
 *
 * Recurrence (§3.2) is NOT expanded yet: a recurring private renders on its seed
 * date only, not on every week it recurs. Deliberately one-off-first per the
 * spec, and currently invisible — 0 of the 5 live rows are recurring.
 */
async function getPrivateSessionInstances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: {
    startDate: string;
    endDate: string;
    teacherId?: string;
    roomId?: string;
    tenantId?: string;
  }
): Promise<ScheduleInstance[]> {
  let query = supabase
    .from("private_sessions")
    .select(
      "id, tenant_id, session_date, start_time, end_time, status, session_type, studio, location_id, primary_teacher_id, co_teacher_ids, student_ids, session_notes"
    )
    .gte("session_date", filters.startDate)
    .lte("session_date", filters.endDate)
    .not("status", "in", `(${PRIVATE_HIDDEN_STATUSES.join(",")})`);

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  const { data: privates, error } = await query;

  if (error) {
    console.error("[schedule:getPrivates]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  if (!privates || privates.length === 0) return [];

  // Teacher filter runs on the rows, before mapping, so co-teachers can be read
  // off the row (the mapped shape has one `teacher_id` and would lose them).
  const rows = filters.teacherId
    ? privates.filter(
        (p) =>
          p.primary_teacher_id === filters.teacherId ||
          (p.co_teacher_ids ?? []).includes(filters.teacherId!)
      )
    : privates;

  if (rows.length === 0) return [];

  // Teacher names come from `profiles` by id — not from `getApprovedTeachers()`,
  // which filters on `profiles.role` and would silently blank the name of any
  // teacher whose primary role is something else (CLAUDE.md §4).
  const teacherIds = [...new Set(rows.map((p) => p.primary_teacher_id).filter(Boolean))];
  const teacherMap: Record<string, { name: string; initials: string }> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherMap[p.id] = {
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        initials: [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join(""),
      };
    }
  }

  // Resolve free-text `studio` → a real room, keyed on (location, lowercased
  // name) so the two "Studio 1"s stay distinct.
  const { data: roomRows } = await supabase
    .from("rooms")
    .select("id, name, location_id")
    .eq("is_active", true);
  const roomByLocationAndName = new Map<string, string>();
  for (const r of roomRows ?? []) {
    if (!r.location_id) continue;
    roomByLocationAndName.set(`${r.location_id}|${r.name.trim().toLowerCase()}`, r.id);
  }

  const locationMap = await fetchLocationLabels(
    supabase,
    rows.map((p) => p.location_id)
  );

  let instances: ScheduleInstance[] = rows.map((p) => {
    const teacher = p.primary_teacher_id ? teacherMap[p.primary_teacher_id] : undefined;
    const roomId = p.location_id && p.studio
      ? roomByLocationAndName.get(`${p.location_id}|${p.studio.trim().toLowerCase()}`) ?? null
      : null;

    return {
      // Namespaced (§3.1) so a click-through can route to the private and never
      // collide with a `schedule_instances` uuid.
      id: `private:${p.id}`,
      tenant_id: p.tenant_id,
      class_id: null,
      teacher_id: p.primary_teacher_id,
      room_id: roomId,
      event_type: "private_lesson",
      event_date: p.session_date,
      start_time: p.start_time,
      end_time: p.end_time,
      status: p.status,
      cancellation_reason: null,
      substitute_teacher_id: null,
      notes: p.session_notes,
      is_trial_eligible: false,
      production_id: null,
      className: privateReservationTitle(teacher?.name ?? null),
      classLevel: null,
      classStyle: p.session_type,
      teacherName: teacher?.name ?? null,
      teacherInitials: teacher?.initials ?? null,
      subTeacherName: null,
      roomName: p.studio,
      roomLocation: p.location_id ? locationMap[p.location_id] ?? null : null,
      enrolledCount: (p.student_ids ?? []).length,
      maxStudents: null,
    };
  });

  if (filters.roomId) {
    // An unresolved private is not in the filtered room, so it drops out — the
    // same way a class in another room does.
    instances = instances.filter((i) => i.room_id === filters.roomId);
  }

  return instances;
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

  // Both sources for the week, in parallel. Privates are a second source, not a
  // fallback: they render even when the class grid is empty (a week outside the
  // generated occurrence span still has real privates in it).
  const [{ data: instances, error }, privateInstances] = await Promise.all([
    query,
    getPrivateSessionInstances(supabase, filters),
  ]);

  if (error) {
    console.error("[schedule:getInstances]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return finalizeWeek([], privateInstances, filters, {});
  }

  if (!instances || instances.length === 0) {
    return finalizeWeek([], privateInstances, filters, {});
  }

  // Get class info for enrichment
  const classIds = [...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[])];
  const classMap: Record<string, { name: string; levels: string[] | null; style: string | null; enrolled_count: number; max_students: number | null }> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, levels, style, enrolled_count, max_students")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classMap[c.id] = {
        name: c.name,
        levels: c.levels,
        style: c.style,
        enrolled_count: c.enrolled_count ?? 0,
        max_students: c.max_students,
      };
    }
  }

  // Get room names + the room's own location. Room names are unique only within
  // a location — two studios each have a "Studio 1" — so the label needs both.
  const roomIds = [...new Set(instances.map((i) => i.room_id).filter(Boolean) as string[])];
  const roomMap: Record<string, { name: string; location: LocationLabelRef | null }> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name, location_id")
      .in("id", roomIds);
    const locationMap = await fetchLocationLabels(
      supabase,
      (rooms ?? []).map((r) => r.location_id)
    );
    for (const r of rooms ?? []) {
      roomMap[r.id] = {
        name: r.name,
        location: r.location_id ? locationMap[r.location_id] ?? null : null,
      };
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

  const enriched: ScheduleInstance[] = instances.map((i) => ({
    ...i,
    is_trial_eligible: i.is_trial_eligible ?? false,
    className: i.class_id ? (classMap[i.class_id]?.name ?? null) : null,
    classLevel: i.class_id ? (classMap[i.class_id]?.levels?.join(", ") ?? null) : null,
    classStyle: i.class_id ? (classMap[i.class_id]?.style ?? null) : null,
    teacherName: i.teacher_id ? (teacherMap[i.teacher_id]?.name ?? null) : null,
    teacherInitials: i.teacher_id ? (teacherMap[i.teacher_id]?.initials ?? null) : null,
    subTeacherName: i.substitute_teacher_id ? (teacherMap[i.substitute_teacher_id]?.name ?? null) : null,
    roomName: i.room_id ? (roomMap[i.room_id]?.name ?? null) : null,
    roomLocation: i.room_id ? (roomMap[i.room_id]?.location ?? null) : null,
    enrolledCount: i.class_id ? (classMap[i.class_id]?.enrolled_count ?? 0) : 0,
    maxStudents: i.class_id ? (classMap[i.class_id]?.max_students ?? null) : null,
  }));

  return finalizeWeek(enriched, privateInstances, filters, classMap);
}

/**
 * Merge the two sources and apply the filters that need enriched data.
 *
 * Level and Style are **class-only** filters: they read columns a private does
 * not have, so a private drops out whenever one is set. That is the honest
 * reading — "show me Advanced" cannot mean "…plus every private". Day and the
 * teacher/room filters (applied per-source upstream) narrow both sources alike.
 */
function finalizeWeek(
  classInstances: ScheduleInstance[],
  privateInstances: ScheduleInstance[],
  filters: { level?: string; style?: string; dayOfWeek?: string },
  classMap: Record<string, { levels: string[] | null }>
): ScheduleInstance[] {
  let merged = [...classInstances, ...privateInstances];

  if (filters.level) {
    const lvl = filters.level.toLowerCase();
    merged = merged.filter(
      (i) => !!i.class_id && (classMap[i.class_id]?.levels ?? []).some((l) => l.toLowerCase() === lvl)
    );
  }
  if (filters.style) {
    const style = filters.style.toLowerCase();
    merged = merged.filter((i) => !!i.class_id && !!i.classStyle?.toLowerCase().includes(style));
  }
  if (filters.dayOfWeek) {
    const dow = parseInt(filters.dayOfWeek, 10);
    merged = merged.filter((i) => {
      const d = new Date(i.event_date + "T00:00:00");
      return d.getDay() === dow;
    });
  }

  // The DB ordering is lost once two sources are concatenated — restore it, so
  // every consumer still gets the week in chronological order.
  return merged.sort(
    (a, b) =>
      a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time)
  );
}

// ── Map recurring classes to ScheduleInstance[] for a given week ──
// Used as fallback when schedule_instances table has no generated data.
export async function getClassesAsScheduleInstances(filters: {
  startDate: string;
  endDate: string;
  teacherId?: string;
  level?: string;
  roomId?: string;
  dayOfWeek?: string;
  tenantId?: string;
}): Promise<ScheduleInstance[]> {
  const supabase = await createClient();

  // classes table has no tenant_id — fetch all active classes
  const { data: classes, error } = await supabase
    .from("classes")
    .select(
      "id, name, day_of_week, days_of_week, start_time, end_time, room, levels, max_enrollment, max_students, is_active, status"
    )
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");
  if (error || !classes) {
    console.error("[schedule:classesAsInstances]", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return [];
  }

  // Get enrollment counts
  const classIds = classes.map((c) => c.id);
  const enrollMap: Record<string, number> = {};
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("class_id", classIds)
      .in("status", ["active", "trial"]);
    for (const e of enrollments ?? []) {
      enrollMap[e.class_id] = (enrollMap[e.class_id] ?? 0) + 1;
    }
  }

  // Get teacher names via class_teachers
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id, teacher_id, is_primary")
    .in("class_id", classIds);

  const teacherIdSet = new Set<string>();
  const classTeacherMap: Record<string, string> = {};
  for (const ct of classTeachers ?? []) {
    teacherIdSet.add(ct.teacher_id);
    if (ct.is_primary || !classTeacherMap[ct.class_id]) {
      classTeacherMap[ct.class_id] = ct.teacher_id;
    }
  }

  const teacherNameMap: Record<string, { name: string; initials: string }> = {};
  if (teacherIdSet.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...teacherIdSet]);
    for (const p of profiles ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      const initials = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("");
      teacherNameMap[p.id] = { name, initials };
    }
  }

  // Build week dates map: day_of_week → date string
  const weekDates: Record<number, string> = {};
  const monday = new Date(filters.startDate + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ...
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    weekDates[dow] = dateStr;
  }

  // Class levels for the CONTAINS filter below (multi-level classes appear under each level).
  const classLevelsById = new Map<string, string[]>(classes.map((c) => [c.id, c.levels ?? []]));

  // Map classes to ScheduleInstance[] — deduplicate by class_id + day_of_week
  let instances: ScheduleInstance[] = [];
  const seen = new Set<string>();
  for (const c of classes) {
    if (!c.start_time || !c.end_time) continue;

    const daysToMap: number[] = c.days_of_week?.length ? c.days_of_week : (c.day_of_week != null ? [c.day_of_week] : []);
    const teacherId = classTeacherMap[c.id] ?? null;
    const teacher = teacherId ? teacherNameMap[teacherId] : null;
    const level = c.levels?.length ? c.levels.join(", ") : null;
    const displayName = c.name;

    for (const dow of daysToMap) {
      const key = `${c.id}-${dow}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const eventDate = weekDates[dow];
      if (!eventDate) continue;

      instances.push({
        id: `${c.id}-${dow}`,
        tenant_id: filters.tenantId ?? "",
        class_id: c.id,
        teacher_id: teacherId,
        room_id: null,
        event_type: "class",
        event_date: eventDate,
        start_time: c.start_time,
        end_time: c.end_time,
        status: "scheduled",
        cancellation_reason: null,
        substitute_teacher_id: null,
        notes: null,
        is_trial_eligible: false,
        production_id: null,
        className: displayName,
        classLevel: level,
        classStyle: null,
        teacherName: teacher?.name ?? null,
        teacherInitials: teacher?.initials ?? null,
        subTeacherName: null,
        roomName: c.room ?? null,
        enrolledCount: enrollMap[c.id] ?? 0,
        maxStudents: c.max_enrollment ?? c.max_students ?? null,
      });
    }
  }

  // Apply filters
  if (filters.teacherId) {
    instances = instances.filter((i) => i.teacher_id === filters.teacherId);
  }
  if (filters.level) {
    const lvl = filters.level.toLowerCase();
    instances = instances.filter((i) =>
      (classLevelsById.get(i.class_id ?? "") ?? []).some((l) => l.toLowerCase() === lvl)
    );
  }
  if (filters.roomId) {
    instances = instances.filter((i) => i.roomName === filters.roomId);
  }
  if (filters.dayOfWeek) {
    const dow = parseInt(filters.dayOfWeek, 10);
    instances = instances.filter((i) => {
      const d = new Date(i.event_date + "T00:00:00");
      return d.getDay() === dow;
    });
  }

  return instances;
}

export async function getDistinctLevels(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("levels")
    .eq("is_active", true);

  const levels = [...new Set((data ?? []).flatMap((c) => c.levels ?? []).filter(Boolean) as string[])];
  return levels.sort();
}
