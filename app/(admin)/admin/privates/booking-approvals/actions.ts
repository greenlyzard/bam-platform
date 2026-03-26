"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function createBookingApproval(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Tenant not found" };

  const teacher_id = formData.get("teacher_id") as string;
  const family_id = formData.get("family_id") as string;
  const student_ids_raw = formData.get("student_ids") as string;
  const notes = formData.get("notes") as string;

  if (!teacher_id || !family_id) {
    return { error: "Teacher and family are required" };
  }

  let student_ids: string[] | null = null;
  if (student_ids_raw) {
    try {
      student_ids = JSON.parse(student_ids_raw);
    } catch {
      return { error: "Invalid student IDs" };
    }
  }

  const { error } = await supabase.from("teacher_booking_approvals").insert({
    tenant_id: tenantId,
    teacher_id,
    family_id,
    student_ids,
    notes: notes || null,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
    is_active: true,
  });

  if (error) {
    console.error("[booking-approvals:create]", error);
    return { error: "Failed to create approval" };
  }

  revalidatePath("/admin/privates/booking-approvals");
  return { success: true };
}

export async function toggleApprovalActive(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const is_active = formData.get("is_active") === "true";

  if (!id) return { error: "Approval ID is required" };

  const { error } = await supabase
    .from("teacher_booking_approvals")
    .update({ is_active })
    .eq("id", id);

  if (error) {
    console.error("[booking-approvals:toggle]", error);
    return { error: "Failed to update approval" };
  }

  revalidatePath("/admin/privates/booking-approvals");
  return { success: true };
}

export async function deleteBookingApproval(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Approval ID is required" };

  const { error } = await supabase
    .from("teacher_booking_approvals")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[booking-approvals:delete]", error);
    return { error: "Failed to delete approval" };
  }

  revalidatePath("/admin/privates/booking-approvals");
  return { success: true };
}
