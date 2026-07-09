import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInstanceLocation,
  formatLocationAddress,
  type LocationRef,
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
    formatLocationAddress({ id: "x", name: "X", address: null, city: null, state: null, zip: null }),
    "",
  );
});
