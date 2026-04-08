import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { executePlacementRelease } from "@/lib/placements/release";

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { season_id, action, scheduled_for } = body ?? {};

  if (!season_id || (action !== "stage" && action !== "release" && action !== "schedule")) {
    return NextResponse.json(
      { error: "season_id and action ('stage'|'release'|'schedule') are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "stage") {
    const { count } = await supabase
      .from("season_placements")
      .select("id", { count: "exact", head: true })
      .eq("season_id", season_id)
      .eq("status", "staged");
    return NextResponse.json({ message: `${count ?? 0} placements staged` });
  }

  if (action === "schedule") {
    if (!scheduled_for) {
      return NextResponse.json({ error: "scheduled_for is required" }, { status: 400 });
    }
    await supabase.from("season_placement_releases").insert({
      tenant_id: user.tenantId!,
      season_id,
      released_by: user.id,
      scheduled_for,
    });
    return NextResponse.json({
      message: `Release scheduled for ${new Date(scheduled_for).toLocaleString()}`,
    });
  }

  // action === "release"
  const result = await executePlacementRelease({
    seasonId: season_id,
    tenantId: user.tenantId!,
    releasedBy: user.id,
    logEvent: true,
  });

  if (result.released === 0) {
    return NextResponse.json({ message: "No staged placements to release" });
  }

  return NextResponse.json({
    message: `Released ${result.released} placements for ${result.studentsPlaced} students. Notified ${result.familiesNotified} families (${result.emailsSent} emails sent).`,
    families_notified: result.familiesNotified,
    students_placed: result.studentsPlaced,
    emails_sent: result.emailsSent,
  });
}
