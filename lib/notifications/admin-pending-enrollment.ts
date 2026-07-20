// Admin "new pending enrollment" notification (in-app + email) with a deep link to the approvals
// queue (§4-bis). Sent (fire-and-forget) from the enrollment webhook when a pending enrollment is
// created. STUB — the notifications-table + Resend wiring lands in Phase 1 step 6; the call site
// exists now so the webhook wiring is complete and non-fatal.

export interface AdminPendingEnrollmentArgs {
  tenantId: string;
  familyId: string | null;
  classes: { name: string }[];
}

export async function notifyAdminsNewPendingEnrollment(
  args: AdminPendingEnrollmentArgs
): Promise<void> {
  // TODO(step 6): insert a notifications row + optional Resend email; deep-link
  // /admin/enrollment/approvals.
  console.log(
    "[admin:pending-enrollment:stub] tenant",
    args.tenantId,
    `${args.classes.length} pending class(es)`
  );
}
