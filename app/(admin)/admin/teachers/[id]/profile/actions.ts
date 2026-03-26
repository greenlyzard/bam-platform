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

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 2. Toggle teacher active status (profile_roles table)
// ---------------------------------------------------------------------------
export async function toggleTeacherActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  const isActive = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("profile_roles")
    .update({ is_active: isActive })
    .eq("user_id", teacherId)
    .eq("role", "teacher");

  if (error) return { error: error.message };

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 3. Add specialty
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

  // Get current max sort_order for this teacher
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

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 4. Remove specialty
// ---------------------------------------------------------------------------
export async function removeSpecialty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const specialtyId = formData.get("specialtyId") as string;
  if (!specialtyId) return { error: "Missing specialtyId" };

  const { error } = await supabase
    .from("teacher_specialties")
    .delete()
    .eq("id", specialtyId);

  if (error) return { error: error.message };

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 5. Update specialty sort order
// ---------------------------------------------------------------------------
export async function updateSpecialtyOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const specialtyId = formData.get("specialtyId") as string;
  const sortOrder = Number(formData.get("sortOrder"));

  if (!specialtyId || isNaN(sortOrder)) {
    return { error: "Missing specialtyId or sortOrder" };
  }

  const { error } = await supabase
    .from("teacher_specialties")
    .update({ sort_order: sortOrder })
    .eq("id", specialtyId);

  if (error) return { error: error.message };

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 6. Upsert rate card
// ---------------------------------------------------------------------------
export async function upsertRateCard(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  const teacherId = formData.get("teacherId") as string;
  const sessionType = formData.get("sessionType") as string;

  if (!tenantId || !teacherId || !sessionType) {
    return { error: "Missing required fields" };
  }

  const toNum = (key: string) => {
    const val = formData.get(key) as string;
    return val ? Number(val) : null;
  };

  const { error } = await supabase
    .from("teacher_rate_cards")
    .upsert(
      {
        tenant_id: tenantId,
        teacher_id: teacherId,
        session_type: sessionType,
        market_rate_60: toNum("market_rate_60"),
        market_rate_45: toNum("market_rate_45"),
        market_rate_30: toNum("market_rate_30"),
        standard_rate_60: toNum("standard_rate_60"),
        standard_rate_45: toNum("standard_rate_45"),
        standard_rate_30: toNum("standard_rate_30"),
        point_cost: toNum("point_cost"),
        cancellation_notice_hours: toNum("cancellation_notice_hours"),
        late_cancel_charge_pct: toNum("late_cancel_charge_pct"),
        no_show_charge_pct: toNum("no_show_charge_pct"),
      },
      { onConflict: "teacher_id,session_type" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 7. Update compliance
// ---------------------------------------------------------------------------
export async function updateCompliance(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  const toDateOrNull = (key: string) => {
    const val = formData.get(key) as string;
    return val || null;
  };

  const { error } = await supabase
    .from("teacher_compliance")
    .upsert(
      {
        teacher_id: teacherId,
        background_check_status: (formData.get("background_check_status") as string) || null,
        background_check_date: toDateOrNull("background_check_date"),
        background_check_expiry: toDateOrNull("background_check_expiry"),
        mandated_reporter_status: (formData.get("mandated_reporter_status") as string) || null,
        mandated_reporter_date: toDateOrNull("mandated_reporter_date"),
        mandated_reporter_expiry: toDateOrNull("mandated_reporter_expiry"),
        w9_status: (formData.get("w9_status") as string) || null,
        w9_received_date: toDateOrNull("w9_received_date"),
        cpr_status: (formData.get("cpr_status") as string) || null,
        cpr_expiry: toDateOrNull("cpr_expiry"),
        notes: (formData.get("notes") as string) || null,
        updated_by: user.id,
      },
      { onConflict: "teacher_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/teachers");
  return {};
}

// ---------------------------------------------------------------------------
// 8. Update sub eligibility
// ---------------------------------------------------------------------------
export async function updateSubEligibility(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  const isSubEligible = formData.get("is_sub_eligible") === "true";

  // Parse JSON arrays from form data
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

  revalidatePath("/admin/teachers");
  return {};
}
