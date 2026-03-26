"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getTeacherContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const tenantId = roles?.[0]?.tenant_id;
  if (!tenantId) return null;

  return { id: user.id, tenant_id: tenantId };
}

// ---------------------------------------------------------------------------
// 1. Create availability slot
// ---------------------------------------------------------------------------

export async function createAvailabilitySlot(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getTeacherContext(supabase);
  if (!ctx) return { error: "Not authenticated as teacher." };

  const isRecurring = formData.get("is_recurring") === "true";
  const dayOfWeek = isRecurring ? Number(formData.get("day_of_week")) : null;
  const specificDate = !isRecurring ? (formData.get("specific_date") as string) : null;

  const { error } = await supabase.from("teacher_availability").insert({
    tenant_id: ctx.tenant_id,
    teacher_id: ctx.id,
    day_of_week: dayOfWeek,
    specific_date: specificDate,
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
    is_recurring: isRecurring,
    slot_type: (formData.get("slot_type") as string) || "private",
    max_students: Number(formData.get("max_students")) || 1,
    is_published: formData.get("is_published") === "true",
  });

  if (error) {
    console.error("[availability:create]", error);
    return { error: "Failed to create slot." };
  }

  revalidatePath("/teach/availability");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 2. Update availability slot
// ---------------------------------------------------------------------------

export async function updateAvailabilitySlot(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getTeacherContext(supabase);
  if (!ctx) return { error: "Not authenticated as teacher." };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing slot id." };

  const isRecurring = formData.get("is_recurring") === "true";
  const dayOfWeek = isRecurring ? Number(formData.get("day_of_week")) : null;
  const specificDate = !isRecurring ? (formData.get("specific_date") as string) : null;

  const { error } = await supabase
    .from("teacher_availability")
    .update({
      day_of_week: dayOfWeek,
      specific_date: specificDate,
      start_time: formData.get("start_time") as string,
      end_time: formData.get("end_time") as string,
      is_recurring: isRecurring,
      slot_type: (formData.get("slot_type") as string) || "private",
      max_students: Number(formData.get("max_students")) || 1,
      is_published: formData.get("is_published") === "true",
    })
    .eq("id", id)
    .eq("teacher_id", ctx.id);

  if (error) {
    console.error("[availability:update]", error);
    return { error: "Failed to update slot." };
  }

  revalidatePath("/teach/availability");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 3. Delete availability slot
// ---------------------------------------------------------------------------

export async function deleteAvailabilitySlot(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getTeacherContext(supabase);
  if (!ctx) return { error: "Not authenticated as teacher." };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing slot id." };

  // Check if booked — cannot delete booked slots
  const { data: slot } = await supabase
    .from("teacher_availability")
    .select("is_booked")
    .eq("id", id)
    .eq("teacher_id", ctx.id)
    .single();

  if (!slot) return { error: "Slot not found." };
  if (slot.is_booked) return { error: "Cannot delete a booked slot." };

  const { error } = await supabase
    .from("teacher_availability")
    .delete()
    .eq("id", id)
    .eq("teacher_id", ctx.id);

  if (error) {
    console.error("[availability:delete]", error);
    return { error: "Failed to delete slot." };
  }

  revalidatePath("/teach/availability");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 4. Toggle slot published
// ---------------------------------------------------------------------------

export async function toggleSlotPublished(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getTeacherContext(supabase);
  if (!ctx) return { error: "Not authenticated as teacher." };

  const id = formData.get("id") as string;
  const isPublished = formData.get("is_published") === "true";

  const { error } = await supabase
    .from("teacher_availability")
    .update({ is_published: isPublished })
    .eq("id", id)
    .eq("teacher_id", ctx.id);

  if (error) {
    console.error("[availability:togglePublished]", error);
    return { error: "Failed to toggle published." };
  }

  revalidatePath("/teach/availability");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 5. Toggle auto-confirm preference
// ---------------------------------------------------------------------------

export async function toggleAutoConfirm(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getTeacherContext(supabase);
  if (!ctx) return { error: "Not authenticated as teacher." };

  const autoConfirm = formData.get("auto_confirm") === "true";

  try {
    const { error } = await supabase.from("teacher_preferences").upsert(
      {
        tenant_id: ctx.tenant_id,
        teacher_id: ctx.id,
        auto_confirm_bookings: autoConfirm,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,teacher_id" }
    );

    if (error) {
      console.error("[availability:toggleAutoConfirm]", error);
      return { error: "Failed to update preference." };
    }
  } catch (err) {
    // Graceful if teacher_preferences table doesn't exist yet
    console.error("[availability:toggleAutoConfirm] table may not exist", err);
    return { error: "Preference table not available." };
  }

  revalidatePath("/teach/availability");
  return { success: true };
}
