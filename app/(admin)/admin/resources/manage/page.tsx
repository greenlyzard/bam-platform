import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ResourceManagement } from "./resource-management";

export default async function ResourceManagePage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Fetch locations for this tenant
  const { data: locationRows } = await supabase
    .from("studio_locations")
    .select("id, name, address, city, state, zip, is_primary, is_active")
    .eq("tenant_id", user.tenantId!)
    .order("sort_order")
    .order("name");

  const locations = (locationRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    state: l.state,
    zip: l.zip,
    is_primary: l.is_primary,
    is_active: l.is_active,
  }));

  // Fetch resources for this tenant
  const { data: resourceRows } = await supabase
    .from("studio_resources")
    .select("id, name, type, location_id, is_portable, color, capacity, description, is_active, sort_order")
    .eq("tenant_id", user.tenantId!)
    .order("sort_order")
    .order("name");

  const resources = (resourceRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    location_id: r.location_id,
    is_portable: r.is_portable,
    color: r.color,
    capacity: r.capacity,
    description: r.description,
    is_active: r.is_active,
    sort_order: r.sort_order,
  }));

  return (
    <ResourceManagement
      locations={locations}
      resources={resources}
      tenantId={user.tenantId!}
    />
  );
}
