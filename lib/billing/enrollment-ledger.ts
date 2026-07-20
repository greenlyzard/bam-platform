/** A cart item reduced to exactly what checkout finalization needs. */
export interface CheckoutItem {
  classId: string;
  studentId: string | null;
  priceCents: number;
  locationId: string | null;
}

/**
 * Idempotency key — one enrollment per (checkout session, student, class).
 * Keyed on the Stripe Checkout Session id — the canonical vault-only anchor (§1.2, decision 1):
 * setup mode has NO PaymentIntent, so the session id (not a payment intent) is what a webhook retry
 * maps back to. Includes studentId so two children enrolled in the SAME class in one checkout remain
 * distinct entries.
 */
export function enrollmentDedupeKey(
  checkoutSessionId: string,
  studentId: string | null,
  classId: string
): string {
  return `${checkoutSessionId}|${studentId ?? "null"}|${classId}`;
}

/**
 * Given the checkout's items and the set of enrollment keys that ALREADY exist
 * for this checkout session, return only the items still needing finalization.
 * A webhook retry after full success passes a complete existing-set → returns []
 * → no double-create. A retry after partial/total failure returns just the
 * remainder.
 */
export function selectUnprocessedItems<T extends CheckoutItem>(
  items: T[],
  existingKeys: ReadonlySet<string>,
  checkoutSessionId: string
): T[] {
  return items.filter(
    (it) =>
      !existingKeys.has(enrollmentDedupeKey(checkoutSessionId, it.studentId, it.classId))
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
