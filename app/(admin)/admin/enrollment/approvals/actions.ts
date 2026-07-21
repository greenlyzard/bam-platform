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
