"use server";

// Enrollment approval / decline / waitlist-promotion server actions (BILLING_APPROVAL_AND_DRAW.md
// §3.2, §3.3). Thin wrappers: gate on admin, build the real deps (createAdminClient service role,
// Stripe, confirmation email), delegate all logic to the injected engine in lib/billing/approval.ts,
// then revalidate the queue. The engine owns ordering + post-charge failure isolation.

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendEnrollmentConfirmation } from "@/lib/email/enrollment-confirmation";
import { buildAdjustmentRow, type AdjustmentType } from "@/lib/billing/adjustments";
import {
  approveEnrollment,
  declineEnrollment,
  promoteWaitlistEnrollment,
  type StripeGateway,
  type SendConfirmation,
  type ApprovalOutcome,
} from "@/lib/billing/approval";
import { createSupabaseApprovalRepo } from "@/lib/billing/approval-repo";

const APPROVALS_PATH = "/admin/enrollment/approvals";

/** Off-session PaymentIntent gateway — throws on card decline so the engine hits its failure path. */
function stripeGateway(): StripeGateway {
  const stripe = getStripe();
  return {
    async createOffSessionPaymentIntent(a) {
      const pi = await stripe.paymentIntents.create(
        {
          amount: a.amountCents,
          currency: "usd",
          customer: a.customerId,
          payment_method: a.paymentMethodId,
          off_session: true,
          confirm: true,
          metadata: a.metadata,
        },
        { idempotencyKey: a.idempotencyKey }
      );
      const latest = pi.latest_charge;
      const latestChargeId =
        typeof latest === "string" ? latest : ((latest as Stripe.Charge | null)?.id ?? null);
      return { id: pi.id, latestChargeId, status: pi.status };
    },
  };
}

const sendConfirmation: SendConfirmation = async (ctx) => {
  if (!ctx.to) return;
  await sendEnrollmentConfirmation({
    to: ctx.to,
    parentName: ctx.parentName,
    classes: ctx.classes,
  });
};

export async function approveEnrollmentAction(enrollmentId: string): Promise<ApprovalOutcome> {
  const admin = await requireAdmin();
  const repo = createSupabaseApprovalRepo(createAdminClient());
  const outcome = await approveEnrollment(
    { repo, stripe: stripeGateway(), sendConfirmation, now: new Date() },
    { enrollmentId, adminId: admin.id }
  );
  revalidatePath(APPROVALS_PATH);
  return outcome;
}

export async function declineEnrollmentAction(enrollmentId: string, reason: string) {
  const admin = await requireAdmin();
  const repo = createSupabaseApprovalRepo(createAdminClient());
  const outcome = await declineEnrollment(
    { repo, now: new Date() },
    { enrollmentId, adminId: admin.id, reason }
  );
  revalidatePath(APPROVALS_PATH);
  return outcome;
}

export async function promoteWaitlistEnrollmentAction(enrollmentId: string) {
  await requireAdmin();
  const repo = createSupabaseApprovalRepo(createAdminClient());
  const outcome = await promoteWaitlistEnrollment({ repo, now: new Date() }, { enrollmentId });
  revalidatePath(APPROVALS_PATH);
  return outcome;
}

// ── Adjustment write path (§3.2, §4.4) ───────────────────────────────────────────────
// The approval engine reads persisted `approved_amount_cents` via netApprovedCents, so adjustments
// must be persisted BEFORE approval. These actions are the only writers of that value + the
// append-only charge_item_adjustments audit log. `value` units follow adjustments.ts:
// amount_off = CENTS, percent_off = BASIS POINTS, waive = ignored (UI converts at its edge).

type ItemActionResult = { ok: true; approvedCents?: number } | { ok: false; error: string };

const ADJUSTABLE_STATUSES = ["pending", "approved"];

/** Apply a waive / $-off / %-off to one charge item: log it + set approved_amount_cents. */
export async function applyChargeItemAdjustmentAction(input: {
  chargeItemId: string;
  type: AdjustmentType;
  value: number;
  reason: string;
}): Promise<ItemActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("enrollment_charge_items")
    .select("id, tenant_id, recommended_amount_cents, status")
    .eq("id", input.chargeItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Charge item not found" };
  if (!ADJUSTABLE_STATUSES.includes(item.status)) {
    return { ok: false, error: `Cannot adjust a ${item.status} item` };
  }

  let row;
  try {
    row = buildAdjustmentRow({
      tenantId: item.tenant_id,
      chargeItemId: item.id,
      adminId: admin.id,
      recommendedCents: item.recommended_amount_cents,
      adjustment: { type: input.type, value: input.value, reason: input.reason },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid adjustment" };
  }

  const { error: logErr } = await supabase.from("charge_item_adjustments").insert(row);
  if (logErr) return { ok: false, error: logErr.message };

  const { error: updErr } = await supabase
    .from("enrollment_charge_items")
    .update({ approved_amount_cents: row.approved_cents })
    .eq("id", item.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(APPROVALS_PATH);
  return { ok: true, approvedCents: row.approved_cents };
}

/** Toggle a recurring first-tuition item between charge_now and deferred (folds into next draw). */
export async function setChargeItemTimingAction(input: {
  chargeItemId: string;
  defer: boolean;
}): Promise<ItemActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("enrollment_charge_items")
    .select("id, recurrence_type, status")
    .eq("id", input.chargeItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Charge item not found" };
  if (!ADJUSTABLE_STATUSES.includes(item.status)) {
    return { ok: false, error: `Cannot change a ${item.status} item` };
  }
  if (input.defer && item.recurrence_type !== "recurring") {
    return { ok: false, error: "Only recurring tuition can be deferred" };
  }

  const { error } = await supabase
    .from("enrollment_charge_items")
    .update({ charge_timing: input.defer ? "deferred" : "charge_now" })
    .eq("id", item.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(APPROVALS_PATH);
  return { ok: true };
}

/** Reset an item: approved_amount_cents → null, charge_timing → charge_now, logged as an audit row. */
export async function resetChargeItemAdjustmentAction(input: {
  chargeItemId: string;
}): Promise<ItemActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("enrollment_charge_items")
    .select("id, tenant_id, recommended_amount_cents, status")
    .eq("id", input.chargeItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Charge item not found" };
  if (!ADJUSTABLE_STATUSES.includes(item.status)) {
    return { ok: false, error: `Cannot reset a ${item.status} item` };
  }

  // Append-only audit row for the clear (adjustment_type 'reset' — back to full recommended).
  const { error: logErr } = await supabase.from("charge_item_adjustments").insert({
    tenant_id: item.tenant_id,
    charge_item_id: item.id,
    admin_id: admin.id,
    adjustment_type: "reset",
    value: 0,
    recommended_cents: item.recommended_amount_cents,
    approved_cents: item.recommended_amount_cents,
    reason: "Reset to recommended amount",
  });
  if (logErr) return { ok: false, error: logErr.message };

  const { error: updErr } = await supabase
    .from("enrollment_charge_items")
    .update({ approved_amount_cents: null, charge_timing: "charge_now" })
    .eq("id", item.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(APPROVALS_PATH);
  return { ok: true };
}
