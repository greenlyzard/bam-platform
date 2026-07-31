import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInstanceLocation,
  formatLocationAddress,
  formatCalendarLocation,
  formatRoomLabel,
  locationShortLabel,
  ROOM_LOCATION_SEPARATOR,
  type LocationRef,
  type LocationLabelRef,
  type LocationLookup,
  type InstanceLocationFields,
  type ClassLocationFields,
} from "./resolve.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const SAN_CLEMENTE: LocationRef = {
  id: "loc-sc",
  name: "Ballet Academy and Movement — San Clemente",
  address: "400-C Camino De Estrella",
  city: "San Clemente",
  state: "CA",
  zip: "92672",
};

const RSM: LocationRef = {
  id: "loc-rsm",
  name: "Ballet Academy and Movement — Rancho Santa Margarita",
  address: null,
  city: "Rancho Santa Margarita",
  state: "CA",
  zip: null,
};

const locations = new Map<string, LocationRef>([
  [SAN_CLEMENTE.id, SAN_CLEMENTE],
  [RSM.id, RSM],
]);
const lookup: LocationLookup = (id) => locations.get(id) ?? null;

function instance(fields: Partial<InstanceLocationFields>): InstanceLocationFields {
  return { location_id: null, venue_name: null, venue_address: null, ...fields };
}
function klass(location_id: string | null): ClassLocationFields {
  return { location_id };
}

// ── 1. External one-off ──────────────────────────────────────────────────────
test("branch 1: external venue when venue_name is set", () => {
  const r = resolveInstanceLocation(
    instance({
      venue_name: "San Juan Hills HS Theater",
      venue_address: "29211 Stallion Ridge, San Juan Capistrano, CA 92675",
      // location_id also set to prove venue_name takes precedence:
      location_id: "loc-rsm",
    }),
    klass("loc-sc"),
    lookup,
  );
  assert.equal(r.kind, "external");
  if (r.kind !== "external") return;
  assert.equal(r.name, "San Juan Hills HS Theater");
  assert.equal(r.address, "29211 Stallion Ridge, San Juan Capistrano, CA 92675");
  assert.equal(r.displayName, "San Juan Hills HS Theater");
  assert.equal(r.displayAddress, "29211 Stallion Ridge, San Juan Capistrano, CA 92675");
  assert.equal(r.relocated, true); // external is always relocated
});

test("branch 1: external venue with no address -> displayAddress empty, address null", () => {
  const r = resolveInstanceLocation(
    instance({ venue_name: "Community Center" }),
    klass("loc-sc"),
    lookup,
  );
  assert.equal(r.kind, "external");
  if (r.kind !== "external") return;
  assert.equal(r.address, null);
  assert.equal(r.displayAddress, "");
  assert.equal(r.relocated, true);
});

// ── 2. Studio-location override ──────────────────────────────────────────────
test("branch 2: override to a DIFFERENT studio -> relocated true", () => {
  const r = resolveInstanceLocation(
    instance({ location_id: "loc-rsm" }),
    klass("loc-sc"),
    lookup,
  );
  assert.equal(r.kind, "studio_location");
  if (r.kind !== "studio_location") return;
  assert.equal(r.location?.id, "loc-rsm");
  assert.equal(r.displayName, RSM.name);
  assert.equal(r.displayAddress, "Rancho Santa Margarita, CA");
  assert.equal(r.relocated, true);
});

test("branch 2: override to the SAME studio as home -> relocated false", () => {
  const r = resolveInstanceLocation(
    instance({ location_id: "loc-sc" }),
    klass("loc-sc"),
    lookup,
  );
  assert.equal(r.kind, "studio_location");
  if (r.kind !== "studio_location") return;
  assert.equal(r.displayName, SAN_CLEMENTE.name);
  assert.equal(r.displayAddress, "400-C Camino De Estrella, San Clemente, CA 92672");
  assert.equal(r.relocated, false);
});

test("branch 2: override id unknown to lookup -> location null, empty displays, still relocated", () => {
  const r = resolveInstanceLocation(
    instance({ location_id: "loc-unknown" }),
    klass("loc-sc"),
    lookup,
  );
  assert.equal(r.kind, "studio_location");
  if (r.kind !== "studio_location") return;
  assert.equal(r.location, null);
  assert.equal(r.displayName, "");
  assert.equal(r.displayAddress, "");
  assert.equal(r.relocated, true); // "loc-unknown" !== "loc-sc"
});

// ── 3. Inherited home ────────────────────────────────────────────────────────
test("branch 3: inherits class home when no override -> relocated false", () => {
  const r = resolveInstanceLocation(instance({}), klass("loc-sc"), lookup);
  assert.equal(r.kind, "inherited");
  if (r.kind !== "inherited") return;
  assert.equal(r.location?.id, "loc-sc");
  assert.equal(r.displayName, SAN_CLEMENTE.name);
  assert.equal(r.displayAddress, "400-C Camino De Estrella, San Clemente, CA 92672");
  assert.equal(r.relocated, false);
});

