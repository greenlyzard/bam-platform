"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 1. Update teacher basics (profiles table)
// ---------------------------------------------------------------------------
export async function updateTeacherBasics(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  // Teacher can only update their own profile
  if (teacherId !== user.id) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      bio: (formData.get("bio") as string) || null,
    })
    .eq("id", teacherId);

  if (error) return { error: error.message };

  revalidatePath("/teach/profile");
  return {};
}

// ---------------------------------------------------------------------------
// 2. Add specialty
// ---------------------------------------------------------------------------
export async function addSpecialty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  const teacherId = formData.get("teacherId") as string;
  const specialty = formData.get("specialty") as string;

  if (!tenantId || !teacherId || !specialty) {
    return { error: "Missing required fields" };
  }

  // Teacher can only update their own specialties
  if (teacherId !== user.id) return { error: "Unauthorized" };

  const { data: existing } = await supabase
    .from("teacher_specialties")
    .select("sort_order")
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from("teacher_specialties")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      specialty,
      sort_order: nextOrder,
    });

  if (error) return { error: error.message };

  revalidatePath("/teach/profile");
  return {};
}

// ---------------------------------------------------------------------------
// 3. Remove specialty
// ---------------------------------------------------------------------------
export async function removeSpecialty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const specialtyId = formData.get("specialtyId") as string;
  if (!specialtyId) return { error: "Missing specialtyId" };

  // Verify ownership: only delete own specialties
  const { data: spec } = await supabase
    .from("teacher_specialties")
    .select("teacher_id")
    .eq("id", specialtyId)
    .single();

  if (!spec || spec.teacher_id !== user.id) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("teacher_specialties")
    .delete()
    .eq("id", specialtyId);

  if (error) return { error: error.message };

  revalidatePath("/teach/profile");
  return {};
}

// ---------------------------------------------------------------------------
// 4. Update sub eligibility
// ---------------------------------------------------------------------------
export async function updateSubEligibility(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  // Teacher can only update their own sub eligibility
  if (teacherId !== user.id) return { error: "Unauthorized" };

  const isSubEligible = formData.get("is_sub_eligible") === "true";

  let eligibleLevels: string[] = [];
  let eligibleDisciplines: string[] = [];

  try {
    const levelsRaw = formData.get("eligible_levels") as string;
    if (levelsRaw) eligibleLevels = JSON.parse(levelsRaw);
  } catch {
    return { error: "Invalid eligible_levels JSON" };
  }

  try {
    const disciplinesRaw = formData.get("eligible_disciplines") as string;
    if (disciplinesRaw) eligibleDisciplines = JSON.parse(disciplinesRaw);
  } catch {
    return { error: "Invalid eligible_disciplines JSON" };
  }

  const { error } = await supabase
    .from("teacher_sub_eligibility")
    .upsert(
      {
        teacher_id: teacherId,
        is_sub_eligible: isSubEligible,
        eligible_levels: eligibleLevels,
        eligible_disciplines: eligibleDisciplines,
        notes: (formData.get("notes") as string) || null,
        updated_by: user.id,
      },
      { onConflict: "teacher_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/teach/profile");
  return {};
}
