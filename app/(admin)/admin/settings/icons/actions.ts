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

// ---------------------------------------------------------------------------
// 4. Upload Icon to Storage
// ---------------------------------------------------------------------------
export async function uploadIconToStorage(formData: FormData): Promise<{ url: string | null; slug: string | null; error?: string }> {
  const file = formData.get("file") as File;
  if (!file) return { url: null, slug: null, error: "No file" };
  if (file.size > 2 * 1024 * 1024) return { url: null, slug: null, error: "File too large (max 2MB)" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  if (!["png", "svg", "webp", "jpg", "jpeg"].includes(ext)) return { url: null, slug: null, error: "Only PNG, JPG, SVG, WebP allowed" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const slug = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const path = `icons/${slug}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { url: null, slug: null, error: uploadError.message };

  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);

  return { url: publicUrl, slug };
}

// ---------------------------------------------------------------------------
// 5. Save Icons to Library (batch)
// ---------------------------------------------------------------------------
export async function saveIconsToLibrary(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const icons = JSON.parse(formData.get("icons") as string ?? "[]") as Array<{
    name: string; slug: string; category: string; icon_url: string; website_url?: string;
  }>;

  if (icons.length === 0) return { error: "No icons to save" };

  const tenantId = formData.get("tenantId") as string;

  const rows = icons.map((icon, i) => ({
    tenant_id: tenantId || null,
    name: icon.name,
    slug: icon.slug,
    category: icon.category,
    icon_url: icon.icon_url,
    website_url: icon.website_url || null,
    is_global: false,
    is_active: true,
    sort_order: 100 + i,
  }));

  const { error } = await supabase.from("icon_library").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings/icons");
  return { count: rows.length };
}
