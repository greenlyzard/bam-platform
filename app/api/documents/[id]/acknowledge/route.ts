import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("family_documents")
    .select("id, family_id, document_type")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.family_id) {
    const { data: studentMatch } = await supabase
      .from("students")
      .select("id")
      .eq("family_id", doc.family_id)
      .eq("parent_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!studentMatch) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("family_documents")
    .update({
      signed_at: nowIso,
      signed_by: user.id,
      status: "completed",
      updated_at: nowIso,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
