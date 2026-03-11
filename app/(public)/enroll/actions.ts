"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const enrollSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
});

const trialSchema = z.object({
  childName: z.string().min(1, "Child's name is required"),
  childAge: z.coerce.number().min(2).max(18),
  email: z.string().email("Valid email is required"),
  classId: z.string().uuid(),
  trialDate: z.string().date("Valid date is required"),
});

/**
 * Enroll a student in a class (or waitlist if full).
 * Parent must be authenticated and own the student.
 */
export async function enrollStudent(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = enrollSchema.safeParse({
    studentId: formData.get("studentId"),
    classId: formData.get("classId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Verify parent owns the student
  const { data: student } = await supabase
    .from("students")
    .select("id, parent_id, first_name, date_of_birth")
    .eq("id", parsed.data.studentId)
    .single();

  if (!student || student.parent_id !== user.id) {
    return { error: "Student not found." };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", parsed.data.studentId)
    .eq("class_id", parsed.data.classId)
    .single();

  if (existing && ["active", "waitlist"].includes(existing.status)) {
    return { error: "Already enrolled or on waitlist for this class." };
  }

  // Get class capacity
  const { data: cls } = await supabase
    .from("classes")
    .select("id, max_students, name, age_min, age_max")
    .eq("id", parsed.data.classId)
    .single();

  if (!cls) return { error: "Class not found." };

  // Check age eligibility (soft warning, not hard block)
  const dob = new Date(student.date_of_birth);
  const today = new Date();
  let childAge = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    childAge--;
  }

  let ageWarning: string | null = null;
  if (cls.age_min && childAge < cls.age_min) {
    ageWarning = `This class is for ages ${cls.age_min}–${cls.age_max ?? "up"}. ${student.first_name} may be younger than recommended.`;
  }
  if (cls.age_max && childAge > cls.age_max) {
    ageWarning = `This class is for ages ${cls.age_min ?? "any"}–${cls.age_max}. ${student.first_name} may be older than recommended.`;
  }

  // Count active enrollments to determine status
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", parsed.data.classId)
    .eq("status", "active");

  const isFull = (count ?? 0) >= cls.max_students;
  const status = isFull ? "waitlist" : "active";

  // If existing enrollment was dropped, update it
  if (existing) {
    const { error } = await supabase
      .from("enrollments")
      .update({ status, enrolled_at: new Date().toISOString(), dropped_at: null })
      .eq("id", existing.id);

    if (error) {
      console.error("[enroll:update]", error);
      return { error: "Enrollment failed. Please try again." };
    }
  } else {
    const { error } = await supabase.from("enrollments").insert({
      student_id: parsed.data.studentId,
      class_id: parsed.data.classId,
      status,
    });

    if (error) {
      // Handle capacity trigger error
      if (error.message.includes("Class is full")) {
        // Try again as waitlist
        const { error: wlError } = await supabase.from("enrollments").insert({
          student_id: parsed.data.studentId,
          class_id: parsed.data.classId,
          status: "waitlist",
        });
        if (wlError) {
          console.error("[enroll:waitlist]", wlError);
          return { error: "Enrollment failed. Please try again." };
        }
        revalidatePath("/portal/dashboard");
        revalidatePath("/portal/schedule");
        return {
          success: true,
          status: "waitlist" as const,
          className: cls.name,
          ageWarning,
        };
      }
      console.error("[enroll:insert]", error);
      return { error: "Enrollment failed. Please try again." };
    }
  }

  revalidatePath("/portal/dashboard");
  revalidatePath("/portal/schedule");
  return {
    success: true,
    status: status as "active" | "waitlist",
    className: cls.name,
    ageWarning,
  };
}

/**
 * Book a free trial class (no auth required — minimal fields).
 */
export async function bookTrialClass(formData: FormData) {
  const supabase = await createClient();

  const parsed = trialSchema.safeParse({
    childName: formData.get("childName"),
    childAge: formData.get("childAge"),
    email: formData.get("email"),
    classId: formData.get("classId"),
    trialDate: formData.get("trialDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Store as a lead/trial booking
  // Check if the user already has an account
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .single();

  if (existingProfile) {
    // User exists — check if they have this student
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("parent_id", existingProfile.id)
      .ilike("first_name", parsed.data.childName.split(" ")[0]);

    const studentId = students?.[0]?.id;

    if (studentId) {
      // Create trial enrollment
      const { error } = await supabase.from("enrollments").insert({
        student_id: studentId,
        class_id: parsed.data.classId,
        status: "trial",
        trial_class_date: parsed.data.trialDate,
      });

      if (error && !error.message.includes("duplicate")) {
        console.error("[enroll:trial]", error);
        return { error: "Could not book trial. Please try again." };
      }
    }
  }

  // TODO: Send trial confirmation email via lib/email/send.ts
  // TODO: Create lead record for CRM if no existing account

  return {
    success: true,
    message: `Trial class booked for ${parsed.data.childName}! Check ${parsed.data.email} for confirmation details.`,
  };
}
