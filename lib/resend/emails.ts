import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const FROM_NAME = "Ballet Academy and Movement";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

const DEFAULT_REPLY_TO = "dance@bamsocal.com";

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams) {
  const { data, error } = await getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo: replyTo ?? DEFAULT_REPLY_TO,
  });

  if (error) {
    console.error("[email:send]", error);
    throw new Error(error.message);
  }

  return data;
}
