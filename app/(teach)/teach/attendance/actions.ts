"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getOrCreateTimesheet,
  getTeacherContext,
  computeHoursFromTimes,
} from "@/lib/timesheets/helpers";

const attendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().date(),
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
  classId: string;
  date: string;
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

  const { classId, date, records } = parsed.data;

  // Verify this teacher owns the class and get class details
  const { data: classData } = await supabase
    .from("classes")
    .select("id, name, start_time, end_time, teacher_id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    return { error: "You can only mark attendance for your own classes." };
  }

  // Delete existing records for this class/date, then insert fresh
  await supabase
    .from("attendance")
    .delete()
    .eq("class_id", classId)
    .eq("class_date", date);

  const rows = records.map((r) => ({
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

  const timesheet = await getOrCreateTimesheet(supabase, tp.id, tp.tenant_id);
  if (!timesheet) return { error: "Could not find or create timesheet." };
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
