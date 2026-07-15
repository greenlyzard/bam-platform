// Double-entry ledger posting for the enrollment checkout.
// Implements docs/LEDGER_FOUNDATION_REVIEW.md §3.3 `direct_sale_captured`: an immediately-paid
// checkout (no invoice, no receivable) posts ONE balanced group — DR cash_clearing (total) /
// CR revenue_tuition (per item). No accounts_receivable leg: AR is reserved for genuinely-owed
// money (the recurring-tuition path), so an instant sale reads like a receipt (cash in = revenue).
//
// Pure + deterministic: no DB, no clock, no randomness. The WRITE PATH is the SECURITY DEFINER
// RPC post_ledger_group() — this module only shapes the balanced group + legs the webhook hands
// to it. Idempotency is the RPC's ON CONFLICT (tenant_id, posting_key) DO NOTHING; the posting
// key below is deterministic so a redelivered webhook no-ops.

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
  eventType: "direct_sale_captured";
  sourceSystem: "stripe";
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
 * Build the single balanced group for an immediately-paid enrollment checkout (Fable §3.3):
 *   direct_sale_captured: one DR cash_clearing (total) + per-item CR revenue_tuition.
 * No accounts_receivable — the money is already paid, so this reads like a receipt
 * (cash in = revenue). The group balances (Σdr=Σcr) and has >=2 legs.
 * Posting key follows the Fable format {source_system}:{source_ref}:{event_type}.
 */
export function buildCheckoutPostingGroups(input: CheckoutPostingInput): PostingGroupSpec[] {
  const { paymentIntentId: pi, familyId, items } = input;
  const totalCents = items.reduce((sum, it) => sum + it.priceCents, 0);
  if (totalCents <= 0) return [];

  // One debit for the cash received, one revenue credit per item (keeps per-class dims).
  const legs: LedgerLeg[] = [
    leg({
      account: ACCOUNTS.cash_clearing,
      direction: "debit",
      amount_cents: totalCents,
      family_id: familyId,
      charge_status: "captured",
    }),
  ];
  for (const it of items) {
    legs.push(
      leg({
        account: ACCOUNTS.revenue_tuition,
        direction: "credit",
        amount_cents: it.priceCents,
        family_id: familyId,
        student_id: it.studentId,
        class_id: it.classId,
        location_id: it.locationId,
        charge_status: "captured",
      })
    );
  }

  return [
    {
      postingKey: `stripe:${pi}:direct_sale_captured`,
      eventType: "direct_sale_captured",
      sourceSystem: "stripe",
      sourceRef: pi,
      legs,
    },
  ];
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
