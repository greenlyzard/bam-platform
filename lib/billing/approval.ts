// Enrollment approval / decline / waitlist-promotion engine (docs/BILLING_APPROVAL_AND_DRAW.md §3.2,
// §3.3, §6.2). Dependency-injected so the ordered control flow — and its post-charge failure
// isolation — is unit-testable with fake repo/Stripe/clock. The real I/O lives in approval-repo.ts;
// the "use server" wrappers in app/(admin)/admin/enrollment/approvals/actions.ts wire the real deps.
//
// The APPROVED ordering is deliberate and must not be reordered:
//   auth+load → assemble → insert charges 'created' (idempotency guard) → off-session PI →
//   [point of no return] each post-charge write individually try/caught; on failure a
//   billing_tasks repair row is written instead of throwing, and the remaining steps still attempt.

import { assembleApprovalCharge, assembleWaitlistPromotion } from "./charges.ts";
import { buildDirectSaleGroup, assertBalanced, type PostingGroupSpec } from "./ledger-posting.ts";
import type { ChargeInsert } from "./charges.ts";
import type { ProrationBlob, ProrationMethod } from "./proration.ts";
import type { PendingChargeItemInput } from "./checkout-lines.ts";
import type { RegistrationFeeMode } from "./enrollment-ledger.ts";

// ── Injected boundaries ────────────────────────────────────────────────────────────────

/** Off-session PaymentIntent gateway. Real impl wraps Stripe; MUST throw on card decline. */
export interface StripeGateway {
  createOffSessionPaymentIntent(args: {
    amountCents: number;
    customerId: string;
    paymentMethodId: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; latestChargeId: string | null; status: string }>;
}

/** Parent confirmation email (§3.2 step 4). Best-effort — failure never blocks activation. */
export type SendConfirmation = (ctx: ConfirmationEmailContext) => Promise<void>;

export interface ConfirmationEmailContext {
  to: string | null;
  parentName: string | null;
  classes: {
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    teacherName: string | null;
  }[];
}

/** A charge item joined with its (already-persisted) approved amount — subset of the Row. */
export interface ApprovalChargeItemCtx {
  id: string;
  item_type: string;
  recurrence_type: string;
  recommended_amount_cents: number;
  approved_amount_cents: number | null;
  charge_timing: string | null;
  class_id: string | null;
  student_id: string | null;
  proration: ProrationBlob | null;
  status: string;
}

/** An existing pending_setup intent (created at checkout) — armed at approval, linked by class/student. */
export interface PendingIntentCtx {
  id: string;
  class_id: string | null;
  student_id: string | null;
}

export interface ApprovalContext {
  enrollment: {
    id: string;
    tenant_id: string;
    status: string;
    class_id: string | null;
    family_id: string | null;
    student_id: string | null;
  };
  family: { stripe_customer_id: string | null; stripe_payment_method_id: string | null };
  items: ApprovalChargeItemCtx[];
  intents: PendingIntentCtx[];
  anchorDay: number;
  /** From the first_tuition item's proration.start_date (guarantees the arming invariant). */
  startDate: string | null;
  email: ConfirmationEmailContext;
}

export interface PromotionContext {
  enrollment: {
    id: string;
    tenant_id: string;
    status: string;
    class_id: string | null;
    student_id: string | null;
    family_id: string | null;
  };
  classInfo: { start_date: string | null; fullMonthCents: number };
  anchorDay: number;
  method: ProrationMethod;
  holdExpiryDays: number;
  registrationFeeCents: number;
  registrationMode: RegistrationFeeMode;
}

export interface BillingTaskInsert {
  tenant_id: string;
  type: string;
  status: string;
  enrollment_id: string | null;
  family_id: string | null;
  intent_id: string | null;
  payload: Record<string, unknown>;
}

/** All DB reads/writes the engine performs (real impl in approval-repo.ts; fakes in tests). */
export interface ApprovalRepo {
  loadApprovalContext(enrollmentId: string): Promise<ApprovalContext | null>;
  /** Approval-source charges for this enrollment (idempotency guard + stuck detection). */
  getApprovalCharges(
    enrollmentId: string
  ): Promise<{ id: string; status: string; stripe_payment_intent_id: string | null }[]>;
  /** Insert 'created' charge rows; returns each row's new id keyed to its charge_item_id. */
  insertChargeRows(
    rows: ChargeInsert[]
  ): Promise<{ id: string; charge_item_id: string; item_type: string }[]>;

