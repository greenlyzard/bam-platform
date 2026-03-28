"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  studio_name: z.string().min(1),
  theme_preset: z.string().min(1),
  custom_colors: z.string(), // JSON string
  heading_font: z.string().min(1),
  body_font: z.string().min(1),
  logo_url: z.string().optional(),
  favicon_url: z.string().optional(),
  app_icon_url: z.string().optional(),
});

export async function updateThemeSettings(formData: FormData) {
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

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Forbidden" };
  }

  const parsed = schema.safeParse({
    studio_name: formData.get("studio_name"),
    theme_preset: formData.get("theme_preset"),
    custom_colors: formData.get("custom_colors"),
    heading_font: formData.get("heading_font"),
    body_font: formData.get("body_font"),
    logo_url: formData.get("logo_url") || undefined,
    favicon_url: formData.get("favicon_url") || undefined,
    app_icon_url: formData.get("app_icon_url") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let customColors = {};
  try {
    customColors = JSON.parse(parsed.data.custom_colors);
  } catch {
    // ignore invalid JSON — use empty overrides
  }

  // Check if settings row exists — also fetch custom_colors to preserve non-theme keys (e.g. class_palette)
  const { data: existing } = await supabase
    .from("studio_settings")
    .select("id, custom_colors")
    .limit(1)
    .single();

  const mergedColors = {
    ...((existing?.custom_colors as Record<string, unknown>) ?? {}),
    ...customColors,
  };

  const settingsPayload = {
    studio_name: parsed.data.studio_name,
    theme_preset: parsed.data.theme_preset,
    custom_colors: mergedColors,
    heading_font: parsed.data.heading_font,
    body_font: parsed.data.body_font,
    logo_url: parsed.data.logo_url || null,
    favicon_url: parsed.data.favicon_url || null,
    app_icon_url: parsed.data.app_icon_url || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("studio_settings")
      .update({
        ...settingsPayload,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("studio_settings").insert({
      ...settingsPayload,
      updated_by: user.id,
    });

    if (error) return { error: error.message };
  }

  return { success: true };
}
