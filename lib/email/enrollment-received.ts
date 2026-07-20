// Parent "we received your enrollment — pending review" email. Sent (fire-and-forget) from the
// enrollment webhook when a pending enrollment is created (§3, §4-bis). The card was saved, NOT
// charged. STUB — the branded templated Resend email lands in Phase 1 step 6; the call site exists
// now so the webhook wiring is complete and non-fatal.

export interface EnrollmentReceivedArgs {
  to: string | null | undefined;
  parentName: string | null;
  classes: { name: string }[];
}

export async function sendEnrollmentReceived(args: EnrollmentReceivedArgs): Promise<void> {
  // TODO(step 6): send the branded "received — pending studio review; card saved, not charged" email.
  console.log(
    "[enrollment:received:stub] would email",
    args.to,
    `${args.classes.length} class(es) pending review`
  );
}
