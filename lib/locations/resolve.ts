import type { Database } from "@/types/database.types";

// Location resolver — LOCATIONS_AND_FACILITIES.md §4.
// Pure/deterministic: no I/O. Callers pass a `lookupLocation` backed by pre-fetched
// studio_locations rows (or a fetch layer) so this stays unit-testable.

type StudioLocationRow = Database["public"]["Tables"]["studio_locations"]["Row"];
type ScheduleInstanceRow = Database["public"]["Tables"]["schedule_instances"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

/** The subset of a `studio_locations` row this resolver needs to render a location. */
export type LocationRef = Pick<
  StudioLocationRow,
  "id" | "name" | "address" | "city" | "state" | "zip"
>;

/** The subset of a `schedule_instances` row that determines its location. */
export type InstanceLocationFields = Pick<
  ScheduleInstanceRow,
  "location_id" | "venue_name" | "venue_address"
>;

/** The subset of a `classes` row that determines its home location. */
export type ClassLocationFields = Pick<ClassRow, "location_id">;

/**
 * Resolves a `studio_locations` row by id; returns null/undefined if unknown.
 * Back it with pre-fetched rows (e.g. a Map) or a fetch layer — the resolver never
 * performs I/O itself.
 */
export type LocationLookup = (id: string) => LocationRef | null | undefined;

/** Discriminated result of resolving where a schedule instance actually happens. */
export type ResolvedLocation =
  | {
      kind: "external";
      /** A one-off external venue — never a studio_locations row, so always relocated. */
      relocated: true;
      name: string;
      address: string | null;
      displayName: string;
      displayAddress: string;
    }
  | {
      kind: "studio_location";
      /** This instance overrides to a specific studio location. */
      relocated: boolean;
      location: LocationRef | null;
      displayName: string;
      displayAddress: string;
    }
  | {
      kind: "inherited";
      /** No override — inherits the class's home studio; by definition not relocated. */
      relocated: false;
      location: LocationRef | null;
      displayName: string;
      displayAddress: string;
    };

function hasText(value: string | null | undefined): value is string {
  return value != null && value.trim() !== "";
}

/** Formats a studio location's parts into one line: "addr, City, ST ZIP" (parts omitted if absent). */
export function formatLocationAddress(loc: LocationRef): string {
  const parts: string[] = [];
  if (hasText(loc.address)) parts.push(loc.address.trim());
  const cityState = [loc.city, loc.state].filter(hasText).join(", ");
  const cityStateZip = [cityState, hasText(loc.zip) ? loc.zip.trim() : ""]
    .filter((s) => s !== "")
    .join(" ");
  if (cityStateZip !== "") parts.push(cityStateZip);
  return parts.join(", ");
}

/**
 * Resolve the effective location of a single schedule instance, per
 * LOCATIONS_AND_FACILITIES.md §4. Resolution order:
 *   1. instance.venue_name set  -> external one-off  (venue_name / venue_address)
 *   2. instance.location_id set -> that studio_location (override)
 *   3. otherwise                -> inherit the class's home location_id
 *
 * `relocated` is true when the resolved location differs from the class's home
 * (`klass.location_id`): always true for an external venue, true for an override to a
 * different studio, false for an override to the same studio, and false when inherited.
 */
export function resolveInstanceLocation(
  instance: InstanceLocationFields,
  klass: ClassLocationFields,
  lookupLocation: LocationLookup,
): ResolvedLocation {
  const homeLocationId = klass.location_id;

  // 1. External one-off venue (free text takes precedence).
  if (hasText(instance.venue_name)) {
    const name = instance.venue_name.trim();
    const address = hasText(instance.venue_address)
      ? instance.venue_address.trim()
      : null;
    return {
      kind: "external",
      relocated: true,
      name,
      address,
      displayName: name,
      displayAddress: address ?? "",
    };
  }

  // 2. Instance-level override to a specific studio location.
  if (hasText(instance.location_id)) {
    const location = lookupLocation(instance.location_id) ?? null;
    return {
      kind: "studio_location",
      relocated: instance.location_id !== homeLocationId,
      location,
      displayName: location?.name ?? "",
      displayAddress: location ? formatLocationAddress(location) : "",
    };
  }

  // 3. Inherit the class's home studio.
  const location = hasText(homeLocationId)
    ? lookupLocation(homeLocationId) ?? null
    : null;
  return {
    kind: "inherited",
    relocated: false,
    location,
    displayName: location?.name ?? "",
    displayAddress: location ? formatLocationAddress(location) : "",
  };
}
