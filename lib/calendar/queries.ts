import { createClient } from "@/lib/supabase/server";
import type {
  ScheduleInstanceWithDetails,
  ScheduleInstanceFilters,
  ScheduleTemplate,
  Season,
  Room,
  ApprovalTask,
  ScheduleEmbed,
} from "./types";

// ── Schedule Instances (enriched) ────────────────────────

export async function getScheduleInstances(
  filters: ScheduleInstanceFilters
): Promise<ScheduleInstanceWithDetails[]> {
  const supabase = await createClient();

  let query = supabase
    .from("schedule_instances")
    .select("*")
    .gte("event_date", filters.startDate)
    .lte("event_date", filters.endDate)
    .order("event_date")
    .order("start_time");

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    query = query.in("event_type", filters.eventTypes);
  }
  if (filters.teacherId) {
    query = query.eq("teacher_id", filters.teacherId);
  }
  if (filters.roomId) {
    query = query.eq("room_id", filters.roomId);
  }
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  }

  const { data: instances, error } = await query;

  if (error) {
    console.error("[calendar:getScheduleInstances]", error);
    return [];
  }

  if (!instances || instances.length === 0) return [];

  // Build lookup maps for teacher names, room names, and class info
  const teacherIds = [
    ...new Set(
      instances
        .flatMap((i) => [i.teacher_id, i.substitute_teacher_id])
        .filter(Boolean) as string[]
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

  const roomIds = [
    ...new Set(instances.map((i) => i.room_id).filter(Boolean) as string[]),
  ];
  const roomNames: Record<string, string> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds);
    for (const r of rooms ?? []) {
      roomNames[r.id] = r.name;
    }
  }

  const classIds = [
    ...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[]),
  ];
  const classInfo: Record<string, { name: string; level: string | null; style: string | null }> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, level, style")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classInfo[c.id] = { name: c.name, level: c.level, style: c.style };
    }
  }

  return instances.map((i) => ({
    ...i,
    className: i.class_id ? (classInfo[i.class_id]?.name ?? null) : null,
    teacherName: i.teacher_id ? (teacherNames[i.teacher_id] ?? null) : null,
    substituteTeacherName: i.substitute_teacher_id
      ? (teacherNames[i.substitute_teacher_id] ?? null)
      : null,
    roomName: i.room_id ? (roomNames[i.room_id] ?? null) : null,
    level: i.class_id ? (classInfo[i.class_id]?.level ?? null) : null,
    style: i.class_id ? (classInfo[i.class_id]?.style ?? null) : null,
  }));
}

// ── Schedule Templates ───────────────────────────────────

export async function getScheduleTemplates(
  seasonId: string
): Promise<ScheduleTemplate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_templates")
    .select("*")
    .eq("season_id", seasonId)
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[calendar:getScheduleTemplates]", error);
    return [];
  }

  return data ?? [];
}

// ── Seasons ──────────────────────────────────────────────

export async function getSeasons(tenantId?: string): Promise<Season[]> {
  const supabase = await createClient();

  let query = supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;

  if (error) {
    console.error("[calendar:getSeasons]", error);
    return [];
  }

  return data ?? [];
}

// ── Rooms ────────────────────────────────────────────────

export async function getRooms(tenantId?: string): Promise<Room[]> {
  const supabase = await createClient();

  let query = supabase
    .from("rooms")
    .select("*")
    .order("name");

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;

  if (error) {
    console.error("[calendar:getRooms]", error);
    return [];
  }

  return data ?? [];
}

// ── Pending Approval Tasks ───────────────────────────────

export async function getPendingApprovalTasks(
  userId: string
): Promise<(ApprovalTask & { changeRequest: Record<string, unknown> | null })[]> {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("approval_tasks")
    .select("*")
    .eq("assigned_to", userId)
    .eq("status", "pending")
    .order("prompted_at", { ascending: false });

  if (error) {
    console.error("[calendar:getPendingApprovalTasks]", error);
    return [];
  }

  if (!tasks || tasks.length === 0) return [];

  // Fetch associated change requests
  const requestIds = [
    ...new Set(tasks.map((t) => t.change_request_id)),
  ];
  const requestMap: Record<string, Record<string, unknown>> = {};
  if (requestIds.length > 0) {
    const { data: requests } = await supabase
      .from("schedule_change_requests")
      .select("*")
      .in("id", requestIds);
    for (const r of requests ?? []) {
      requestMap[r.id] = r;
    }
  }

  return tasks.map((t) => ({
    ...t,
    changeRequest: requestMap[t.change_request_id] ?? null,
  }));
}

// ── Embed Config (public, no auth) ───────────────────────

export async function getEmbedConfig(
  token: string
): Promise<ScheduleEmbed | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_embeds")
    .select("*")
    .eq("embed_token", token)
    .single();

  if (error) {
    console.error("[calendar:getEmbedConfig]", error);
    return null;
  }

  return data;
}