test("branch 3: class has no home location -> inherited with null location", () => {
  const r = resolveInstanceLocation(instance({}), klass(null), lookup);
  assert.equal(r.kind, "inherited");
  if (r.kind !== "inherited") return;
  assert.equal(r.location, null);
  assert.equal(r.displayName, "");
  assert.equal(r.displayAddress, "");
  assert.equal(r.relocated, false);
});

// ── relocated flag: both directions, explicit (spec requirement) ─────────────
test("relocated: false when resolved == home; true when resolved != home", () => {
  const same = resolveInstanceLocation(instance({ location_id: "loc-sc" }), klass("loc-sc"), lookup);
  const diff = resolveInstanceLocation(instance({ location_id: "loc-rsm" }), klass("loc-sc"), lookup);
  const inherited = resolveInstanceLocation(instance({}), klass("loc-sc"), lookup);
  const external = resolveInstanceLocation(instance({ venue_name: "Elsewhere" }), klass("loc-sc"), lookup);
  assert.equal(same.relocated, false);
  assert.equal(diff.relocated, true);
  assert.equal(inherited.relocated, false);
  assert.equal(external.relocated, true);
});

// ── formatter unit ───────────────────────────────────────────────────────────
test("formatLocationAddress handles full, partial, and empty inputs", () => {
  assert.equal(
    formatLocationAddress(SAN_CLEMENTE),
    "400-C Camino De Estrella, San Clemente, CA 92672",
  );
  assert.equal(formatLocationAddress(RSM), "Rancho Santa Margarita, CA");
  assert.equal(
    formatLocationAddress({ address: null, city: null, state: null, zip: null }),
    "",
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// Room labels — the rule decided 2026-07-31.
// ═════════════════════════════════════════════════════════════════════════════

// Mirrors live data: the two `studio` rows carry an abbreviation, the four
// partner_venue/internal rows are null by design (migration 20260731000001).
const SC_LABEL: LocationLabelRef = {
  name: "Ballet Academy and Movement — San Clemente",
  abbreviation: "SC",
};
const RSM_LABEL: LocationLabelRef = {
  name: "Ballet Academy and Movement — Rancho Santa Margarita",
  abbreviation: "RSM",
};
const PARTNER_VENUE: LocationLabelRef = {
  name: "San Juan Hills HS Theater",
  abbreviation: null,
};

const FILTERED = { locationFilterActive: true };
const UNFILTERED = { locationFilterActive: false };

// ── Filter ACTIVE -> bare room name ──────────────────────────────────────────
test("filter active: bare room name, even though the location has an abbreviation", () => {
  assert.equal(formatRoomLabel("Studio 1", RSM_LABEL, FILTERED), "Studio 1");
  assert.equal(formatRoomLabel("Studio 1", SC_LABEL, FILTERED), "Studio 1");
});

test("filter active: bare room name with no location too", () => {
  assert.equal(formatRoomLabel("Studio 1", null, FILTERED), "Studio 1");
});

// ── Filter INACTIVE, abbreviation present ────────────────────────────────────
test("filter inactive with abbreviation: appends the abbreviation", () => {
  assert.equal(formatRoomLabel("Studio 1", RSM_LABEL, UNFILTERED), "Studio 1 · RSM");
  assert.equal(formatRoomLabel("Studio 1", SC_LABEL, UNFILTERED), "Studio 1 · SC");
});

// ── Filter INACTIVE, no abbreviation (partner venue) ─────────────────────────
test("filter inactive without abbreviation: appends the FULL name, never a split of it", () => {
  assert.equal(
    formatRoomLabel("Main Stage", PARTNER_VENUE, UNFILTERED),
    "Main Stage · San Juan Hills HS Theater",
  );
});

test("filter inactive: an em dash in the name is NOT a split point", () => {
  // The retired behaviour would have produced "Studio 1 · San Clemente" here.
  // Without an abbreviation the whole name is the label — punctuation is data.
  const noAbbrev: LocationLabelRef = { ...SC_LABEL, abbreviation: null };
  assert.equal(
    formatRoomLabel("Studio 1", noAbbrev, UNFILTERED),
    "Studio 1 · Ballet Academy and Movement — San Clemente",
  );
});

test("filter inactive: whitespace-only abbreviation falls back to the name", () => {
  assert.equal(
    formatRoomLabel("Studio 1", { name: "Casa Romantica", abbreviation: "   " }, UNFILTERED),
    "Studio 1 · Casa Romantica",
  );
});

// ── Null location -> bare name, no separator, no "Unassigned" ────────────────
test("null location: bare name — no separator, no 'Unassigned' suffix", () => {
  const label = formatRoomLabel("Pilates Room", null, UNFILTERED);
  assert.equal(label, "Pilates Room");
  assert.ok(!label.includes(ROOM_LOCATION_SEPARATOR));
  assert.ok(!label.includes("Unassigned"));
  assert.ok(!label.includes("No location"));
});

test("undefined location behaves the same as null", () => {
  assert.equal(formatRoomLabel("Pilates Room", undefined, UNFILTERED), "Pilates Room");
});

test("location present but blank on both fields: bare name", () => {
  assert.equal(
    formatRoomLabel("Studio 1", { name: "  ", abbreviation: null }, UNFILTERED),
    "Studio 1",
  );
});

// ── Separator ────────────────────────────────────────────────────────────────
test("separator is space-middot-space, used exactly once", () => {
  assert.equal(ROOM_LOCATION_SEPARATOR, " · ");
  const label = formatRoomLabel("Studio 1", RSM_LABEL, UNFILTERED);
  assert.equal(label.split(ROOM_LOCATION_SEPARATOR).length, 2);
  assert.equal(label, `Studio 1${ROOM_LOCATION_SEPARATOR}RSM`);
});

// ── The label must not depend on what else is on screen ──────────────────────
test("a unique room name still gets the location when unfiltered", () => {
  // The retired closure appended the location only to names that collided, so
  // this label changed depending on which other rooms happened to be visible.
  assert.equal(formatRoomLabel("Pilates Room", SC_LABEL, UNFILTERED), "Pilates Room · SC");
});

test("identical inputs give identical labels regardless of the surrounding list", () => {
  const room = { name: "Studio 1", location: SC_LABEL };
  const alone = [room];
  const colliding = [room, { name: "Studio 1", location: RSM_LABEL }];
  const label = (list: typeof alone) =>
    list.map((r) => formatRoomLabel(r.name, r.location, UNFILTERED));
  assert.deepEqual(label(alone), ["Studio 1 · SC"]);
  assert.deepEqual(label(colliding), ["Studio 1 · SC", "Studio 1 · RSM"]);
});

// ── Room name hygiene ────────────────────────────────────────────────────────
test("room name is trimmed; a blank room name yields the location alone", () => {
  assert.equal(formatRoomLabel("  Studio 1  ", RSM_LABEL, UNFILTERED), "Studio 1 · RSM");
  assert.equal(formatRoomLabel("   ", RSM_LABEL, UNFILTERED), "RSM");
  assert.equal(formatRoomLabel("   ", null, UNFILTERED), "");
});

// ── locationShortLabel unit ──────────────────────────────────────────────────
test("locationShortLabel: abbreviation wins, name is the fallback, null when neither", () => {
  assert.equal(locationShortLabel(SC_LABEL), "SC");
  assert.equal(locationShortLabel(PARTNER_VENUE), "San Juan Hills HS Theater");
  assert.equal(locationShortLabel({ name: "X", abbreviation: " RSM " }), "RSM");
  assert.equal(locationShortLabel({ name: " Casa Romantica ", abbreviation: null }), "Casa Romantica");
  assert.equal(locationShortLabel({ name: "", abbreviation: null }), null);
  assert.equal(locationShortLabel(null), null);
  assert.equal(locationShortLabel(undefined), null);
});

// ═════════════════════════════════════════════════════════════════════════════
// Calendar LOCATION — the field a calendar app may hand to a map.
// ═════════════════════════════════════════════════════════════════════════════

test("calendar location: full name + street address, never the abbreviation", () => {
  assert.equal(
    formatCalendarLocation("Studio 1", SAN_CLEMENTE),
    "Studio 1, Ballet Academy and Movement — San Clemente, 400-C Camino De Estrella, San Clemente, CA 92672",
  );
});

test("calendar location: RSM names RSM — the bug this replaces named San Clemente", () => {
  const label = formatCalendarLocation("Studio 1", RSM);
  assert.equal(label, "Studio 1, Ballet Academy and Movement — Rancho Santa Margarita, Rancho Santa Margarita, CA");
  assert.ok(!label.includes("San Clemente"));
});

test("calendar location: an address-less location still names itself", () => {
  assert.equal(
    formatCalendarLocation("Main Stage", { name: "Casa Romantica", address: null, city: null, state: null, zip: null }),
    "Main Stage, Casa Romantica",
  );
});

// The whole point: an unresolved location must never be filled in with a guess.
test("calendar location: unknown location yields the bare room, asserting no studio", () => {
  assert.equal(formatCalendarLocation("Studio 1", null), "Studio 1");
  assert.equal(formatCalendarLocation("Studio 1", undefined), "Studio 1");
  assert.equal(formatCalendarLocation(null, SAN_CLEMENTE), "Ballet Academy and Movement — San Clemente, 400-C Camino De Estrella, San Clemente, CA 92672");
  assert.equal(formatCalendarLocation(null, null), "");
  assert.equal(formatCalendarLocation("   ", null), "");
});

test("calendar location: room name is trimmed", () => {
  assert.equal(formatCalendarLocation("  Studio 2  ", { name: "Casa Romantica", address: null, city: null, state: null, zip: null }), "Studio 2, Casa Romantica");
});
