// Admin "new pending enrollment" notification (§4-bis): an in-app notifications row for every active
// admin/super_admin plus an email, each deep-linking the approvals queue. Sent from the enrollment
// webhook when a pending enrollment is created. Uses the service-role client (webhook has no session).

import { createAdminClient } from "@/lib/supabase/admin";
import { sendRawEmail } from "@/lib/email/send";

export interface AdminPendingEnrollmentArgs {
  tenantId: string;
  familyId: string | null;
  classes: { name: string }[];
}

export async function notifyAdminsNewPendingEnrollment(
  args: AdminPendingEnrollmentArgs
): Promise<void> {
  const supabase = createAdminClient();

  // Active admins / super_admins are the recipients (profile_roles is the source of truth, §4).
  const { data: admins } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true);
  const adminIds = Array.from(
    new Set((admins ?? []).map((a) => a.user_id).filter(Boolean) as string[])
  );
  if (adminIds.length === 0) return;

  const count = args.classes.length;
  const classNames = args.classes.map((c) => c.name).join(", ");
  const title = `New pending enrollment (${count} class${count !== 1 ? "es" : ""})`;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";
  const approvalsUrl = `${appUrl}/admin/enrollment/approvals`;

  // In-app notifications (one per admin).
  await supabase.from("notifications").insert(
    adminIds.map((id) => ({
      tenant_id: args.tenantId,
      recipient_id: id,
      notification_type: "enrollment_pending",
      title,
      body: `${classNames} — review in the approvals queue.`,
      metadata: { family_id: args.familyId, approvals_url: approvalsUrl },
    }))
  );

  // Email each admin. Resolve emails from profiles (profiles.id === profile_roles.user_id).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", adminIds);
  const emails = Array.from(
    new Set((profiles ?? []).map((p) => p.email).filter(Boolean) as string[])
  );

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">${escapeHtml(title)}.</p>
    <p style="margin:0 0 12px 0;color:#6B6B7B;font-size:14px;">${escapeHtml(classNames)}</p>
    <p style="margin:0;"><a href="${escapeHtml(approvalsUrl)}"
      style="color:#9C8BBF;font-weight:600;text-decoration:none;">Open the approvals queue &rarr;</a></p>
  `;
  for (const email of emails) {
    const result = await sendRawEmail({ to: email, subject: title, bodyHtml });
    if (!result.success) {
      console.error("[admin:pending-enrollment] email failed", email, result.error);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
