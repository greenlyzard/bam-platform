import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireAuth();
  const supabase = createAdminClient();

  const { data: students } = await supabase
    .from("students")
    .select("family_id")
    .eq("parent_id", user.id);
  const familyIds = Array.from(
    new Set((students ?? []).map((s) => s.family_id).filter(Boolean) as string[])
  );

  if (familyIds.length === 0) {
    return NextResponse.json({ todos: [] });
  }

  const { data, error } = await supabase
    .from("family_documents")
    .select("*")
    .in("family_id", familyIds)
    .eq("visible_to_parent", true)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ todos: data ?? [] });
}
