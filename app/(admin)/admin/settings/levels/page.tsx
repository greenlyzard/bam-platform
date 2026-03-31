import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { LevelsManager } from "./levels-manager";

export default async function LevelsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from("studio_settings")
    .select("custom_colors")
    .single();

  const levelList: string[] =
    (settings?.custom_colors as Record<string, unknown>)?.level_list as string[] ?? [];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Settings
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Levels
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage class level names and display order.
        </p>
      </div>
      <LevelsManager initialLevels={levelList} />
    </div>
  );
}
