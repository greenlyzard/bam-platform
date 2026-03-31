import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { DisciplinesManager } from "./disciplines-manager";

export default async function DisciplinesPage() {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: disciplines }, { data: iconLibrary }] = await Promise.all([
    supabase
      .from("disciplines")
      .select("id, name, description, icon_id, is_active, sort_order")
      .eq("tenant_id", user.tenantId!)
      .order("sort_order", { ascending: true }),
    supabase
      .from("icon_library")
      .select("id, name, icon_url, category")
      .eq("category", "discipline")
      .eq("is_active", true)
      .order("name"),
  ]);

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
        initialData={(disciplines ?? []).map(d => ({ ...d, icon_id: d.icon_id ?? null }))}
        tenantId={user.tenantId!}
        iconLibrary={(iconLibrary ?? []).map(i => ({ id: i.id, name: i.name, icon_url: i.icon_url }))}
      />
    </div>
  );
}
