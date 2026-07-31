import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationLabelRef } from "./resolve";

/**
 * Fetch the label fields for a set of locations, keyed by `studio_locations.id`.
 *
 * Exists because `formatRoomLabel` is pure and takes an already-resolved
 * location, so roughly a dozen surfaces each need the same two columns for the
 * same set of ids. One helper, so no surface is tempted to derive a short label
 * from the name instead (LOCATIONS_AND_FACILITIES.md §4.1 forbids that).
 *
 * Nulls and duplicates in `locationIds` are fine — they are filtered and
 * de-duplicated here. An empty set skips the query entirely.
 *
 * A missing id is simply absent from the map; callers should treat that as "no
 * location" and fall back to the bare room name rather than guessing a studio.
 */
export async function fetchLocationLabels(
  supabase: SupabaseClient,
  locationIds: Array<string | null | undefined>
): Promise<Record<string, LocationLabelRef>> {
  const ids = [...new Set(locationIds.filter(Boolean) as string[])];
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("studio_locations")
    .select("id, name, abbreviation")
    .in("id", ids);

  const map: Record<string, LocationLabelRef> = {};
  for (const l of data ?? []) {
    map[l.id] = { name: l.name, abbreviation: l.abbreviation };
  }
  return map;
}
