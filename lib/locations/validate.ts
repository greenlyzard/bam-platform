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

/**
 * Class-level Location filter (admin class list, spec §6 admin). No selection
 * (null/empty) passes every class; a selected location id matches only classes whose
 * home `location_id` equals it. Selecting a location with no classes (e.g. RSM today)
 * yields an empty result set — the caller renders its normal "no classes" state.
 */
export function matchesLocationFilter(
  classLocationId: string | null | undefined,
  selectedLocationId: string | null | undefined,
): boolean {
  if (!selectedLocationId) return true;
  return classLocationId === selectedLocationId;
}

/**
 * Derive the parent-catalog Location filter options from the classes a parent can
 * actually SEE (spec §6 parent / §7 launch gating). Options are the DISTINCT home
 * locations present among the given visible classes — so a studio with no visible
 * classes (e.g. RSM today) never appears, and partner_venue/internal never appear
 * (they can't be class homes). Sorted by name. Callers should render the filter only
 * when 2+ options exist (a single-studio filter is noise — "single-studio collapse").
 */
export function deriveLocationOptionsFromClasses(
  classes: ReadonlyArray<{ locationId: string | null; locationName: string | null }>,
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();
  for (const c of classes) {
    if (c.locationId && !byId.has(c.locationId)) {
      byId.set(c.locationId, c.locationName ?? c.locationId);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
