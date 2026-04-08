import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("family_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin can see anything; parents only their family's docs
  const isAdmin = user.roles.some((r) =>
    ["admin", "super_admin", "finance_admin", "studio_admin", "studio_manager"].includes(r)
  );

  if (!isAdmin) {
    if (!data.visible_to_parent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Verify family ownership via parent_id on a student in the family
    if (data.family_id) {
      const { data: studentMatch } = await supabase
        .from("students")
        .select("id")
        .eq("family_id", data.family_id)
        .eq("parent_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!studentMatch) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({ document: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();

  const allowed: Record<string, unknown> = {};
  for (const key of [
    "title", "description", "visible_to_parent", "visible_to_student",
    "expires_at", "admin_notes", "external_url", "file_url",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("family_documents")
    .update(allowed)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
