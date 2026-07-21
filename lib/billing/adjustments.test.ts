import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAdjustment,
  validateAdjustment,
  buildAdjustmentRow,
  netApprovedCents,
  totalApprovedCents,
  type AdjustmentInput,
} from "./adjustments.ts";

// ── applyAdjustment (§3.2 waive/$-off/%-off, bps) ────────────────────────────────────

test("applyAdjustment: waive → 0 regardless of value", () => {
  assert.equal(applyAdjustment(15000, { type: "waive", value: 999, reason: "comp" }), 0);
});

test("applyAdjustment: amount_off subtracts cents", () => {
  assert.equal(applyAdjustment(15000, { type: "amount_off", value: 5000, reason: "x" }), 10000);
});

test("applyAdjustment: amount_off over-discount clamps to 0", () => {
  assert.equal(applyAdjustment(15000, { type: "amount_off", value: 20000, reason: "x" }), 0);
});

test("applyAdjustment: percent_off uses BASIS POINTS (2500 = 25%)", () => {
  assert.equal(applyAdjustment(15000, { type: "percent_off", value: 2500, reason: "x" }), 11250);
});

test("applyAdjustment: percent_off 10000 bps (100%) → 0", () => {
  assert.equal(applyAdjustment(15000, { type: "percent_off", value: 10000, reason: "x" }), 0);
});

test("applyAdjustment: percent_off rounds to whole cents", () => {
  // 10000 * (10000 - 3333) / 10000 = 6667.0 → 6667
  assert.equal(applyAdjustment(10000, { type: "percent_off", value: 3333, reason: "x" }), 6667);
  // 12345 * (10000 - 1000) / 10000 = 11110.5 → 11111 (round half up)
  assert.equal(applyAdjustment(12345, { type: "percent_off", value: 1000, reason: "x" }), 11111);
});

test("applyAdjustment: percent_off 0 bps → unchanged", () => {
  assert.equal(applyAdjustment(15000, { type: "percent_off", value: 0, reason: "x" }), 15000);
});

// ── validateAdjustment (required reason, non-negative, bps bound) ─────────────────────

test("validateAdjustment: empty/whitespace reason throws", () => {
  assert.throws(() => validateAdjustment(15000, { type: "waive", value: 0, reason: "" }), /reason/);
  assert.throws(() => validateAdjustment(15000, { type: "waive", value: 0, reason: "   " }), /reason/);
});

test("validateAdjustment: negative value throws", () => {
  assert.throws(
    () => validateAdjustment(15000, { type: "amount_off", value: -1, reason: "x" }),
    /≥ 0/
  );
});

test("validateAdjustment: percent_off > 10000 bps throws", () => {
  assert.throws(
    () => validateAdjustment(15000, { type: "percent_off", value: 10001, reason: "x" }),
    /100%/
  );
});

test("validateAdjustment: valid inputs do not throw", () => {
  assert.doesNotThrow(() =>
    validateAdjustment(15000, { type: "percent_off", value: 10000, reason: "full comp" })
  );
  assert.doesNotThrow(() =>
    validateAdjustment(15000, { type: "amount_off", value: 15000, reason: "match discount" })
  );
});

// ── buildAdjustmentRow (append-only log shape) ───────────────────────────────────────

test("buildAdjustmentRow: shapes the log row with computed approved_cents", () => {
  const adj: AdjustmentInput = { type: "percent_off", value: 2500, reason: "sibling discount" };
  const row = buildAdjustmentRow({
    tenantId: "t1",
    chargeItemId: "ci1",
    adminId: "admin1",
    recommendedCents: 20000,
    adjustment: adj,
  });
  assert.deepEqual(row, {
    tenant_id: "t1",
    charge_item_id: "ci1",
    admin_id: "admin1",
    adjustment_type: "percent_off",
    value: 2500,
    recommended_cents: 20000,
    approved_cents: 15000,
    reason: "sibling discount",
  });
});

test("buildAdjustmentRow: propagates validation failure", () => {
  assert.throws(
    () =>
      buildAdjustmentRow({
        tenantId: "t1",
        chargeItemId: "ci1",
        adminId: "admin1",
        recommendedCents: 20000,
        adjustment: { type: "amount_off", value: 100, reason: "" },
      }),
    /reason/
  );
});

// ── netApprovedCents / totalApprovedCents ────────────────────────────────────────────

test("netApprovedCents: approved wins over recommended when set", () => {
  assert.equal(
    netApprovedCents({ approved_amount_cents: 9000, recommended_amount_cents: 15000, status: "approved" }),
    9000
  );
});

test("netApprovedCents: falls back to recommended when approved is null", () => {
  assert.equal(
    netApprovedCents({ approved_amount_cents: null, recommended_amount_cents: 15000, status: "pending" }),
    15000
  );
});

test("netApprovedCents: declined item is worth 0 even with an approved amount", () => {
  assert.equal(
    netApprovedCents({ approved_amount_cents: 9000, recommended_amount_cents: 15000, status: "declined" }),
    0
  );
});

test("totalApprovedCents: sums net across items, declined excluded", () => {
  const total = totalApprovedCents([
    { approved_amount_cents: 9000, recommended_amount_cents: 15000, status: "approved" },
    { approved_amount_cents: null, recommended_amount_cents: 5000, status: "pending" },
    { approved_amount_cents: 3000, recommended_amount_cents: 3000, status: "declined" },
  ]);
  assert.equal(total, 14000);
});
