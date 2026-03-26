"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// 1. Create Icon
// ---------------------------------------------------------------------------
export async function createIcon(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const category = formData.get("category") as string;
  const tenantId = formData.get("tenantId") as string;

  if (!name || !category) {
    return { error: "Name and category are required" };
  }

  const slug = slugify(name);
  const iconUrl = (formData.get("icon_url") as string)?.trim() || null;
  const websiteUrl = (formData.get("website_url") as string)?.trim() || null;

  // Get next sort_order
  const { data: maxRow } = await supabase
    .from("icon_library")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("icon_library").insert({
    name,
    slug,
    category,
    icon_url: iconUrl,
    website_url: websiteUrl,
    tenant_id: tenantId || null,
    is_global: false,
    is_active: true,
    sort_order: nextSort,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/settings/icons");
  return {};
}

// ---------------------------------------------------------------------------
// 2. Update Icon
// ---------------------------------------------------------------------------
export async function updateIcon(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing icon id" };

  const name = (formData.get("name") as string)?.trim();
  const category = formData.get("category") as string;

  if (!name || !category) {
    return { error: "Name and category are required" };
  }

  const { error } = await supabase
    .from("icon_library")
    .update({
      name,
      slug: slugify(name),
      category,
      icon_url: (formData.get("icon_url") as string)?.trim() || null,
      website_url: (formData.get("website_url") as string)?.trim() || null,
      is_active: formData.get("is_active") !== "false",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings/icons");
  return {};
}

// ---------------------------------------------------------------------------
// 3. Toggle Icon Active
// ---------------------------------------------------------------------------
export async function toggleIconActive(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const isActive = formData.get("is_active") === "true";

  if (!id) return { error: "Missing icon id" };

  const { error } = await supabase
    .from("icon_library")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings/icons");
  return {};
}
