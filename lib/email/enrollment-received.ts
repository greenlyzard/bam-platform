// Parent "we received your enrollment — pending review" email (§3, §4-bis). Sent from the enrollment
// webhook when a pending enrollment is created. The card was vaulted, NOT charged — registration and
// the prorated first month are charged only after admin approval; ongoing tuition draws on the 15th.

import { sendRawEmail } from "@/lib/email/send";

export interface EnrollmentReceivedArgs {
  to: string | null | undefined;
  parentName: string | null;
  classes: { name: string; waitlisted?: boolean }[];
}

export async function sendEnrollmentReceived(args: EnrollmentReceivedArgs): Promise<void> {
  if (!args.to) return;

  const greeting = args.parentName ? args.parentName.split(" ")[0] : "there";
  const pending = args.classes.filter((c) => !c.waitlisted);
  const waitlisted = args.classes.filter((c) => c.waitlisted);

  const listHtml = (rows: { name: string }[]) =>
    rows
      .map(
        (c) => `<li style="margin:0 0 6px 0;color:#6B6B7B;font-size:14px;">${escapeHtml(c.name)}</li>`
      )
      .join("");

  const pendingSection = pending.length
    ? `<p style="margin:0 0 8px 0;font-weight:600;color:#2C2C2C;">Classes pending review</p>
       <ul style="margin:0 0 16px 0;padding-left:20px;">${listHtml(pending)}</ul>`
    : "";

  const waitlistSection = waitlisted.length
    ? `<p style="margin:0 0 8px 0;font-weight:600;color:#2C2C2C;">Waitlisted classes</p>
       <ul style="margin:0 0 8px 0;padding-left:20px;">${listHtml(waitlisted)}</ul>
       <p style="margin:0 0 16px 0;color:#6B6B7B;font-size:13px;">These classes are currently full.
         We&apos;ll notify you if a spot opens — <strong>nothing is charged for waitlisted classes</strong>
         unless you&apos;re enrolled.</p>`
    : "";

  // Only promise charges when at least one class is actually pending review (not all waitlisted).
  const nextSteps = pending.length
    ? `<ul style="margin:0 0 16px 0;padding-left:20px;color:#6B6B7B;font-size:14px;line-height:1.7;">
        <li>Our team reviews your enrollment.</li>
        <li>Once approved, we charge your one-time registration fee and your prorated first month.</li>
        <li>Ongoing monthly tuition draws on the 15th.</li>
        <li>Your first class is always a free trial — full refund if it&apos;s not the right fit.</li>
      </ul>`
    : `<ul style="margin:0 0 16px 0;padding-left:20px;color:#6B6B7B;font-size:14px;line-height:1.7;">
        <li>We&apos;ll notify you as soon as a spot opens in your waitlisted class(es).</li>
        <li>Nothing is charged while you&apos;re waitlisted.</li>
      </ul>`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(greeting)},</p>
    <p style="margin:0 0 16px 0;">Thank you — we&apos;ve received your enrollment request at Ballet Academy
      and Movement. Your card was securely saved, and <strong>nothing has been charged yet</strong>.</p>
    <p style="margin:0 0 8px 0;font-weight:600;color:#2C2C2C;">What happens next</p>
    ${nextSteps}
    ${pendingSection}
    ${waitlistSection}
    <p style="margin:0;">Questions? Reply to this email or call us at (949) 229-0846.</p>
  `;

  const result = await sendRawEmail({
    to: args.to,
    subject: "We received your enrollment — pending review",
    bodyHtml,
  });
  if (!result.success) {
    console.error("[enrollment:received] email failed", result.error);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
