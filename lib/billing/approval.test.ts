import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approveEnrollment,
  declineEnrollment,
  promoteWaitlistEnrollment,
  type ApprovalRepo,
  type ApprovalContext,
  type PromotionContext,
  type StripeGateway,
  type SendConfirmation,
} from "./approval.ts";
import { buildPendingChargeItems, type PendingChargeItemInput } from "./checkout-lines.ts";
import { buildPendingIntent } from "./charges.ts";
import type { ProrationBlob } from "./proration.ts";

const NOW = new Date("2026-09-10T12:00:00Z");

const BLOB: ProrationBlob = {
  method: "meeting",
  source: "schedule_instances",
  full_month_cents: 15000,
  meetings_in_cycle: 4,
  deliverable_meetings_in_window: 2,
  start_date: "2026-09-03",
  next_anchor_date: "2026-09-15",
};

function baseContext(over: Partial<ApprovalContext> = {}): ApprovalContext {
  return {
    enrollment: {
      id: "enr1",
      tenant_id: "t1",
      status: "pending",
      class_id: "cls-a",
      family_id: "fam1",
      student_id: "stu-1",
    },
    family: { stripe_customer_id: "cus_1", stripe_payment_method_id: "pm_1" },
    items: [
      {
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
      },
      {
        id: "ci-tui",
        item_type: "first_tuition",
        recurrence_type: "recurring",
        recommended_amount_cents: 8000,
        approved_amount_cents: null,
        charge_timing: "charge_now",
        class_id: "cls-a",
        student_id: "stu-1",
        proration: BLOB,
        status: "pending",
      },
    ],
    intents: [{ id: "int1", class_id: "cls-a", student_id: "stu-1" }],
    anchorDay: 15,
    startDate: "2026-09-03",
    email: { to: "p@x.com", parentName: "Ada Lovelace", classes: [] },
    ...over,
  };
}

interface HarnessOpts {
  context?: ApprovalContext | null;
  existingCharges?: { id: string; status: string; stripe_payment_intent_id: string | null }[];
  throwOn?: Set<string>;
  stripeThrows?: boolean;
  stripeStatus?: string;
  confirmThrows?: boolean;
  promotionContext?: PromotionContext | null;
  proration?: { recommendedCents: number; blob: ProrationBlob };
}

function makeHarness(opts: HarnessOpts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const rec = (name: string, ...a: unknown[]) => {
    (calls[name] ??= []).push(a);
    if (opts.throwOn?.has(name)) throw new Error(`boom:${name}`);
  };

  const repo: ApprovalRepo = {
    async loadApprovalContext(id) {
      rec("loadApprovalContext", id);
      return opts.context === undefined ? baseContext() : opts.context;
    },
    async getApprovalCharges(id) {
      rec("getApprovalCharges", id);
      return opts.existingCharges ?? [];
    },
    async insertChargeRows(rows) {
      rec("insertChargeRows", rows);
      return rows.map((r, i) => {
        const meta = (r.metadata as { charge_item_id?: string; item_type?: string }) ?? {};
        return { id: `chg-${i}`, charge_item_id: meta.charge_item_id ?? "", item_type: meta.item_type ?? "" };
      });
    },
    async markChargesSucceeded(...a) {
      rec("markChargesSucceeded", ...a);
    },
    async markChargesFailed(...a) {
      rec("markChargesFailed", ...a);
    },
    async postLedgerGroup(...a) {
      rec("postLedgerGroup", ...a);
    },
    async armIntents(...a) {
      rec("armIntents", ...a);
    },
    async patchChargeIntentIds(...a) {
      rec("patchChargeIntentIds", ...a);
    },
    async markChargeItems(...a) {
      rec("markChargeItems", ...a);
    },
    async activateEnrollment(...a) {
      rec("activateEnrollment", ...a);
    },
    async setEnrollmentChargeError(...a) {
      rec("setEnrollmentChargeError", ...a);
    },
    async advanceEnrolledCount(...a) {
      rec("advanceEnrolledCount", ...a);
    },
    async createBillingTask(...a) {
      rec("createBillingTask", ...a);
    },
    async getEnrollmentStatus(id) {
      rec("getEnrollmentStatus", id);
      const ctx = opts.context === undefined ? baseContext() : opts.context;
      return ctx ? { tenant_id: ctx.enrollment.tenant_id, status: ctx.enrollment.status } : null;
    },
    async declineEnrollment(...a) {
      rec("declineEnrollment", ...a);
    },
    async markChargeItemsDeclined(...a) {
      rec("markChargeItemsDeclined", ...a);
    },
    async cancelPendingIntents(...a) {
      rec("cancelPendingIntents", ...a);
    },
    async clearHold(...a) {
      rec("clearHold", ...a);
    },
    async loadPromotionContext(id) {
      rec("loadPromotionContext", id);
      return opts.promotionContext ?? null;
    },
    async computeFirstDrawProration(...a) {
      rec("computeFirstDrawProration", ...a);
      return opts.proration ?? { recommendedCents: 6000, blob: BLOB };
    },
    async insertPromotionChargeItems(...a) {
      rec("insertPromotionChargeItems", ...a);
    },
    async insertPendingIntent(...a) {
      rec("insertPendingIntent", ...a);
    },
    async promoteToPending(...a) {
      rec("promoteToPending", ...a);
    },
  };

  const stripe: StripeGateway = {
    async createOffSessionPaymentIntent(a) {
      (calls.stripe ??= []).push([a]);
      if (opts.stripeThrows) throw new Error("Your card was declined.");
      return { id: "pi_1", latestChargeId: "ch_1", status: opts.stripeStatus ?? "succeeded" };
    },
  };

  const sendConfirmation: SendConfirmation = async (ctx) => {
    (calls.sendConfirmation ??= []).push([ctx]);
    if (opts.confirmThrows) throw new Error("email down");
  };

  return { repo, stripe, sendConfirmation, calls, now: NOW };
}

