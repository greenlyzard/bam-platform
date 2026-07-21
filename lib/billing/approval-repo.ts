// Supabase-backed ApprovalRepo (docs/BILLING_APPROVAL_AND_DRAW.md §3.2). All cross-user writes for
// the approval / decline / promotion engine live here, behind createAdminClient (service role). The
// engine (approval.ts) is pure control-flow over this interface; the "use server" actions wire it.
//
// House rule: NEVER chain .select() onto .update() (the PostgREST update-returning footgun). Reads
// that inform a write are issued as their own .select() call, separate from the .update().

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/types/database.types";
import { resolveClassPriceCents } from "./resolve-price.ts";
import { computeFirstDrawProrationFromDb, type ProrationMethod } from "./proration.ts";
import type { RegistrationFeeMode } from "./enrollment-ledger.ts";
import type { ChargeInsert, PendingIntentInsert } from "./charges.ts";
import type { PendingChargeItemInput } from "./checkout-lines.ts";
import type {
  ApprovalRepo,
  ApprovalContext,
  ApprovalChargeItemCtx,
  PendingIntentCtx,
  PromotionContext,
  BillingTaskInsert,
  ConfirmationEmailContext,
} from "./approval.ts";
import type { PostingGroupSpec } from "./ledger-posting.ts";
import type { ProrationBlob } from "./proration.ts";

interface SettingsRow {
  tuition_anchor_day: number | null;
  proration_method: string | null;
  hold_expiry_days: number | null;
  registration_fee_cents: number | null;
  registration_fee_mode: string | null;
}

async function loadSettings(admin: SupabaseClient): Promise<SettingsRow> {
  const { data } = await admin
    .from("studio_settings")
    .select(
      "tuition_anchor_day, proration_method, hold_expiry_days, registration_fee_cents, registration_fee_mode"
    )
    .limit(1)
    .maybeSingle();
  return (data as SettingsRow | null) ?? {
    tuition_anchor_day: null,
    proration_method: null,
    hold_expiry_days: null,
    registration_fee_cents: null,
    registration_fee_mode: null,
  };
}

