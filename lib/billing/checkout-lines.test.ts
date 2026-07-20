import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitCheckoutLines,
  immediateTotalCents,
  buildAuthorizationSessionParams,
  buildPendingChargeItems,
  type CartLineInput,
} from "./checkout-lines.ts";
import type { ProrationBlob } from "./proration.ts";

const TUITION_ITEM: CartLineInput = {
  classId: "cls-a",
  studentId: "stu-1",
  studentName: "Ada",
  priceCents: 15000,
  chargeTiming: "scheduled",
};

const BLOB: ProrationBlob = {
  method: "meeting",
  source: "schedule_instances",
  full_month_cents: 15000,
  meetings_in_cycle: 4,
  deliverable_meetings_in_window: 2,
  start_date: "2026-09-01",
  next_anchor_date: "2026-09-15",
};

test("split: registration → immediate; class tuition → scheduled (the §7 shape)", () => {
  const { immediate, scheduled } = splitCheckoutLines({
    items: [TUITION_ITEM],
    registrationFeeCents: 5000,
  });
  assert.equal(immediate.length, 1);
  assert.equal(immediate[0].lineType, "registration");
  assert.equal(immediate[0].amountCents, 5000);
  assert.equal(immediate[0].account, "revenue_registration");

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].lineType, "tuition");
  assert.equal(scheduled[0].monthlyAmountCents, 15000);
  assert.equal(scheduled[0].classId, "cls-a");
  assert.equal(scheduled[0].anchorDay, 15);
});

test("split: only immediate lines are charged now", () => {
  const { immediate } = splitCheckoutLines({ items: [TUITION_ITEM], registrationFeeCents: 5000 });
  assert.equal(immediateTotalCents(immediate), 5000); // tuition NOT in the immediate total
});

test("split: an admin-flipped 'immediate' class charges tuition now (revenue_tuition)", () => {
  const { immediate, scheduled } = splitCheckoutLines({
    items: [{ ...TUITION_ITEM, chargeTiming: "immediate" }],
    registrationFeeCents: 5000,
  });
  assert.equal(scheduled.length, 0);
  assert.equal(immediate.length, 2); // registration + immediate tuition
  const tui = immediate.find((l) => l.lineType === "tuition")!;
  assert.equal(tui.account, "revenue_tuition");
  assert.equal(tui.amountCents, 15000);
  assert.equal(immediateTotalCents(immediate), 20000);
});

test("split: zero registration fee → no registration immediate line", () => {
  const { immediate } = splitCheckoutLines({ items: [TUITION_ITEM], registrationFeeCents: 0 });
  assert.equal(immediate.length, 0);
});

test("session params: SETUP mode — vaults the card, charges nothing (no line_items), carries metadata", () => {
  const params = buildAuthorizationSessionParams({
    customerId: "cus_123",
    appUrl: "http://localhost:3000",
    metadata: { cart_id: "cart-1", tenant_id: "ten-1", family_id: "fam-1" },
  });

  // Vault-only: setup mode is the load-bearing assertion — no money moves at checkout (§1.2).
  assert.equal(params.mode, "setup");
  assert.deepEqual(params.payment_method_types, ["card"]); // ACH mandate is a later slice
  assert.equal(params.customer, "cus_123");
  // Setup mode has NO line items and NO payment_intent_data — nothing is charged now.
  assert.equal(params.line_items, undefined);
  assert.equal(params.payment_intent_data, undefined);
  // The SetupIntent carries provenance; top-level metadata mirrors it.
  assert.equal(params.setup_intent_data?.metadata?.family_id, "fam-1");
  assert.equal(params.metadata?.family_id, "fam-1");
  assert.ok(params.success_url?.includes("/enroll/success"));
});

// ── buildPendingChargeItems (§2 approval-queue manifest) ─────────────────────────────

test("charge items: registration (one_time, attributed to student) + first_tuition (recurring)", () => {
  const items = buildPendingChargeItems({
    registration: { amountCents: 5000, studentId: "stu-1" },
    firstTuition: [
      { classId: "cls-a", studentId: "stu-1", recommendedCents: 7500, proration: BLOB },
    ],
  });

  assert.equal(items.length, 2);

  const reg = items.find((i) => i.item_type === "registration")!;
  assert.equal(reg.recurrence_type, "one_time");
  assert.equal(reg.recommended_amount_cents, 5000);
  assert.equal(reg.charge_timing, "charge_now");
  assert.equal(reg.class_id, null);
  assert.equal(reg.student_id, "stu-1"); // attributed to the student (per_student mode)
  assert.equal(reg.proration, null);

  const tui = items.find((i) => i.item_type === "first_tuition")!;
  assert.equal(tui.recurrence_type, "recurring");
  assert.equal(tui.recommended_amount_cents, 7500);
  assert.equal(tui.charge_timing, "charge_now"); // default recommendation; admin may DEFER (§3.2)
  assert.equal(tui.class_id, "cls-a");
  assert.equal(tui.student_id, "stu-1");
  assert.equal(tui.proration, BLOB); // the recommendation's provenance rides on the item
});

test("charge items: per_family registration carries a null student_id", () => {
  const items = buildPendingChargeItems({
    registration: { amountCents: 5000, studentId: null },
    firstTuition: [{ classId: "cls-a", studentId: "stu-1", recommendedCents: 7500, proration: BLOB }],
  });
  const reg = items.find((i) => i.item_type === "registration")!;
  assert.equal(reg.student_id, null);
});

test("charge items: no registration (null or zero) → only first_tuition", () => {
  const none = buildPendingChargeItems({
    registration: null,
    firstTuition: [{ classId: "cls-a", studentId: "stu-1", recommendedCents: 7500, proration: BLOB }],
  });
  assert.equal(none.length, 1);
  assert.equal(none[0].item_type, "first_tuition");

  const zero = buildPendingChargeItems({
    registration: { amountCents: 0, studentId: "stu-1" },
    firstTuition: [{ classId: "cls-a", studentId: "stu-1", recommendedCents: 7500, proration: BLOB }],
  });
  assert.equal(zero.length, 1);
  assert.equal(zero[0].item_type, "first_tuition");
});

test("charge items: one first_tuition line per class", () => {
  const items = buildPendingChargeItems({
    registration: { amountCents: 5000, studentId: "stu-1" },
    firstTuition: [
      { classId: "cls-a", studentId: "stu-1", recommendedCents: 7500, proration: BLOB },
      { classId: "cls-b", studentId: "stu-1", recommendedCents: 6000, proration: BLOB },
    ],
  });
  assert.equal(items.filter((i) => i.item_type === "first_tuition").length, 2);
  assert.equal(items.filter((i) => i.item_type === "registration").length, 1);
});
