import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudioSettingsClient } from "./studio-settings-client";

export default async function StudioSettingsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: studioSettings } = await supabase
    .from("studio_settings")
    .select("*")
    .single();

  const { data: locations } = await supabase
    .from("studio_locations")
    .select("*")
    .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
    .order("sort_order");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, capacity, is_bookable, is_active, color_hex, location_id, notes")
    .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
    .order("name");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          &larr; Settings
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Studio Profile
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage your studio identity, locations, and rooms.
        </p>
      </div>

      <StudioSettingsClient
        studioSettings={studioSettings}
        locations={locations ?? []}
        rooms={rooms ?? []}
      />
    </div>
  );
}
