import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: lead }, { data: history }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase
      .from("lead_stage_history")
      .select("id, from_stage, to_stage, moved_by_name, note, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ lead, history: history ?? [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed: Record<string, unknown> = {};
  for (const key of [
    "first_name", "last_name", "email", "phone",
    "notes", "source", "placement_notes",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").update(allowed).eq("id", id);
  if (error) {
    console.error("[admin:leads:patch]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
