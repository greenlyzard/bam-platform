import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enrollmentDedupeKey,
  chargeItemDedupeKey,
  selectMissingChargeItems,
  shouldAttachRegistration,
  enrollmentStatusForCapacity,
  studentClassKey,
  duplicateSkipFor,
  shouldNotifyNewPendingEnrollment,
  FAMILY_REG_KEY,
  type BlockingEnrollment,
  type RegistrationFeeMode,
} from "@/lib/billing/enrollment-ledger";
import { buildPendingChargeItems } from "@/lib/billing/checkout-lines";
import { buildPendingIntent } from "@/lib/billing/charges";
import {
  computeFirstDrawProrationFromDb,
  nextAnchorDate,
  type ProrationBlob,
  type ProrationMethod,
} from "@/lib/billing/proration";
import { sendEnrollmentReceived } from "@/lib/email/enrollment-received";
import { notifyAdminsNewPendingEnrollment } from "@/lib/notifications/admin-pending-enrollment";
import type Stripe from "stripe";

/**
 * POST — Stripe webhook for the VAULT-ONLY enrollment path (BILLING_APPROVAL_AND_DRAW.md §1.2).
 *
 * Checkout is setup mode: the card is vaulted and NO money moves. On checkout.session.completed the
 * webhook creates, server-side with the service role, PENDING enrollments (with a capacity hold),
 * their pending enrollment_charge_items (registration + prorated first tuition — charged later at
 * admin approval), and pending_setup tuition intents. Nothing is charged and nothing is posted to
 * the ledger here. Everything is idempotent, keyed on the Checkout Session id (setup mode has no
 * PaymentIntent), so a retry never double-creates. Failures return HTTP 500 so Stripe retries.
 */

