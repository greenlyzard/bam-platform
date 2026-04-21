import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { SeasonsManager } from "./seasons-manager";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  const { data } = await supabase
    .from("seasons")
    .select(
      "id, name, start_date, end_date, period, year, is_active, is_public, is_ongoing, registration_open, display_priority"
    )
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

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
          Seasons
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage studio seasons and registration windows.
        </p>
      </div>
      <SeasonsManager initialSeasons={data ?? []} />
    </div>
  );
}
