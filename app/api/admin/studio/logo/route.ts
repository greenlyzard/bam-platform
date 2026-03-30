import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STUDIO_SETTINGS_ID = "807cadc5-405f-4d24-9225-ae8458a31577";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

const VALID_UPLOAD_TYPES = ["logo", "logo_light", "logo_dark", "favicon", "app_icon"] as const;

const COLUMN_MAP: Record<string, string> = {
  logo: "logo_url",
  logo_light: "logo_light_url",
  logo_dark: "logo_dark_url",
  favicon: "favicon_url",
  app_icon: "app_icon_url",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify admin role
  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("profile_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const adminRoles = ["admin", "super_admin", "studio_admin", "finance_admin"];
  const isAdmin = (roles ?? []).some((r) => adminRoles.includes(r.role));
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!type || !VALID_UPLOAD_TYPES.includes(type as (typeof VALID_UPLOAD_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `studio-branding/${type}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const updateField = COLUMN_MAP[type];
  const { error: updateError } = await admin
    .from("studio_settings")
    .update({ [updateField]: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", STUDIO_SETTINGS_ID);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}