  markChargesSucceeded(
    chargeIds: string[],
    piId: string,
    stripeChargeId: string | null,
    capturedAtIso: string
  ): Promise<void>;
  markChargesFailed(chargeIds: string[], errorCode: string): Promise<void>;

  postLedgerGroup(group: PostingGroupSpec, tenantId: string, occurredAtIso: string): Promise<void>;

  armIntents(
    armings: {
      intentId: string;
      monthly_amount_cents: number;
      anchor_day: number;
      next_draw_at: string;
      deferred_addition_cents: number;
    }[]
  ): Promise<void>;
  patchChargeIntentIds(links: { chargeId: string; intentId: string }[]): Promise<void>;
  markChargeItems(
    links: { chargeItemId: string; chargeId: string | null; status: "charged" | "deferred" }[]
  ): Promise<void>;

  activateEnrollment(enrollmentId: string, adminId: string, approvedAtIso: string): Promise<void>;
  setEnrollmentChargeError(enrollmentId: string, error: string): Promise<void>;
  advanceEnrolledCount(classId: string): Promise<void>;

  createBillingTask(task: BillingTaskInsert): Promise<void>;

  // ── decline ──
  getEnrollmentStatus(
    enrollmentId: string
  ): Promise<{ tenant_id: string; status: string } | null>;
  declineEnrollment(enrollmentId: string, reason: string, declinedAtIso: string): Promise<void>;
  markChargeItemsDeclined(enrollmentId: string): Promise<void>;
  cancelPendingIntents(enrollmentId: string, canceledAtIso: string): Promise<void>;
  clearHold(enrollmentId: string): Promise<void>;

