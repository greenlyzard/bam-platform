"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const contactSchema = z.object({
  family_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notify_via_sms: z.coerce.boolean().optional(),
  notify_via_email: z.coerce.boolean().optional(),
});

/**
 * Parent adds a stream contact to their own family.
 */
export async function addStreamContact(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = contactSchema.safeParse({
    family_id: formData.get("family_id"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relationship: formData.get("relationship"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notify_via_sms: formData.get("notify_via_sms"),
    notify_via_email: formData.get("notify_via_email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Verify the family belongs to this parent
  const { data: family } = await supabase
    .from("families")
    .select("id, tenant_id")
    .eq("id", parsed.data.family_id)
    .eq("primary_contact_id", user.id)
    .single();

  if (!family) return { error: "Family not found" };

  const { error } = await supabase.from("family_contacts").insert({
    tenant_id: family.tenant_id,
    family_id: family.id,
    contact_type: "stream",
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    relationship: parsed.data.relationship || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    notify_via_sms: parsed.data.notify_via_sms ?? true,
    notify_via_email: parsed.data.notify_via_email ?? true,
    created_by: user.id,
  });

  if (error) {
    console.error("[portal:addStreamContact]", error);
    return { error: "Failed to add contact" };
  }

  revalidatePath(`/portal/students/${formData.get("student_id")}`);
  return { success: true };
}

/**
 * Parent removes a stream contact from their own family.
 */
export async function removeStreamContact(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const contactId = formData.get("id") as string;
  if (!contactId) return { error: "Contact ID required" };

  // Verify contact belongs to parent's family
  const { data: contact } = await supabase
    .from("family_contacts")
    .select("id, family_id")
    .eq("id", contactId)
    .single();

  if (!contact) return { error: "Contact not found" };

  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("id", contact.family_id)
    .eq("primary_contact_id", user.id)
    .single();

  if (!family) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("family_contacts")
    .delete()
    .eq("id", contactId);

  if (error) {
    console.error("[portal:removeStreamContact]", error);
    return { error: "Failed to remove contact" };
  }

  revalidatePath(`/portal/students/${formData.get("student_id")}`);
  return { success: true };
}
