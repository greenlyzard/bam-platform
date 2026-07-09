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

// ── Single-instance override rules (spec §4) ─────────────────────────────────

/**
 * Location types eligible as a per-instance override target: `studio` and
 * `partner_venue`. `internal` is never eligible (non-teaching sites never appear
 * on schedules). Use this to build the override location picker's option list.
 */
export const OVERRIDE_ELIGIBLE_LOCATION_TYPES: readonly LocationType[] = [
  "studio",
  "partner_venue",
];

/**
 * Whether a location may be used as a single-instance override target:
 * studio + partner_venue allowed, internal rejected.
 */
export function isOverrideEligibleLocationType(type: LocationType): boolean {
  return OVERRIDE_ELIGIBLE_LOCATION_TYPES.includes(type);
}

/**
 * A schedule instance's location override may set EITHER a studio_locations
 * `location_id` OR a free-text `venue_name` — never both (they are mutually
 * exclusive; spec §4). Returns false only when both are set; "neither" (inherit
 * the class home) and "exactly one" are both valid. Empty/whitespace counts as unset.
 */
export function isValidLocationVenueXor(
  locationId: string | null | undefined,
  venueName: string | null | undefined,
): boolean {
  return !(hasText(locationId) && hasText(venueName));
}

function hasText(value: string | null | undefined): boolean {
  return value != null && value.trim() !== "";
}
