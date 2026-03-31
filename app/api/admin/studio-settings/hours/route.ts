import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { locationId, tenantId, hours } = await req.json();

    if (!locationId || !tenantId || !Array.isArray(hours)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Upsert all 7 days
    const rows = hours.map((h: { day_of_week: number; is_open: boolean; open_time: string | null; close_time: string | null; notes: string | null }) => ({
      tenant_id: tenantId,
      location_id: locationId,
      day_of_week: h.day_of_week,
      is_open: h.is_open,
      open_time: h.is_open ? h.open_time : null,
      close_time: h.is_open ? h.close_time : null,
      notes: h.notes || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await admin
      .from("location_hours")
      .upsert(rows, { onConflict: "location_id,day_of_week" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
