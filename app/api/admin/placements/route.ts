import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { season_id, student_id, class_id } = body ?? {};

  if (!season_id || !student_id || !class_id) {
    return NextResponse.json(
      { error: "season_id, student_id, and class_id are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("season_placements")
    .insert({
      tenant_id: user.tenantId!,
      season_id,
      student_id,
      class_id,
      placed_by: user.id,
      status: "staged",
    })
    .select("id, student_id, class_id, status, placement_notes")
    .single();

  if (error) {
    console.error("[admin:placements:create]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ placement: data });
}
