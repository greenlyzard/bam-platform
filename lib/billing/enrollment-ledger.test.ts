import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enrollmentDedupeKey,
  selectUnprocessedItems,
  chargeItemDedupeKey,
  selectMissingChargeItems,
  shouldAttachRegistration,
  enrollmentStatusForCapacity,
  FAMILY_REG_KEY,
  currentPeriod,
  type CheckoutItem,
  type RegistrationFeeMode,
} from "./enrollment-ledger.ts";

/**
 * Walk a session's enrollments (stable order) through shouldAttachRegistration exactly as the
 * webhook does — seeding + growing the registeredKeys set — and return the enrollmentIds that get a
 * registration item. Mirrors the webhook's incremental attach loop so the modes are testable.
 */
function attachTargets(args: {
  mode: RegistrationFeeMode;
  registrationFeeCents: number;
  enrollments: { enrollmentId: string; studentKey: string }[];
  seed?: Set<string>;
}): string[] {
  const registered = new Set(args.seed ?? []);
  const targets: string[] = [];
  for (const e of args.enrollments) {
    if (
      shouldAttachRegistration({
        mode: args.mode,
        registrationFeeCents: args.registrationFeeCents,
        studentKey: e.studentKey,
        registeredKeys: registered,
      })
    ) {
      targets.push(e.enrollmentId);
      registered.add(args.mode === "per_family" ? FAMILY_REG_KEY : e.studentKey);
    }
  }
  return targets;
}

// Canonical vault-only anchor is the Stripe Checkout Session id (§1.2, decision 1) — setup mode has
// no PaymentIntent.
const CS = "cs_123";

const itemA: CheckoutItem = { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: "loc-1" };
const itemB: CheckoutItem = { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: "loc-1" };
// two children in the SAME class — distinct keys
const itemAChild2: CheckoutItem = { classId: "cls-a", studentId: "stu-2", priceCents: 15000, locationId: "loc-1" };

test("enrollmentDedupeKey: keyed on the checkout session; distinguishes student and class", () => {
  assert.equal(enrollmentDedupeKey(CS, "stu-1", "cls-a"), "cs_123|stu-1|cls-a");
  assert.notEqual(
    enrollmentDedupeKey(CS, "stu-1", "cls-a"),
    enrollmentDedupeKey(CS, "stu-2", "cls-a")
  );
  assert.equal(enrollmentDedupeKey(CS, null, "cls-a"), "cs_123|null|cls-a");
});

test("selectUnprocessedItems: empty existing → all items processed", () => {
  const out = selectUnprocessedItems([itemA, itemB], new Set(), CS);
  assert.deepEqual(out, [itemA, itemB]);
});

test("selectUnprocessedItems: full existing set → none (retry after success is a no-op)", () => {
  const existing = new Set([
    enrollmentDedupeKey(CS, "stu-1", "cls-a"),
    enrollmentDedupeKey(CS, "stu-1", "cls-b"),
  ]);
  const out = selectUnprocessedItems([itemA, itemB], existing, CS);
  assert.deepEqual(out, []);
});

test("selectUnprocessedItems: partial existing → only the remainder (partial-failure retry)", () => {
  const existing = new Set([enrollmentDedupeKey(CS, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemB], existing, CS);
  assert.deepEqual(out, [itemB]);
});

test("selectUnprocessedItems: two children, same class → both kept, one processed independently", () => {
  const existing = new Set([enrollmentDedupeKey(CS, "stu-1", "cls-a")]);
  const out = selectUnprocessedItems([itemA, itemAChild2], existing, CS);
  assert.deepEqual(out, [itemAChild2]);
});

// ── charge-item idempotency (§2; enrollment_charge_items) ────────────────────────────

type Row = { enrollment_id: string; item_type: string; class_id: string | null };

test("chargeItemDedupeKey: one per (enrollment, item_type, class); registration is class-null", () => {
  assert.equal(chargeItemDedupeKey("enr-1", "first_tuition", "cls-a"), "enr-1|first_tuition|cls-a");
  assert.equal(chargeItemDedupeKey("enr-1", "registration", null), "enr-1|registration|null");
  assert.notEqual(
    chargeItemDedupeKey("enr-1", "first_tuition", "cls-a"),
    chargeItemDedupeKey("enr-1", "first_tuition", "cls-b")
  );
});

test("selectMissingChargeItems: empty existing → all rows inserted", () => {
  const rows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
  ];
  assert.deepEqual(selectMissingChargeItems(rows, new Set()), rows);
});

test("selectMissingChargeItems: partial existing → only the remainder (partial-failure retry)", () => {
  const rows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
  ];
  const existing = new Set([chargeItemDedupeKey("enr-1", "registration", null)]);
  assert.deepEqual(selectMissingChargeItems(rows, existing), [rows[1]]);
});