  // ── promotion ──
  loadPromotionContext(enrollmentId: string): Promise<PromotionContext | null>;
  computeFirstDrawProration(args: {
    classId: string;
    tenantId: string;
    fullMonthCents: number;
    startDate: string;
    anchorDay: number;
    method: ProrationMethod;
  }): Promise<{ recommendedCents: number; blob: ProrationBlob }>;
  insertPromotionChargeItems(
    items: PendingChargeItemInput[],
    ctx: { enrollmentId: string; tenantId: string; familyId: string | null }
  ): Promise<void>;
  insertPendingIntent(row: import("./charges.ts").PendingIntentInsert): Promise<void>;
  promoteToPending(enrollmentId: string, holdExpiresAtIso: string): Promise<void>;
}

// ── Outcomes ─────────────────────────────────────────────────────────────────────────

export interface RepairTask {
  step: string;
  error: string;
}

export type ApprovalOutcome =
  | {
      status: "approved";
      paymentIntentId: string | null;
      chargedCents: number;
      repairTasks: RepairTask[];
    }
  | { status: "already_processed"; stuck: boolean }
  | { status: "charge_failed"; error: string }
  | { status: "not_pending"; actual: string };

const REPAIR_TASK_TYPE = "approval_post_charge_repair";

interface ApproveDeps {
  repo: ApprovalRepo;
  stripe: StripeGateway;
  sendConfirmation: SendConfirmation;
  now: Date;
}

// ── Approve ────────────────────────────────────────────────────────────────────────────

export async function approveEnrollment(
  deps: ApproveDeps,
  args: { enrollmentId: string; adminId: string }
): Promise<ApprovalOutcome> {
  const { repo, stripe, sendConfirmation, now } = deps;
  const { enrollmentId, adminId } = args;

  // 1. Load + gate: only a pending enrollment is approvable (an expired hold does NOT block —
  // admin discretion, §3.3).
  const ctx = await repo.loadApprovalContext(enrollmentId);
  if (!ctx) return { status: "not_pending", actual: "missing" };
  if (ctx.enrollment.status !== "pending") {
    return { status: "not_pending", actual: ctx.enrollment.status };
  }
  const { tenant_id: tenantId, family_id: familyId, class_id: classId } = ctx.enrollment;

  // 2. Assemble (net resolved inside via netApprovedCents).
  const startDate =
    ctx.startDate ?? ctx.items.find((i) => i.proration)?.proration?.start_date ?? isoDate(now);
  const assembled = assembleApprovalCharge({
    context: { tenantId, familyId: familyId ?? "", enrollmentId, adminId },
    items: ctx.items,
    anchorDay: ctx.anchorDay,
    startDate,
  });

  // 3. Idempotency guard (double-click safety): a non-failed approval charge already exists →
  // already processed. If ALL such charges are 'created' with no PI, it's a stuck pre-Stripe row
  // (ruling B) — surface stuck:true so the UI can offer a manual retry (retry action not built here).
  const existing = await repo.getApprovalCharges(enrollmentId);
  const nonFailed = existing.filter((c) => c.status !== "failed");
  if (nonFailed.length > 0) {
    const stuck = nonFailed.every(
      (c) => c.status === "created" && c.stripe_payment_intent_id == null
    );
    return { status: "already_processed", stuck };
  }

  //    Insert the 'created' charge rows BEFORE calling Stripe.
  const inserted = await repo.insertChargeRows(assembled.chargeRows);
  const chargeIdByItem = new Map(inserted.map((r) => [r.charge_item_id, r.id]));
  const createdChargeIds = inserted.map((r) => r.id);

  // 4. One off-session PI for the charge-now total. Skip entirely when nothing is charged now.
  let paymentIntentId: string | null = null;
  let stripeChargeId: string | null = null;
  if (assembled.paymentIntentAmountCents > 0) {
    const customerId = ctx.family.stripe_customer_id;
    const paymentMethodId = ctx.family.stripe_payment_method_id;
    if (!customerId || !paymentMethodId) {
      const msg = "No vaulted payment method on file for this family";
      await repo.markChargesFailed(createdChargeIds, "no_payment_method");
      await repo.setEnrollmentChargeError(enrollmentId, msg);
      return { status: "charge_failed", error: msg };
    }
    try {
      const pi = await stripe.createOffSessionPaymentIntent({
        amountCents: assembled.paymentIntentAmountCents,
        customerId,
        paymentMethodId,
        idempotencyKey: `approval:${enrollmentId}`,
        metadata: { enrollment_id: enrollmentId, tenant_id: tenantId, source: "approval" },
      });
      if (pi.status !== "succeeded") {
        // 6. Non-success (requires_action/processing/declined) → treat as failure; stay pending.
        const msg = `Payment not completed (status: ${pi.status})`;
        await repo.markChargesFailed(createdChargeIds, `pi_${pi.status}`);
        await repo.setEnrollmentChargeError(enrollmentId, msg);
        return { status: "charge_failed", error: msg };
      }
      paymentIntentId = pi.id;
      stripeChargeId = pi.latestChargeId;
    } catch (e) {
      // 6. Card declined off-session → charges failed, error stamped, enrollment STAYS pending.
      const msg = errMessage(e);
      await repo.markChargesFailed(createdChargeIds, "card_declined");
      await repo.setEnrollmentChargeError(enrollmentId, msg);
      return { status: "charge_failed", error: msg };
    }
  }

  // 5 / 7. Point of no return (or zero-PI activation). Every write below is individually isolated:
  // a failure writes a billing_tasks repair row and the remaining steps still attempt.
  const repairTasks: RepairTask[] = [];
  const step = async (name: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      const error = errMessage(e);
      repairTasks.push({ step: name, error });
      try {
        await repo.createBillingTask({
          tenant_id: tenantId,
          type: REPAIR_TASK_TYPE,
          status: "open",
          enrollment_id: enrollmentId,
          family_id: familyId,
          intent_id: null,
          payload: {
            step: name,
            error,
            payment_intent_id: paymentIntentId,
            charge_ids: createdChargeIds,
          },
        });
      } catch (taskErr) {
        // Last-ditch: we could not even record the repair task. Nothing left but to log.
        console.error("[approval] failed to write billing_tasks repair row", name, taskErr);
      }
    }
  };

