import type { Database } from "@/types/database.types";

/** The `location_type` enum from the live schema (studio | partner_venue | internal). */
export type LocationType = Database["public"]["Enums"]["location_type"];

/** Labels for each location type — single source of truth for the admin selectors. */
export const LOCATION_TYPE_OPTIONS: ReadonlyArray<{
  value: LocationType;
  label: string;
}> = [
  { value: "studio", label: "Teaching studio" },
  { value: "partner_venue", label: "Partner venue (events/rehearsals)" },
  { value: "internal", label: "Internal / non-teaching" },
];

/**
 * A class's home location must be a `studio`-type location (spec §4/§6):
 * partner_venue / internal are never valid class homes (they are only reachable
 * per-instance via the Step 4b override). A null/empty selection is allowed (no home).
 *
 * `studioLocationIds` is the set of ids of location_type='studio' locations.
 */
export function isValidClassHomeLocation(
  locationId: string | null | undefined,
  studioLocationIds: ReadonlySet<string>,
): boolean {
  if (!locationId) return true;
  return studioLocationIds.has(locationId);
}
