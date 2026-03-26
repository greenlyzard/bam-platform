"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 1. Enroll existing student in a new class
// ---------------------------------------------------------------------------
export async function enrollExistingStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const studentId = formData.get("studentId") as string;
  const classId = formData.get("classId") as string;
  const tenantId = formData.get("tenantId") as string;

  // Check student isn't already enrolled in this class
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    throw new Error("Student is already enrolled in this class");
  }

  // Insert enrollment
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      student_id: studentId,
      class_id: classId,
      status: "active",
      enrollment_type: "full",
      enrolled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Check for saved payment method via family record
  let savedCard: string | null = null;
  try {
    const { data: student } = await supabase
      .from("students")
      .select("family_id")
      .eq("id", studentId)
      .single();

    if (student?.family_id) {
      const { data: family } = await supabase
        .from("families")
        .select("stripe_payment_method_last4")
        .eq("id", student.family_id)
        .single();

      savedCard = family?.stripe_payment_method_last4 ?? null;
    }
  } catch {
    // Non-blocking — saved card lookup is optional
  }

  revalidatePath("/portal");
  revalidatePath("/portal/dashboard");
  revalidatePath("/portal/enroll");

  return { id: enrollment.id, savedCard };
}

// ---------------------------------------------------------------------------
// 2. Request level up for a student
// ---------------------------------------------------------------------------
export async function requestLevelUp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const studentId = formData.get("studentId") as string;
  const currentClassId = formData.get("currentClassId") as string;
  const requestedClassId = formData.get("requestedClassId") as string;
  const tenantId = formData.get("tenantId") as string;

  // Get student + class names for the notification
  const [{ data: student }, { data: currentClass }, { data: requestedClass }] =
    await Promise.all([
      supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", studentId)
        .single(),
      supabase
        .from("classes")
        .select("name")
        .eq("id", currentClassId)
        .single(),
      supabase
        .from("classes")
        .select("name")
        .eq("id", requestedClassId)
        .single(),
    ]);

  const { data: request, error } = await supabase
    .from("level_up_requests")
    .insert({
      student_id: studentId,
      current_class_id: currentClassId,
      requested_class_id: requestedClassId,
      requested_by: user.id,
      tenant_id: tenantId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Send admin notification
  const studentName = student
    ? `${student.first_name} ${student.last_name}`
    : "A student";
  const fromClass = currentClass?.name ?? "current class";
  const toClass = requestedClass?.name ?? "requested class";

  try {
    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      type: "level_up_request",
      title: "Level Up Request",
      message: `${studentName} requested level up from ${fromClass} to ${toClass}`,
      target_role: "admin",
    });
  } catch {
    // Non-blocking
  }

  return { id: request.id };
}

// ---------------------------------------------------------------------------
// 3. Admin reviews a level up request
// ---------------------------------------------------------------------------
export async function reviewLevelUp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const requestId = formData.get("requestId") as string;
  const status = formData.get("status") as "approved" | "denied" | "deferred";
  const adminNote = (formData.get("adminNote") as string) || null;

  // Update the level up request
  const { data: request, error } = await supabase
    .from("level_up_requests")
    .update({
      status,
      admin_note: adminNote,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("student_id, requested_class_id, current_class_id, tenant_id, requested_by")
    .single();

  if (error) throw new Error(error.message);

  // If approved, auto-enroll student in requested class
  if (status === "approved" && request) {
    await supabase.from("enrollments").insert({
      student_id: request.student_id,
      class_id: request.requested_class_id,
      status: "active",
      enrollment_type: "full",
      enrolled_at: new Date().toISOString(),
    });
  }

  // Send parent notification with outcome
  if (request) {
    const [{ data: student }, { data: requestedClass }] = await Promise.all([
      supabase
        .from("students")
        .select("first_name")
        .eq("id", request.student_id)
        .single(),
      supabase
        .from("classes")
        .select("name")
        .eq("id", request.requested_class_id)
        .single(),
    ]);

    const studentName = student?.first_name ?? "Your dancer";
    const className = requestedClass?.name ?? "the requested class";

    const messages: Record<string, string> = {
      approved: `Great news! ${studentName} has been approved to level up to ${className}.`,
      denied: `${studentName}'s level up request for ${className} was not approved at this time.${adminNote ? ` Note: ${adminNote}` : ""}`,
      deferred: `${studentName}'s level up request for ${className} has been deferred for now.${adminNote ? ` Note: ${adminNote}` : ""}`,
    };

    try {
      await supabase.from("notifications").insert({
        tenant_id: request.tenant_id,
        type: "level_up_review",
        title: `Level Up ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: messages[status],
        user_id: request.requested_by,
      });
    } catch {
      // Non-blocking
    }
  }

  revalidatePath("/portal");
  revalidatePath("/portal/dashboard");
  revalidatePath("/admin/evaluations");

  return {};
}

// ---------------------------------------------------------------------------
// 4. Get re-enrollment classes filtered for a student
// ---------------------------------------------------------------------------
export async function getReEnrollmentClasses(formData: FormData) {
  const supabase = await createClient();
  const studentId = formData.get("studentId") as string;

  // Fetch student DOB to calculate age
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("date_of_birth, first_name, last_name")
    .eq("id", studentId)
    .single();

  if (studentError || !student) throw new Error("Student not found");

  const dob = new Date(student.date_of_birth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  // Fetch all active classes
  const { data: allClasses } = await supabase
    .from("classes")
    .select(
      "id, name, description, day_of_week, start_time, age_min, age_max, max_enrollment, enrollment_count, monthly_price, level"
    )
    .eq("is_active", true);

  // Fetch student's existing active enrollments
  const { data: existingEnrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrolledClassIds = new Set(
    (existingEnrollments ?? []).map((e) => e.class_id)
  );

  // Get the levels of currently enrolled classes
  const enrolledClasses = (allClasses ?? []).filter((c) =>
    enrolledClassIds.has(c.id)
  );
  const currentLevels = new Set(
    enrolledClasses.map((c) => c.level).filter(Boolean)
  );

  // Filter: age-appropriate and NOT already enrolled
  const eligible = (allClasses ?? []).filter(
    (c) =>
      c.age_min <= age &&
      c.age_max >= age &&
      !enrolledClassIds.has(c.id)
  );

  // Identify level up candidates: if student is in Level N, find Level N+1
  const levelUpOptions = eligible.filter((c) => {
    if (!c.level) return false;
    // Check if this class is one level above any current level
    for (const currentLevel of currentLevels) {
      const currentNum = parseLevelNumber(currentLevel as string);
      const candidateNum = parseLevelNumber(c.level);
      if (currentNum !== null && candidateNum !== null && candidateNum === currentNum + 1) {
        return true;
      }
    }
    return false;
  });

  const formatClass = (c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    description: (c.description as string) || "",
    dayTime: `${c.day_of_week} ${c.start_time}`,
    ageRange: `Ages ${c.age_min}-${c.age_max}`,
    spotsRemaining: Math.max(
      0,
      ((c.max_enrollment as number) || 20) -
        ((c.enrollment_count as number) || 0)
    ),
    price: (c.monthly_price as number) || 0,
    isFull:
      ((c.enrollment_count as number) || 0) >=
      ((c.max_enrollment as number) || 20),
    level: (c.level as string) || null,
  });

  return {
    classes: eligible.map(formatClass),
    levelUpOptions: levelUpOptions.map(formatClass),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseLevelNumber(level: string): number | null {
  // Handles "Level 1", "Level 2", "L1", "L2", "1", "2", etc.
  const match = level.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