// ── happy path ─────────────────────────────────────────────────────────────────────

test("approve: charge-now reg + tuition → PI, ledger, arming, activation, count, email", async () => {
  const h = makeHarness();
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });

  assert.equal(out.status, "approved");
  assert.equal(out.status === "approved" && out.paymentIntentId, "pi_1");
  assert.equal(out.status === "approved" && out.chargedCents, 13000);
  assert.deepEqual(out.status === "approved" && out.repairTasks, []);

  assert.equal(h.calls.stripe.length, 1);
  assert.equal((h.calls.stripe[0][0] as { amountCents: number }).amountCents, 13000);
  assert.ok(h.calls.markChargesSucceeded);
  assert.ok(h.calls.postLedgerGroup);
  // arming: full month, start-date anchor, no deferral
  assert.deepEqual(h.calls.armIntents[0][0], [
    {
      intentId: "int1",
      monthly_amount_cents: 15000,
      anchor_day: 15,
      next_draw_at: "2026-09-15",
      deferred_addition_cents: 0,
    },
  ]);
  // intent_id patched onto the first_tuition charge row (index 1 → chg-1)
  assert.deepEqual(h.calls.patchChargeIntentIds[0][0], [{ chargeId: "chg-1", intentId: "int1" }]);
  // charge items → charged with their charge_id backref
  assert.deepEqual(h.calls.markChargeItems[0][0], [
    { chargeItemId: "ci-reg", chargeId: "chg-0", status: "charged" },
    { chargeItemId: "ci-tui", chargeId: "chg-1", status: "charged" },
  ]);
  assert.ok(h.calls.activateEnrollment);
  assert.deepEqual(h.calls.advanceEnrolledCount[0], ["cls-a"]);
  assert.ok(h.calls.sendConfirmation);
  assert.ok(!h.calls.createBillingTask);
});

// ── not pending ──────────────────────────────────────────────────────────────────────

test("approve: non-pending enrollment is rejected", async () => {
  const h = makeHarness({ context: baseContext({ enrollment: { ...baseContext().enrollment, status: "active" } }) });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.deepEqual(out, { status: "not_pending", actual: "active" });
  assert.ok(!h.calls.insertChargeRows);
});

// ── idempotency guard + stuck detection (ruling B) ───────────────────────────────────

test("approve: existing succeeded approval charge → already_processed (not stuck)", async () => {
  const h = makeHarness({
    existingCharges: [{ id: "c1", status: "succeeded", stripe_payment_intent_id: "pi_x" }],
  });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.deepEqual(out, { status: "already_processed", stuck: false });
  assert.ok(!h.calls.insertChargeRows);
  assert.ok(!h.calls.stripe);
});

test("approve: only 'created' charges w/ null PI → already_processed stuck:true", async () => {
  const h = makeHarness({
    existingCharges: [{ id: "c1", status: "created", stripe_payment_intent_id: null }],
  });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.deepEqual(out, { status: "already_processed", stuck: true });
});

// ── PI failure keeps enrollment pending ──────────────────────────────────────────────

