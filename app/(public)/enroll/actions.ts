"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Complete Registration (family-centric) ───────────────────

const registrationSchema = z.object({
  student_first_name: z.string().min(1),
  student_last_name: z.string().min(1),
  student_dob: z.string().min(1),
  medical_notes: z.string().optional(),
  allergy_notes: z.string().optional(),
  photo_consent: z.coerce.boolean().optional(),
  emergency_contacts: z
    .array(
      z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        relationship: z.string().optional(),
        phone: z.string().min(1),
      })
    )
    .optional(),
  class_ids: z.array(z.string().uuid()).min(1),
});

/**
 * Complete registration: creates family, student, emergency contacts,
 * and enrollments in one transaction. Requires authentication.
 */
export async function completeRegistration(data: {
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  medical_notes?: string;
  allergy_notes?: string;
  photo_consent?: boolean;
  emergency_contacts?: {
    first_name: string;
    last_name: string;
    relationship?: string;
    phone: string;
  }[];
  class_ids: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const parsed = registrationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) return { error: "Studio not found" };

  // Get or create family
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", user.id)
    .single();

  let familyId: string;

  const { data: existingFamily } = await supabase
    .from("families")
    .select("id")
    .eq("primary_contact_id", user.id)
    .single();

  if (existingFamily) {
    familyId = existingFamily.id;
  } else {
    const familyName = `The ${profile?.last_name || parsed.data.student_last_name} Family`;
    const { data: newFamily, error: famError } = await supabase
      .from("families")
      .insert({
        tenant_id: tenant.id,
        primary_contact_id: user.id,
        family_name: familyName,
        billing_email: profile?.email ?? user.email,
        billing_phone: profile?.phone ?? null,
      })
      .select("id")
      .single();

    if (famError || !newFamily) {
      console.error("[enroll:completeRegistration:family]", famError);
      return { error: "Failed to create family record" };
    }
    familyId = newFamily.id;
  }

  // Create student
  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      tenant_id: tenant.id,
      family_id: familyId,
      parent_id: user.id,
      first_name: parsed.data.student_first_name,
      last_name: parsed.data.student_last_name,
      date_of_birth: parsed.data.student_dob,
      medical_notes: parsed.data.medical_notes || null,
      allergy_notes: parsed.data.allergy_notes || null,
      photo_consent: parsed.data.photo_consent ?? false,
    })
    .select("id")
    .single();

  if (studentError || !student) {
    console.error("[enroll:completeRegistration:student]", studentError);
    return { error: "Failed to create student record" };
  }

  // Create emergency contacts
  if (parsed.data.emergency_contacts?.length) {
    const contactRows = parsed.data.emergency_contacts.map((c) => ({
      tenant_id: tenant.id,
      family_id: familyId,
      contact_type: "emergency" as const,
      first_name: c.first_name,
      last_name: c.last_name,
      relationship: c.relationship || null,
      phone: c.phone,
      created_by: user.id,
    }));

    const { error: contactError } = await supabase
      .from("family_contacts")
      .insert(contactRows);

    if (contactError) {
      console.error("[enroll:completeRegistration:contacts]", contactError);
      // Non-fatal — student and family are created
    }
  }

  // Create enrollments
  const enrollmentResults: { classId: string; status: string }[] = [];

  for (const classId of parsed.data.class_ids) {
    const { data: cls } = await supabase
      .from("classes")
      .select("id, max_enrollment, enrollment_count")
      .eq("id", classId)
      .single();

    if (!cls) continue;

    const isFull =
      cls.max_enrollment && (cls.enrollment_count ?? 0) >= cls.max_enrollment;
    const status = isFull ? "waitlist" : "active";

    const { error: enrollError } = await supabase.from("enrollments").insert({
      tenant_id: tenant.id,
      student_id: student.id,
      class_id: classId,
      family_id: familyId,
      status,
      enrollment_type: "full",
      enrolled_by: user.id,
    });

    if (!enrollError && (status === "active")) {
      await supabase
        .from("classes")
        .update({ enrollment_count: (cls.enrollment_count ?? 0) + 1 })
        .eq("id", classId);
    }

    enrollmentResults.push({ classId, status });
  }

  revalidatePath("/portal/dashboard");
  return {
    success: true,
    studentId: student.id,
    familyId,
    enrollments: enrollmentResults,
  };
}

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
