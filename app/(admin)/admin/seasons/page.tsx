import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SeasonManagement } from "./season-management";

export default async function SeasonsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Fetch all seasons for this tenant
  const { data: seasonRows } = await supabase
    .from("seasons")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("display_priority", { ascending: true });

  const seasons = (seasonRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    program_type_id: s.program_type_id,
    start_date: s.start_date,
    end_date: s.end_date,
    is_ongoing: s.is_ongoing ?? false,
    is_active: s.is_active,
    registration_open: s.registration_open,
    display_priority: s.display_priority ?? 0,
    created_at: s.created_at,
  }));

  // Fetch class counts per season
  const seasonIds = seasons.map((s) => s.id);
  const { data: classRows } =
    seasonIds.length > 0
      ? await supabase
          .from("classes")
          .select("id, season_id")
          .in("season_id", seasonIds)
      : { data: [] };

  const classCounts: Record<string, number> = {};
  for (const c of classRows ?? []) {
    if (c.season_id) {
      classCounts[c.season_id] = (classCounts[c.season_id] ?? 0) + 1;
    }
  }

  // Fetch program types for this tenant
  const { data: programTypeRows } = await supabase
    .from("tenant_program_types")
    .select("id, name, slug, color, is_public, is_active")
    .eq("tenant_id", user.tenantId!)
    .eq("is_active", true)
    .order("display_order");

  const programTypes = (programTypeRows ?? []).map((pt) => ({
    id: pt.id,
    name: pt.name,
    slug: pt.slug,
    color: pt.color,
    is_public: pt.is_public,
  }));

  return (
    <SeasonManagement
      seasons={seasons}
      classCounts={classCounts}
      programTypes={programTypes}
      tenantId={user.tenantId!}
    />
  );
}
