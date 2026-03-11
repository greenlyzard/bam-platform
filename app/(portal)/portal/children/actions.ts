"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: z.string().date("Valid date is required"),
  currentLevel: z.string().optional(),
  medicalNotes: z.string().max(2000).optional(),
});

export async function addStudent(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const parsed = addStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    currentLevel: formData.get("currentLevel") || undefined,
    medicalNotes: formData.get("medicalNotes") || undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  // Calculate age group from DOB
  const dob = new Date(parsed.data.dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  let ageGroup: string;
  if (age <= 4) ageGroup = "toddler";
  else if (age <= 7) ageGroup = "primary";
  else if (age <= 11) ageGroup = "intermediate";
  else ageGroup = "advanced";

  const { error } = await supabase.from("students").insert({
    parent_id: user.id,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth,
    current_level: parsed.data.currentLevel || null,
    age_group: ageGroup,
    medical_notes: parsed.data.medicalNotes || null,
  });

  if (error) {
    console.error("[portal:addStudent]", error);
    return { error: "Failed to add dancer. Please try again." };
  }

  revalidatePath("/portal/children");
  revalidatePath("/portal/dashboard");
  return { success: true };
}
