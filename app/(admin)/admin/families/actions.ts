"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────

const createFamilySchema = z.object({
  family_name: z.string().min(1, "Family name is required"),
  billing_email: z.string().email().optional().or(z.literal("")),
  billing_phone: z.string().optional(),
  primary_contact_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

const updateFamilySchema = z.object({
  id: z.string().uuid(),
  family_name: z.string().min(1, "Family name is required"),
  billing_email: z.string().email().optional().or(z.literal("")),
  billing_phone: z.string().optional(),
  notes: z.string().optional(),
});

const addStudentSchema = z.object({
  family_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  medical_notes: z.string().optional(),
  allergy_notes: z.string().optional(),
  photo_consent: z.coerce.boolean().optional(),
});

const contactSchema = z.object({
  family_id: z.string().uuid(),
  contact_type: z.enum(["emergency", "stream", "both"]),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notify_via_sms: z.coerce.boolean().optional(),
  notify_via_email: z.coerce.boolean().optional(),
  is_primary: z.coerce.boolean().optional(),
});

const enrollSchema = z.object({
  student_id: z.string().uuid(),
  class_id: z.string().uuid(),
  family_id: z.string().uuid().optional(),
  enrollment_type: z.enum(["full", "trial", "audit", "comp"]).default("full"),
  proration_method: z
    .enum(["per_class", "daily", "split", "custom", "none"])
    .default("per_class"),
  prorated_amount: z.coerce.number().optional(),
  billing_override: z.coerce.boolean().optional(),
  override_amount: z.coerce.number().optional(),
  override_reason: z.string().optional(),
});

const dropSchema = z.object({
  enrollment_id: z.string().uuid(),
  drop_reason: z.string().optional(),
});

// ── Helper: get BAM tenant ID ────────────────────────────────

async function getTenantId() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  return data?.id ?? null;
}

// ── Actions ──────────────────────────────────────────────────

export async function createFamily(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = createFamilySchema.safeParse({
    family_name: formData.get("family_name"),
    billing_email: formData.get("billing_email"),
    billing_phone: formData.get("billing_phone"),
    primary_contact_id: formData.get("primary_contact_id"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  const { data, error } = await supabase
    .from("families")
    .insert({
      tenant_id: tenantId,
      family_name: parsed.data.family_name,
      billing_email: parsed.data.billing_email || null,
      billing_phone: parsed.data.billing_phone || null,
      primary_contact_id: parsed.data.primary_contact_id || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[families:create]", error);
    return { error: "Failed to create family" };
  }

  revalidatePath("/admin/families");
  return { success: true, id: data.id };
}

export async function updateFamily(formData: FormData) {
  const supabase = await createClient();

  const parsed = updateFamilySchema.safeParse({
    id: formData.get("id"),
    family_name: formData.get("family_name"),
    billing_email: formData.get("billing_email"),
    billing_phone: formData.get("billing_phone"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("families")
    .update({
      family_name: parsed.data.family_name,
      billing_email: parsed.data.billing_email || null,
      billing_phone: parsed.data.billing_phone || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[families:update]", error);
    return { error: "Failed to update family" };
  }

  revalidatePath(`/admin/families/${parsed.data.id}`);
  revalidatePath("/admin/families");
  return { success: true };
}

export async function addStudentToFamily(formData: FormData) {
  const supabase = await createClient();

  const parsed = addStudentSchema.safeParse({
    family_id: formData.get("family_id"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    date_of_birth: formData.get("date_of_birth"),
    gender: formData.get("gender"),
    medical_notes: formData.get("medical_notes"),
    allergy_notes: formData.get("allergy_notes"),
    photo_consent: formData.get("photo_consent"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  // Get the family's primary contact to set as parent_id
  const { data: family } = await supabase
    .from("families")
    .select("primary_contact_id")
    .eq("id", parsed.data.family_id)
    .single();

  const { data: newStudent, error } = await supabase.from("students").insert({
    tenant_id: tenantId,
    family_id: parsed.data.family_id,
    parent_id: family?.primary_contact_id ?? null,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    date_of_birth: parsed.data.date_of_birth,
    gender: parsed.data.gender || null,
    medical_notes: parsed.data.medical_notes || null,
    allergy_notes: parsed.data.allergy_notes || null,
    photo_consent: parsed.data.photo_consent ?? false,
  }).select("id").single();

  if (error || !newStudent) {
    console.error("[families:addStudent]", error);
    return { error: "Failed to add student" };
  }

  // Also insert into student_families junction table
  try {
    await supabase.from("student_families").insert({
      tenant_id: tenantId,
      student_id: newStudent.id,
      family_id: parsed.data.family_id,
      is_primary: true,
    });
  } catch (e) {
    console.warn("[families:addStudent] student_families insert failed — table may not exist yet", e);
  }

  revalidatePath(`/admin/families/${parsed.data.family_id}`);
  return { success: true };
}

export async function addFamilyContact(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = contactSchema.safeParse({
    family_id: formData.get("family_id"),
    contact_type: formData.get("contact_type"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relationship: formData.get("relationship"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notify_via_sms: formData.get("notify_via_sms"),
    notify_via_email: formData.get("notify_via_email"),
    is_primary: formData.get("is_primary"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  const { error } = await supabase.from("family_contacts").insert({
    tenant_id: tenantId,
    family_id: parsed.data.family_id,
    contact_type: parsed.data.contact_type,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    relationship: parsed.data.relationship || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    notify_via_sms: parsed.data.notify_via_sms ?? true,
    notify_via_email: parsed.data.notify_via_email ?? true,
    is_primary: parsed.data.is_primary ?? false,
    created_by: user.id,
  });

  if (error) {
    console.error("[families:addContact]", error);
    return { error: "Failed to add contact" };
  }

  revalidatePath(`/admin/families/${parsed.data.family_id}`);
  return { success: true };
}

export async function updateFamilyContact(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const familyId = formData.get("family_id") as string;

  if (!id) return { error: "Contact ID required" };

  const { error } = await supabase
    .from("family_contacts")
    .update({
      contact_type: formData.get("contact_type") as string,
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      relationship: (formData.get("relationship") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      notify_via_sms: formData.get("notify_via_sms") === "true",
      notify_via_email: formData.get("notify_via_email") === "true",
      is_primary: formData.get("is_primary") === "true",
    })
    .eq("id", id);

  if (error) {
    console.error("[families:updateContact]", error);
    return { error: "Failed to update contact" };
  }

  revalidatePath(`/admin/families/${familyId}`);
  return { success: true };
}

export async function removeFamilyContact(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const familyId = formData.get("family_id") as string;

  if (!id) return { error: "Contact ID required" };

  const { error } = await supabase
    .from("family_contacts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[families:removeContact]", error);
    return { error: "Failed to remove contact" };
  }

  revalidatePath(`/admin/families/${familyId}`);
  return { success: true };
}

export async function adminEnrollStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = enrollSchema.safeParse({
    student_id: formData.get("student_id"),
    class_id: formData.get("class_id"),
    family_id: formData.get("family_id"),
    enrollment_type: formData.get("enrollment_type"),
    proration_method: formData.get("proration_method"),
    prorated_amount: formData.get("prorated_amount"),
    billing_override: formData.get("billing_override"),
    override_amount: formData.get("override_amount"),
    override_reason: formData.get("override_reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  // Check for existing active enrollment
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", parsed.data.student_id)
    .eq("class_id", parsed.data.class_id)
    .in("status", ["active", "trial", "waitlist", "pending_payment"])
    .single();

  if (existing) {
    return { error: "Student is already enrolled in this class" };
  }

  // Check class capacity
  const { data: cls } = await supabase
    .from("classes")
    .select("id, max_enrollment, enrollment_count")
    .eq("id", parsed.data.class_id)
    .single();

  if (!cls) return { error: "Class not found" };

  const isFull =
    cls.max_enrollment && (cls.enrollment_count ?? 0) >= cls.max_enrollment;
  const status =
    parsed.data.enrollment_type === "trial"
      ? "trial"
      : isFull
        ? "waitlist"
        : "active";

  const { error } = await supabase.from("enrollments").insert({
    tenant_id: tenantId,
    student_id: parsed.data.student_id,
    class_id: parsed.data.class_id,
    family_id: parsed.data.family_id || null,
    status,
    enrollment_type: parsed.data.enrollment_type,
    enrolled_by: user.id,
    proration_method: parsed.data.proration_method,
    prorated_amount: parsed.data.prorated_amount ?? null,
    billing_override: parsed.data.billing_override ?? false,
    override_amount: parsed.data.override_amount ?? null,
    override_reason: parsed.data.override_reason || null,
    override_by: parsed.data.billing_override ? user.id : null,
  });

  if (error) {
    console.error("[families:adminEnroll]", error);
    return { error: "Failed to enroll student" };
  }

  // Update enrollment count
  if (status === "active" || status === "trial") {
    await supabase
      .from("classes")
      .update({ enrollment_count: (cls.enrollment_count ?? 0) + 1 })
      .eq("id", parsed.data.class_id);
  }

  revalidatePath(`/admin/schedule/classes/${parsed.data.class_id}`);
  revalidatePath(`/admin/families/${parsed.data.family_id}`);
  return { success: true, status };
}

export async function adminDropStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = dropSchema.safeParse({
    enrollment_id: formData.get("enrollment_id"),
    drop_reason: formData.get("drop_reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Get enrollment to find class_id for count update
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, class_id, status")
    .eq("id", parsed.data.enrollment_id)
    .single();

  if (!enrollment) return { error: "Enrollment not found" };

  const wasActive = ["active", "trial"].includes(enrollment.status);

  const { error } = await supabase
    .from("enrollments")
    .update({
      status: "dropped",
      drop_date: new Date().toISOString().split("T")[0],
      drop_reason: parsed.data.drop_reason || null,
      drop_approved_by: user.id,
      dropped_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.enrollment_id);

  if (error) {
    console.error("[families:adminDrop]", error);
    return { error: "Failed to drop student" };
  }

  // Decrement enrollment count
  if (wasActive) {
    const { data: cls } = await supabase
      .from("classes")
      .select("enrollment_count")
      .eq("id", enrollment.class_id)
      .single();

    if (cls) {
      await supabase
        .from("classes")
        .update({
          enrollment_count: Math.max(0, (cls.enrollment_count ?? 1) - 1),
        })
        .eq("id", enrollment.class_id);
    }
  }

  revalidatePath(`/admin/schedule/classes/${enrollment.class_id}`);
  return { success: true };
}

// ── Guardian Schemas ────────────────────────────────────────

const guardianSchema = z.object({
  student_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  relationship: z.enum(["mother", "father", "stepparent", "grandparent", "guardian", "sibling", "other"]),
  is_primary: z.coerce.boolean().default(false),
  is_billing: z.coerce.boolean().default(false),
  is_emergency: z.coerce.boolean().default(false),
  portal_access: z.coerce.boolean().default(true),
});

const updateGuardianSchema = z.object({
  id: z.string().uuid(),
  relationship: z.enum(["mother", "father", "stepparent", "grandparent", "guardian", "sibling", "other"]),
  is_primary: z.coerce.boolean().default(false),
  is_billing: z.coerce.boolean().default(false),
  is_emergency: z.coerce.boolean().default(false),
  portal_access: z.coerce.boolean().default(true),
});

// ── Guardian Actions ────────────────────────────────────────

export async function addGuardian(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = guardianSchema.safeParse({
    student_id: formData.get("student_id"),
    profile_id: formData.get("profile_id"),
    relationship: formData.get("relationship"),
    is_primary: formData.get("is_primary"),
    is_billing: formData.get("is_billing"),
    is_emergency: formData.get("is_emergency"),
    portal_access: formData.get("portal_access") ?? "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("student_guardians").insert({
    student_id: parsed.data.student_id,
    profile_id: parsed.data.profile_id,
    relationship: parsed.data.relationship,
    is_primary: parsed.data.is_primary,
    is_billing: parsed.data.is_billing,
    is_emergency: parsed.data.is_emergency,
    portal_access: parsed.data.portal_access,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This guardian is already linked to this student" };
    }
    console.error("[families:addGuardian]", error);
    return { error: "Failed to add guardian" };
  }

  revalidatePath("/admin/families");
  return { success: true };
}

export async function updateGuardian(formData: FormData) {
  const supabase = await createClient();

  const parsed = updateGuardianSchema.safeParse({
    id: formData.get("id"),
    relationship: formData.get("relationship"),
    is_primary: formData.get("is_primary"),
    is_billing: formData.get("is_billing"),
    is_emergency: formData.get("is_emergency"),
    portal_access: formData.get("portal_access") ?? "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("student_guardians")
    .update({
      relationship: parsed.data.relationship,
      is_primary: parsed.data.is_primary,
      is_billing: parsed.data.is_billing,
      is_emergency: parsed.data.is_emergency,
      portal_access: parsed.data.portal_access,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[families:updateGuardian]", error);
    return { error: "Failed to update guardian" };
  }

  revalidatePath("/admin/families");
  return { success: true };
}

export async function removeGuardian(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  if (!id) return { error: "Guardian ID required" };

  const { error } = await supabase
    .from("student_guardians")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[families:removeGuardian]", error);
    return { error: "Failed to remove guardian" };
  }

  revalidatePath("/admin/families");
  return { success: true };
}

/**
 * Create a new profile and link as guardian to a student.
 * Used in the Add Family flow when no existing profile is found.
 */
export async function createProfileAndLinkGuardian(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const studentId = formData.get("student_id") as string;
  const relationship = formData.get("relationship") as string;
  const isPrimary = formData.get("is_primary") === "true";
  const isBilling = formData.get("is_billing") === "true";
  const isEmergency = formData.get("is_emergency") === "true";

  if (!firstName || !lastName) {
    return { error: "First and last name are required" };
  }
  if (!studentId) {
    return { error: "Student ID is required" };
  }

  // Create the profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      role: "parent",
    })
    .select("id")
    .single();

  if (profileError) {
    console.error("[families:createProfileAndLink]", profileError);
    return { error: "Failed to create profile" };
  }

  // Link as guardian
  const { error: guardianError } = await supabase
    .from("student_guardians")
    .insert({
      student_id: studentId,
      profile_id: profile.id,
      relationship: relationship || "guardian",
      is_primary: isPrimary,
      is_billing: isBilling,
      is_emergency: isEmergency,
      portal_access: true,
    });

  if (guardianError) {
    console.error("[families:createProfileAndLink:guardian]", guardianError);
    return { error: "Profile created but failed to link as guardian" };
  }

  revalidatePath("/admin/families");
  return { success: true, profileId: profile.id };
}

// ── Search students for linking ─────────────────────────────
export async function searchStudentsForLinking(formData: FormData) {
  const supabase = await createClient();
  const query = (formData.get("query") as string ?? "").trim();
  if (query.length < 2) return { students: [] };

  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name, date_of_birth, current_level, family_id, families(family_name)")
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .eq("active", true)
    .order("first_name")
    .limit(20);

  const students = (data ?? []).map((s: any) => {
    const fam = Array.isArray(s.families) ? s.families[0] : s.families;
    return {
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      date_of_birth: s.date_of_birth,
      current_level: s.current_level,
      family_name: fam?.family_name ?? null,
    };
  });

  return { students };
}

// ── Link existing student to family ─────────────────────────
export async function linkStudentToFamily(formData: FormData) {
  const supabase = await createClient();
  const studentId = formData.get("studentId") as string;
  const familyId = formData.get("familyId") as string;
  const relationship = (formData.get("relationship") as string) || null;

  if (!studentId || !familyId) return { error: "Missing required fields" };

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  const { error } = await supabase.from("student_families").insert({
    tenant_id: tenantId,
    student_id: studentId,
    family_id: familyId,
    is_primary: false,
    relationship,
  });

  if (error) {
    if (error.code === "23505") return { error: "Student is already linked to this family" };
    console.error("[families:linkStudent]", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/families/${familyId}`);
  return { success: true };
}

// ── Remove student from family ──────────────────────────────
export async function unlinkStudentFromFamily(formData: FormData) {
  const supabase = await createClient();
  const studentId = formData.get("studentId") as string;
  const familyId = formData.get("familyId") as string;

  if (!studentId || !familyId) return { error: "Missing required fields" };

  // Check if this is the only family link
  const { count } = await supabase
    .from("student_families")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  // Check if this is the primary link
  const { data: link } = await supabase
    .from("student_families")
    .select("id, is_primary")
    .eq("student_id", studentId)
    .eq("family_id", familyId)
    .single();

  if (link?.is_primary && (count ?? 0) <= 1) {
    return { error: "Cannot remove student from their only primary family. Assign another primary family first." };
  }

  const { error } = await supabase
    .from("student_families")
    .delete()
    .eq("student_id", studentId)
    .eq("family_id", familyId);

  if (error) {
    console.error("[families:unlinkStudent]", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/families/${familyId}`);
  return { success: true };
}
