import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInitialNextDrawAt,
  assembleApprovalCharge,
  assembleWaitlistPromotion,
  buildPendingIntent,
  chargeKindForItemType,
  ledgerAccountForItemType,
  type ApprovedChargeItem,
} from "./charges.ts";
import { nextAnchorDate, type ProrationBlob } from "./proration.ts";
import { buildPendingChargeItems } from "./checkout-lines.ts";

const CTX = { tenantId: "t1", familyId: "fam1", enrollmentId: "enr1", adminId: "admin1" };

/** A proration blob whose next_anchor_date is derived from the start/anchor (so invariants hold). */
function blob(startDate: string, anchorDay: number, fullMonthCents: number): ProrationBlob {
  return {
    method: "meeting",
    source: "schedule_instances",
    full_month_cents: fullMonthCents,
    meetings_in_cycle: 4,
    deliverable_meetings_in_window: 2,
    start_date: startDate,
    next_anchor_date: nextAnchorDate(startDate, anchorDay),
  };
}

function firstTuition(over: Partial<ApprovedChargeItem> = {}): ApprovedChargeItem {
  return {
    id: "ci-tuition",
    item_type: "first_tuition",
    recurrence_type: "recurring",
    recommended_amount_cents: 8000,
    approved_amount_cents: null,
    charge_timing: "charge_now",
    class_id: "cls-a",
    student_id: "stu-1",
    proration: blob("2026-09-03", 15, 15000),
    status: "pending",
    ...over,
  };
}

function registration(over: Partial<ApprovedChargeItem> = {}): ApprovedChargeItem {
  return {
    id: "ci-reg",
    item_type: "registration",
    recurrence_type: "one_time",
    recommended_amount_cents: 5000,
    approved_amount_cents: null,
    charge_timing: "charge_now",
    class_id: null,
    student_id: "stu-1",
    proration: null,
    status: "pending",
    ...over,
  };
}

// ── item_type mappings ───────────────────────────────────────────────────────────────

test("chargeKindForItemType is 1:1; ledger account splits registration vs tuition", () => {
  assert.equal(chargeKindForItemType("registration"), "registration");
  assert.equal(chargeKindForItemType("first_tuition"), "first_tuition");
  assert.equal(ledgerAccountForItemType("registration"), "revenue_registration");
  assert.equal(ledgerAccountForItemType("first_tuition"), "revenue_tuition");
  assert.equal(ledgerAccountForItemType("private_pack"), "revenue_tuition");
});

// ── (a) start-on-anchor arming invariant (§4.1 / §3.2.4) ─────────────────────────────

test("resolveInitialNextDrawAt equals proration.nextAnchorDate for the same inputs", () => {
  for (const [start, anchor] of [
    ["2026-09-03", 15],
    ["2026-09-20", 15],
    ["2026-12-20", 15],
    ["2026-02-10", 31],
  ] as const) {
    assert.equal(resolveInitialNextDrawAt(start, anchor), nextAnchorDate(start, anchor));
  }
});

test("resolveInitialNextDrawAt: start == anchor → same-day arming (no skipped period)", () => {
  // Sept 15 with anchor 15: inclusive → armed on the start date itself, not Oct 15.
  assert.equal(resolveInitialNextDrawAt("2026-09-15", 15), "2026-09-15");
});

test("assembleApprovalCharge: arming next_draw_at matches the first_tuition proration blob", () => {
  const item = firstTuition({ proration: blob("2026-09-15", 15, 15000) });
  const out = assembleApprovalCharge({
    context: CTX,
    items: [item],
    anchorDay: 15,
    startDate: "2026-09-15",
  });
  assert.equal(out.intentArmings.length, 1);
  assert.equal(out.intentArmings[0].next_draw_at, item.proration!.next_anchor_date);
  assert.equal(out.intentArmings[0].next_draw_at, "2026-09-15"); // same-day, not skipped to Oct
  // Start-on-anchor: window empty → recommended 0, but the intent still carries the FULL month.
  assert.equal(out.intentArmings[0].monthly_amount_cents, 15000);
});

// ── (b via arming) partitioning: charge-now vs deferred, full-month arming ────────────

