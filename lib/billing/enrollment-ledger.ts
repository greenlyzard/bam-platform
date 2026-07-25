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

/**
 * Capacity gate (§3.3): a new enrollment WAITLISTS when pending+active already fills the class.
 * Capacity counts `pending + active` (a pending hold occupies a spot); `enrolled_count` is not used
 * here. A null `maxStudents` means no cap → always `pending`. Waitlisted enrollments owe nothing and
 * hold no spot until an admin promotes them (Phase 2).
 */
export function enrollmentStatusForCapacity(args: {
  pendingActiveCount: number;
  maxStudents: number | null;
}): "pending" | "waitlist" {
  if (args.maxStudents != null && args.pendingActiveCount >= args.maxStudents) return "waitlist";
  return "pending";
}

/**
 * Key for the GLOBAL uniqueness the DB actually enforces: `enrollments_student_id_class_id_key` is
 * UNIQUE (student_id, class_id) with no session, season, or status scoping. This is deliberately
 * NOT the same key as `enrollmentDedupeKey` — that one is session-scoped and only recognises rows
 * this checkout created (resumable retry). A row created by ANY other path — admin placement, an
 * earlier checkout, a trial — is invisible to it and collides at insert time with 23505.
 */
export function studentClassKey(studentId: string | null, classId: string): string {
  return `${studentId ?? "null"}|${classId}`;
}

/**
 * Statuses that count as "already enrolled or in flight" for the add-to-cart guard. Matches the
 * corrected convention from the pending_payment sweep — `pending_payment` was never a real status.
 * Deliberately NARROWER than the webhook's skip rule: the webhook must treat ANY existing row as
 * blocking (the unique constraint ignores status), while the cart only blocks a parent on a class
 * their student is genuinely still in. A declined/canceled row therefore passes the cart guard but
 * is still skipped by the webhook — the residue of the global constraint, tracked in §4 backlog
 * (partial unique index scoped to in-flight statuses).
 */
export const BLOCKING_ENROLLMENT_STATUSES = [
  "active",
  "pending",
  "trial",
  "waitlist",
] as const;

/** An existing enrollment that blocks creating another row for the same (student, class). */
export interface BlockingEnrollment {
  id: string;
  status: string;
}

/**
 * Decide whether a cart item must be SKIPPED because the student already has an enrollment in that
 * class (any status). Returns the blocking row, or null when the item should proceed.
 *
 * A null studentId never collides: Postgres treats NULLs as distinct in a unique constraint, so
 * multiple unsaved-dancer rows for one class are allowed and must not be skipped.
 */
export function duplicateSkipFor<T extends { class_id: string; student_id: string | null }>(
  item: T,
  priorByPair: ReadonlyMap<string, BlockingEnrollment>
): BlockingEnrollment | null {
  if (!item.student_id) return null;
  return priorByPair.get(studentClassKey(item.student_id, item.class_id)) ?? null;
}

/**
 * Split checkout items into those to create and those to skip as pre-existing duplicates (§3.3
 * companion rule). Partial overlap is normal and fine: the skipped items simply produce no
 * enrollment, no charge items and no intent, while the rest finalize as usual. An all-skipped cart
 * is a fully processed event, not a failure — the caller returns 200 so Stripe stops retrying.
 */
export function planEnrollmentCreation<
  T extends { class_id: string; student_id: string | null }
>(
  items: T[],
  priorByPair: ReadonlyMap<string, BlockingEnrollment>
): { create: T[]; skipped: { item: T; blockedBy: BlockingEnrollment }[] } {
  const create: T[] = [];
  const skipped: { item: T; blockedBy: BlockingEnrollment }[] = [];
  for (const item of items) {
    const blockedBy = duplicateSkipFor(item, priorByPair);
    if (blockedBy) skipped.push({ item, blockedBy });
    else create.push(item);
  }
  return { create, skipped };
}

/**
 * The admin "new pending enrollment" notification fires only when the webhook actually created
 * enrollments. An all-duplicate checkout created nothing, so there is nothing to review — notifying
 * would page an admin about a no-op.
 */
export function shouldNotifyNewPendingEnrollment(createdCount: number): boolean {
  return createdCount > 0;
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
