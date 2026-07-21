import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ApprovalsClient,
  type PendingEnrollment,
  type WaitlistEnrollment,
  type ChargeItem,
} from "./approvals-client";

export const metadata = { title: "Enrollment Approvals — Admin" };

// Admin-gated page: read the billing tables with the service role (RLS bypassed) after requireAdmin,
// avoiding any RLS gap on the newer approval tables. All writes go through the server actions.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function ApprovalsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: pendingRaw } = await supabase
    .from("enrollments")
    .select(
      `id, status, hold_expires_at, created_at, last_charge_error,
       student:students!inner(id, first_name, last_name),
       klass:classes(id, name, day_of_week, start_time, end_time),
       family:families(id, family_name, stripe_payment_method_id),
       items:enrollment_charge_items(
         id, item_type, recurrence_type, recommended_amount_cents, approved_amount_cents,
         charge_timing, proration, status,
         adjustments:charge_item_adjustments(id, adjustment_type, value, reason, created_at)
       )`
    )
    .eq("status", "pending")
    .order("hold_expires_at", { ascending: true, nullsFirst: false });

  const { data: waitlistRaw } = await supabase
    .from("enrollments")
    .select(
      `id, created_at,
       student:students!inner(id, first_name, last_name),
       klass:classes(id, name),
       family:families(id, family_name)`
    )
    .eq("status", "waitlist")
    .order("created_at", { ascending: true });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pending: PendingEnrollment[] = (pendingRaw ?? []).map((e: any) => {
    const student = one<any>(e.student);
    const klass = one<any>(e.klass);
    const family = one<any>(e.family);
    const items: ChargeItem[] = (e.items ?? []).map((it: any) => ({
      id: it.id,
      item_type: it.item_type,
      recurrence_type: it.recurrence_type,
      recommended_amount_cents: it.recommended_amount_cents,
      approved_amount_cents: it.approved_amount_cents,
      charge_timing: it.charge_timing,
      status: it.status,
      proration: it.proration ?? null,
      adjustments: (it.adjustments ?? [])
        .slice()
        .sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1))
        .map((a: any) => ({
          id: a.id,
          adjustment_type: a.adjustment_type,
          value: a.value,
          reason: a.reason,
          created_at: a.created_at,
        })),
    }));
    // First-tuition proration carries the start date; sort so registration reads first.
    items.sort((a, b) => a.item_type.localeCompare(b.item_type));
    return {
      id: e.id,
      status: e.status,
      hold_expires_at: e.hold_expires_at,
      last_charge_error: e.last_charge_error,
      student: student ? { first_name: student.first_name, last_name: student.last_name } : null,
      klass: klass
        ? {
            name: klass.name,
            day_of_week: klass.day_of_week ?? null,
            start_time: klass.start_time ?? null,
            end_time: klass.end_time ?? null,
          }
        : null,
      family: family
        ? { family_name: family.family_name, hasVaultedPm: family.stripe_payment_method_id != null }
        : null,
      items,
    };
  });

  const waitlist: WaitlistEnrollment[] = (waitlistRaw ?? []).map((e: any) => {
    const student = one<any>(e.student);
    const klass = one<any>(e.klass);
    const family = one<any>(e.family);
    return {
      id: e.id,
      student: student ? { first_name: student.first_name, last_name: student.last_name } : null,
      klass: klass ? { name: klass.name } : null,
      family: family ? { family_name: family.family_name } : null,
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ApprovalsClient pending={pending} waitlist={waitlist} />
    </div>
  );
}
