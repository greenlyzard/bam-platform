// Double-entry ledger posting for immediately-captured sales (Fable §3.3 `direct_sale_captured`).
// One balanced group: DR cash_clearing (total) / CR <revenue account> per line. No accounts_receivable
// — the money is already paid, so it reads like a receipt. Reserved for the immediate lines of the
// authorization checkout (registration fee, and any admin-flipped immediate tuition).
//
// Pure/deterministic: no DB, no clock, no randomness. The WRITE PATH is the SECURITY DEFINER RPC
// post_ledger_group(); idempotency is its ON CONFLICT (tenant_id, posting_key) DO NOTHING and the
// deterministic posting_key below.

/** Chart-of-accounts slugs (must exist in ledger_accounts) touched by the immediate sale. */
export const ACCOUNTS = {
  cash_clearing: "cash_clearing",
  revenue_tuition: "revenue_tuition",
  revenue_registration: "revenue_registration",
} as const;

export type LegDirection = "debit" | "credit";

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

/** A revenue line captured now in an immediate sale. */
export interface SaleLine {
  account: string; // revenue_registration | revenue_tuition | ...
  amountCents: number;
  familyId: string | null;
  studentId?: string | null;
  classId?: string | null;
  locationId?: string | null;
}

function leg(
  partial: Partial<LedgerLeg> & { account: string; direction: LegDirection; amount_cents: number }
): LedgerLeg {
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
 * Build the balanced `direct_sale_captured` group for the immediately-charged lines:
 *   DR cash_clearing (total) + CR <account> per line, all charge_status='captured'.
 * Returns null when nothing is payable (caller skips posting). >=2 legs, Σdebit=Σcredit.
 * Posting key follows the Fable format {source_system}:{source_ref}:{event_type}.
 */
export function buildDirectSaleGroup(args: {
  paymentIntentId: string;
  familyId: string | null;
  lines: SaleLine[];
}): PostingGroupSpec | null {
  const total = args.lines.reduce((sum, l) => sum + l.amountCents, 0);
  if (total <= 0) return null;

  const legs: LedgerLeg[] = [
    leg({
      account: ACCOUNTS.cash_clearing,
      direction: "debit",
      amount_cents: total,
      family_id: args.familyId,
      charge_status: "captured",
    }),
  ];
  for (const l of args.lines) {
    legs.push(
      leg({
        account: l.account,
        direction: "credit",
        amount_cents: l.amountCents,
        family_id: l.familyId,
        student_id: l.studentId ?? null,
        class_id: l.classId ?? null,
        location_id: l.locationId ?? null,
        charge_status: "captured",
      })
    );
  }

  return {
    postingKey: `stripe:${args.paymentIntentId}:direct_sale_captured`,
    eventType: "direct_sale_captured",
    sourceSystem: "stripe",
    sourceRef: args.paymentIntentId,
    legs,
  };
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
