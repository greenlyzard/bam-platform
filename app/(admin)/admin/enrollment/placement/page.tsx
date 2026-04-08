import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementBoard } from "./placement-board";

export const metadata = {
  title: "Pre-Placement — Admin",
  description: "Stage and release season placements for active students.",
};

export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const { season: seasonParam } = await searchParams;

  const supabase = createAdminClient();

  // Fetch active seasons
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name")
    .order("created_at", { ascending: false });

  const seasonId = seasonParam ?? seasons?.[0]?.id ?? null;

  // Fetch active students
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, current_level, date_of_birth")
    .eq("active", true)
    .order("first_name");

  // Fetch active classes for assignment dropdowns
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, levels, max_enrollment, enrolled_count, day_of_week, start_time, end_time")
    .eq("is_active", true)
    .eq("is_hidden", false)
    .eq("is_rehearsal", false)
    .order("name");

  // Fetch existing staged placements for this season
  let placements: Array<{
    id: string;
    student_id: string;
    class_id: string;
    status: string;
    placement_notes: string | null;
  }> = [];
  if (seasonId) {
    const { data } = await supabase
      .from("season_placements")
      .select("id, student_id, class_id, status, placement_notes")
      .eq("season_id", seasonId);
    placements = data ?? [];
  }

  // Fetch active bundle configs
  const { data: bundles } = await supabase
    .from("bundle_configs")
    .select("id, name, trigger_type, trigger_value, discount_type, discount_value")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <PlacementBoard
      seasons={seasons ?? []}
      seasonId={seasonId}
      students={students ?? []}
      classes={classes ?? []}
      placements={placements}
      bundles={bundles ?? []}
    />
  );
}
