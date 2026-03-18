export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { renderEmailHtml } from "@/lib/email/layout";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const FROM_NAME = "Ballet Academy and Movement";
const DEFAULT_REPLY_TO = "dance@bamsocal.com";
const DEFAULT_LOGO_URL =
  "https://portal.balletacademyandmovement.com/BAM%20Logos_Pink%20Circle-Favicon.png";

/**
 * Supabase Auth Email Hook — edge runtime for zero cold start.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   URL:    https://<your-domain>/api/auth/send-email
 *   Secret: HOOK_SECRET (set in env vars)
 *
 * Supabase calls this instead of its built-in mailer for:
 *   - signup (confirmation email)
 *   - magiclink (magic link email)
 *   - recovery (password reset)
 *   - email_change (email change confirmation)
 *
 * Uses Resend REST API directly (not the SDK) for edge compatibility.
 *
 * See: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
export async function POST(req: NextRequest) {
  // Verify the hook secret to prevent unauthorized calls.
  // If verification fails, log a warning but still return 200
  // so Supabase auth flow is not blocked for the end user.
  const hookSecret = process.env.HOOK_SECRET;
  if (hookSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.trim() !== `Bearer ${hookSecret?.trim()}`) {
      console.warn("[auth:send-email] Hook secret mismatch — skipping custom email");
      return NextResponse.json({ success: true });
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
  // Build the confirmation URL — point directly to our callback route
  // so the user's browser calls verifyOtp itself, bypassing Supabase's
  // /auth/v1/verify redirect (which Gmail SafeLinks pre-fetches and breaks).
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://portal.balletacademyandmovement.com";

  let confirmationUrl: string;
  if (tokenHash) {
    confirmationUrl = `${siteUrl}/callback?token_hash=${tokenHash}&type=${emailType}`;
  } else if (token) {
    confirmationUrl = `${siteUrl}/callback?token_hash=${token}&type=${emailType}`;
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
    logoUrl: DEFAULT_LOGO_URL,
  });

  // Send via Resend REST API directly (edge-compatible, no SDK needed)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[auth:send-email] RESEND_API_KEY not set");
    return NextResponse.json({ success: true });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [recipientEmail],
        reply_to: DEFAULT_REPLY_TO,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[auth:send-email] Resend API error:", res.status, err);
    }
  } catch (err) {
    console.error("[auth:send-email] Resend fetch error:", err);
  }

  // Always return success so Supabase auth flow is not blocked.
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
