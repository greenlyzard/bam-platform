import { sendEmail, sendRawEmail } from "./send";
import { renderEmailHtml } from "./layout";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

interface EnrolledClass {
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacherName: string | null;
}

export async function sendEnrollmentConfirmation({
  to,
  parentName,
  classes,
}: {
  to: string;
  parentName: string | null;
  classes: EnrolledClass[];
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";

  // Try template-based email first
  const greeting = parentName ? parentName.split(" ")[0] : "there";

  const classListHtml = classes
    .map(
      (cls) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #F0EDF3;">
          <p style="margin: 0; font-weight: 600; font-size: 15px; color: #2C2C2C;">
            ${escapeHtml(cls.name)}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #6B6B7B;">
            ${DAYS[cls.dayOfWeek]}s &middot; ${formatTime(cls.startTime)}&ndash;${formatTime(cls.endTime)}
            ${cls.room ? ` &middot; ${escapeHtml(cls.room)}` : ""}
            ${cls.teacherName ? ` &middot; ${escapeHtml(cls.teacherName)}` : ""}
          </p>
        </td>
      </tr>`
    )
    .join("");

  const variables: Record<string, string> = {
    parent_first_name: greeting,
    class_list: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${classListHtml}</table>`,
    portal_url: `${appUrl}/portal/dashboard`,
    app_url: appUrl,
  };

  // Try the template first
  const templateResult = await sendEmail(
    "enrollment_confirmation",
    to,
    variables
  );

  if (templateResult.success) return templateResult;

  // Fallback: send raw HTML if template doesn't exist
  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Welcome, ${escapeHtml(greeting)}!</p>
    <p style="margin: 0 0 16px 0;">Your enrollment at Ballet Academy and Movement is confirmed. Here are your class details:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${classListHtml}
    </table>
    <p style="margin: 24px 0 8px 0; font-weight: 600; color: #2C2C2C;">What happens next:</p>
    <ul style="margin: 0; padding-left: 20px; color: #6B6B7B; font-size: 14px; line-height: 1.8;">
      <li>Your first class is always a free trial &mdash; if it&apos;s not the right fit, we&apos;ll refund in full.</li>
      <li>Class details and your schedule are in your <a href="${escapeHtml(appUrl)}/portal/dashboard" style="color: #9C8BBF; text-decoration: none; font-weight: 500;">parent portal</a>.</li>
      <li>Questions? Reply to this email or call us at (949) 229-0846.</li>
    </ul>
    <p style="margin: 24px 0 0 0; color: #2C2C2C;">We can&apos;t wait to see you in the studio!</p>
  `;

  return sendRawEmail({
    to,
    subject: "You're enrolled at Ballet Academy and Movement!",
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