test("assembleApprovalCharge: charge-now registration + first_tuition → PI, rows, lines, arming", () => {
  const out = assembleApprovalCharge({
    context: CTX,
    items: [registration(), firstTuition()],
    anchorDay: 15,
    startDate: "2026-09-03",
  });

  assert.equal(out.paymentIntentAmountCents, 5000 + 8000);
  assert.equal(out.chargeRows.length, 2);
  assert.equal(out.capturedSaleLines.length, 2);

  const reg = out.chargeRows.find((r) => r.kind === "registration")!;
  assert.equal(reg.amount_cents, 5000);
  assert.equal(reg.source, "approval");
  assert.equal(reg.status, "created");
  assert.equal(reg.billing_period, null);
  assert.equal(reg.created_by, "admin1");
  assert.deepEqual(reg.metadata, { charge_item_id: "ci-reg", item_type: "registration" });

  // one recurring arming, full month, no deferral
  assert.equal(out.intentArmings.length, 1);
  assert.equal(out.intentArmings[0].monthly_amount_cents, 15000);
  assert.equal(out.intentArmings[0].deferred_addition_cents, 0);
  assert.equal(out.intentArmings[0].status, "active");
  assert.equal(out.intentArmings[0].next_draw_at, "2026-09-15");

  // sale lines carry the right revenue accounts
  const accounts = out.capturedSaleLines.map((l) => l.account).sort();
  assert.deepEqual(accounts, ["revenue_registration", "revenue_tuition"]);
});

test("assembleApprovalCharge: deferred first_tuition folds into the intent, no charge now", () => {
  const out = assembleApprovalCharge({
    context: CTX,
    items: [firstTuition({ charge_timing: "deferred", approved_amount_cents: 6000 })],
    anchorDay: 15,
    startDate: "2026-09-03",
  });
  assert.equal(out.paymentIntentAmountCents, 0);
  assert.equal(out.chargeRows.length, 0);
  assert.equal(out.capturedSaleLines.length, 0);
  assert.equal(out.intentArmings.length, 1);
  assert.equal(out.intentArmings[0].deferred_addition_cents, 6000);
  assert.equal(out.intentArmings[0].monthly_amount_cents, 15000);
});

test("assembleApprovalCharge: zero-PI case (all waived) → no PI, no rows, arming still made", () => {
  const out = assembleApprovalCharge({
    context: CTX,
    items: [
      registration({ approved_amount_cents: 0 }),
      firstTuition({ approved_amount_cents: 0 }),
    ],
    anchorDay: 15,
    startDate: "2026-09-03",
  });
  assert.equal(out.paymentIntentAmountCents, 0);
  assert.equal(out.chargeRows.length, 0);
  assert.equal(out.capturedSaleLines.length, 0);
  // recurring item still arms its intent (a waived first draw is still an active subscription)
  assert.equal(out.intentArmings.length, 1);
  assert.equal(out.intentArmings[0].deferred_addition_cents, 0);
});

test("assembleApprovalCharge: declined item is fully excluded", () => {
  const out = assembleApprovalCharge({
    context: CTX,
    items: [registration({ status: "declined" }), firstTuition({ status: "declined" })],
    anchorDay: 15,
    startDate: "2026-09-03",
  });
  assert.equal(out.paymentIntentAmountCents, 0);
  assert.equal(out.chargeRows.length, 0);
  assert.equal(out.intentArmings.length, 0);
});

test("assembleApprovalCharge: deferring a one_time item throws (no intent to fold into)", () => {
  assert.throws(
    () =>
      assembleApprovalCharge({
        context: CTX,
        items: [registration({ charge_timing: "deferred" })],
        anchorDay: 15,
        startDate: "2026-09-03",
      }),
    /one_time and cannot be deferred/
  );
});

test("assembleApprovalCharge: recurring item without a proration blob throws", () => {
  assert.throws(
    () =>
      assembleApprovalCharge({
        context: CTX,
        items: [firstTuition({ proration: null })],
        anchorDay: 15,
        startDate: "2026-09-03",
      }),
    /missing its proration blob/
  );
});

// ── (b) waitlist→pending promotion parity with the webhook path ──────────────────────

test("assembleWaitlistPromotion: charge items + intent match the webhook builders exactly", () => {
  const prorationBlob = blob("2026-09-03", 15, 15000);
  const registrationArg = { amountCents: 5000, studentId: "stu-1" };
  const firstTuitionArg = [
    { classId: "cls-a", studentId: "stu-1", recommendedCents: 8000, proration: prorationBlob },
  ];
  const intentArg = {
    tenantId: "t1",
    familyId: "fam1",
    studentId: "stu-1",
    classId: "cls-a",
    monthlyAmountCents: 15000,
    anchorDay: 15,
    sourceRef: "cs_test_123",
    enrollmentId: "enr1",
  };

  const promo = assembleWaitlistPromotion({
    registration: registrationArg,
    firstTuition: firstTuitionArg,
    intent: intentArg,
  });

  // Parity: identical to calling the webhook's own builders directly.
  assert.deepEqual(
    promo.chargeItems,
    buildPendingChargeItems({ registration: registrationArg, firstTuition: firstTuitionArg })
  );
  assert.deepEqual(promo.intent, buildPendingIntent(intentArg));

  // And the intent is a pending_setup row (armed only later, at approval).
  assert.equal(promo.intent.status, "pending_setup");
  assert.equal(promo.chargeItems.length, 2); // registration + first_tuition
});
