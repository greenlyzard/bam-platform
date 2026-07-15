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

test("emits ONE direct_sale_captured group with the Fable posting key", () => {
  const gs = buildCheckoutPostingGroups(INPUT);
  assert.equal(gs.length, 1);
  assert.equal(gs[0].eventType, "direct_sale_captured");
  assert.equal(gs[0].sourceSystem, "stripe");
  assert.deepEqual(keysOf(gs), ["stripe:pi_abc:direct_sale_captured"]);
});

test("group balances (Σdebits == Σcredits) and has >=2 legs", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  const { debitCents, creditCents } = groupBalance(g);
  assert.equal(debitCents, creditCents);
  assert.ok(g.legs.length >= 2);
  assert.doesNotThrow(() => assertBalanced(g));
});

test("no accounts_receivable leg — cash in = revenue (reads like a receipt)", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  assert.ok(g.legs.every((l) => l.account !== ACCOUNTS.accounts_receivable));
});

test("net effect: one cash debit (total) == Σ revenue credits == Σ item prices", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  const total = 15000 + 12500;

  const cashLegs = g.legs.filter((l) => l.account === ACCOUNTS.cash_clearing && l.direction === "debit");
  assert.equal(cashLegs.length, 1);
  assert.equal(cashLegs[0].amount_cents, total);

  const revenue = g.legs
    .filter((l) => l.account === ACCOUNTS.revenue_tuition && l.direction === "credit")
    .reduce((s, l) => s + l.amount_cents, 0);
  assert.equal(revenue, total);
});

test("idempotent replay: same input → identical posting key (RPC ON CONFLICT dedupes)", () => {
  assert.deepEqual(keysOf(buildCheckoutPostingGroups(INPUT)), keysOf(buildCheckoutPostingGroups(INPUT)));
});

test("every leg carries charge_status='captured'", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  assert.ok(g.legs.every((l) => l.charge_status === "captured"));
});

test("dimensions stamped on revenue legs (family/student/class/location); cash leg is family-only", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  const revA = g.legs.find((l) => l.account === ACCOUNTS.revenue_tuition && l.class_id === "cls-a")!;
  assert.equal(revA.family_id, "fam-1");
  assert.equal(revA.student_id, "stu-1");
  assert.equal(revA.location_id, "loc-1");

  const cash = g.legs.find((l) => l.account === ACCOUNTS.cash_clearing)!;
  assert.equal(cash.family_id, "fam-1");
  assert.equal(cash.class_id, null);
  assert.equal(cash.student_id, null);
});

test("two children in the same class → two distinct revenue legs (not merged), group balances", () => {
  const g = buildCheckoutPostingGroups({
    paymentIntentId: "pi_two",
    familyId: "fam-1",
    items: [
      { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: "loc-1" },
      { classId: "cls-a", studentId: "stu-2", priceCents: 15000, locationId: "loc-1" },
    ],
  })[0];
  const revLegs = g.legs.filter((l) => l.account === ACCOUNTS.revenue_tuition);
  assert.equal(revLegs.length, 2);
  assert.deepEqual(revLegs.map((l) => l.student_id).sort(), ["stu-1", "stu-2"]);
  assert.doesNotThrow(() => assertBalanced(g)); // cash 30000 == 15000 + 15000
});

test("assertBalanced throws on a tampered (unbalanced) group", () => {
  const g = buildCheckoutPostingGroups(INPUT)[0];
  const tampered: PostingGroupSpec = {
    ...g,
    legs: [...g.legs, { account: ACCOUNTS.revenue_tuition, direction: "credit", amount_cents: 1, family_id: null, student_id: null, class_id: null, location_id: null, charge_status: "captured" }],
  };
  assert.throws(() => assertBalanced(tampered), /Unbalanced/);
});

test("empty cart → no groups", () => {
  assert.deepEqual(buildCheckoutPostingGroups({ paymentIntentId: "pi_z", familyId: "f", items: [] }), []);
});
