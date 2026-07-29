"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantTimezone } from "@/lib/tenant/timezone";
import {
  getOrCreateTimesheet,
  getTeacherContext,
  computeHoursFromTimes,
  periodLockMessage,
  resolvePeriodLockForWorkDate,
} from "@/lib/timesheets/helpers";

/**
 * Attendance is recorded against an OCCURRENCE (`schedule_instances.id`), not
 * against (class, date).
 *
 * `class_id + event_date` does not identify an occurrence: a class that meets
 * twice in one day is two distinct sessions with two distinct rosters. Keyed on
 * class/date, saving the second roster deletes the first — silent data loss with
 * no error and no trace. Rehearsal weeks produce exactly that shape.
 *
 * The occurrence id is therefore the ONLY key the caller supplies. `class_id`
 * and `class_date` are still written (both are NOT NULL) but are derived from
 * the occurrence rather than accepted from the client, so a row can never claim
 * a date its occurrence does not have.
 */
const attendanceSchema = z.object({
  scheduleInstanceId: z.string().uuid(),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(["present", "absent", "excused", "late"]),
    })
  ),
});

export interface AttendanceResult {
  success?: boolean;
  error?: string;
  /** Returned so the client can show a "Log Hours?" modal */
  classDetails?: {
    classId: string;
    className: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    hours: number;
    alreadyLogged: boolean;
  };
}

export async function markAttendance(data: {
  scheduleInstanceId: string;
  records: { studentId: string; status: string }[];
}): Promise<AttendanceResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const parsed = attendanceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { scheduleInstanceId, records } = parsed.data;

  // Resolve the occurrence. RLS scopes this SELECT to instances the caller may
  // see, so a teacher cannot name someone else's occurrence and have it resolve.
  const { data: instance } = await supabase
    .from("schedule_instances")
    .select("id, class_id, event_date, event_type, status")
    .eq("id", scheduleInstanceId)
    .maybeSingle();

  if (!instance) {
    return { error: "That class occurrence was not found." };
  }

  const classId: string | null = instance.class_id;
  if (instance.event_type !== "class" || !classId) {
    return {
      error: "Attendance can only be recorded against a class occurrence.",
    };
  }

  if (instance.status === "cancelled") {
    return { error: "This class was cancelled — attendance cannot be recorded." };
  }

  const date: string = instance.event_date;

  // Verify this teacher owns the class and get class details. Deliberately the
  // same rule as before this action moved to occurrence keying — ownership of
  // the class the occurrence belongs to. Note this still excludes a substitute
  // assigned via `schedule_instances.substitute_teacher_id`, who cannot mark
  // attendance for a class they are covering. That gap predates this change and
  // is left alone here rather than widened in passing.
  const { data: classData } = await supabase
    .from("classes")
    .select("id, name, start_time, end_time, teacher_id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classData) {
    return { error: "You can only mark attendance for your own classes." };
  }

  // Delete existing records for this OCCURRENCE, then insert fresh. Scoped to
  // the occurrence, so a second session of the same class on the same day is
  // untouched.
  await supabase
    .from("attendance")
    .delete()
    .eq("schedule_instance_id", scheduleInstanceId);

  const rows = records.map((r) => ({
    schedule_instance_id: scheduleInstanceId,
    class_id: classId,
    student_id: r.studentId,
    class_date: date,
    status: r.status,
    recorded_by: user.id,
  }));

  const { error } = await supabase.from("attendance").insert(rows);

  if (error) {
    console.error("[teach:markAttendance]", error);
    return { error: "Failed to save attendance. Please try again." };
  }

  // Check if timesheet entry already exists for this class/date
  const { data: existing } = await supabase
    .from("timesheet_entries")
    .select("id")
    .eq("class_id", classId)
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  // Calculate hours from class times
  let totalHours = 1;
  const startTime = classData.start_time?.slice(0, 5) ?? null;
  const endTime = classData.end_time?.slice(0, 5) ?? null;
  if (startTime && endTime) {
    const computed = computeHoursFromTimes(startTime, endTime);
    if (computed) totalHours = computed;
  }

  // Notify guardians of checked-in students (Feature 4)
  const presentStudents = records.filter((r) => r.status === "present" || r.status === "late");
  if (presentStudents.length > 0) {
    notifyGuardiansOfCheckin(
      supabase,
      presentStudents.map((r) => r.studentId),
      classData.name,
      date,
      startTime
    ).catch((err) => console.error("[teach:notifyGuardians]", err));
  }

  revalidatePath("/teach/attendance");
  revalidatePath("/teach/dashboard");
  revalidatePath("/teach/timesheets");

  return {
    success: true,
    classDetails: {
      classId: classData.id,
      className: classData.name,
      date,
      startTime,
      endTime,
      hours: totalHours,
      alreadyLogged: !!existing,
    },
  };
}

