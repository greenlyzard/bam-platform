import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEnrollmentConfirmation } from "@/lib/email/enrollment-confirmation";
import {
  selectUnprocessedItems,
  enrollmentDedupeKey,
  type CheckoutItem,
} from "@/lib/billing/enrollment-ledger";
import {
  buildDirectSaleGroup,
  assertBalanced,
  type LedgerLeg,
} from "@/lib/billing/ledger-posting";
import { splitCheckoutLines } from "@/lib/billing/checkout-lines";
import type Stripe from "stripe";

// Type bridge for the post_ledger_group RPC (added by 20260715180000_ledger_groups_rebuild.sql;
// not in the generated types until `supabase gen types` runs). Remove after regen.
interface PostLedgerGroupArgs {
  p_tenant: string;
  p_posting_key: string;
  p_event_type: string;
  p_occurred_at: string;
  p_source_system: string;
  p_source_ref: string;
  p_legs: LedgerLeg[];
  p_reversal_of: string | null;
}
type RpcFn = (
  name: "post_ledger_group",
  args: PostLedgerGroupArgs
) => Promise<{ error: { message: string } | null }>;

/**
 * POST — Stripe webhook for the Checkout-Session enrollment path.
 *
 * This is the SINGLE source of enrollment-record creation (COMMERCE_AND_BILLING.md §3,
 * Layer 1). On `checkout.session.completed` it creates, server-side with the service
 * role, both the `enrollments` row(s) AND the matching `ledger_entries` revenue row(s),
 * idempotently (keyed on the Stripe payment intent + student + class), so a webhook
 * retry never double-creates. Failures are surfaced (HTTP 500) so Stripe retries.
 */

interface JoinedClass {
  id: string;
  name: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  enrolled_count: number | null;
  location_id: string | null;
  teacher:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
}

interface CartItemRow {
  id: string;
  class_id: string;
  student_id: string | null;
  student_name: string | null;
  price_cents: number;
  charge_timing: string | null;
  class: JoinedClass | JoinedClass[] | null;
}