// REQUIRED: a retry of the SAME checkout session creates no new enrollments AND no new charge items.
test("idempotent re-run: same checkout_session_id yields no new enrollments or charge items", () => {
  const CS_RETRY = "cs_retry";
  const items: CheckoutItem[] = [
    { classId: "cls-a", studentId: "stu-1", priceCents: 15000, locationId: null },
    { classId: "cls-b", studentId: "stu-1", priceCents: 12500, locationId: null },
  ];

  // First run created both enrollments; the retry sees them all as existing.
  const existingEnrollmentKeys = new Set(
    items.map((it) => enrollmentDedupeKey(CS_RETRY, it.studentId, it.classId))
  );
  assert.deepEqual(selectUnprocessedItems(items, existingEnrollmentKeys, CS_RETRY), []);

  // First run also created every charge item (registration on enr-1 + a first_tuition per class);
  // the retry re-derives the same rows and finds them all present.
  const plannedChargeRows: Row[] = [
    { enrollment_id: "enr-1", item_type: "registration", class_id: null },
    { enrollment_id: "enr-1", item_type: "first_tuition", class_id: "cls-a" },
    { enrollment_id: "enr-2", item_type: "first_tuition", class_id: "cls-b" },
  ];
  const existingChargeKeys = new Set(
    plannedChargeRows.map((r) => chargeItemDedupeKey(r.enrollment_id, r.item_type, r.class_id))
  );
  assert.deepEqual(selectMissingChargeItems(plannedChargeRows, existingChargeKeys), []);
});

// ── registration cardinality (§2; per_student vs per_family) ─────────────────────────

test("registration per_student: two students → two registrations (first enrollment of each)", () => {
  // Student A in cls-a (enr-1) + cls-b (enr-2); Student B in cls-c (enr-3).
  const targets = attachTargets({
    mode: "per_student",
    registrationFeeCents: 5000,
    enrollments: [
      { enrollmentId: "enr-1", studentKey: "A" },
      { enrollmentId: "enr-2", studentKey: "A" },
      { enrollmentId: "enr-3", studentKey: "B" },
    ],
  });
  assert.deepEqual(targets, ["enr-1", "enr-3"]); // A's first + B's first; NOT enr-2
});

test("registration per_family: many enrollments → exactly one registration (the first)", () => {
  const targets = attachTargets({
    mode: "per_family",
    registrationFeeCents: 5000,
    enrollments: [
      { enrollmentId: "enr-1", studentKey: "A" },
      { enrollmentId: "enr-2", studentKey: "A" },
      { enrollmentId: "enr-3", studentKey: "B" },
    ],
  });
  assert.deepEqual(targets, ["enr-1"]);
});

test("registration: zero fee → no registration in either mode", () => {
  const base = [{ enrollmentId: "enr-1", studentKey: "A" }];
  assert.deepEqual(attachTargets({ mode: "per_student", registrationFeeCents: 0, enrollments: base }), []);
  assert.deepEqual(attachTargets({ mode: "per_family", registrationFeeCents: 0, enrollments: base }), []);
});

test("registration partial-retry: per_student, student A already registered → only B gets one", () => {
  // Retry: A's registration exists (seed {A}); the run must not re-attach it to A.
  const targets = attachTargets({
    mode: "per_student",
    registrationFeeCents: 5000,
    enrollments: [
      { enrollmentId: "enr-1", studentKey: "A" },
      { enrollmentId: "enr-3", studentKey: "B" },
    ],
    seed: new Set(["A"]),
  });
  assert.deepEqual(targets, ["enr-3"]);
});

test("registration partial-retry: per_family, one already exists → none added", () => {
  const targets = attachTargets({
    mode: "per_family",
    registrationFeeCents: 5000,
    enrollments: [{ enrollmentId: "enr-1", studentKey: "A" }],
    seed: new Set([FAMILY_REG_KEY]),
  });
  assert.deepEqual(targets, []);
});

// ── capacity gate (§3.3; pending+active → waitlist) ──────────────────────────────────

test("enrollmentStatusForCapacity: below cap → pending; at/over cap → waitlist", () => {
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 8, maxStudents: 10 }), "pending");
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 9, maxStudents: 10 }), "pending");
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 10, maxStudents: 10 }), "waitlist");
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 11, maxStudents: 10 }), "waitlist");
});

test("enrollmentStatusForCapacity: null max (no cap) → always pending", () => {
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 999, maxStudents: null }), "pending");
});

test("enrollmentStatusForCapacity: zero-capacity class → waitlist even at count 0", () => {
  assert.equal(enrollmentStatusForCapacity({ pendingActiveCount: 0, maxStudents: 0 }), "waitlist");
});

test("currentPeriod: YYYY-MM in UTC", () => {
  assert.equal(currentPeriod(new Date("2026-08-03T00:00:00Z")), "2026-08");
  assert.equal(currentPeriod(new Date("2026-01-31T23:59:59Z")), "2026-01");
  assert.equal(currentPeriod(new Date("2026-12-01T12:00:00Z")), "2026-12");
});
