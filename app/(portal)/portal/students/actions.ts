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
  allergyNotes: z.string().max(2000).optional(),
  gender: z.string().optional(),
  photoConsent: z.coerce.boolean().optional(),
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
    allergyNotes: formData.get("allergyNotes") || undefined,
    gender: formData.get("gender") || undefined,
    photoConsent: formData.get("photoConsent"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  const tenantId = tenant?.id ?? null;

  // Get or create family account for this parent
  let familyId: string | null = null;

  const { data: existingFamily } = await supabase
    .from("families")
    .select("id")
    .eq("primary_contact_id", user.id)
    .single();

  if (existingFamily) {
    familyId = existingFamily.id;
  } else if (tenantId) {
    // Create a family record for this parent
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, phone")
      .eq("id", user.id)
      .single();

    const familyName = `The ${profile?.last_name || parsed.data.lastName} Family`;

    const { data: newFamily } = await supabase
      .from("families")
      .insert({
        tenant_id: tenantId,
        primary_contact_id: user.id,
        family_name: familyName,
        billing_email: profile?.email ?? user.email,
        billing_phone: profile?.phone ?? null,
      })
      .select("id")
      .single();

    familyId = newFamily?.id ?? null;
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
    tenant_id: tenantId,
    family_id: familyId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth,
    current_level: parsed.data.currentLevel || null,
    age_group: ageGroup,
    medical_notes: parsed.data.medicalNotes || null,
    allergy_notes: parsed.data.allergyNotes || null,
    gender: parsed.data.gender || null,
    photo_consent: parsed.data.photoConsent ?? false,
  });

  if (error) {
    console.error("[portal:addStudent]", error);
    return { error: "Failed to add dancer. Please try again." };
  }

  revalidatePath("/portal/children");
  revalidatePath("/portal/dashboard");
  return { success: true };
}
