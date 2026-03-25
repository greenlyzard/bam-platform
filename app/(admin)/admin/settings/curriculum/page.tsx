import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CurriculumManager } from "./curriculum-manager";

export default async function CurriculumPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: curriculum } = await supabase
    .from("dance_curriculum")
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
          Curriculum
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage teaching methodologies and curriculum styles. A class can
          reference one or more curricula.
        </p>
      </div>

      <CurriculumManager
        initialData={curriculum ?? []}
        tenantId={user.tenantId!}
      />
    </div>
  );
}
