import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { HoursManager } from "./hours-manager";

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";

export default async function BusinessHoursPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: locations }, { data: hours }] = await Promise.all([
    supabase
      .from("studio_locations")
      .select("id, name, is_primary, is_active")
      .eq("tenant_id", TENANT_ID)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("location_hours")
      .select("id, location_id, day_of_week, is_open, open_time, close_time, notes")
      .eq("tenant_id", TENANT_ID)
      .order("day_of_week"),
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
          Business Hours
        </h1>
        <p className="mt-1 text-sm text-mist">
          Set operating hours for each studio location.
        </p>
      </div>
      <HoursManager
        locations={locations ?? []}
        initialHours={hours ?? []}
        tenantId={TENANT_ID}
      />
    </div>
  );
}
