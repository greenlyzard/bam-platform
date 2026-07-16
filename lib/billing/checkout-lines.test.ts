import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitCheckoutLines,
  immediateTotalCents,
  buildAuthorizationSessionParams,
  type CartLineInput,
} from "./checkout-lines.ts";

const TUITION_ITEM: CartLineInput = {
  classId: "cls-a",
  studentId: "stu-1",
  studentName: "Ada",
  priceCents: 15000,
  chargeTiming: "scheduled",
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

test("session params: card-only + vaults the card + immediate line items + metadata + customer", () => {
  const { immediate } = splitCheckoutLines({ items: [TUITION_ITEM], registrationFeeCents: 5000 });
  const params = buildAuthorizationSessionParams({
    immediate,
    customerId: "cus_123",
    appUrl: "http://localhost:3000",
    metadata: { cart_id: "cart-1", tenant_id: "ten-1", family_id: "fam-1", scheduled_intents: "[]" },
  });

  assert.equal(params.mode, "payment");
  assert.deepEqual(params.payment_method_types, ["card"]);
  assert.equal(params.customer, "cus_123");
  // VAULTING flag is the load-bearing assertion for the authorization model.
  assert.equal(params.payment_intent_data?.setup_future_usage, "off_session");
  assert.equal(params.line_items?.length, 1); // only the immediate registration line
  assert.equal(params.line_items?.[0].price_data?.unit_amount, 5000);
  assert.equal(params.metadata?.family_id, "fam-1");
  assert.ok(params.success_url?.includes("/enroll/success"));
});
