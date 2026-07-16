import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectSaleGroup,
  groupBalance,
  assertBalanced,
  ACCOUNTS,
  type PostingGroupSpec,
  type SaleLine,
} from "./ledger-posting.ts";

const PI = "pi_abc";

test("registration-only sale: DR cash_clearing / CR revenue_registration, balances", () => {
  const g = buildDirectSaleGroup({
    paymentIntentId: PI,
    familyId: "fam-1",
    lines: [{ account: ACCOUNTS.revenue_registration, amountCents: 5000, familyId: "fam-1" }],
  })!;
  assert.equal(g.eventType, "direct_sale_captured");
  assert.equal(g.postingKey, "stripe:pi_abc:direct_sale_captured");
  const { debitCents, creditCents } = groupBalance(g);
  assert.equal(debitCents, 5000);
  assert.equal(creditCents, 5000);
  assert.doesNotThrow(() => assertBalanced(g));

  const cash = g.legs.find((l) => l.account === ACCOUNTS.cash_clearing && l.direction === "debit")!;
  assert.equal(cash.amount_cents, 5000);
  const rev = g.legs.find((l) => l.account === ACCOUNTS.revenue_registration && l.direction === "credit")!;
  assert.equal(rev.amount_cents, 5000);
  assert.ok(g.legs.every((l) => l.charge_status === "captured"));
});

test("no accounts_receivable leg (reads like a receipt)", () => {
  const g = buildDirectSaleGroup({
    paymentIntentId: PI,
    familyId: "fam-1",
    lines: [{ account: ACCOUNTS.revenue_registration, amountCents: 5000, familyId: "fam-1" }],
  })!;
  assert.ok(g.legs.every((l) => l.account !== "accounts_receivable"));
});

test("multi-line immediate sale: one cash debit == Σ revenue credits", () => {
  const lines: SaleLine[] = [
    { account: ACCOUNTS.revenue_registration, amountCents: 5000, familyId: "fam-1" },
    { account: ACCOUNTS.revenue_tuition, amountCents: 15000, familyId: "fam-1", studentId: "stu-1", classId: "cls-a" },
  ];
  const g = buildDirectSaleGroup({ paymentIntentId: PI, familyId: "fam-1", lines })!;
  const cash = g.legs.filter((l) => l.account === ACCOUNTS.cash_clearing && l.direction === "debit");
  assert.equal(cash.length, 1);
  assert.equal(cash[0].amount_cents, 20000);
  const revenue = g.legs
    .filter((l) => l.direction === "credit")
    .reduce((s, l) => s + l.amount_cents, 0);
  assert.equal(revenue, 20000);
  assert.doesNotThrow(() => assertBalanced(g));
  // dims stamped on the tuition line
  const tui = g.legs.find((l) => l.account === ACCOUNTS.revenue_tuition)!;
  assert.equal(tui.class_id, "cls-a");
  assert.equal(tui.student_id, "stu-1");
});

test("nothing payable (0 total) → null", () => {
  assert.equal(buildDirectSaleGroup({ paymentIntentId: PI, familyId: "f", lines: [] }), null);
});

test("idempotent posting key: same payment intent → same key", () => {
  const mk = () =>
    buildDirectSaleGroup({
      paymentIntentId: PI,
      familyId: "fam-1",
      lines: [{ account: ACCOUNTS.revenue_registration, amountCents: 5000, familyId: "fam-1" }],
    })!.postingKey;
  assert.equal(mk(), mk());
});

test("assertBalanced throws on a tampered (unbalanced) group", () => {
  const g = buildDirectSaleGroup({
    paymentIntentId: PI,
    familyId: "fam-1",
    lines: [{ account: ACCOUNTS.revenue_registration, amountCents: 5000, familyId: "fam-1" }],
  })!;
  const tampered: PostingGroupSpec = {
    ...g,
    legs: [...g.legs, { account: ACCOUNTS.revenue_tuition, direction: "credit", amount_cents: 1, family_id: null, student_id: null, class_id: null, location_id: null, charge_status: "captured" }],
  };
  assert.throws(() => assertBalanced(tampered), /Unbalanced/);
});
