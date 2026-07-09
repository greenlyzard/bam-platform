import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidClassHomeLocation, LOCATION_TYPE_OPTIONS } from "./validate.ts";

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
