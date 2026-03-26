import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ClassFieldSettings } from "./class-field-settings";

export default async function ClassFieldsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: fields } = await supabase
    .from("class_field_config")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Settings
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Class Field Visibility
        </h1>
        <p className="mt-1 text-sm text-mist">
          Control which class fields are visible on each portal. Core fields
          cannot be hidden from admin views.
        </p>
      </div>

      <ClassFieldSettings fields={fields ?? []} tenantId={user.tenantId!} />
    </div>
  );
}