function firstOrSelf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[enrollment:webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Service role: ledger_entries is admin-only under RLS, and a webhook has no user session.
  const supabase = createAdminClient();

  switch (event.type) {
    // Card captures synchronously (payment_status='paid' at completion); ACH Direct Debit
    // settles asynchronously — the session completes with payment_status='unpaid', then
    // checkout.session.async_payment_succeeded fires on settlement. Finalize (create
    // enrollments + post the ledger) only when the money is actually there; both success
    // signals share this body.
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // ACH pending: completed but not yet paid → wait for async_payment_succeeded. Never post
      // the ledger for money that hasn't settled.
      if (event.type === "checkout.session.completed" && session.payment_status === "unpaid") {
        console.log(
          "[enrollment:webhook] checkout completed, ACH payment pending — awaiting settlement",
          session.id
        );
        return NextResponse.json({ received: true, pending: true });
      }

      const cartId = session.metadata?.cart_id;
      const tenantId = session.metadata?.tenant_id;

      if (!cartId || !tenantId) {
        console.error("[enrollment:webhook] Missing cart_id or tenant_id in metadata");
        // Nothing we can do — ack so Stripe stops retrying a malformed event.
        return NextResponse.json({ received: true, skipped: "missing_metadata" });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      if (!paymentIntentId) {
        console.error("[enrollment:webhook] No payment_intent on session", session.id);
        return NextResponse.json({ error: "No payment intent" }, { status: 500 });
      }

      // Load cart items + class detail.
      const { data: itemsRaw, error: itemsErr } = await supabase
        .from("enrollment_cart_items")
        .select(
          `
          id, class_id, student_id, student_name, price_cents, charge_timing,
          class:classes(
            id, name, day_of_week, start_time, end_time, room, enrolled_count, location_id,
            teacher:profiles!teacher_id(first_name, last_name)
          )
        `
        )
        .eq("cart_id", cartId);

      if (itemsErr) {
        console.error("[enrollment:webhook] Failed to load cart items", itemsErr);
        return NextResponse.json({ error: "Failed to load cart" }, { status: 500 });
      }

      const items = (itemsRaw ?? []) as unknown as CartItemRow[];
      if (items.length === 0) {
        console.error("[enrollment:webhook] No items found for cart", cartId);
        return NextResponse.json({ received: true, skipped: "empty_cart" });
      }

      // Cart → family.
      const { data: cart } = await supabase
        .from("enrollment_carts")
        .select("family_id")
        .eq("id", cartId)
        .single();
      const familyId = cart?.family_id ?? null;

      // ── Idempotency: which (paymentIntent, student, class) enrollments already exist? ──
      const { data: existing, error: existingErr } = await supabase
        .from("enrollments")
        .select("student_id, class_id")
        .eq("stripe_payment_intent_id", paymentIntentId);

      if (existingErr) {
        console.error("[enrollment:webhook] Failed to read existing enrollments", existingErr);
        return NextResponse.json({ error: "Idempotency check failed" }, { status: 500 });
      }

      const existingKeys = new Set(
        (existing ?? []).map((e) =>
          enrollmentDedupeKey(paymentIntentId, e.student_id, e.class_id)
        )
      );

      const checkoutItems: (CheckoutItem & { row: CartItemRow })[] = items.map((it) => {
        const cls = firstOrSelf(it.class);
        return {
          classId: it.class_id,
          studentId: it.student_id,
          priceCents: it.price_cents,
          locationId: cls?.location_id ?? null,
          row: it,
        };
      });

      const toProcess = selectUnprocessedItems(checkoutItems, existingKeys, paymentIntentId);

      const occurredAt = new Date().toISOString();

      const enrolledClasses: {
        name: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        room: string | null;
        teacherName: string | null;
      }[] = [];
      const errors: string[] = [];

      for (const item of toProcess) {
        const cls = firstOrSelf(item.row.class);

        // 1. Enrollment (the idempotency anchor).
        const { data: enr, error: enrollErr } = await supabase
          .from("enrollments")
          .insert({
            tenant_id: tenantId,
            family_id: familyId,
            student_id: item.studentId,
            class_id: item.classId,
            status: "active",
            enrollment_type: "paid",
            stripe_payment_intent_id: paymentIntentId,
            // Tuition is SCHEDULED (drawn on the 15th), not paid at checkout — only the
            // registration fee is charged now. So nothing of the tuition is paid yet.
            amount_paid_cents: 0,
          })
          .select("id")
          .single();

        if (enrollErr || !enr) {
          console.error("[enrollment:webhook] enrollment insert failed", item.classId, enrollErr);
          errors.push(`enrollment:${item.classId}`);
          continue;
        }

        // 2. Bump enrolled_count (NOT the phantom `enrollment_count`).
        //    (Ledger is posted once, for the whole checkout, after this loop — see below.)
        if (cls && typeof cls.enrolled_count === "number") {
          await supabase
            .from("classes")
            .update({ enrolled_count: cls.enrolled_count + 1 })
            .eq("id", item.classId);
        }

        const teacher = firstOrSelf(cls?.teacher ?? null);
        enrolledClasses.push({
          name: cls?.name ?? "Class",
          dayOfWeek: cls?.day_of_week ?? 0,
          startTime: cls?.start_time ?? "",
          endTime: cls?.end_time ?? "",
          room: cls?.room ?? null,
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
        });
      }

      // Surface partial failure so Stripe retries; already-created items are skipped next time.
      if (errors.length > 0) {
        console.error("[enrollment:webhook] finalization had errors", cartId, errors);
        return NextResponse.json(
          { error: "Finalization incomplete", failed: errors },
          { status: 500 }
        );
      }

      // ── Authorization checkout finalize (AUTHORIZATION_CHECKOUT.md §4.6):
      //    (a) post the IMMEDIATE lines (registration fee) as direct_sale_captured,
      //    (b) record SCHEDULED tuition as pending_setup intents (no charge now),
      //    (c) persist the vaulted card to the family.
      const { data: settingsRow } = await supabase
        .from("studio_settings")
        .select("registration_fee_cents")
        .limit(1)
        .maybeSingle();
      const registrationFeeCents =
        (settingsRow?.registration_fee_cents as number | undefined) ?? 0;

      const { immediate, scheduled } = splitCheckoutLines({
        items: checkoutItems.map((c) => ({
          classId: c.classId,
          studentId: c.studentId,
          studentName: c.row.student_name,
          priceCents: c.priceCents,
          chargeTiming: (c.row.charge_timing as "immediate" | "scheduled") ?? "scheduled",
        })),
        registrationFeeCents,
      });

      // (a) Immediate lines → one balanced direct_sale_captured group via the RPC. Idempotent on
      //     UNIQUE(tenant_id, posting_key) (ON CONFLICT DO NOTHING) — a retry no-ops.
      const saleGroup = buildDirectSaleGroup({
        paymentIntentId,
        familyId,
        lines: immediate.map((l) => ({
          account: l.account,
          amountCents: l.amountCents,
          familyId,
          studentId: l.studentId,
          classId: l.classId,
        })),
      });
      if (saleGroup) {
        assertBalanced(saleGroup); // defense-in-depth ahead of the DB trigger
        const rpc = supabase.rpc.bind(supabase) as unknown as RpcFn;
        const { error: postErr } = await rpc("post_ledger_group", {
          p_tenant: tenantId,
          p_posting_key: saleGroup.postingKey,
          p_event_type: saleGroup.eventType,
          p_occurred_at: occurredAt,
          p_source_system: saleGroup.sourceSystem,
          p_source_ref: saleGroup.sourceRef,
          p_legs: saleGroup.legs,
          p_reversal_of: null,
        });
        if (postErr) {
          console.error("[enrollment:webhook] ledger posting failed", postErr);
          return NextResponse.json({ error: "Ledger posting failed" }, { status: 500 });
        }
      }

      // (b) Scheduled tuition intents → pending_setup rows (no charge). Idempotent per
      //     (payment_intent, class, student) so a webhook retry doesn't duplicate.
      for (const s of scheduled) {
        let dupQ = supabase
          .from("tuition_schedule_intent")
          .select("id")
          .eq("source_ref", paymentIntentId)
          .eq("class_id", s.classId);
        dupQ = s.studentId ? dupQ.eq("student_id", s.studentId) : dupQ.is("student_id", null);
        const { data: dup } = await dupQ.maybeSingle();
        if (dup) continue;

        const { error: intentErr } = await supabase.from("tuition_schedule_intent").insert({
          tenant_id: tenantId,
          family_id: familyId,
          student_id: s.studentId,
          class_id: s.classId,
          monthly_amount_cents: s.monthlyAmountCents,
          anchor_day: s.anchorDay,
          status: "pending_setup",
          source_ref: paymentIntentId,
        });
        if (intentErr) {
          console.error("[enrollment:webhook] tuition intent insert failed", s.classId, intentErr);
          return NextResponse.json({ error: "Intent recording failed" }, { status: 500 });
        }
      }

      // (c) Persist the vaulted card (payment method) to the family for later off-session draws.
      if (familyId) {
        try {
          const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
          const pmId =
            typeof pi.payment_method === "string"
              ? pi.payment_method
              : pi.payment_method?.id ?? null;
          if (pmId) {
            await supabase
              .from("families")
              .update({ stripe_payment_method_id: pmId })
              .eq("id", familyId);
          }
        } catch (err) {
          console.error("[enrollment:webhook] failed to persist payment method (non-fatal)", err);
        }
      }

      // Mark cart completed (idempotent).
      await supabase
        .from("enrollment_carts")
        .update({ status: "completed" })
        .eq("id", cartId);

      // Confirmation email only when new enrollments were created (skips on pure retry).
      if (enrolledClasses.length > 0) {
        const customerEmail = session.customer_email ?? session.customer_details?.email;
        const customerName = session.customer_details?.name ?? null;
        if (customerEmail) {
          await sendEnrollmentConfirmation({
            to: customerEmail,
            parentName: customerName,
            classes: enrolledClasses,
          }).catch((err) => {
            console.error("[enrollment:webhook] confirmation email failed (non-fatal)", err);
          });
        }
      }

      console.log(
        "[enrollment:webhook] Checkout completed:",
        cartId,
        `${enrolledClasses.length} new enrollment(s), ${existingKeys.size} pre-existing`
      );
      return NextResponse.json({ received: true, created: enrolledClasses.length });
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.warn(
        "[enrollment:webhook] async (ACH) payment failed — not finalizing",
        session.id,
        session.metadata?.cart_id
      );
      // No dedicated cart status without a schema change (status CHECK lacks 'payment_failed');
      // leaving the cart as-is and logging. See judgment calls.
      return NextResponse.json({ received: true, failed: true });
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const cartId = session.metadata?.cart_id;
      if (cartId) {
        await supabase
          .from("enrollment_carts")
          .update({ status: "expired" })
          .eq("id", cartId);
        console.log("[enrollment:webhook] Checkout expired:", cartId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
