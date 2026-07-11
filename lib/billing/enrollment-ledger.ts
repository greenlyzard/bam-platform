import type { Database } from "@/types/database.types";

export type LedgerInsert = Database["public"]["Tables"]["ledger_entries"]["Insert"];

/** A cart item reduced to exactly what checkout finalization needs. */
export interface CheckoutItem {
  classId: string;
  studentId: string | null;
  priceCents: number;
  locationId: string | null;
}

/**
 * Idempotency key — one enrollment per (payment intent, student, class).
 * Keyed on the Stripe payment intent so a webhook retry maps to the same rows.
 * Includes studentId so two children enrolled in the SAME class in one checkout
 * remain distinct entries.
 */
export function enrollmentDedupeKey(
  paymentIntentId: string,
  studentId: string | null,
  classId: string
): string {
  return `${paymentIntentId}|${studentId ?? "null"}|${classId}`;
}

/**
 * Given the checkout's items and the set of enrollment keys that ALREADY exist
 * for this payment intent, return only the items still needing finalization.
 * A webhook retry after full success passes a complete existing-set → returns []
 * → no double-create. A retry after partial/total failure returns just the
 * remainder.
 */
export function selectUnprocessedItems<T extends CheckoutItem>(
  items: T[],
  existingKeys: ReadonlySet<string>,
  paymentIntentId: string
): T[] {
  return items.filter(
    (it) =>
      !existingKeys.has(enrollmentDedupeKey(paymentIntentId, it.studentId, it.classId))
  );
}

/** Accounting period 'YYYY-MM' (UTC) for the ledger `period` dimension. */
export function currentPeriod(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Build the tuition revenue ledger row for one enrolled class.
 * (Registration-fee entries — category='registration' — are added separately
 * when the cart model carries a registration line; it does not today.)
 */
export function buildTuitionLedgerRow(args: {
  tenantId: string;
  item: CheckoutItem;
  familyId: string | null;
  paymentIntentId: string | null;
  currency: string;
  period: string;
  occurredAt: string;
}): LedgerInsert {
  return {
    tenant_id: args.tenantId,
    direction: "revenue",
    account: "tuition",
    category: "tuition",
    source: "enrollment",
    class_id: args.item.classId,
    location_id: args.item.locationId,
    family_id: args.familyId,
    amount_cents: args.item.priceCents,
    currency: args.currency,
    period: args.period,
    occurred_at: args.occurredAt,
    charge_status: "charged",
    review_tier: "auto",
    stripe_reference: args.paymentIntentId,
  };
}
