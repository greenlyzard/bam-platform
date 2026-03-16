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

export async function markAttendance(data: {
  classId: string;
  date: string;
  records: { studentId: string; status: string }[];
}) {
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

  // Auto-create timesheet entry for this class
  await autoCreateTimesheetEntry(supabase, classData, date);

  revalidatePath("/teach/attendance");
  revalidatePath("/teach/dashboard");
  revalidatePath("/teach/timesheets");
  return { success: true };
}

async function autoCreateTimesheetEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classData: {
    id: string;
    name: string;
    start_time: string | null;
    end_time: string | null;
    teacher_id: string;
  },
  date: string
) {
  try {
    const tp = await getTeacherContext(supabase);
    if (!tp) return;

    // Check for duplicate: same teacher, date, class
    const { data: existing } = await supabase
      .from("timesheet_entries")
      .select("id")
      .eq("class_id", classData.id)
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (existing) return; // Already has an entry for this class/date

    const timesheet = await getOrCreateTimesheet(supabase, tp.id, tp.tenant_id);
    if (!timesheet || timesheet.status !== "draft") return;

    // Calculate hours from class times
    let totalHours = 1; // default 1 hour
    const startTime = classData.start_time?.slice(0, 5) ?? null;
    const endTime = classData.end_time?.slice(0, 5) ?? null;

    if (startTime && endTime) {
      const computed = computeHoursFromTimes(startTime, endTime);
      if (computed) totalHours = computed;
    }

    await supabase.from("timesheet_entries").insert({
      tenant_id: tp.tenant_id,
      timesheet_id: timesheet.id,
      entry_type: "class_lead",
      date,
      total_hours: totalHours,
      description: classData.name,
      start_time: startTime,
      end_time: endTime,
      class_id: classData.id,
      notes: "Auto-created from attendance",
      status: "draft",
    });
  } catch (err) {
    console.error("[teach:autoCreateTimesheetEntry]", err);
    // Don't fail the attendance save if timesheet auto-creation fails
  }
}
