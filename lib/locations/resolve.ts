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

/**
 * The subset of a `studio_locations` row needed to *label* it — the short form
 * that hangs off a room name in UI chrome. Deliberately narrower than
 * `LocationRef`: a caller that only needs a label should only have to select
 * these two columns.
 */
export type LocationLabelRef = Pick<StudioLocationRow, "name" | "abbreviation">;

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

/** The subset of a `studio_locations` row needed to render a mailing address. */
export type LocationAddressRef = Pick<
  StudioLocationRow,
  "address" | "city" | "state" | "zip"
>;

/** Formats a studio location's parts into one line: "addr, City, ST ZIP" (parts omitted if absent). */
export function formatLocationAddress(loc: LocationAddressRef): string {
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
 * Separator between a room name and its location: "Studio 1 · RSM".
 *
 * Space-middot-space is the established separator for inline metadata across
 * the portal (schedule views, class catalog, timesheets, teacher schedule).
 * This is that same convention, not a new one.
 */
export const ROOM_LOCATION_SEPARATOR = " · ";

/**
 * The short form of a location: its `abbreviation` when it has one, otherwise
 * its full `name`. Returns null when there is no location, or when neither
 * field carries text.
 *
 * `abbreviation` is nullable **by design** — only the two `studio` rows have
 * one (SC, RSM); partner venues and internal sites deliberately do not. Null is
 * "no established short form", not missing data, and the fallback is the whole
 * name.
 *
 * This NEVER derives a short form by splitting the name on punctuation. That
 * behaviour existed before `studio_locations.abbreviation` did (migration
 * 20260731000001) and is not kept as a fallback: "Ballet Academy and Movement —
 * San Clemente" yielding "San Clemente" was a coincidence of someone typing an
 * em dash, and it breaks silently on rename.
 */
export function locationShortLabel(
  location: LocationLabelRef | null | undefined,
): string | null {
  if (!location) return null;
  if (hasText(location.abbreviation)) return location.abbreviation.trim();
  if (hasText(location.name)) return location.name.trim();
  return null;
}

export type RoomLabelOptions = {
  /**
   * True when the view is scoped to exactly one location — a location filter is
   * applied. The caller collapses "a filter is set" and "only one location is in
   * view" into this single flag before calling.
   */
  locationFilterActive: boolean;
};

/**
 * The display label for a room, per the rule decided 2026-07-31:
 *
 *   - Location filter ACTIVE  -> bare room name. The user has already said which
 *     studio they are looking at; repeating it on every column is noise.
 *   - No filter (or more than one location in view) -> always append the
 *     location: "Studio 1 · RSM".
 *   - Room with no location -> bare name. No separator, no "Unassigned" suffix.
 *
 * Predictable within a view, quiet once filtered.
 *
 * The suffix depends ONLY on whether the view is filtered — never on whether two
 * visible rooms happen to share a name. A label that changes because an
 * unrelated row scrolled into view is disorienting, and it makes the same room
 * read differently on two screens.
 *
 * Pure: no I/O, no lookups. Pass the already-resolved location.
 */
export function formatRoomLabel(
  roomName: string,
  location: LocationLabelRef | null | undefined,
  { locationFilterActive }: RoomLabelOptions,
): string {
  const room = roomName.trim();
  if (locationFilterActive) return room;

  const locationLabel = locationShortLabel(location);
  if (locationLabel === null) return room;
  if (room === "") return locationLabel;

  return `${room}${ROOM_LOCATION_SEPARATOR}${locationLabel}`;
}

/**
 * The subset of a `studio_locations` row needed for a calendar `LOCATION` field:
 * the full name plus every address part. Deliberately wider than
 * `LocationLabelRef` — see `formatCalendarLocation`.
 */
export type CalendarLocationRef = Pick<
  StudioLocationRow,
  "name" | "address" | "city" | "state" | "zip"
>;

/**
 * The `LOCATION` value for a calendar event — the ICS subscription feed, a
 * downloaded .ics, and the Google Calendar "add event" link.
 *
 * **Deliberately not `formatRoomLabel`.** That helper is for UI chrome, where a
 * person is scanning a list and `abbreviation` is exactly the point. A calendar
 * app treats `LOCATION` as free text it may hand to a map for directions, so
 * "RSM" is worthless there and the street address is the whole value:
 *
 *   "Studio 1, Ballet Academy and Movement — San Clemente, 400-C Camino De Estrella, San Clemente, CA 92672"
 *
 * When the location is unknown this returns the bare room name and nothing else.
 * It never names a studio it cannot substantiate — the hardcoded
 * `" - Ballet Academy and Movement"` suffix it replaces did exactly that, and
 * would have put the wrong studio on every RSM event a parent had synced.
 *
 * Callers are responsible for `LOCATION`-field escaping: the comma separators
 * here are literal text and must be escaped per RFC 5545 before being written
 * into an ICS body (a URL-encoded query param, as in the Google link, does not
 * need it).
 *
 * Pure: no I/O. Pass the already-resolved location.
 */
export function formatCalendarLocation(
  roomName: string | null | undefined,
  location: CalendarLocationRef | null | undefined,
): string {
  const parts: string[] = [];
  if (hasText(roomName)) parts.push(roomName.trim());
  if (location) {
    if (hasText(location.name)) parts.push(location.name.trim());
    const address = formatLocationAddress(location);
    if (address !== "") parts.push(address);
  }
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
