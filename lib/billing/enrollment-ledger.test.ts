import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enrollmentDedupeKey,
  selectUnprocessedItems,
  currentPeriod,
  type CheckoutItem,
} from "./enrollment-ledger.ts";

const PI = "pi_123";

const itemA: CheckoutItem = { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: "loc-1" };
const itemB: CheckoutItem = { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: "loc-1" };
// two children in the SAME class — distinct keys
const itemAChild2: CheckoutItem = { classId: "cls-a", studentId: "stu-2", priceCents: 15000, locationId: "loc-1" };

test("enrollmentDedupeKey: stable + distinguishes student and class", () => {
  assert.equal(enrollmentDedupeKey(PI, "stu-1", "cls-a"), "pi_123|stu-1|cls-a");
  assert.notEqual(
    enrollmentDedupeKey(PI, "stu-1", "cls-a"),
    enrollmentDedupeKey(PI, "stu-2", "cls-a")
  );
  assert.equal(enrollmentDedupeKey(PI, null, "cls-a"), "pi_123|null|cls-a");
});

test("selectUnprocessedItems: empty existing → all items processed", () => {
  const out = selectUnprocessedItems([itemA, itemB], new Set(), PI);
  assert.deepEqual(out, [itemA, itemB]);
});

test("selectUnprocessedItems: full existing set → none (retry after success is a no-op)", () => {
  const existing = new Set([
    enrollmentDedupeKey(PI, "stu-1", "cls-a"),
    enrollmentDedupeKey(PI, "stu-1", "cls-b"),
  ]);
  const out = selectUnprocessedItems([itemA, itemB], existing, PI);
  assert.deepEqual(out, []);
});

test("selectUnprocessedItems: partial existing → only the remainder (partial-failure retry)", () => {
  const existing = new Set([enrollmentDedupeKey(PI, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemB], existing, PI);
  assert.deepEqual(out, [itemB]);
});

test("selectUnprocessedItems: two children, same class → both kept, one processed independently", () => {
  const existing = new Set([enrollmentDedupeKey(PI, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemAChild2], existing, PI);
  assert.deepEqual(out, [itemAChild2]);
});

test("currentPeriod: YYYY-MM in UTC", () => {
  assert.equal(currentPeriod(new Date("2026-08-03T00:00:00Z")), "2026-08");
  assert.equal(currentPeriod(new Date("2026-01-31T23:59:59Z")), "2026-01");
  assert.equal(currentPeriod(new Date("2026-12-01T12:00:00Z")), "2026-12");
});
