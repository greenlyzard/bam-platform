import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { renderEmailHtml } from "@/lib/email/layout";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const FROM_NAME = "Ballet Academy and Movement";

/**
 * Supabase Auth Email Hook.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   URL:    https://<your-domain>/api/auth/send-email
 *   Secret: SUPABASE_AUTH_HOOK_SECRET (set in env vars)
 *
 * Supabase calls this instead of its built-in mailer for:
 *   - signup (confirmation email)
 *   - magiclink (magic link email)
 *   - recovery (password reset)
 *   - email_change (email change confirmation)
 *
 * See: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
export async function POST(req: NextRequest) {
  // Verify the hook secret to prevent unauthorized calls
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${hookSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = await req.json();
  const { user, email_data } = payload;

  const recipientEmail = user?.email;
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No recipient email" },
      { status: 400 }
    );
  }

  const emailType: string = email_data?.email_action_type ?? "";
  const token: string = email_data?.token ?? "";
  const tokenHash: string = email_data?.token_hash ?? "";
  const redirectTo: string = email_data?.redirect_to ?? "";

  // Build the confirmation URL
  // Supabase expects the token to be verified via its /auth/v1/verify endpoint
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://portal.balletacademyandmovement.com";

  let confirmationUrl: string;
  if (tokenHash) {
    // PKCE flow — use token_hash with type param
    confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${emailType}&redirect_to=${encodeURIComponent(redirectTo || siteUrl)}`;
  } else if (token) {
    confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${emailType}&redirect_to=${encodeURIComponent(redirectTo || siteUrl)}`;
  } else {
    confirmationUrl = siteUrl;
  }

  const firstName =
    user?.user_metadata?.first_name ??
    user?.raw_user_meta_data?.first_name ??
    "";

  const { subject, headerText, bodyHtml, buttonText } =
    getEmailContent(emailType, firstName, confirmationUrl);

  const html = renderEmailHtml({
    headerText,
    bodyHtml,
    buttonText,
    buttonUrl: confirmationUrl,
  });

  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipientEmail],
    subject,
    html,
  });

  if (error) {
    console.error("[auth:send-email] Resend error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function getEmailContent(
  emailType: string,
  firstName: string,
  _confirmationUrl: string
): {
  subject: string;
  headerText: string;
  bodyHtml: string;
  buttonText: string;
} {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  switch (emailType) {
    case "signup":
      return {
        subject: "Confirm your account — Ballet Academy and Movement",
        headerText: "Welcome to Ballet Academy and Movement",
        bodyHtml: `<p>${greeting}</p>
<p>Thank you for creating your account! Please confirm your email address to get started.</p>
<p>Once confirmed, you can view your schedule, manage enrollment, and stay connected with the studio.</p>`,
        buttonText: "Confirm My Email",
      };

    case "magiclink":
      return {
        subject: "Your sign-in link — Ballet Academy and Movement",
        headerText: "Sign In to Your Account",
        bodyHtml: `<p>${greeting}</p>
<p>Click the button below to sign in to your Ballet Academy and Movement account. This link expires in 10 minutes.</p>`,
        buttonText: "Sign In",
      };

    case "recovery":
      return {
        subject: "Reset your password — Ballet Academy and Movement",
        headerText: "Password Reset Request",
        bodyHtml: `<p>${greeting}</p>
<p>We received a request to reset your password. Click the button below to choose a new password.</p>
<p>If you didn&rsquo;t request this, you can safely ignore this email.</p>`,
        buttonText: "Reset Password",
      };

    case "email_change":
      return {
        subject: "Confirm your new email — Ballet Academy and Movement",
        headerText: "Email Address Change",
        bodyHtml: `<p>${greeting}</p>
<p>You requested to change your email address. Please confirm your new email by clicking the button below.</p>`,
        buttonText: "Confirm New Email",
      };

    default:
      return {
        subject: "Ballet Academy and Movement",
        headerText: "Ballet Academy and Movement",
        bodyHtml: `<p>${greeting}</p>
<p>Please click the button below to continue.</p>`,
        buttonText: "Continue",
      };
  }
}
