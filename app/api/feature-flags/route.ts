import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAuth();
  const supabase = await createClient();

  const { data: flags } = await supabase
    .from("feature_flags")
    .select("key, is_enabled")
    .order("key");

  return NextResponse.json({
    flags: (flags ?? []).reduce(
      (acc: Record<string, boolean>, f) => {
        acc[f.key] = f.is_enabled;
        return acc;
      },
      {}
    ),
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth();

  // Only super_admin can toggle flags
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { key, is_enabled } = body;

  if (!key || typeof is_enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("feature_flags")
    .update({ is_enabled, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
