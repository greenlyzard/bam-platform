"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateClassFieldVisibility(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fieldKey = formData.get("fieldKey") as string;
  const column = formData.get("column") as string;
  const value = formData.get("value") === "true";
  const tenantId = formData.get("tenantId") as string;

  // Validate column name to prevent injection
  const validColumns = [
    "parent_visible",
    "adult_student_visible",
    "child_portal_visible",
    "public_visible",
    "admin_default_on",
  ];
  if (!validColumns.includes(column)) return { error: "Invalid column" };

  const { error } = await supabase
    .from("class_field_config")
    .update({
      [column]: value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("field_key", fieldKey)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings/class-fields");
  return {};
}
