import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { season_id, action } = body ?? {};

  if (!season_id || (action !== "stage" && action !== "release")) {
    return NextResponse.json(
      { error: "season_id and action ('stage'|'release') are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "stage") {
    // No-op marker — placements are already staged on insert.
    // Could be used to revert any 'released' rows back to 'staged' if needed.
    const { count } = await supabase
      .from("season_placements")
      .select("id", { count: "exact", head: true })
      .eq("season_id", season_id)
      .eq("status", "staged");
    return NextResponse.json({ message: `${count ?? 0} placements staged` });
  }

  // action === "release"
  const nowIso = new Date().toISOString();

  const { data: stagedRows, error: fetchErr } = await supabase
    .from("season_placements")
    .select("id, student_id")
    .eq("season_id", season_id)
    .eq("status", "staged");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const stagedIds = (stagedRows ?? []).map((r) => r.id);
  const studentsPlaced = new Set((stagedRows ?? []).map((r) => r.student_id)).size;

  if (stagedIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("season_placements")
      .update({ status: "released", released_at: nowIso, updated_at: nowIso })
      .in("id", stagedIds);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  // Log the release event
  await supabase.from("season_placement_releases").insert({
    tenant_id: user.tenantId!,
    season_id,
    released_by: user.id,
    executed_at: nowIso,
    students_placed: studentsPlaced,
  });

  return NextResponse.json({
    message: `Released ${stagedIds.length} placements for ${studentsPlaced} students`,
  });
}
