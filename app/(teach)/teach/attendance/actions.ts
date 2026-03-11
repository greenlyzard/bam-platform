"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  // Verify this teacher owns the class
  const { data: classData } = await supabase
    .from("classes")
    .select("id")
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

  revalidatePath("/teach/attendance");
  revalidatePath("/teach/dashboard");
  return { success: true };
}