/**
 * Called from the "Log Hours" button in the post-attendance modal.
 */
export async function logHoursFromAttendance(data: {
  classId: string;
  className: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  hours: number;
}) {
  const supabase = await createClient();

  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher context not found." };

  // Check for duplicate
  const { data: existing } = await supabase
    .from("timesheet_entries")
    .select("id")
    .eq("class_id", data.classId)
    .eq("date", data.date)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { error: "Hours already logged for this class on this date." };
  }

  // This path had NO lock check at all, and once the season starts it is where
  // most hours travel — so the cutoff was unenforced exactly where it mattered
  // most. Keyed on the CLASS's date, matching the period the entry files to.
  const timeZone = await getTenantTimezone(supabase, tp.tenant_id);
  const lock = await resolvePeriodLockForWorkDate(
    supabase,
    tp.tenant_id,
    timeZone,
    data.date
  );
  if ("error" in lock) return { error: lock.error };
  if (lock.locked) {
    // periodLockMessage names the cutoff date being enforced, so the teacher
    // knows to ask an admin to file it rather than retrying the button.
    return { error: periodLockMessage(lock) };
  }

  // The CLASS's date decides the period, not today. Attendance is routinely
  // marked a day or two after the fact, and a class taught on the last day of a
  // month must be paid on that month's run.
  const timesheet = await getOrCreateTimesheet(
    supabase,
    tp.id,
    tp.tenant_id,
    data.date
  );
  if ("error" in timesheet) return { error: timesheet.error };
  if (timesheet.status !== "draft") {
    return { error: "Timesheet is already submitted. Add hours manually." };
  }

  const { error } = await supabase.from("timesheet_entries").insert({
    tenant_id: tp.tenant_id,
    timesheet_id: timesheet.id,
    entry_type: "class_lead",
    date: data.date,
    total_hours: data.hours,
    description: data.className,
    start_time: data.startTime,
    end_time: data.endTime,
    class_id: data.classId,
    notes: "Logged from attendance",
    status: "draft",
  });

  if (error) {
    console.error("[teach:logHoursFromAttendance]", error);
    return { error: "Failed to log hours." };
  }

  revalidatePath("/teach/timesheets");
  return { success: true };
}

/**
 * Feature 4 — Notify guardians when a student is marked present.
 * Fire-and-forget: uses service role to insert notifications.
 */
async function notifyGuardiansOfCheckin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIds: string[],
  className: string,
  date: string,
  startTime: string | null
) {
  // Get student names
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name")
    .in("id", studentIds);

  if (!students?.length) return;

  const studentNameMap: Record<string, string> = {};
  for (const s of students) {
    studentNameMap[s.id] = s.first_name;
  }

  // Get guardians with portal access for these students
  const { data: guardians } = await supabase
    .from("student_guardians")
    .select("student_id, profile_id, portal_access")
    .in("student_id", studentIds)
    .eq("portal_access", true);

  if (!guardians?.length) return;

  const timeStr = startTime
    ? (() => {
        const [h, m] = startTime.split(":");
        const hour = parseInt(h);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${h12}:${m} ${ampm}`;
      })()
    : "";

  // Dedupe: one notification per guardian per student
  const notifications = guardians.map((g) => ({
    recipient_id: g.profile_id,
    notification_type: "checkin",
    title: `${studentNameMap[g.student_id] ?? "Your child"} has checked in`,
    body: `${studentNameMap[g.student_id] ?? "Your child"} has checked in to ${className}${timeStr ? ` at ${timeStr}` : ""} on ${new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
    metadata: JSON.stringify({
      student_id: g.student_id,
      class_name: className,
      date,
    }),
  }));

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }
}
