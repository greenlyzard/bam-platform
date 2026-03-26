"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAssistantConfig(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) return { error: "Missing tenant" };

  const { error } = await supabase
    .from("tenant_assistant_config")
    .upsert({
      tenant_id: tenantId,
      assistant_name: (formData.get("assistant_name") as string) || "Angelina",
      director_name: (formData.get("director_name") as string) || "Miss Amanda",
      greeting_message: (formData.get("greeting_message") as string) || "",
      primary_color: (formData.get("primary_color") as string) || "#9C8BBF",
      enrollment_enabled: formData.get("enrollment_enabled") === "true",
      trial_enabled: formData.get("trial_enabled") === "true",
      assistant_avatar_url: (formData.get("assistant_avatar_url") as string) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });

  if (error) return { error: error.message };
  revalidatePath("/admin/settings/assistant");
  return {};
}
