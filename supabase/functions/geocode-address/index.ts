// Supabase Edge Function stub: geocode-address
// Accepts an address payload and geocodes it via Nominatim, then updates lat/lng.
//
// Deploy: npx supabase functions deploy geocode-address
// Invoke: supabase.functions.invoke('geocode-address', { body: {...} })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GeoRequest {
  address_line_1: string;
  city: string;
  state: string;
  zip_code: string;
  table: "students" | "profiles";
  record_id: string;
}

serve(async (req) => {
  const { address_line_1, city, state, zip_code, table, record_id } =
    (await req.json()) as GeoRequest;

  if (!table || !record_id) {
    return new Response(JSON.stringify({ error: "Missing table or record_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (table !== "students" && table !== "profiles") {
    return new Response(JSON.stringify({ error: "Invalid table" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parts = [address_line_1, city, state, zip_code].filter(Boolean);
  const addressQuery = parts.join(", ");

  if (!addressQuery) {
    return new Response(JSON.stringify({ error: "No address provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Geocode via Nominatim
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&limit=1`;
  const geoRes = await fetch(url, {
    headers: { "User-Agent": "BAMPlatform/1.0 (dance@bamsocal.com)" },
  });

  if (!geoRes.ok) {
    return new Response(JSON.stringify({ error: "Geocoding service error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await geoRes.json();
  if (!results || results.length === 0) {
    return new Response(JSON.stringify({ geocoded: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const latitude = parseFloat(results[0].lat);
  const longitude = parseFloat(results[0].lon);

  // Update the record
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase
    .from(table)
    .update({ latitude, longitude })
    .eq("id", record_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ geocoded: true, latitude, longitude }), {
    headers: { "Content-Type": "application/json" },
  });
});
