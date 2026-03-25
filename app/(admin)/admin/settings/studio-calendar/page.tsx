import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { StudioCalendarManager } from "./studio-calendar-manager";

export default async function StudioCalendarPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: closures } = await supabase
    .from("studio_closures")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("closed_date", { ascending: true });

  // Get classes with date ranges for overlap warnings
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, start_date, end_date, days_of_week")
    .eq("is_active", true);

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
          Studio Calendar
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage studio closure dates. Classes scheduled on closure dates will be
          automatically flagged.
        </p>
      </div>

      <StudioCalendarManager
        initialData={closures ?? []}
        classes={classes ?? []}
        tenantId={user.tenantId!}
      />
    </div>
  );
}
