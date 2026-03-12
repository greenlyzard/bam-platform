import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ResourceSettings } from "./resource-settings";

export default async function ResourceSettingsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return (
      <div className="p-8 text-center text-slate">
        Tenant not configured.
      </div>
    );
  }

  const [hoursResult, roomsResult] = await Promise.all([
    supabase
      .from("studio_hours")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("day_of_week"),
    supabase
      .from("rooms")
      .select("id, name, capacity, hourly_rate_private")
      .eq("tenant_id", tenant.id)
      .eq("is_bookable", true)
      .order("name"),
  ]);

  const hours = hoursResult.data ?? [];
  const rooms = roomsResult.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Resource Settings
        </h1>
        <p className="mt-1 text-sm text-slate">
          Configure studio hours, room rates, and recommendation thresholds.
        </p>
      </div>

      <ResourceSettings hours={hours} rooms={rooms} />
    </div>
  );
}
