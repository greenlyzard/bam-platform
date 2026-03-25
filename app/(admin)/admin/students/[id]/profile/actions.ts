"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 1. Update student basics
// ---------------------------------------------------------------------------
export async function updateStudentBasics(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("studentId") as string;
  if (!studentId) return { error: "Missing studentId" };

  const { error } = await supabase
    .from("students")
    .update({
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      preferred_name: formData.get("preferred_name") as string || null,
      date_of_birth: formData.get("date_of_birth") as string || null,
      medical_notes: formData.get("medical_notes") as string || null,
      allergy_notes: formData.get("allergy_notes") as string || null,
    })
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 2. Update student level
// ---------------------------------------------------------------------------
export async function updateStudentLevel(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("studentId") as string;
  const level = formData.get("level") as string;
  if (!studentId) return { error: "Missing studentId" };
  if (!level) return { error: "Missing level" };

  const { error } = await supabase
    .from("students")
    .update({ current_level: level })
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 3. Toggle student active
// ---------------------------------------------------------------------------
export async function toggleStudentActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("studentId") as string;
  const active = formData.get("active") === "true";
  if (!studentId) return { error: "Missing studentId" };

  const { error } = await supabase
    .from("students")
    .update({ active })
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 4. Award badge
// ---------------------------------------------------------------------------
export async function awardBadge(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const studentId = formData.get("studentId") as string;
  const badgeId = formData.get("badgeId") as string;
  if (!studentId) return { error: "Missing studentId" };
  if (!badgeId) return { error: "Missing badgeId" };

  const notes = formData.get("notes") as string || null;

  const { error } = await supabase
    .from("student_badges")
    .insert({
      student_id: studentId,
      badge_id: badgeId,
      notes,
      awarded_by: user.id,
    });

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 5. Revoke badge
// ---------------------------------------------------------------------------
export async function revokeBadge(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const badgeAwardId = formData.get("badgeAwardId") as string;
  if (!badgeAwardId) return { error: "Missing badgeAwardId" };

  const { error } = await supabase
    .from("student_badges")
    .delete()
    .eq("id", badgeAwardId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 6. Create evaluation
// ---------------------------------------------------------------------------
export async function createEvaluation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const studentId = formData.get("studentId") as string;
  if (!tenantId) return { error: "Missing tenant" };
  if (!studentId) return { error: "Missing studentId" };

  const { error } = await supabase
    .from("student_evaluations")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      evaluation_type: formData.get("evaluation_type") as string,
      title: formData.get("title") as string,
      body: formData.get("body") as string,
      is_private: formData.get("is_private") === "true",
      attributed_to_name: formData.get("attributed_to_name") as string || null,
      evaluator_id: user.id,
    });

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 7. Delete evaluation
// ---------------------------------------------------------------------------
export async function deleteEvaluation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const evaluationId = formData.get("evaluationId") as string;
  if (!evaluationId) return { error: "Missing evaluationId" };

  const { error } = await supabase
    .from("student_evaluations")
    .delete()
    .eq("id", evaluationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 8. Create album
// ---------------------------------------------------------------------------
export async function createAlbum(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const studentId = formData.get("studentId") as string;
  if (!tenantId) return { error: "Missing tenant" };
  if (!studentId) return { error: "Missing studentId" };

  const { error } = await supabase
    .from("student_google_photo_albums")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      label: formData.get("label") as string,
      album_url: formData.get("album_url") as string,
      sort_order: parseInt(formData.get("sort_order") as string || "0", 10),
    });

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 9. Update album
// ---------------------------------------------------------------------------
export async function updateAlbum(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const albumId = formData.get("albumId") as string;
  if (!albumId) return { error: "Missing albumId" };

  const { error } = await supabase
    .from("student_google_photo_albums")
    .update({
      label: formData.get("label") as string,
      album_url: formData.get("album_url") as string,
    })
    .eq("id", albumId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 10. Delete album
// ---------------------------------------------------------------------------
export async function deleteAlbum(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const albumId = formData.get("albumId") as string;
  if (!albumId) return { error: "Missing albumId" };

  const { error } = await supabase
    .from("student_google_photo_albums")
    .delete()
    .eq("id", albumId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 11. Create relative
// ---------------------------------------------------------------------------
export async function createRelative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const studentId = formData.get("studentId") as string;
  if (!tenantId) return { error: "Missing tenant" };
  if (!studentId) return { error: "Missing studentId" };

  const { data, error } = await supabase
    .from("student_profile_relatives")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      name: formData.get("name") as string,
      relationship: formData.get("relationship") as string,
      email: formData.get("email") as string || null,
      vanity_slug: formData.get("vanity_slug") as string || null,
    })
    .select("id, share_token")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return { id: data.id, share_token: data.share_token };
}

// ---------------------------------------------------------------------------
// 12. Update relative active status
// ---------------------------------------------------------------------------
export async function updateRelativeActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const relativeId = formData.get("relativeId") as string;
  const isActive = formData.get("isActive") === "true";
  if (!relativeId) return { error: "Missing relativeId" };

  const { error } = await supabase
    .from("student_profile_relatives")
    .update({ is_active: isActive })
    .eq("id", relativeId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 13. Update share permission (upsert)
// ---------------------------------------------------------------------------
export async function updateSharePermission(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const relativeId = formData.get("relativeId") as string;
  const sectionKey = formData.get("section_key") as string;
  const isVisible = formData.get("is_visible") === "true";
  if (!tenantId) return { error: "Missing tenant" };
  if (!relativeId) return { error: "Missing relativeId" };
  if (!sectionKey) return { error: "Missing section_key" };

  const { error } = await supabase
    .from("student_profile_share_permissions")
    .upsert(
      {
        tenant_id: tenantId,
        relative_id: relativeId,
        section_key: sectionKey,
        is_visible: isVisible,
      },
      { onConflict: "relative_id,section_key" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {};
}

// ---------------------------------------------------------------------------
// 14. Enroll student in class
// ---------------------------------------------------------------------------
export async function enrollStudentInClass(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  const studentId = formData.get("studentId") as string;
  const classId = formData.get("classId") as string;
  const familyId = (formData.get("familyId") as string) || null;
  const enrollmentType = (formData.get("enrollmentType") as string) || "full";
  const billingPlanType = (formData.get("billingPlanType") as string) || null;
  const suppressOnboarding = formData.get("suppressOnboarding") === "true";
  const pointCost = parseInt(formData.get("pointCost") as string) || 1;

  if (!tenantId || !studentId || !classId) {
    return { error: "Missing required fields" };
  }

  const { data: enrollment, error: enrollErr } = await supabase
    .from("enrollments")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      class_id: classId,
      family_id: familyId,
      status: "active",
      enrollment_type: enrollmentType,
      enrolled_by: user.id,
      billing_plan_type: billingPlanType,
      suppress_onboarding: suppressOnboarding,
      enrolled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (enrollErr) {
    console.error("[enroll:insert]", enrollErr);
    return { error: enrollErr.message };
  }

  // If bundle: deduct credits
  if (billingPlanType === "bundle" && pointCost > 0) {
    try {
      let { data: account } = await supabase
        .from("credit_accounts")
        .select("id, balance, lifetime_spent")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .single();

      if (!account) {
        const { data: newAcct } = await supabase
          .from("credit_accounts")
          .insert({ tenant_id: tenantId, student_id: studentId, family_id: familyId, balance: 0 })
          .select("id, balance, lifetime_spent")
          .single();
        account = newAcct;
      }

      if (account) {
        const newBalance = account.balance - pointCost;
        await supabase
          .from("credit_accounts")
          .update({ balance: newBalance, lifetime_spent: (account.lifetime_spent ?? 0) + pointCost, updated_at: new Date().toISOString() })
          .eq("id", account.id);

        const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();

        await supabase.from("credit_transactions").insert({
          tenant_id: tenantId, account_id: account.id, type: "charge",
          amount: -pointCost, balance_after: newBalance,
          description: `Class enrollment: ${cls?.name ?? classId}`,
          reference_id: enrollment.id, created_by: user.id,
        });
      }
    } catch (e) {
      console.warn("[enroll:credits] Credit deduction failed", e);
    }
  }

  // If trial: insert trial_history
  if (enrollmentType === "trial") {
    try {
      await supabase.from("trial_history").insert({
        tenant_id: tenantId, student_id: studentId, class_id: classId,
        enrollment_id: enrollment.id,
        trial_date: new Date().toISOString().split("T")[0],
        outcome: "pending_conversion",
      });
    } catch (e) {
      console.warn("[enroll:trial] trial_history insert failed", e);
    }
  }

  revalidatePath("/admin/students");
  return { id: enrollment.id };
}

// ---------------------------------------------------------------------------
// 15. Check billing plan for enrollment
// ---------------------------------------------------------------------------
export async function checkBillingPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  const studentId = formData.get("studentId") as string;
  const pointCost = parseInt(formData.get("pointCost") as string) || 1;

  // 1. Check unlimited plans
  try {
    const { data: plans } = await supabase
      .from("unlimited_plans")
      .select("id, plan_name")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("is_active", true)
      .limit(1);
    if (plans && plans.length > 0) {
      return { planType: "unlimited" as const, message: "Covered by unlimited plan — no charge" };
    }
  } catch { /* table may not exist */ }

  // 2. Check credit balance
  try {
    const { data: account } = await supabase
      .from("credit_accounts")
      .select("id, balance")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .single();
    if (account && account.balance >= pointCost) {
      return {
        planType: "bundle" as const,
        message: `${account.balance} credits available — this class costs ${pointCost} point${pointCost !== 1 ? "s" : ""}. ${account.balance - pointCost} remaining after enrollment.`,
        balance: account.balance,
      };
    }
  } catch { /* table may not exist or no row */ }

  // 3. Fallback
  return { planType: "per_class" as const, message: "No plan or credits. Standard rate applies." };
}