export function createSupabaseApprovalRepo(admin: SupabaseClient): ApprovalRepo {
  return {
    async loadApprovalContext(enrollmentId): Promise<ApprovalContext | null> {
      const { data: enr } = await admin
        .from("enrollments")
        .select("id, tenant_id, status, class_id, family_id, student_id")
        .eq("id", enrollmentId)
        .maybeSingle();
      if (!enr) return null;

      const [{ data: family }, { data: items }, { data: intents }, settings, { data: cls }] =
        await Promise.all([
          admin
            .from("families")
            .select("stripe_customer_id, stripe_payment_method_id, billing_email, primary_contact_id")
            .eq("id", enr.family_id ?? "")
            .maybeSingle(),
          admin
            .from("enrollment_charge_items")
            .select(
              "id, item_type, recurrence_type, recommended_amount_cents, approved_amount_cents, charge_timing, class_id, student_id, proration, status"
            )
            .eq("enrollment_id", enrollmentId),
          admin
            .from("tuition_schedule_intent")
            .select("id, class_id, student_id")
            .eq("enrollment_id", enrollmentId)
            .eq("status", "pending_setup"),
          loadSettings(admin),
          admin
            .from("classes")
            .select("name, day_of_week, start_time, end_time, room")
            .eq("id", enr.class_id ?? "")
            .maybeSingle(),
        ]);

      const itemCtx = (items ?? []) as ApprovalChargeItemCtx[];
      const startDate =
        itemCtx.find((i) => i.proration)?.proration?.start_date ?? null;

      // Best-effort parent name for the confirmation email.
      let parentName: string | null = null;
      if (family?.primary_contact_id) {
        const { data: prof } = await admin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", family.primary_contact_id)
          .maybeSingle();
        if (prof) {
          parentName = [prof.first_name, prof.last_name].filter(Boolean).join(" ") || null;
        }
      }

      const email: ConfirmationEmailContext = {
        to: (family?.billing_email as string | null) ?? null,
        parentName,
        classes: cls
          ? [
              {
                name: (cls.name as string) ?? "Class",
                dayOfWeek: (cls.day_of_week as number | null) ?? 0,
                startTime: (cls.start_time as string | null) ?? "",
                endTime: (cls.end_time as string | null) ?? "",
                room: (cls.room as string | null) ?? null,
                teacherName: null,
              },
            ]
          : [],
      };

      return {
        enrollment: {
          id: enr.id as string,
          tenant_id: enr.tenant_id as string,
          status: enr.status as string,
          class_id: (enr.class_id as string | null) ?? null,
          family_id: (enr.family_id as string | null) ?? null,
          student_id: (enr.student_id as string | null) ?? null,
        },
        family: {
          stripe_customer_id: (family?.stripe_customer_id as string | null) ?? null,
          stripe_payment_method_id: (family?.stripe_payment_method_id as string | null) ?? null,
        },
        items: itemCtx,
        intents: (intents ?? []) as PendingIntentCtx[],
        anchorDay: settings.tuition_anchor_day ?? 15,
        startDate,
        email,
      };
    },

    async getApprovalCharges(enrollmentId) {
      const { data } = await admin
        .from("charges")
        .select("id, status, stripe_payment_intent_id")
        .eq("enrollment_id", enrollmentId)
        .eq("source", "approval");
      return (data ?? []).map((r) => ({
        id: r.id as string,
        status: r.status as string,
        stripe_payment_intent_id: (r.stripe_payment_intent_id as string | null) ?? null,
      }));
    },

    async insertChargeRows(rows: ChargeInsert[]) {
      if (rows.length === 0) return [];
      const { data, error } = await admin
        .from("charges")
        .insert(rows)
        .select("id, kind, metadata");
      if (error) throw new Error(`insertChargeRows: ${error.message}`);
      return (data ?? []).map((r) => {
        const meta = (r.metadata as { charge_item_id?: string; item_type?: string } | null) ?? {};
        return {
          id: r.id as string,
          charge_item_id: meta.charge_item_id ?? "",
          item_type: meta.item_type ?? (r.kind as string),
        };
      });
    },

    async markChargesSucceeded(chargeIds, piId, stripeChargeId, capturedAtIso) {
      if (chargeIds.length === 0) return;
      const { error } = await admin
        .from("charges")
        .update({
          status: "succeeded",
          captured_at: capturedAtIso,
          stripe_payment_intent_id: piId,
          stripe_charge_id: stripeChargeId,
        })
        .in("id", chargeIds);
      if (error) throw new Error(`markChargesSucceeded: ${error.message}`);
    },

    async markChargesFailed(chargeIds, _errorCode) {
      if (chargeIds.length === 0) return;
      const { error } = await admin
        .from("charges")
        .update({ status: "failed" })
        .in("id", chargeIds);
      if (error) throw new Error(`markChargesFailed: ${error.message}`);
    },

    async postLedgerGroup(group: PostingGroupSpec, tenantId, occurredAtIso) {
      const { error } = await admin.rpc("post_ledger_group", {
        p_tenant: tenantId,
        p_posting_key: group.postingKey,
        p_event_type: group.eventType,
        p_occurred_at: occurredAtIso,
        p_source_system: group.sourceSystem,
        p_source_ref: group.sourceRef,
        p_legs: group.legs as unknown as Json,
      });
      if (error) throw new Error(`postLedgerGroup: ${error.message}`);
    },

    async armIntents(armings) {
      for (const a of armings) {
        const { error } = await admin
          .from("tuition_schedule_intent")
          .update({
            status: "active",
            monthly_amount_cents: a.monthly_amount_cents,
            anchor_day: a.anchor_day,
            next_draw_at: a.next_draw_at,
            deferred_addition_cents: a.deferred_addition_cents,
          })
          .eq("id", a.intentId);
        if (error) throw new Error(`armIntents(${a.intentId}): ${error.message}`);
      }
    },

    async patchChargeIntentIds(links) {
      for (const l of links) {
        const { error } = await admin
          .from("charges")
          .update({ intent_id: l.intentId })
          .eq("id", l.chargeId);
        if (error) throw new Error(`patchChargeIntentIds(${l.chargeId}): ${error.message}`);
      }
    },

    async markChargeItems(links) {
      for (const l of links) {
        const { error } = await admin
          .from("enrollment_charge_items")
          .update({ status: l.status, charge_id: l.chargeId })
          .eq("id", l.chargeItemId);
        if (error) throw new Error(`markChargeItems(${l.chargeItemId}): ${error.message}`);
      }
    },

    async activateEnrollment(enrollmentId, adminId, approvedAtIso) {
      const { error } = await admin
        .from("enrollments")
        .update({ status: "active", approved_by: adminId, approved_at: approvedAtIso })
        .eq("id", enrollmentId);
      if (error) throw new Error(`activateEnrollment: ${error.message}`);
    },

    async setEnrollmentChargeError(enrollmentId, errorText) {
      const { error } = await admin
        .from("enrollments")
        .update({ last_charge_error: errorText })
        .eq("id", enrollmentId);
      if (error) throw new Error(`setEnrollmentChargeError: ${error.message}`);
    },

    async advanceEnrolledCount(classId) {
      // Display counter only (§3.3): read then +1. The capacity GATE reads live pending+active.
      const { data: cls } = await admin
        .from("classes")
        .select("enrolled_count")
        .eq("id", classId)
        .maybeSingle();
      const next = ((cls?.enrolled_count as number | null) ?? 0) + 1;
      const { error } = await admin
        .from("classes")
        .update({ enrolled_count: next })
        .eq("id", classId);
      if (error) throw new Error(`advanceEnrolledCount: ${error.message}`);
    },

    async createBillingTask(task: BillingTaskInsert) {
      const { error } = await admin.from("billing_tasks").insert({
        tenant_id: task.tenant_id,
        type: task.type,
        status: task.status,
        enrollment_id: task.enrollment_id,
        family_id: task.family_id,
        intent_id: task.intent_id,
        payload: task.payload,
      });
      if (error) throw new Error(`createBillingTask: ${error.message}`);
    },

    // ── decline ──
    async getEnrollmentStatus(enrollmentId) {
      const { data } = await admin
        .from("enrollments")
        .select("tenant_id, status")
        .eq("id", enrollmentId)
        .maybeSingle();
      if (!data) return null;
      return { tenant_id: data.tenant_id as string, status: data.status as string };
    },

    async declineEnrollment(enrollmentId, reason, declinedAtIso) {
      const { error } = await admin
        .from("enrollments")
        .update({ status: "declined", declined_reason: reason, declined_at: declinedAtIso })
        .eq("id", enrollmentId);
      if (error) throw new Error(`declineEnrollment: ${error.message}`);
    },

    async markChargeItemsDeclined(enrollmentId) {
      const { error } = await admin
        .from("enrollment_charge_items")
        .update({ status: "declined" })
        .eq("enrollment_id", enrollmentId);
      if (error) throw new Error(`markChargeItemsDeclined: ${error.message}`);
    },

    async cancelPendingIntents(enrollmentId, canceledAtIso) {
      const { error } = await admin
        .from("tuition_schedule_intent")
        .update({ status: "canceled", canceled_at: canceledAtIso })
        .eq("enrollment_id", enrollmentId)
        .eq("status", "pending_setup");
      if (error) throw new Error(`cancelPendingIntents: ${error.message}`);
    },

    async clearHold(enrollmentId) {
      const { error } = await admin
        .from("enrollments")
        .update({ hold_expires_at: null })
        .eq("id", enrollmentId);
      if (error) throw new Error(`clearHold: ${error.message}`);
    },

    // ── promotion ──
    async loadPromotionContext(enrollmentId): Promise<PromotionContext | null> {
      const { data: enr } = await admin
        .from("enrollments")
        .select("id, tenant_id, status, class_id, student_id, family_id")
        .eq("id", enrollmentId)
        .maybeSingle();
      if (!enr) return null;

      const settings = await loadSettings(admin);
      const fullMonthCents = enr.class_id
        ? (await resolveClassPriceCents(enr.class_id as string, admin)) ?? 0
        : 0;

      let startDate: string | null = null;
      if (enr.class_id) {
        const { data: cls } = await admin
          .from("classes")
          .select("start_date")
          .eq("id", enr.class_id)
          .maybeSingle();
        startDate = (cls?.start_date as string | null) ?? null;
      }

      return {
        enrollment: {
          id: enr.id as string,
          tenant_id: enr.tenant_id as string,
          status: enr.status as string,
          class_id: (enr.class_id as string | null) ?? null,
          student_id: (enr.student_id as string | null) ?? null,
          family_id: (enr.family_id as string | null) ?? null,
        },
        classInfo: { start_date: startDate, fullMonthCents },
        anchorDay: settings.tuition_anchor_day ?? 15,
        method: ((settings.proration_method ?? "meeting") as ProrationMethod),
        holdExpiryDays: settings.hold_expiry_days ?? 5,
        registrationFeeCents: settings.registration_fee_cents ?? 0,
        registrationMode: ((settings.registration_fee_mode ?? "per_student") as RegistrationFeeMode),
      };
    },

    async computeFirstDrawProration(args): Promise<{ recommendedCents: number; blob: ProrationBlob }> {
      return computeFirstDrawProrationFromDb(admin, args);
    },

    async insertPromotionChargeItems(items: PendingChargeItemInput[], ctx) {
      if (items.length === 0) return;
      const rows = items.map((ci) => ({
        tenant_id: ctx.tenantId,
        enrollment_id: ctx.enrollmentId,
        family_id: ctx.familyId,
        student_id: ci.student_id,
        class_id: ci.class_id,
        item_type: ci.item_type,
        recurrence_type: ci.recurrence_type,
        recommended_amount_cents: ci.recommended_amount_cents,
        charge_timing: ci.charge_timing,
        proration: ci.proration,
        status: "pending",
      }));
      const { error } = await admin.from("enrollment_charge_items").insert(rows);
      if (error) throw new Error(`insertPromotionChargeItems: ${error.message}`);
    },

    async insertPendingIntent(row: PendingIntentInsert) {
      const { error } = await admin.from("tuition_schedule_intent").insert(row);
      if (error) throw new Error(`insertPendingIntent: ${error.message}`);
    },

    async promoteToPending(enrollmentId, holdExpiresAtIso) {
      const { error } = await admin
        .from("enrollments")
        .update({ status: "pending", hold_expires_at: holdExpiresAtIso })
        .eq("id", enrollmentId);
      if (error) throw new Error(`promoteToPending: ${error.message}`);
    },
  };
}
