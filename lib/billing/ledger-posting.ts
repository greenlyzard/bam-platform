// Double-entry ledger posting for the enrollment checkout.
// Implements docs/LEDGER_FOUNDATION_REVIEW.md §3 recipes R1 (invoice_finalized: DR AR / CR
// revenue) and R2 (payment_captured: DR cash_clearing / CR AR) for the Stripe Checkout flow.
//
// Pure + deterministic: no DB, no clock, no randomness. The WRITE PATH is the SECURITY DEFINER
// RPC post_ledger_group() — this module only shapes the balanced groups + legs the webhook hands
// to it. Idempotency is the RPC's ON CONFLICT (tenant_id, posting_key) DO NOTHING; the posting
// keys below are deterministic so a redelivered webhook no-ops.

/** Chart-of-accounts slugs (must exist in ledger_accounts) touched by checkout. */
export const ACCOUNTS = {
  accounts_receivable: "accounts_receivable",
  cash_clearing: "cash_clearing",
  revenue_tuition: "revenue_tuition",
} as const;

export type LegDirection = "debit" | "credit";

export interface PostingItem {
  classId: string;
  studentId: string | null;
  priceCents: number;
  locationId: string | null;
}

/** A leg, shaped for the post_ledger_group RPC's p_legs jsonb (snake_case keys). */
export interface LedgerLeg {
  account: string;
  direction: LegDirection;
  amount_cents: number;
  family_id: string | null;
  student_id: string | null;
  class_id: string | null;
  location_id: string | null;
  charge_status: string | null;
}

/** One economic event → one call to post_ledger_group. */
export interface PostingGroupSpec {
  postingKey: string;
  eventType: "invoice_finalized" | "payment_captured";
  sourceSystem: "app" | "stripe";
  sourceRef: string;
  legs: LedgerLeg[];
}

export interface CheckoutPostingInput {
  /** Stripe payment intent id — the stable source_ref for deterministic posting keys. */
  paymentIntentId: string;
  familyId: string | null;
  items: PostingItem[];
}

function leg(partial: Partial<LedgerLeg> & { account: string; direction: LegDirection; amount_cents: number }): LedgerLeg {
  return {
    family_id: null,
    student_id: null,
    class_id: null,
    location_id: null,
    charge_status: null,
    ...partial,
  };
}

/**
 * Build the two balanced groups for a completed enrollment checkout:
 *   R1 invoice_finalized: per item  DR accounts_receivable / CR revenue_tuition
 *   R2 payment_captured:  total     DR cash_clearing       / CR accounts_receivable
 * AR opens in R1 and clears in R2; each group independently balances (>=2 legs, Σdr=Σcr).
 * Posting keys follow the Fable format {source_system}:{source_ref}:{event_type}.
 */
export function buildCheckoutPostingGroups(input: CheckoutPostingInput): PostingGroupSpec[] {
  const { paymentIntentId: pi, familyId, items } = input;
  const groups: PostingGroupSpec[] = [];

  // R1 — invoice/enrollment finalized (revenue recognized against AR).
  const finalizeLegs: LedgerLeg[] = [];
  for (const it of items) {
    finalizeLegs.push(
      leg({
        account: ACCOUNTS.accounts_receivable,
        direction: "debit",
        amount_cents: it.priceCents,
        family_id: familyId,
        student_id: it.studentId,
        class_id: it.classId,
        location_id: it.locationId,
      }),
      leg({
        account: ACCOUNTS.revenue_tuition,
        direction: "credit",
        amount_cents: it.priceCents,
        family_id: familyId,
        student_id: it.studentId,
        class_id: it.classId,
        location_id: it.locationId,
      })
    );
  }
  if (finalizeLegs.length > 0) {
    groups.push({
      postingKey: `app:${pi}:invoice_finalized`,
      eventType: "invoice_finalized",
      sourceSystem: "app",
      sourceRef: pi,
      legs: finalizeLegs,
    });
  }

  // R2 — payment captured (cash clears AR).
  const totalCents = items.reduce((sum, it) => sum + it.priceCents, 0);
  if (totalCents > 0) {
    groups.push({
      postingKey: `stripe:${pi}:payment_captured`,
      eventType: "payment_captured",
      sourceSystem: "stripe",
      sourceRef: pi,
      legs: [
        leg({ account: ACCOUNTS.cash_clearing, direction: "debit", amount_cents: totalCents, family_id: familyId, charge_status: "captured" }),
        leg({ account: ACCOUNTS.accounts_receivable, direction: "credit", amount_cents: totalCents, family_id: familyId, charge_status: "captured" }),
      ],
    });
  }

  return groups;
}

/** Sum of debit and credit cents in a group. */
export function groupBalance(group: PostingGroupSpec): { debitCents: number; creditCents: number } {
  let debitCents = 0;
  let creditCents = 0;
  for (const l of group.legs) {
    if (l.direction === "debit") debitCents += l.amount_cents;
    else creditCents += l.amount_cents;
  }
  return { debitCents, creditCents };
}

/** Throw unless the group balances (Σdebits == Σcredits) and has >=2 legs. Call before the RPC. */
export function assertBalanced(group: PostingGroupSpec): void {
  const { debitCents, creditCents } = groupBalance(group);
  if (group.legs.length < 2) {
    throw new Error(`Ledger group '${group.eventType}' has <2 legs`);
  }
  if (debitCents !== creditCents) {
    throw new Error(
      `Unbalanced ledger group '${group.eventType}': debits=${debitCents} credits=${creditCents}`
    );
  }
}
