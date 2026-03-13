import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const SUPER_EMAIL = "derek@greenlyzard.com";

export async function GET() {
  await requireAuth();
  const supabase = await createClient();

  const { data: modules } = await supabase
    .from("platform_modules")
    .select("*")
    .order("nav_group")
    .order("sort_order");

  return NextResponse.json({ modules: modules ?? [] });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin" && profile?.email !== SUPER_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Only allow toggling these fields
  const allowed = ["platform_enabled", "tenant_enabled", "nav_visible"];
  const safeUpdates: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof updates[key] === "boolean") {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("platform_modules")
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
