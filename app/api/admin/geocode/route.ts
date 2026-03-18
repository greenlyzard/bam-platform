import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/geocode
 * Geocodes an address via OpenStreetMap Nominatim and updates lat/lng.
 * Rate-limited: 1 request per second (Nominatim usage policy).
 */

let lastCallTime = 0;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { table, record_id, address_line_1, city, state, zip_code } = body;

  if (!table || !record_id) {
    return NextResponse.json({ error: "Missing table or record_id" }, { status: 400 });
  }

  if (!address_line_1 && !city && !zip_code) {
    return NextResponse.json({ error: "No address provided" }, { status: 400 });
  }

  // Only allow updating students or profiles tables
  if (table !== "students" && table !== "profiles") {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  // Rate limit: 1 second between calls
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastCallTime = Date.now();

  // Build address string
  const parts = [address_line_1, city, state, zip_code].filter(Boolean);
  const addressQuery = parts.join(", ");

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BAMPlatform/1.0 (dance@bamsocal.com)",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding service error" }, { status: 502 });
    }

    const results = await res.json();
    if (!results || results.length === 0) {
      return NextResponse.json({ geocoded: false, message: "No results found" });
    }

    const { lat, lon } = results[0];
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    const { error } = await supabase
      .from(table)
      .update({ latitude, longitude })
      .eq("id", record_id);

    if (error) {
      console.error("[geocode:update]", error);
      return NextResponse.json({ error: "Failed to update coordinates" }, { status: 500 });
    }

    return NextResponse.json({ geocoded: true, latitude, longitude });
  } catch (e) {
    console.error("[geocode:fetch]", e);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