interface JoinedClass {
  id: string;
  name: string | null;
  start_date: string | null;
  max_students: number | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
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

/**
 * Await a side-effect (email / notification) but never let its failure fail the webhook. Awaited
 * (not detached) so it actually completes in the serverless request before the response returns.
 */
async function safeSideEffect(p: Promise<unknown>, label: string): Promise<void> {
  try {
    await p;
  } catch (e) {
    console.error(`[enrollment:webhook] ${label} failed (non-fatal)`, e);
  }
}

/** The student's start date: the class start date if it is still in the future, else today (UTC). */
function classStartYmd(startDate: string | null | undefined, todayYmd: string): string {
  return startDate && startDate > todayYmd ? startDate : todayYmd;
}

/**
 * Proration with failure isolation (§4): computeFirstDrawProrationFromDb already picks the
 * schedule_instances → day_of_week fallback internally. If the whole loader throws (DB error), do
 * NOT abort the cart — recommend the full month and mark the blob with a failure note.
 */
async function safeFirstDrawProration(
  client: ReturnType<typeof createAdminClient>,
  args: {
    classId: string;
    tenantId: string;
    fullMonthCents: number;
    startDate: string;
    anchorDay: number;
    method: ProrationMethod;
  }
): Promise<{ recommendedCents: number; blob: ProrationBlob }> {
  try {
    return await computeFirstDrawProrationFromDb(client, args);
  } catch (e) {
    console.error("[enrollment:webhook] proration failed; full-month fallback", args.classId, e);
    return {
      recommendedCents: args.fullMonthCents,
      blob: {
        method: args.method,
        source: "day_of_week_fallback",
        full_month_cents: args.fullMonthCents,
        meetings_in_cycle: 0,
        deliverable_meetings_in_window: 0,
        start_date: args.startDate,
        next_anchor_date: nextAnchorDate(args.startDate, args.anchorDay),
        note: "proration_loader_failed; recommended full month for admin review",
      },
    };
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[enrollment:webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Service role: enrollment/charge tables are admin-only under RLS and a webhook has no session.
  const supabase = createAdminClient();

  switch (event.type) {
    // Belt-and-suspenders: ensure the vaulted payment method is persisted even if the session
    // handler missed it. setup_intent.succeeded carries the family_id in metadata.
    case "setup_intent.succeeded": {
      const si = event.data.object as Stripe.SetupIntent;
      const familyId = si.metadata?.family_id;
      const pmId =
        typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
      if (familyId && pmId) {
        await supabase
          .from("families")
          .update({ stripe_payment_method_id: pmId })
          .eq("id", familyId);
      }
      return NextResponse.json({ received: true });
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Enrollment checkout is setup mode. A payment-mode session (future merch) is not ours here.
      if (session.mode !== "setup") {
        return NextResponse.json({ received: true, skipped: "not_setup_mode" });
      }

      const cartId = session.metadata?.cart_id;
      const tenantId = session.metadata?.tenant_id;
      if (!cartId || !tenantId) {
        console.error("[enrollment:webhook] Missing cart_id or tenant_id in metadata");
        return NextResponse.json({ received: true, skipped: "missing_metadata" });
      }

      // The Checkout Session id is the canonical dedupe anchor (setup mode has no PaymentIntent).
      const sessionId = session.id;
      const setupIntentId =
        typeof session.setup_intent === "string"
          ? session.setup_intent
          : session.setup_intent?.id ?? null;

      // Cart items + class detail (start_date drives proration; teacher/time drive the email).
      const { data: itemsRaw, error: itemsErr } = await supabase
        .from("enrollment_cart_items")
        .select(
          `
          id, class_id, student_id, student_name, price_cents, charge_timing,
          class:classes(
            id, name, start_date, max_students, day_of_week, start_time, end_time, room,
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

      // Tenant billing config (never hardcoded): hold window + registration fee + proration inputs.
      const { data: settings } = await supabase
        .from("studio_settings")
        .select(
          "registration_fee_cents, hold_expiry_days, tuition_anchor_day, proration_method, registration_fee_mode"
        )
        .limit(1)
        .maybeSingle();
      const registrationFeeCents = (settings?.registration_fee_cents as number | null) ?? 0;
      const holdDays = (settings?.hold_expiry_days as number | null) ?? 5; // default only if null
      const anchorDay = (settings?.tuition_anchor_day as number | null) ?? 15;
      const method = ((settings?.proration_method as string | null) ?? "meeting") as ProrationMethod;
      const registrationMode = ((settings?.registration_fee_mode as string | null) ??
        "per_student") as RegistrationFeeMode;
      const holdExpiresAt = new Date(Date.now() + holdDays * 86_400_000).toISOString();
      const todayYmd = new Date().toISOString().slice(0, 10);

      // ── Pre-load existing state for idempotency (all keyed on this session) ──
      const { data: existingEnr } = await supabase
        .from("enrollments")
        .select("id, student_id, class_id, status")
        .eq("checkout_session_id", sessionId);
      const existingByKey = new Map<string, { id: string; status: string }>();
      for (const e of existingEnr ?? []) {
        existingByKey.set(enrollmentDedupeKey(sessionId, e.student_id, e.class_id), {
          id: e.id as string,
          status: e.status as string,
        });
      }

      const existingChargeKeys = new Set<string>();
      // Keys already covered by a registration item (§2): studentKeys (per_student) or the
      // FAMILY_REG_KEY sentinel (per_family). Seeds the idempotent attach guard so a partial retry
      // never charges a student/family registration twice.
      const registeredKeys = new Set<string>();
      const existingEnrIds = [...existingByKey.values()].map((v) => v.id);
      if (existingEnrIds.length > 0) {
        const { data: existingItems } = await supabase
          .from("enrollment_charge_items")
          .select("enrollment_id, item_type, class_id, student_id")
          .in("enrollment_id", existingEnrIds);
        for (const it of existingItems ?? []) {
          existingChargeKeys.add(
            chargeItemDedupeKey(it.enrollment_id as string, it.item_type as string, it.class_id as string | null)
          );
          if (it.item_type === "registration") {
            if (registrationMode === "per_family") {
              registeredKeys.add(FAMILY_REG_KEY);
            } else if (it.student_id) {
              registeredKeys.add(it.student_id as string);
            }
            // per_student new-dancer (null student_id): the name-key can't be reconstructed here;
            // the per-enrollment existingChargeKeys guard + admin review cover that rare retry edge.
          }
        }
      }

      // ── Pre-existing enrollments from ANY path (the 23505 guard) ──
      // `enrollments_student_id_class_id_key` is UNIQUE (student_id, class_id) with no session or
      // status scoping, so a row created by admin placement, an earlier checkout, or a trial blocks
      // our insert outright — and existingByKey above cannot see it (wrong session). Preload every
      // existing row for this cart's pairs, any status, and skip those items instead of 500-looping
      // Stripe forever on a collision that will never resolve itself.
      const cartStudentIds = [
        ...new Set(items.map((i) => i.student_id).filter((s): s is string => !!s)),
      ];
      const cartClassIds = [...new Set(items.map((i) => i.class_id))];
      const priorByPair = new Map<string, BlockingEnrollment>();
      if (cartStudentIds.length > 0) {
        const { data: priorEnr, error: priorErr } = await supabase
          .from("enrollments")
          .select("id, student_id, class_id, status")
          .in("student_id", cartStudentIds)
          .in("class_id", cartClassIds);
        if (priorErr) {
          console.error("[enrollment:webhook] Failed to preload existing enrollments", priorErr);
          return NextResponse.json({ error: "Failed to preload enrollments" }, { status: 500 });
        }
        for (const e of priorEnr ?? []) {
          // Rows THIS session created are resumable-retry state, not duplicates — existingByKey
          // owns them and the loop reuses them rather than skipping.
          if (existingByKey.has(enrollmentDedupeKey(sessionId, e.student_id, e.class_id))) continue;
          priorByPair.set(
            studentClassKey(e.student_id as string | null, e.class_id as string),
            { id: e.id as string, status: e.status as string }
          );
        }
      }

      const { data: existingIntents } = await supabase
        .from("tuition_schedule_intent")
        .select("class_id, student_id")
        .eq("source_ref", sessionId);
      const existingIntentKeys = new Set(
        (existingIntents ?? []).map((it) => `${it.class_id}|${it.student_id ?? "null"}`)
      );

      // Stable order so "which enrollment carries registration" is deterministic across retries.
      const sorted = [...items].sort((a, b) => {
        const sa = a.student_id ?? "";
        const sb = b.student_id ?? "";
        if (sa !== sb) return sa < sb ? -1 : 1;
        return a.class_id < b.class_id ? -1 : a.class_id > b.class_id ? 1 : 0;
      });

      const newEnrollments: {
        name: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        room: string | null;
        teacherName: string | null;
        waitlisted: boolean;
      }[] = [];
      const errors: string[] = [];
      const skipped: { classId: string; enrollmentId: string; status: string }[] = [];

      // No date-eligibility re-check here by design: this handler only runs after
      // checkout.session.completed, and the checkout route gates ended classes (isClassOpenForEnrollment)
      // before ever creating the Stripe session — so an ended class cannot reach the webhook. The only
      // residual window is a class whose end_date rolls into the past between the checkout gate and
      // payment completion (day-granularity date, minutes-long checkout); admin approval (§8.1) reviews
      // every pending enrollment before any charge, which covers that negligible edge.
      // ── Resumable per-item flow: enrollment → charge items → intent, each idempotent ──
      for (const item of sorted) {
        const cls = firstOrSelf(item.class);
        const ekey = enrollmentDedupeKey(sessionId, item.student_id, item.class_id);
        const existing = existingByKey.get(ekey);
        let enrollmentId: string;
        let enrollmentStatus: string;

        // Duplicate from another path/session: skip the entire item — no enrollment, no charge
        // items, no intent. Not an error; there is genuinely nothing to create for this class.
        if (!existing) {
          const blockedBy = duplicateSkipFor(item, priorByPair);
          if (blockedBy) {
            console.log(
              `[enrollment:webhook] skipped duplicate: student already has enrollment ${blockedBy.id} status ${blockedBy.status}`,
              { cartId, classId: item.class_id, studentId: item.student_id }
            );
            skipped.push({
              classId: item.class_id,
              enrollmentId: blockedBy.id,
              status: blockedBy.status,
            });
            continue;
          }
        }

        if (existing) {
          enrollmentId = existing.id;
          enrollmentStatus = existing.status;
        } else {
          // Capacity gate (§3.3): a pending hold occupies a spot, so count pending+active. Full →
          // waitlist (no hold, no charge items, no intent; card stays vaulted, promoted in Phase 2).
          const { count: pendingActiveCount } = await supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .eq("class_id", item.class_id)
            .in("status", ["pending", "active"]);
          enrollmentStatus = enrollmentStatusForCapacity({
            pendingActiveCount: pendingActiveCount ?? 0,
            maxStudents: (cls?.max_students as number | null) ?? null,
          });

          const { data: enr, error: enrollErr } = await supabase
            .from("enrollments")
            .insert({
              tenant_id: tenantId,
              family_id: familyId,
              student_id: item.student_id,
              class_id: item.class_id,
              status: enrollmentStatus, // 'pending' (awaits approval, §8.1) or 'waitlist' if full
              enrollment_type: "paid",
              checkout_session_id: sessionId,
              stripe_setup_intent_id: setupIntentId,
              // Only pending holds a spot; waitlist has no hold (§3.3).
              hold_expires_at: enrollmentStatus === "waitlist" ? null : holdExpiresAt,
              amount_paid_cents: 0, // nothing charged at checkout
            })
            .select("id")
            .single();
          if (enrollErr || !enr) {
            // Race fallback: another writer created the (student, class) row between our preload
            // and this insert. 23505 on the global unique constraint is the same "already
            // enrolled" outcome as the preload skip, so treat it identically — an error here would
            // 500 and make Stripe retry a collision that can never clear.
            if (enrollErr?.code === "23505") {
              const { data: raced } = await supabase
                .from("enrollments")
                .select("id, status")
                .eq("student_id", item.student_id as string)
                .eq("class_id", item.class_id)
                .maybeSingle();
              const racedId = (raced?.id as string | undefined) ?? "unknown";
              const racedStatus = (raced?.status as string | undefined) ?? "unknown";
              console.log(
                `[enrollment:webhook] skipped duplicate: student already has enrollment ${racedId} status ${racedStatus}`,
                { cartId, classId: item.class_id, studentId: item.student_id, race: true }
              );
              skipped.push({
                classId: item.class_id,
                enrollmentId: racedId,
                status: racedStatus,
              });
              continue;
            }
            console.error("[enrollment:webhook] enrollment insert failed", item.class_id, enrollErr);
            errors.push(`enrollment:${item.class_id}`);
            continue; // do NOT bump enrolled_count — capacity is pending+active at read time (§3.3)
          }
          enrollmentId = enr.id as string;
          existingByKey.set(ekey, { id: enrollmentId, status: enrollmentStatus });

          const teacher = firstOrSelf(cls?.teacher ?? null);
          newEnrollments.push({
            name: cls?.name ?? "Class",
            dayOfWeek: cls?.day_of_week ?? 0,
            startTime: cls?.start_time ?? "",
            endTime: cls?.end_time ?? "",
            room: cls?.room ?? null,
            teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
            waitlisted: enrollmentStatus === "waitlist",
          });
        }

        // Waitlisted enrollments owe nothing and hold no spot: no charge items, no intent (§3.3).
        // Charges are generated when an admin promotes waitlist → pending (Phase 2 requirement).
        if (enrollmentStatus === "waitlist") continue;

        // Charge items for this enrollment (§2): a first_tuition per class, plus the one-time
        // registration attached to the first enrollment of the session. Only compute proration when
        // the first_tuition row is actually missing (avoids wasted work on a retry).
        const needFirstTuition = !existingChargeKeys.has(
          chargeItemDedupeKey(enrollmentId, "first_tuition", item.class_id)
        );
        let firstTuition: {
          classId: string;
          studentId: string | null;
          recommendedCents: number;
          proration: ProrationBlob;
        }[] = [];
        if (needFirstTuition) {
          const { recommendedCents, blob } = await safeFirstDrawProration(supabase, {
            classId: item.class_id,
            tenantId,
            fullMonthCents: item.price_cents,
            startDate: classStartYmd(cls?.start_date, todayYmd),
            anchorDay,
            method,
          });
          firstTuition = [
            { classId: item.class_id, studentId: item.student_id, recommendedCents, proration: blob },
          ];
        }

        // Registration (§2): per_student attaches to each student's first enrollment; per_family
        // once per checkout. Idempotent under partial retry via registeredKeys (seeded above, grown
        // as we insert). studentKey falls back to a name-key for an unsaved new dancer.
        const studentKey = item.student_id ?? `name:${item.student_name ?? ""}`;
        const attachRegistration = shouldAttachRegistration({
          mode: registrationMode,
          registrationFeeCents,
          studentKey,
          registeredKeys,
        });

        const plannedRows = buildPendingChargeItems({
          registration: attachRegistration
            ? {
                amountCents: registrationFeeCents,
                studentId: registrationMode === "per_family" ? null : item.student_id,
              }
            : null,
          firstTuition,
        }).map((ci) => ({ ...ci, enrollment_id: enrollmentId as string }));

        for (const m of selectMissingChargeItems(plannedRows, existingChargeKeys)) {
          const { error: itemErr } = await supabase.from("enrollment_charge_items").insert({
            tenant_id: tenantId,
            enrollment_id: m.enrollment_id,
            family_id: familyId,
            student_id: m.student_id,
            class_id: m.class_id,
            item_type: m.item_type,
            recurrence_type: m.recurrence_type,
            recommended_amount_cents: m.recommended_amount_cents,
            charge_timing: m.charge_timing,
            proration: m.proration,
            status: "pending",
          });
          if (itemErr) {
            console.error("[enrollment:webhook] charge item insert failed", m.item_type, item.class_id, itemErr);
            errors.push(`charge_item:${m.item_type}:${m.class_id ?? "reg"}`);
            continue;
          }
          existingChargeKeys.add(chargeItemDedupeKey(m.enrollment_id, m.item_type, m.class_id));
          if (m.item_type === "registration") {
            registeredKeys.add(registrationMode === "per_family" ? FAMILY_REG_KEY : studentKey);
          }
        }

        // tuition_schedule_intent → pending_setup (armed → active only at approval, §3.2.4).
        const ikey = `${item.class_id}|${item.student_id ?? "null"}`;
        if (!existingIntentKeys.has(ikey)) {
          const { error: intentErr } = await supabase.from("tuition_schedule_intent").insert(
            buildPendingIntent({
              tenantId,
              familyId,
              studentId: item.student_id,
              classId: item.class_id,
              monthlyAmountCents: item.price_cents,
              anchorDay,
              sourceRef: sessionId,
              enrollmentId,
            })
          );
          if (intentErr) {
            console.error("[enrollment:webhook] tuition intent insert failed", item.class_id, intentErr);
            errors.push(`intent:${item.class_id}`);
            continue;
          }
          existingIntentKeys.add(ikey);
        }
      }

      // Surface partial failure so Stripe retries; everything already created is skipped next time.
      if (errors.length > 0) {
        console.error("[enrollment:webhook] finalization had errors", cartId, errors);
        return NextResponse.json({ error: "Finalization incomplete", failed: errors }, { status: 500 });
      }

      // Persist the vaulted card (from the SetupIntent) for later off-session draws. Non-fatal.
      if (familyId && setupIntentId) {
        try {
          const si = await getStripe().setupIntents.retrieve(setupIntentId);
          const pmId =
            typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
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
      await supabase.from("enrollment_carts").update({ status: "completed" }).eq("id", cartId);

      // Notify — fire-and-forget (a notification failure must never fail the webhook). Only on new
      // enrollments (skips on a pure retry). Real impls land in step 6.
      if (shouldNotifyNewPendingEnrollment(newEnrollments.length)) {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const parentName = session.customer_details?.name ?? null;
        await safeSideEffect(
          sendEnrollmentReceived({
            to: customerEmail,
            parentName,
            classes: newEnrollments.map((c) => ({ name: c.name, waitlisted: c.waitlisted })),
          }),
          "received email"
        );
        await safeSideEffect(
          notifyAdminsNewPendingEnrollment({ tenantId, familyId, classes: newEnrollments }),
          "admin notify"
        );
      }

      // An all-skipped cart is a fully processed event (nothing left to create), so it reports 200
      // and the cart is completed above — Stripe must not retry it.
      console.log(
        "[enrollment:webhook] Vault-only checkout finalized:",
        cartId,
        `${newEnrollments.length} new pending enrollment(s), ${skipped.length} skipped as duplicate` +
          (newEnrollments.length === 0 && skipped.length > 0
            ? " (nothing to create — every item was already enrolled)"
            : "")
      );
      return NextResponse.json({
        received: true,
        created: newEnrollments.length,
        skipped: skipped.length,
      });
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const cartId = session.metadata?.cart_id;
      if (cartId) {
        await supabase.from("enrollment_carts").update({ status: "expired" }).eq("id", cartId);
        console.log("[enrollment:webhook] Checkout expired:", cartId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
