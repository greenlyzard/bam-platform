import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { LevelsAndProgramsManager } from "./levels-manager";

export const dynamic = "force-dynamic";

export default async function LevelsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  // Fetch levels from the new studio_levels table
  const { data: levelsData } = await supabase
    .from("studio_levels")
    .select("id, name, description, parent_id, age_min, age_max, sort_order, is_active, color_hex")
    .eq("tenant_id", tenantId)
    .order("sort_order");

  // Fetch programs
  const { data: programsData } = await supabase
    .from("studio_programs")
    .select("id, name, description, color_hex, requires_audition, has_contract, sort_order, is_active")
    .eq("tenant_id", tenantId)
    .order("sort_order");

  const programIds = (programsData ?? []).map((p) => p.id);
  const { data: eligibles } = programIds.length
    ? await supabase
        .from("program_eligible_levels")
        .select("program_id, level_id")
        .in("program_id", programIds)
    : { data: [] };

  const eligMap: Record<string, string[]> = {};
  for (const e of eligibles ?? []) {
    if (!eligMap[e.program_id]) eligMap[e.program_id] = [];
    eligMap[e.program_id].push(e.level_id);
  }

  const programs = (programsData ?? []).map((p) => ({
    ...p,
    eligible_level_ids: eligMap[p.id] ?? [],
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Settings
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Levels & Programs
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage class levels, display order, and sub-brand programs.
        </p>
      </div>
      <LevelsAndProgramsManager
        initialLevels={levelsData ?? []}
        initialPrograms={programs}
      />
    </div>
  );
}
