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
  buildCheckoutPostingGroups,
  assertBalanced,
  type LedgerLeg,
} from "@/lib/billing/ledger-posting";
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
          id, class_id, student_id, student_name, price_cents,
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
            amount_paid_cents: item.priceCents,
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

      // ── Post balanced double-entry ledger groups via the RPC (Fable §3: R1 finalize + R2
      // payment). The WRITE PATH is post_ledger_group(): it inserts group + legs atomically in
      // one transaction and dedupes on UNIQUE(tenant_id, posting_key) via ON CONFLICT DO NOTHING,
      // so a redelivered/concurrent webhook no-ops (no check-then-insert race). The DB's deferred
      // constraint trigger enforces Σdebits=Σcredits at commit; we also assert here before the
      // call. Posted for ALL cart items once enrollments are in place. Payment/enrollment STATE
      // lives on their own rows, never the ledger.
      const groups = buildCheckoutPostingGroups({
        paymentIntentId,
        familyId,
        items: checkoutItems.map((c) => ({
          classId: c.classId,
          studentId: c.studentId,
          priceCents: c.priceCents,
          locationId: c.locationId,
        })),
      });

      const rpc = supabase.rpc.bind(supabase) as unknown as RpcFn;
      for (const group of groups) {
        assertBalanced(group); // defense-in-depth ahead of the DB trigger
        const { error: postErr } = await rpc("post_ledger_group", {
          p_tenant: tenantId,
          p_posting_key: group.postingKey,
          p_event_type: group.eventType,
          p_occurred_at: occurredAt,
          p_source_system: group.sourceSystem,
          p_source_ref: group.sourceRef,
          p_legs: group.legs,
          p_reversal_of: null,
        });
        if (postErr) {
          console.error("[enrollment:webhook] ledger posting failed", group.eventType, postErr);
          return NextResponse.json(
            { error: "Ledger posting failed", group: group.eventType },
            { status: 500 }
          );
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
