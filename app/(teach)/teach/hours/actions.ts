"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const logHoursSchema = z.object({
  date: z.string().date("Valid date is required"),
  hours: z
    .number()
    .positive("Hours must be greater than 0")
    .max(24, "Hours cannot exceed 24"),
  category: z.enum(["class", "private", "rehearsal", "admin", "sub"]),
  classId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export async function logHours(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const parsed = logHoursSchema.safeParse({
    date: formData.get("date"),
    hours: parseFloat(formData.get("hours") as string),
    category: formData.get("category"),
    classId: formData.get("classId") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("teacher_hours").insert({
    teacher_id: user.id,
    date: parsed.data.date,
    hours: parsed.data.hours,
    category: parsed.data.category,
    class_id: parsed.data.classId || null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    console.error("[teach:logHours]", error);
    return { error: "Failed to log hours. Please try again." };
  }

  revalidatePath("/teach/hours");
  revalidatePath("/teach/dashboard");
  return { success: true };
}