  const capturedAt = now.toISOString();

  // (a) charges → succeeded + captured_at + stripe ids (only when a PI actually ran).
  if (paymentIntentId && createdChargeIds.length > 0) {
    await step("charges_succeeded", () =>
      repo.markChargesSucceeded(createdChargeIds, paymentIntentId!, stripeChargeId, capturedAt)
    );
  }

  // (b) post the balanced revenue ledger group (only when money was captured).
  if (paymentIntentId && assembled.capturedSaleLines.length > 0) {
    await step("post_ledger_group", async () => {
      const group = buildDirectSaleGroup({
        paymentIntentId: paymentIntentId!,
        familyId,
        lines: assembled.capturedSaleLines,
      });
      if (!group) return;
      assertBalanced(group);
      await repo.postLedgerGroup(group, tenantId, capturedAt);
    });
  }

  // (c) arm the recurring intents (pending_setup → active, full-month amount, start-date-anchored
  // next_draw_at, deferred catch-up folded in).
  const armings = assembled.intentArmings
    .map((a) => {
      const intentId = matchIntentId(ctx.intents, a.class_id, a.student_id);
      return intentId
        ? {
            intentId,
            monthly_amount_cents: a.monthly_amount_cents,
            anchor_day: a.anchor_day,
            next_draw_at: a.next_draw_at,
            deferred_addition_cents: a.deferred_addition_cents,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (armings.length > 0) {
    await step("arm_intents", () => repo.armIntents(armings));
  }

  // (d) patch intent_id onto each first_tuition charge row (route responsibility, per charges.ts).
  const intentLinks = assembled.chargeRows
    .filter((r) => r.kind === "first_tuition")
    .map((r) => {
      const chargeItemId = (r.metadata as { charge_item_id?: string } | null)?.charge_item_id;
      const chargeId = chargeItemId ? chargeIdByItem.get(chargeItemId) : undefined;
      const intentId = matchIntentId(ctx.intents, r.class_id, r.student_id);
      return chargeId && intentId ? { chargeId, intentId } : null;
    })
    .filter((x): x is { chargeId: string; intentId: string } => x !== null);
  if (intentLinks.length > 0) {
    await step("patch_charge_intent_ids", () => repo.patchChargeIntentIds(intentLinks));
  }

  // (e) charge items → charged (+ charge_id backref) / deferred first_tuition → deferred.
  const itemLinks = ctx.items
    .filter((i) => i.status !== "declined")
    .map((i) => {
      const isDeferred = i.charge_timing === "deferred" && i.recurrence_type === "recurring";
      return {
        chargeItemId: i.id,
        chargeId: chargeIdByItem.get(i.id) ?? null,
        status: (isDeferred ? "deferred" : "charged") as "deferred" | "charged",
      };
    });
  if (itemLinks.length > 0) {
    await step("mark_charge_items", () => repo.markChargeItems(itemLinks));
  }

  // (f) activate the enrollment (pending → active, approved_by/at).
  await step("activate_enrollment", () =>
    repo.activateEnrollment(enrollmentId, adminId, capturedAt)
  );

  // (g) advance the display counter (capacity gate itself reads live pending+active — §3.3).
  if (classId) {
    await step("advance_enrolled_count", () => repo.advanceEnrolledCount(classId));
  }

  // (h) parent confirmation email — best-effort; failure is console.error ONLY, never a repair task
  // (ruling C: repair tasks are for money/state integrity, not notifications).
  try {
    await sendConfirmation(ctx.email);
  } catch (e) {
    console.error("[approval] confirmation email failed (non-fatal)", enrollmentId, errMessage(e));
  }

  return {
    status: "approved",
    paymentIntentId,
    chargedCents: assembled.paymentIntentAmountCents,
    repairTasks,
  };
}

// ── Decline ────────────────────────────────────────────────────────────────────────────

export async function declineEnrollment(
  deps: { repo: ApprovalRepo; now: Date },
  args: { enrollmentId: string; adminId: string; reason: string }
): Promise<{ status: "declined" | "not_pending"; actual?: string }> {
  const { repo, now } = deps;
  const { enrollmentId, reason } = args;

  const enr = await repo.getEnrollmentStatus(enrollmentId);
  if (!enr) return { status: "not_pending", actual: "missing" };
  if (enr.status !== "pending") return { status: "not_pending", actual: enr.status };

  const iso = now.toISOString();
  // Nothing was ever charged (card only vaulted) — a simple sequential teardown.
  await repo.declineEnrollment(enrollmentId, reason, iso);
  await repo.markChargeItemsDeclined(enrollmentId);
  await repo.cancelPendingIntents(enrollmentId, iso);
  await repo.clearHold(enrollmentId);

  return { status: "declined" };
}

// ── Waitlist → pending promotion ────────────────────────────────────────────────────────

export async function promoteWaitlistEnrollment(
  deps: { repo: ApprovalRepo; now: Date },
  args: { enrollmentId: string }
): Promise<{ status: "promoted" | "not_waitlist"; actual?: string }> {
  const { repo, now } = deps;
  const { enrollmentId } = args;

  const ctx = await repo.loadPromotionContext(enrollmentId);
  if (!ctx) return { status: "not_waitlist", actual: "missing" };
  if (ctx.enrollment.status !== "waitlist") {
    return { status: "not_waitlist", actual: ctx.enrollment.status };
  }

  const { tenant_id: tenantId, family_id: familyId, student_id: studentId, class_id: classId } =
    ctx.enrollment;
  if (!classId) return { status: "not_waitlist", actual: "no_class" };

  const startDate = ctx.classInfo.start_date ?? isoDate(now);
  const { recommendedCents, blob } = await repo.computeFirstDrawProration({
    classId,
    tenantId,
    fullMonthCents: ctx.classInfo.fullMonthCents,
    startDate,
    anchorDay: ctx.anchorDay,
    method: ctx.method,
  });

  const registration =
    ctx.registrationFeeCents > 0
      ? {
          amountCents: ctx.registrationFeeCents,
          studentId: ctx.registrationMode === "per_family" ? null : studentId,
        }
      : null;

  // Same builders the webhook uses (charges.ts) → promotion can't drift from checkout (§3.3).
  const promo = assembleWaitlistPromotion({
    registration,
    firstTuition: [{ classId, studentId, recommendedCents, proration: blob }],
    intent: {
      tenantId,
      familyId: familyId ?? "",
      studentId,
      classId,
      monthlyAmountCents: ctx.classInfo.fullMonthCents,
      anchorDay: ctx.anchorDay,
      sourceRef: null,
      enrollmentId,
    },
  });

  await repo.insertPromotionChargeItems(promo.chargeItems, {
    enrollmentId,
    tenantId,
    familyId,
  });
  await repo.insertPendingIntent(promo.intent);

  // Fresh hold clock from the tenant's hold_expiry_days (NO charging at promotion).
  const holdExpires = new Date(now.getTime() + ctx.holdExpiryDays * 86_400_000).toISOString();
  await repo.promoteToPending(enrollmentId, holdExpires);

  return { status: "promoted" };
}

// ── helpers ──────────────────────────────────────────────────────────────────────────

function matchIntentId(
  intents: PendingIntentCtx[],
  classId: string | null,
  studentId: string | null
): string | null {
  const hit = intents.find((i) => i.class_id === classId && i.student_id === studentId);
  return hit?.id ?? null;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 'YYYY-MM-DD' (UTC) — only used as a start-date fallback when no proration blob is present. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
