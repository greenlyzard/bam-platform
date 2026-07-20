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

/**
 * Idempotency key for an enrollment_charge_item — one per (enrollment, item_type, class).
 * Registration items carry a null class_id (studio-level), so their key is unique per enrollment.
 */
export function chargeItemDedupeKey(
  enrollmentId: string,
  itemType: string,
  classId: string | null
): string {
  return `${enrollmentId}|${itemType}|${classId ?? "null"}`;
}

/**
 * Given planned charge-item rows and the keys that ALREADY exist, return only the rows still
 * needing insertion. A webhook retry re-derives the same planned rows; a full existing-set → [] →
 * no double-insert. Mirrors selectUnprocessedItems for the charge-item layer.
 */
export function selectMissingChargeItems<
  T extends { enrollment_id: string; item_type: string; class_id: string | null }
>(rows: T[], existingKeys: ReadonlySet<string>): T[] {
  return rows.filter(
    (r) => !existingKeys.has(chargeItemDedupeKey(r.enrollment_id, r.item_type, r.class_id))
  );
}

/** Registration fee cardinality (studio_settings.registration_fee_mode; §2). */
export type RegistrationFeeMode = "per_student" | "per_family";

/** Sentinel studentKey for `per_family` mode — one registration per family/checkout. */
export const FAMILY_REG_KEY = "__family__";

/**
 * Decide whether the CURRENT enrollment should carry a registration charge item (§2).
 *
 * `registeredKeys` is the running set of keys already covered by a registration item —
 * per_student: studentKeys (student_id, or a name-derived key for an unsaved new dancer);
 * per_family: contains FAMILY_REG_KEY once any registration exists. The webhook seeds it from the
 * pre-loaded existing charge items and adds to it as it inserts, so this is idempotent under a
 * partial retry: a student/family already covered is never charged registration twice.
 *
 * Per-student dedupe is per-checkout-session only. Cross-checkout, season-aware dedupe (a returning
 * family that already paid registration this season) is a Phase-2 approval-time concern; every
 * registration recommendation is admin-reviewed before any charge.
 */
export function shouldAttachRegistration(args: {
  mode: RegistrationFeeMode;
  registrationFeeCents: number;
  studentKey: string;
  registeredKeys: ReadonlySet<string>;
}): boolean {
  if (args.registrationFeeCents <= 0) return false;
  const key = args.mode === "per_family" ? FAMILY_REG_KEY : args.studentKey;
  return !args.registeredKeys.has(key);
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
