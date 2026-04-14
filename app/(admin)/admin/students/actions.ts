"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getTenantId() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  return data?.id ?? null;
}

export async function updateStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Student ID required" };

  const mediaConsent = formData.get("media_consent") === "true";

  // Fetch current student to check if media_consent is being toggled on
  const { data: current } = await supabase
    .from("students")
    .select("media_consent")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    preferred_name: formData.get("preferred_name") || null,
    date_of_birth: formData.get("date_of_birth"),
    active: formData.get("active") === "true",
    medical_notes: formData.get("medical_notes") || null,
    emergency_contact: formData.get("emergency_contact")
      ? JSON.parse(formData.get("emergency_contact") as string)
      : null,
    media_consent: mediaConsent,
    address_line_1: formData.get("address_line_1") || null,
    address_line_2: formData.get("address_line_2") || null,
    city: formData.get("city") || null,
    state: formData.get("state") || null,
    zip_code: formData.get("zip_code") || null,
    current_level: formData.get("current_level") || null,
  };

  // Set media_consent_date on first consent
  if (mediaConsent && !current?.media_consent) {
    updates.media_consent_date = new Date().toISOString();
  }

  const { error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[students:update]", error);
    return { error: "Failed to update student" };
  }

  revalidatePath(`/admin/students/${id}`);
  return { success: true };
}

export async function addExtendedContact(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  const studentId = formData.get("student_id") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;

  if (!studentId || !firstName || !lastName) {
    return { error: "Student ID, first name, and last name are required" };
  }

  const { data: contact, error: contactError } = await supabase
    .from("extended_contacts")
    .insert({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      relationship: (formData.get("relationship") as string) || null,
      notify_live_stream: formData.get("notify_live_stream") === "true",
      notify_recordings: formData.get("notify_recordings") === "true",
      notify_photos: formData.get("notify_photos") === "true",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (contactError) {
    console.error("[students:addExtendedContact]", contactError);
    return { error: "Failed to create contact" };
  }

  // Link to student
  const { error: linkError } = await supabase
    .from("extended_contact_students")
    .insert({
      extended_contact_id: contact.id,
      student_id: studentId,
    });

  if (linkError) {
    console.error("[students:linkExtendedContact]", linkError);
    return { error: "Contact created but failed to link to student" };
  }

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

export async function removeExtendedContact(formData: FormData) {
  const supabase = await createClient();

  const contactId = formData.get("contact_id") as string;
  const studentId = formData.get("student_id") as string;

  if (!contactId) return { error: "Contact ID required" };

  // Remove link
  const { error: linkError } = await supabase
    .from("extended_contact_students")
    .delete()
    .eq("extended_contact_id", contactId)
    .eq("student_id", studentId);

  if (linkError) {
    console.error("[students:removeExtendedContactLink]", linkError);
    return { error: "Failed to unlink contact" };
  }

  // Check if contact has any remaining student links
  const { data: remaining } = await supabase
    .from("extended_contact_students")
    .select("id")
    .eq("extended_contact_id", contactId)
    .limit(1);

  // If no more links, delete the contact itself
  if (!remaining?.length) {
    await supabase.from("extended_contacts").delete().eq("id", contactId);
  }

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}
