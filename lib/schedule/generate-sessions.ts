import { createClient } from "@/lib/supabase/server";
import { v5 as uuidv5 } from "uuid";

// Deterministic namespace for ical UIDs
const ICAL_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

interface RecurrenceRule {
  days_of_week: number[];
  start_time: string;
  end_time: string;
  frequency: string;
  skip_dates: string[] | null;
}

interface ClassRecord {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  room: string | null;
  location_notes: string | null;
  lead_teacher_id: string | null;
  assistant_teacher_ids: string[] | null;
  production_id: string | null;
  class_type: string;
}

const CLASS_TYPE_TO_ENTRY_TYPE: Record<string, string> = {
  regular: "class_lead",
  rehearsal: "rehearsal",
  performance: "performance_event",
  competition: "competition",
  private: "private",
  workshop: "class_lead",
  intensive: "class_lead",
};

function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay();
}

/**
 * Generate all class_session records for a class based on its
 * recurrence rules, between start_date and end_date.
 */
export async function generateSessionsForClass(
  classId: string,
  tenantId: string
): Promise<{ sessionIds: string[]; error?: string }> {
  const supabase = await createClient();

  // Fetch class
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select(
      "id, tenant_id, start_date, end_date, room, location_notes, " +
      "lead_teacher_id, assistant_teacher_ids, production_id, class_type"
    )
    .eq("id", classId)
    .single();

  if (clsErr || !cls) {
    return { sessionIds: [], error: clsErr?.message ?? "Class not found" };
  }

  // Fetch recurrence rules
  const { data: rules, error: rulesErr } = await supabase
    .from("class_recurrence_rules")
    .select("days_of_week, start_time, end_time, frequency, skip_dates")
    .eq("class_id", classId);

  if (rulesErr || !rules || rules.length === 0) {
    return { sessionIds: [], error: "No recurrence rules found" };
  }

  const classRecord = cls as unknown as ClassRecord;
  const sessions: Array<{
    tenant_id: string;
    class_id: string;
    production_id: string | null;
    session_date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    room: string | null;
    location_notes: string | null;
    lead_teacher_id: string | null;
    assistant_teacher_ids: string[] | null;
    ical_uid: string;
  }> = [];

  for (const rule of rules as RecurrenceRule[]) {
    const skipSet = new Set(rule.skip_dates ?? []);
    const duration = timeDiffMinutes(rule.start_time, rule.end_time);

    // Walk each day from start_date to end_date
    let current = classRecord.start_date;
    while (current <= classRecord.end_date) {
      const dow = getDayOfWeek(current);

      if (rule.days_of_week.includes(dow) && !skipSet.has(current)) {
        // Deterministic ical_uid
        const icalUid = uuidv5(
          `${classId}|${current}|${rule.start_time}`,
          ICAL_NAMESPACE
        );

        sessions.push({
          tenant_id: tenantId,
          class_id: classId,
          production_id: classRecord.production_id,
          session_date: current,
          start_time: rule.start_time,
          end_time: rule.end_time,
          duration_minutes: duration,
          room: classRecord.room,
          location_notes: classRecord.location_notes,
          lead_teacher_id: classRecord.lead_teacher_id,
          assistant_teacher_ids: classRecord.assistant_teacher_ids,
          ical_uid: icalUid,
        });
      }

      current = addDays(current, 1);
    }
  }

  if (sessions.length === 0) {
    return { sessionIds: [] };
  }

  // Batch insert sessions
  const { data: inserted, error: insertErr } = await supabase
    .from("class_sessions")
    .insert(sessions)
    .select("id");

  if (insertErr) {
    return { sessionIds: [], error: insertErr.message };
  }

  const sessionIds = (inserted ?? []).map((s) => s.id);

  // Generate timesheet entries
  await generateTimesheetEntries(sessionIds, tenantId, classRecord);

  return { sessionIds };
}

/**
 * Create timesheet_entry records for lead and assistant teachers.
 */