test("approve: card declined → charge_failed, charges failed, error stamped, stays pending", async () => {
  const h = makeHarness({ stripeThrows: true });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.equal(out.status, "charge_failed");
  assert.ok(h.calls.markChargesFailed);
  assert.ok(h.calls.setEnrollmentChargeError);
  assert.ok(!h.calls.activateEnrollment);
  assert.ok(!h.calls.createBillingTask);
});

test("approve: missing vaulted PM → charge_failed before any Stripe call", async () => {
  const h = makeHarness({
    context: baseContext({ family: { stripe_customer_id: null, stripe_payment_method_id: null } }),
  });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.equal(out.status, "charge_failed");
  assert.ok(!h.calls.stripe);
  assert.ok(h.calls.markChargesFailed);
});

test("approve: PI returns non-succeeded status → charge_failed", async () => {
  const h = makeHarness({ stripeStatus: "requires_action" });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.equal(out.status, "charge_failed");
  assert.ok(!h.calls.activateEnrollment);
});

// ── zero-PI path ─────────────────────────────────────────────────────────────────────

test("approve: all waived (zero-PI) → no Stripe/ledger, arming + activation + count still run", async () => {
  const ctx = baseContext();
  ctx.items[0].approved_amount_cents = 0;
  ctx.items[1].approved_amount_cents = 0;
  const h = makeHarness({ context: ctx });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });

  assert.equal(out.status, "approved");
  assert.equal(out.status === "approved" && out.chargedCents, 0);
  assert.ok(!h.calls.stripe);
  assert.ok(!h.calls.markChargesSucceeded); // no PI → no charges to succeed
  assert.ok(!h.calls.postLedgerGroup);
  assert.ok(h.calls.armIntents); // recurring intent still armed
  assert.deepEqual(h.calls.markChargeItems[0][0], [
    { chargeItemId: "ci-reg", chargeId: null, status: "charged" },
    { chargeItemId: "ci-tui", chargeId: null, status: "charged" },
  ]);
  assert.ok(h.calls.activateEnrollment);
  assert.ok(h.calls.advanceEnrolledCount);
  assert.ok(h.calls.sendConfirmation);
});

// ── deferred first tuition folds into intent ─────────────────────────────────────────

test("approve: deferred first_tuition → PI is registration only, catch-up folded into arming", async () => {
  const ctx = baseContext();
  ctx.items[1].charge_timing = "deferred";
  ctx.items[1].approved_amount_cents = 8000;
  const h = makeHarness({ context: ctx });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });

  assert.equal(out.status === "approved" && out.chargedCents, 5000); // registration only
  assert.equal((h.calls.stripe[0][0] as { amountCents: number }).amountCents, 5000);
  assert.equal((h.calls.armIntents[0][0] as { deferred_addition_cents: number }[])[0].deferred_addition_cents, 8000);
  // tuition item → deferred (not charged)
  const links = h.calls.markChargeItems[0][0] as { chargeItemId: string; status: string }[];
  assert.equal(links.find((l) => l.chargeItemId === "ci-tui")?.status, "deferred");
});

// ── post-charge failure isolation ────────────────────────────────────────────────────

const ISOLATED_STEPS: [method: string, step: string][] = [
  ["markChargesSucceeded", "charges_succeeded"],
  ["postLedgerGroup", "post_ledger_group"],
  ["armIntents", "arm_intents"],
  ["patchChargeIntentIds", "patch_charge_intent_ids"],
  ["markChargeItems", "mark_charge_items"],
  ["activateEnrollment", "activate_enrollment"],
  ["advanceEnrolledCount", "advance_enrolled_count"],
];

for (const [method, step] of ISOLATED_STEPS) {
  test(`approve: post-charge step '${step}' failing → billing_tasks repair + remaining steps still run`, async () => {
    const h = makeHarness({ throwOn: new Set([method]) });
    const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });

    // Still approved (charge already captured — never rolled back).
    assert.equal(out.status, "approved");
    assert.equal(out.status === "approved" && out.repairTasks.length, 1);
    assert.equal(out.status === "approved" && out.repairTasks[0].step, step);

    // Exactly one repair task, tagged with the right step + payload.
    assert.equal(h.calls.createBillingTask.length, 1);
    const task = h.calls.createBillingTask[0][0] as {
      type: string;
      status: string;
      payload: { step: string; error: string; payment_intent_id: string | null; charge_ids: string[] };
    };
    assert.equal(task.type, "approval_post_charge_repair");
    assert.equal(task.status, "open");
    assert.equal(task.payload.step, step);
    assert.equal(task.payload.payment_intent_id, "pi_1");
    assert.ok(Array.isArray(task.payload.charge_ids));

    // The final best-effort step (confirmation email) still ran → remaining steps attempted.
    assert.ok(h.calls.sendConfirmation, `sendConfirmation should still run after '${step}' failed`);
  });
}

