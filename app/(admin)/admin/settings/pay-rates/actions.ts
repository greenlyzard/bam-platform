"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ALLOWED_ROLES = ["finance_admin", "admin", "super_admin"];

const payRateSchema = z.object({
  teacherId: z.string().uuid(),
  classRateCents: z.number().int().min(0),
  privateRateCents: z.number().int().min(0),
  rehearsalRateCents: z.number().int().min(0),
  adminRateCents: z.number().int().min(0),
});

export async function updatePayRate(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Forbidden — Finance Admin or above required" };
  }

  const parsed = payRateSchema.safeParse({
    teacherId: formData.get("teacherId"),
    classRateCents: Math.round(
      parseFloat(formData.get("classRate") as string) * 100
    ),
    privateRateCents: Math.round(
      parseFloat(formData.get("privateRate") as string) * 100
    ),
    rehearsalRateCents: Math.round(
      parseFloat(formData.get("rehearsalRate") as string) * 100
    ),
    adminRateCents: Math.round(
      parseFloat(formData.get("adminRate") as string) * 100
    ),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("teachers")
    .update({
      class_rate_cents: parsed.data.classRateCents,
      private_rate_cents: parsed.data.privateRateCents,
      rehearsal_rate_cents: parsed.data.rehearsalRateCents,
      admin_rate_cents: parsed.data.adminRateCents,
    })
    .eq("id", parsed.data.teacherId);

  if (error) {
    console.error("[admin:updatePayRate]", error);
    return { error: "Failed to update pay rate." };
  }

  revalidatePath("/admin/settings/pay-rates");
  revalidatePath("/admin/staff");
  return { success: true };
}
