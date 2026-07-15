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

// NOTE: the old single-entry `buildTuitionLedgerRow` was retired in the double-entry cutover
// (LEDGER_DOUBLE_ENTRY_DESIGN.md). Ledger rows are now built by lib/billing/ledger-posting.ts
// as balanced debit/credit posting groups.
