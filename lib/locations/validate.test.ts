import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidClassHomeLocation,
  LOCATION_TYPE_OPTIONS,
  OVERRIDE_ELIGIBLE_LOCATION_TYPES,
  isOverrideEligibleLocationType,
  isValidLocationVenueXor,
  matchesLocationFilter,
} from "./validate.ts";

const studios = new Set(["loc-sc", "loc-rsm"]);

test("null / undefined / empty home location is allowed (no home)", () => {
  assert.equal(isValidClassHomeLocation(null, studios), true);
  assert.equal(isValidClassHomeLocation(undefined, studios), true);
  assert.equal(isValidClassHomeLocation("", studios), true);
});

test("a studio-type location is a valid class home", () => {
  assert.equal(isValidClassHomeLocation("loc-sc", studios), true);
  assert.equal(isValidClassHomeLocation("loc-rsm", studios), true);
});

test("a non-studio location (partner_venue / internal) is rejected", () => {
  // ids not present in the studio set — i.e. partner_venue or internal locations
  assert.equal(isValidClassHomeLocation("loc-san-juan-hills", studios), false);
  assert.equal(isValidClassHomeLocation("loc-storage", studios), false);
});

test("empty studio set rejects any concrete location", () => {
  assert.equal(isValidClassHomeLocation("loc-sc", new Set()), false);
  assert.equal(isValidClassHomeLocation(null, new Set()), true);
});

test("LOCATION_TYPE_OPTIONS covers all three enum values in order", () => {
  assert.deepEqual(
    LOCATION_TYPE_OPTIONS.map((o) => o.value),
    ["studio", "partner_venue", "internal"],
  );
});

// ── Single-instance override rules ───────────────────────────────────────────

test("override eligibility: studio + partner_venue allowed, internal rejected", () => {
  assert.equal(isOverrideEligibleLocationType("studio"), true);
  assert.equal(isOverrideEligibleLocationType("partner_venue"), true);
  assert.equal(isOverrideEligibleLocationType("internal"), false);
});

test("OVERRIDE_ELIGIBLE_LOCATION_TYPES is exactly [studio, partner_venue]", () => {
  assert.deepEqual([...OVERRIDE_ELIGIBLE_LOCATION_TYPES], ["studio", "partner_venue"]);
  assert.equal(OVERRIDE_ELIGIBLE_LOCATION_TYPES.includes("internal"), false);
});

test("location-XOR-venue: rejects both set; allows neither or exactly one", () => {
  assert.equal(isValidLocationVenueXor(null, null), true); // inherit (neither)
  assert.equal(isValidLocationVenueXor("loc-sc", null), true); // location only
  assert.equal(isValidLocationVenueXor(null, "San Juan Hills Theater"), true); // venue only
  assert.equal(isValidLocationVenueXor("loc-sc", "San Juan Hills Theater"), false); // both -> invalid
});

test("location-XOR-venue: empty / whitespace strings count as unset", () => {
  assert.equal(isValidLocationVenueXor("", ""), true);
  assert.equal(isValidLocationVenueXor("   ", "Venue"), true); // whitespace-only location = unset
  assert.equal(isValidLocationVenueXor("loc-sc", "   "), true); // whitespace-only venue = unset
});

// ── Class-level Location filter (admin class list) ───────────────────────────

test("matchesLocationFilter: no selection passes all classes", () => {
  assert.equal(matchesLocationFilter("loc-sc", null), true);
  assert.equal(matchesLocationFilter("loc-sc", ""), true);
  assert.equal(matchesLocationFilter(null, null), true);
});

test("matchesLocationFilter: a selected location matches only that location's classes", () => {
  assert.equal(matchesLocationFilter("loc-sc", "loc-sc"), true);
  assert.equal(matchesLocationFilter("loc-rsm", "loc-sc"), false);
  assert.equal(matchesLocationFilter(null, "loc-sc"), false);
});

test("matchesLocationFilter: selecting a location with no classes (RSM) yields empty, not error", () => {
  const classes = [{ location_id: "loc-sc" }, { location_id: "loc-sc" }, { location_id: null }];
  const rsmResults = classes.filter((c) => matchesLocationFilter(c.location_id, "loc-rsm"));
  assert.deepEqual(rsmResults, []);
});
