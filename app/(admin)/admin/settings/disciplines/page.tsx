import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DisciplinesManager } from "./disciplines-manager";

export default async function DisciplinesPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Settings
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Disciplines
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage the dance disciplines offered at your studio. Deactivating a
          discipline hides it from new class assignments but preserves existing
          records.
        </p>
      </div>

      <DisciplinesManager
        initialData={disciplines ?? []}
        tenantId={user.tenantId!}
      />
    </div>
  );
}
