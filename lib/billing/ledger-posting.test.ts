import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutPostingGroups,
  groupBalance,
  assertBalanced,
  ACCOUNTS,
  type CheckoutPostingInput,
  type PostingGroupSpec,
} from "./ledger-posting.ts";

const INPUT: CheckoutPostingInput = {
  paymentIntentId: "pi_abc",
  familyId: "fam-1",
  items: [
    { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: "loc-1" },
    { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: "loc-1" },
  ],
};

const keysOf = (gs: PostingGroupSpec[]) => gs.map((g) => g.postingKey);

test("emits R1 invoice_finalized + R2 payment_captured", () => {
  const gs = buildCheckoutPostingGroups(INPUT);
  assert.equal(gs.length, 2);
  assert.deepEqual(gs.map((g) => g.eventType), ["invoice_finalized", "payment_captured"]);
  assert.deepEqual(keysOf(gs), ["app:pi_abc:invoice_finalized", "stripe:pi_abc:payment_captured"]);
});

test("every group balances (Σdebits == Σcredits) and has >=2 legs", () => {
  for (const g of buildCheckoutPostingGroups(INPUT)) {
    const { debitCents, creditCents } = groupBalance(g);
    assert.equal(debitCents, creditCents, `group ${g.eventType} must balance`);
    assert.ok(g.legs.length >= 2);
    assert.doesNotThrow(() => assertBalanced(g));
  }
});

test("net effect: cash debit == tuition revenue credit == Σ item prices", () => {
  const gs = buildCheckoutPostingGroups(INPUT);
  const total = 15000 + 12500;

  const revenue = gs
    .find((g) => g.eventType === "invoice_finalized")!
    .legs.filter((l) => l.account === ACCOUNTS.revenue_tuition && l.direction === "credit")
    .reduce((s, l) => s + l.amount_cents, 0);
  assert.equal(revenue, total);

  const cash = gs
    .find((g) => g.eventType === "payment_captured")!
    .legs.find((l) => l.account === ACCOUNTS.cash_clearing && l.direction === "debit")!;
  assert.equal(cash.amount_cents, total);
});

test("finalize opens AR per item; payment clears the same total AR", () => {
  const gs = buildCheckoutPostingGroups(INPUT);
  const arDebits = gs
    .find((g) => g.eventType === "invoice_finalized")!
    .legs.filter((l) => l.account === ACCOUNTS.accounts_receivable && l.direction === "debit")
    .reduce((s, l) => s + l.amount_cents, 0);
  const arCredit = gs
    .find((g) => g.eventType === "payment_captured")!
    .legs.find((l) => l.account === ACCOUNTS.accounts_receivable && l.direction === "credit")!;
  assert.equal(arDebits, arCredit.amount_cents);
});

test("idempotent replay: same input → identical posting_keys (RPC ON CONFLICT dedupes)", () => {
  assert.deepEqual(keysOf(buildCheckoutPostingGroups(INPUT)), keysOf(buildCheckoutPostingGroups(INPUT)));
});

test("payment legs carry charge_status='captured'; revenue/AR-open legs do not", () => {
  const gs = buildCheckoutPostingGroups(INPUT);
  const payment = gs.find((g) => g.eventType === "payment_captured")!;
  assert.ok(payment.legs.every((l) => l.charge_status === "captured"));
  const finalize = gs.find((g) => g.eventType === "invoice_finalized")!;
  assert.ok(finalize.legs.every((l) => l.charge_status === null));
});

test("dimensions stamped on finalize legs (family/student/class/location)", () => {
  const finalize = buildCheckoutPostingGroups(INPUT).find((g) => g.eventType === "invoice_finalized")!;
  const revA = finalize.legs.find((l) => l.account === ACCOUNTS.revenue_tuition && l.class_id === "cls-a")!;
  assert.equal(revA.family_id, "fam-1");
  assert.equal(revA.student_id, "stu-1");
  assert.equal(revA.location_id, "loc-1");
});

test("assertBalanced throws on a tampered (unbalanced) group", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  const tampered: PostingGroupSpec = {
    ...g,
    legs: [...g.legs, { account: ACCOUNTS.revenue_tuition, direction: "credit", amount_cents: 1, family_id: null, student_id: null, class_id: null, location_id: null, charge_status: null }],
  };
  assert.throws(() => assertBalanced(tampered), /Unbalanced/);
});

test("empty cart → no groups", () => {
  assert.deepEqual(buildCheckoutPostingGroups({ paymentIntentId: "pi_z", familyId: "f", items: [] }), []);
});