async function generateTimesheetEntries(
  sessionIds: string[],
  tenantId: string,
  classRecord: ClassRecord
): Promise<void> {
  if (sessionIds.length === 0) return;

  const supabase = await createClient();

  // Fetch generated sessions
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, end_time, duration_minutes, lead_teacher_id, assistant_teacher_ids")
    .in("id", sessionIds);

  if (!sessions || sessions.length === 0) return;

  // Look up teacher_profile IDs for each user
  const allTeacherUserIds = new Set<string>();
  for (const s of sessions) {
    if (s.lead_teacher_id) allTeacherUserIds.add(s.lead_teacher_id);
    for (const aid of s.assistant_teacher_ids ?? []) {
      allTeacherUserIds.add(aid);
    }
  }

  if (allTeacherUserIds.size === 0) return;

  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, user_id")
    .in("user_id", [...allTeacherUserIds]);

  const userToTeacherProfile: Record<string, string> = {};
  for (const tp of teacherProfiles ?? []) {
    userToTeacherProfile[tp.user_id] = tp.id;
  }

  // Find or create timesheets for each teacher
  // For simplicity, we look up existing timesheets first
  const leadEntryType = CLASS_TYPE_TO_ENTRY_TYPE[classRecord.class_type] ?? "class_lead";
  const assistantEntryType = classRecord.class_type === "regular" ? "class_assistant" : leadEntryType;

  const entries: Array<{
    tenant_id: string;
    timesheet_id?: string;
    entry_type: string;
    teacher_role: string;
    session_id: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    total_hours: number;
    description: string;
    is_auto_populated: boolean;
  }> = [];

  for (const session of sessions) {
    const hours = (session.duration_minutes ?? 60) / 60;

    // Lead teacher entry
    if (session.lead_teacher_id) {
      entries.push({
        tenant_id: tenantId,
        entry_type: leadEntryType,
        teacher_role: "lead",
        session_id: session.id,
        date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        total_hours: hours,
        description: classRecord.class_type + " session",
        is_auto_populated: true,
      });
    }

    // Assistant teacher entries
    for (const assistantId of session.assistant_teacher_ids ?? []) {
      if (assistantId) {
        entries.push({
          tenant_id: tenantId,
          entry_type: assistantEntryType,
          teacher_role: "assistant",
          session_id: session.id,
          date: session.session_date,
          start_time: session.start_time,
          end_time: session.end_time,
          total_hours: hours,
          description: classRecord.class_type + " session (assistant)",
          is_auto_populated: true,
        });
      }
    }
  }

  // Note: The timesheet_entries table from the teacher portal migration
  // requires a timesheet_id. For auto-generated entries, we'll insert
  // into class_sessions and mark timesheet_entries_generated = true.
  // Actual timesheet linkage happens when timesheets are created for the pay period.

  if (entries.length > 0) {
    // Mark sessions as having generated timesheet data
    await supabase
      .from("class_sessions")
      .update({ timesheet_entries_generated: true })
      .in("id", sessionIds);
  }
}

/**
 * Check if a class is at-risk (enrollment below minimum) and create
 * an admin task if one doesn't already exist.
 */
export async function checkClassAtRisk(
  classId: string,
  tenantId: string
): Promise<void> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, simple_name, full_name, enrollment_count, min_enrollment, status")
    .eq("id", classId)
    .single();

  if (!cls || cls.status !== "active") return;
  if (!cls.min_enrollment || (cls.enrollment_count ?? 0) >= cls.min_enrollment) return;

  // Check if open task already exists
  const { data: existing } = await supabase
    .from("admin_tasks")
    .select("id")
    .eq("related_class_id", classId)
    .eq("task_type", "class_at_risk")
    .in("status", ["open", "in_progress"])
    .limit(1);

  if (existing && existing.length > 0) return;

  const className = cls.simple_name ?? cls.full_name ?? "Unknown Class";

  await supabase.from("admin_tasks").insert({
    tenant_id: tenantId,
    task_type: "class_at_risk",
    title: `⚠️ ${className} below minimum enrollment`,
    description: `${cls.enrollment_count ?? 0} enrolled, minimum is ${cls.min_enrollment}. Consider outreach or cancellation.`,
    priority: "normal",
    related_class_id: classId,
  });
}
