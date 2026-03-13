import { sendRawEmail } from "./send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";

export async function sendTimesheetApprovedEmail({
  to,
  teacherName,
  dateRange,
  totalHours,
  totalOwed,
}: {
  to: string;
  teacherName: string;
  dateRange: string;
  totalHours: number;
  totalOwed?: number;
}) {
  const bodyHtml = `
    <p>Hi ${escapeHtml(teacherName)},</p>
    <p>Your timesheet for <strong>${escapeHtml(dateRange)}</strong> has been approved.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 4px 16px 4px 0; font-size: 14px; color: #6B6B7B;">Total hours approved:</td>
        <td style="font-size: 14px; font-weight: 600; color: #2C2C2C;">${totalHours.toFixed(1)}</td>
      </tr>
      ${totalOwed ? `
      <tr>
        <td style="padding: 4px 16px 4px 0; font-size: 14px; color: #6B6B7B;">Total owed:</td>
        <td style="font-size: 14px; font-weight: 600; color: #2C2C2C;">$${totalOwed.toFixed(2)}</td>
      </tr>` : ""}
    </table>
    <p style="margin-top: 16px;">
      <a href="${APP_URL}/teach/timesheets" style="color: #9C8BBF; text-decoration: none; font-weight: 500;">
        View your timesheet →
      </a>
    </p>
  `;

  return sendRawEmail({
    to,
    subject: "Your timesheet has been approved",
    bodyHtml,
  });
}

export async function sendTimesheetFlaggedEmail({
  to,
  teacherName,
  question,
  entryDescription,
  entryDate,
}: {
  to: string;
  teacherName: string;
  question: string;
  entryDescription: string;
  entryDate: string;
}) {
  const bodyHtml = `
    <p>Hi ${escapeHtml(teacherName)},</p>
    <p>Amanda has a question about your timesheet entry:</p>
    <div style="margin: 16px 0; padding: 12px 16px; background-color: #FFF8E7; border-left: 3px solid #C9A84C; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #6B6B7B;">
        Entry: ${escapeHtml(entryDescription)} on ${escapeHtml(entryDate)}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #2C2C2C; font-style: italic;">
        &ldquo;${escapeHtml(question)}&rdquo;
      </p>
    </div>
    <p>Please log in to respond and resubmit.</p>
    <p style="margin-top: 16px;">
      <a href="${APP_URL}/teach/timesheets" style="color: #9C8BBF; text-decoration: none; font-weight: 500;">
        Respond now →
      </a>
    </p>
  `;

  return sendRawEmail({
    to,
    subject: "Action needed: Timesheet question from Amanda",
    bodyHtml,
  });
}

export async function sendFlagResponseEmail({
  to,
  teacherName,
  response,
  entryDescription,
}: {
  to: string;
  teacherName: string;
  response: string;
  entryDescription: string;
}) {
  const bodyHtml = `
    <p>${escapeHtml(teacherName)} responded to your timesheet question:</p>
    <div style="margin: 16px 0; padding: 12px 16px; background-color: #F0EDF3; border-left: 3px solid #9C8BBF; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #6B6B7B;">
        Entry: ${escapeHtml(entryDescription)}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #2C2C2C;">
        &ldquo;${escapeHtml(response)}&rdquo;
      </p>
    </div>
    <p style="margin-top: 16px;">
      <a href="${APP_URL}/admin/timesheets?view=entries" style="color: #9C8BBF; text-decoration: none; font-weight: 500;">
        Review in admin →
      </a>
    </p>
  `;

  return sendRawEmail({
    to,
    subject: `${teacherName} responded to your timesheet question`,
    bodyHtml,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