test("approve: notification failure is NOT a repair task (logged only)", async () => {
  const h = makeHarness({ confirmThrows: true });
  const out = await approveEnrollment(h, { enrollmentId: "enr1", adminId: "admin1" });
  assert.equal(out.status, "approved");
  assert.ok(!h.calls.createBillingTask); // email failure never creates a billing_task
});

// ── decline ────────────────────────────────────────────────────────────────────────

test("decline: pending → declined, items declined, intent canceled, hold cleared", async () => {
  const h = makeHarness();
  const out = await declineEnrollment(h, { enrollmentId: "enr1", adminId: "admin1", reason: "class full elsewhere" });
  assert.deepEqual(out, { status: "declined" });
  assert.deepEqual(h.calls.declineEnrollment[0], ["enr1", "class full elsewhere", NOW.toISOString()]);
  assert.ok(h.calls.markChargeItemsDeclined);
  assert.ok(h.calls.cancelPendingIntents);
  assert.ok(h.calls.clearHold);
});

test("decline: non-pending is rejected", async () => {
  const h = makeHarness({ context: baseContext({ enrollment: { ...baseContext().enrollment, status: "active" } }) });
  const out = await declineEnrollment(h, { enrollmentId: "enr1", adminId: "admin1", reason: "x" });
  assert.deepEqual(out, { status: "not_pending", actual: "active" });
  assert.ok(!h.calls.declineEnrollment);
});

// ── waitlist promotion parity ────────────────────────────────────────────────────────

function promoContext(): PromotionContext {
  return {
    enrollment: {
      id: "enr1",
      tenant_id: "t1",
      status: "waitlist",
      class_id: "cls-a",
      student_id: "stu-1",
      family_id: "fam1",
    },
    classInfo: { start_date: "2026-09-03", fullMonthCents: 15000 },
    anchorDay: 15,
    method: "meeting",
    holdExpiryDays: 5,
    registrationFeeCents: 5000,
    registrationMode: "per_student",
  };
}

test("promote: charge items + pending intent match the webhook builders exactly", async () => {
  const proration = { recommendedCents: 6000, blob: BLOB };
  const h = makeHarness({ promotionContext: promoContext(), proration });
  const out = await promoteWaitlistEnrollment(h, { enrollmentId: "enr1" });
  assert.deepEqual(out, { status: "promoted" });

  const registration = { amountCents: 5000, studentId: "stu-1" };
  const firstTuition = [{ classId: "cls-a", studentId: "stu-1", recommendedCents: 6000, proration: BLOB }];
  const expectedItems: PendingChargeItemInput[] = buildPendingChargeItems({ registration, firstTuition });
  const expectedIntent = buildPendingIntent({
    tenantId: "t1",
    familyId: "fam1",
    studentId: "stu-1",
    classId: "cls-a",
    monthlyAmountCents: 15000,
    anchorDay: 15,
    sourceRef: null,
    enrollmentId: "enr1",
  });

  assert.deepEqual(h.calls.insertPromotionChargeItems[0][0], expectedItems);
  assert.deepEqual(h.calls.insertPromotionChargeItems[0][1], {
    enrollmentId: "enr1",
    tenantId: "t1",
    familyId: "fam1",
  });
  assert.deepEqual(h.calls.insertPendingIntent[0][0], expectedIntent);

  // Fresh hold clock = now + hold_expiry_days.
  const expectedHold = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
  assert.deepEqual(h.calls.promoteToPending[0], ["enr1", expectedHold]);
});

test("promote: per_family registration attaches with null student_id", async () => {
  const ctx = promoContext();
  ctx.registrationMode = "per_family";
  const h = makeHarness({ promotionContext: ctx, proration: { recommendedCents: 6000, blob: BLOB } });
  await promoteWaitlistEnrollment(h, { enrollmentId: "enr1" });
  const items = h.calls.insertPromotionChargeItems[0][0] as PendingChargeItemInput[];
  const reg = items.find((i) => i.item_type === "registration")!;
  assert.equal(reg.student_id, null);
});

test("promote: non-waitlist is rejected", async () => {
  const ctx = promoContext();
  ctx.enrollment.status = "pending";
  const h = makeHarness({ promotionContext: ctx });
  const out = await promoteWaitlistEnrollment(h, { enrollmentId: "enr1" });
  assert.deepEqual(out, { status: "not_waitlist", actual: "pending" });
  assert.ok(!h.calls.insertPendingIntent);
});
