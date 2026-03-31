"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveDisciplineEdit(
  id: string,
  name: string,
  description: string | null,
  icon_id: string | null
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("disciplines")
    .update({ name, description, icon_id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings/disciplines");
  return { success: true };
}

export async function addDiscipline(
  tenant_id: string,
  name: string,
  description: string | null,
  sort_order: number
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("disciplines")
    .insert({ tenant_id, name, description, is_active: true, sort_order })
    .select()
    .single();
  if (error) return { error: error.message };
  return { success: true, item: data };
}

export async function toggleDisciplineActive(id: string, is_active: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("disciplines")
    .update({ is_active })
    .eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateDisciplineSortOrder(
  items: Array<{ id: string; sort_order: number }>
) {
  const supabase = createAdminClient();
  await Promise.all(
    items.map((item) =>
      supabase.from("disciplines").update({ sort_order: item.sort_order }).eq("id", item.id)
    )
  );
  return { success: true };
}

export async function deleteDiscipline(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("disciplines")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings/disciplines");
  return { success: true };
}
