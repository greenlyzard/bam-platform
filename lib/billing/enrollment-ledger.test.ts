import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enrollmentDedupeKey,
  selectUnprocessedItems,
  chargeItemDedupeKey,
  selectMissingChargeItems,
  currentPeriod,
  type CheckoutItem,
} from "./enrollment-ledger.ts";

// Canonical vault-only anchor is the Stripe Checkout Session id (§1.2, decision 1) — setup mode has
// no PaymentIntent.
const CS = "cs_123";

const itemA: CheckoutItem = { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: "loc-1" };
const itemB: CheckoutItem = { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: "loc-1" };
// two children in the SAME class — distinct keys
const itemAChild2: CheckoutItem = { classId: "cls-a", studentId: "stu-2", priceCents: 15000, locationId: "loc-1" };

test("enrollmentDedupeKey: keyed on the checkout session; distinguishes student and class", () => {
  assert.equal(enrollmentDedupeKey(CS, "stu-1", "cls-a"), "cs_123|stu-1|cls-a");
  assert.notEqual(
    enrollmentDedupeKey(CS, "stu-1", "cls-a"),
    enrollmentDedupeKey(CS, "stu-2", "cls-a")
  );
  assert.equal(enrollmentDedupeKey(CS, null, "cls-a"), "cs_123|null|cls-a");
});

test("selectUnprocessedItems: empty existing → all items processed", () => {
  const out = selectUnprocessedItems([itemA, itemB], new Set(), CS);
  assert.deepEqual(out, [itemA, itemB]);
});

test("selectUnprocessedItems: full existing set → none (retry after success is a no-op)", () => {
  const existing = new Set([
    enrollmentDedupeKey(CS, "stu-1", "cls-a"),
    enrollmentDedupeKey(CS, "stu-1", "cls-b"),
  ]);
  const out = selectUnprocessedItems([itemA, itemB], existing, CS);
  assert.deepEqual(out, []);
});

test("selectUnprocessedItems: partial existing → only the remainder (partial-failure retry)", () => {
  const existing = new Set([enrollmentDedupeKey(CS, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemB], existing, CS);
  assert.deepEqual(out, [itemB]);
});

test("selectUnprocessedItems: two children, same class → both kept, one processed independently", () => {
  const existing = new Set([enrollmentDedupeKey(CS, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemAChild2], existing, CS);
  assert.deepEqual(out, [itemAChild2]);
});

// ── charge-item idempotency (§2; enrollment_charge_items) ────────────────────────────

type Row = { enrollment_id: string; item_type: string; class_id: string | null };

test("chargeItemDedupeKey: one per (enrollment, item_type, class); registration is class-null", () => {
  assert.equal(chargeItemDedupeKey("enr-1", "first_tuition", "cls-a"), "enr-1|first_tuition|cls-a");
  assert.equal(chargeItemDedupeKey("enr-1", "registration", null), "enr-1|registration|null");
  assert.notEqual(
    chargeItemDedupeKey("enr-1", "first_tuition", "cls-a"),
    chargeItemDedupeKey("enr-1", "first_tuition", "cls-b")
  );
});

test("selectMissingChargeItems: empty existing → all rows inserted", () => {
  const rows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
  ];
  assert.deepEqual(selectMissingChargeItems(rows, new Set()), rows);
});

test("selectMissingChargeItems: partial existing → only the remainder (partial-failure retry)", () => {
  const rows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
  ];
  const existing = new Set([chargeItemDedupeKey("enr-1", "registration", null)]);
  assert.deepEqual(selectMissingChargeItems(rows, existing), [rows[1]]);
});

// REQUIRED: a retry of the SAME checkout session creates no new enrollments AND no new charge items.
test("idempotent re-run: same checkout_session_id yields no new enrollments or charge items", () => {
  const CS_RETRY = "cs_retry";
  const items: CheckoutItem[] = [
    { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: null },
    { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: null },
  ];

  // First run created both enrollments; the retry sees them all as existing.
  const existingEnrollmentKeys = new Set(
    items.map((it) => enrollmentDedupeKey(CS_RETRY, it.studentId, it.classId))
  );
  assert.deepEqual(selectUnprocessedItems(items, existingEnrollmentKeys, CS_RETRY), []);

  // First run also created every charge item (registration on enr-1 + a first_tuition per class);
  // the retry re-derives the same rows and finds them all present.
  const plannedChargeRows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
    { enrollment_id: "enr-2", item_type: "first_tuition", class_id: "cls-b" },
  ];
  const existingChargeKeys = new Set(
    plannedChargeRows.map((r) => chargeItemDedupeKey(r.enrollment_id, r.item_type, r.class_id))
  );
  assert.deepEqual(selectMissingChargeItems(plannedChargeRows, existingChargeKeys), []);
});

test("currentPeriod: YYYY-MM in UTC", () => {
  assert.equal(currentPeriod(new Date("2026-08-03T00:00:00Z")), "2026-08");
  assert.equal(currentPeriod(new Date("2026-01-31T23:59:59Z")), "2026-01");
  assert.equal(currentPeriod(new Date("2026-12-01T12:00:00Z")), "2026-12");
});
