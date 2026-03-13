"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const requestSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  requestType: z.enum(["enrollment_request", "trial_request"]),
});

/**
 * Submit an enrollment or trial request that goes to the admin task queue.
 */
export async function requestEnrollment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = requestSchema.safeParse({
    studentId: formData.get("studentId"),
    classId: formData.get("classId"),
    requestType: formData.get("requestType"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Verify parent owns the student
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_id, family_id, trial_used")
    .eq("id", parsed.data.studentId)
    .single();

  if (!student || student.parent_id !== user.id) {
    return { error: "Student not found." };
  }

  // Get class details
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, simple_name, max_enrollment, enrollment_count")
    .eq("id", parsed.data.classId)
    .single();

  if (!cls) return { error: "Class not found." };

  // Check if already enrolled or request pending
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", parsed.data.studentId)
    .eq("class_id", parsed.data.classId)
    .in("status", ["active", "trial", "waitlist", "pending_payment"])
    .single();

  if (existing) {
    return { error: "Already enrolled or request pending for this class." };
  }

  // Check for existing open task
  const { data: existingTask } = await supabase
    .from("admin_tasks")
    .select("id")
    .eq("related_student_id", parsed.data.studentId)
    .eq("related_class_id", parsed.data.classId)
    .in("task_type", ["enrollment_request", "trial_request"])
    .eq("status", "open")
    .single();

  if (existingTask) {
    return { error: "A request for this class is already pending." };
  }

  // Check trial eligibility
  if (parsed.data.requestType === "trial_request" && student.trial_used) {
    return {
      error:
        "Your child has already used their free trial. Please request a full enrollment instead.",
    };
  }

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) return { error: "Studio not found." };

  const className = cls.simple_name || cls.name;
  const studentName = `${student.first_name} ${student.last_name}`;
  const isTrial = parsed.data.requestType === "trial_request";

  // Create admin task
  const { error } = await supabase.from("admin_tasks").insert({
    tenant_id: tenant.id,
    task_type: parsed.data.requestType,
    title: isTrial
      ? `Trial request: ${studentName} for ${className}`
      : `Enrollment request: ${studentName} for ${className}`,
    description: isTrial
      ? `${studentName}'s parent has requested a trial class in ${className}.`
      : `${studentName}'s parent has requested enrollment in ${className}.`,
    priority: "normal",
    status: "open",
    related_class_id: parsed.data.classId,
    related_student_id: parsed.data.studentId,
    related_family_id: student.family_id ?? null,
    metadata: {
      parent_user_id: user.id,
      student_name: studentName,
      class_name: className,
      request_type: parsed.data.requestType,
    },
  });

  if (error) {
    console.error("[enrollment:request]", error);
    return { error: "Failed to submit request. Please try again." };
  }

  revalidatePath("/portal/enrollment");
  return {
    success: true,
    message: isTrial
      ? `Trial request submitted for ${studentName} in ${className}. The studio will contact you to confirm.`
      : `Enrollment request submitted for ${studentName} in ${className}. The studio will review and confirm your spot.`,
  };
}
