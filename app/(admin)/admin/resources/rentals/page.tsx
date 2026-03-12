import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { RentalsList } from "./rentals-list";

export default async function RentalsPage() {
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

  // Fetch rentals and rooms in parallel
  const [rentalsResult, roomsResult] = await Promise.all([
    supabase
      .from("room_rentals")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("start_time", { ascending: false }),
    supabase
      .from("rooms")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("is_bookable", true)
      .order("name"),
  ]);

  const rentals = rentalsResult.data ?? [];
  const rooms = roomsResult.data ?? [];

  // Build room name map
  const roomNames: Record<string, string> = {};
  for (const r of rooms) {
    roomNames[r.id] = r.name;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Room Rental Manager
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage room rental inquiries, bookings, and track revenue.
        </p>
      </div>

      <RentalsList
        rentals={rentals}
        rooms={rooms}
        roomNames={roomNames}
      />
    </div>
  );
}
