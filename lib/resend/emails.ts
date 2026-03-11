import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const FROM_NAME = "Ballet Academy and Movement";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams) {
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });

  if (error) {
    console.error("[email:send]", error);
    throw new Error(error.message);
  }

  return data;
}
