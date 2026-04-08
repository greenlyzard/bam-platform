import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executePlacementRelease } from "@/lib/placements/release";

export async function GET(req: Request) {
  // CRON_SECRET protection
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find scheduled releases that are due
  const { data: due, error } = await supabase
    .from("season_placement_releases")
    .select("id, tenant_id, season_id, released_by, scheduled_for")
    .lte("scheduled_for", nowIso)
    .is("executed_at", null)
    .not("scheduled_for", "is", null);

  if (error) {
    console.error("[cron:scheduled-releases]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    release_id: string;
    season_id: string;
    released: number;
    families_notified: number;
    emails_sent: number;
  }> = [];

  for (const row of due ?? []) {
    try {
      const result = await executePlacementRelease({
        seasonId: row.season_id,
        tenantId: row.tenant_id,
        releasedBy: row.released_by,
        logEvent: false, // we update the existing scheduled row instead
      });

      // Mark this scheduled release as executed
      await supabase
        .from("season_placement_releases")
        .update({
          executed_at: nowIso,
          families_notified: result.familiesNotified,
          students_placed: result.studentsPlaced,
        })
        .eq("id", row.id);

      results.push({
        release_id: row.id,
        season_id: row.season_id,
        released: result.released,
        families_notified: result.familiesNotified,
        emails_sent: result.emailsSent,
      });
    } catch (e) {
      console.error(`[cron:scheduled-releases] failed for release ${row.id}:`, e);
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
