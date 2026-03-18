import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderEmailHtml, DEFAULT_LOGO_URL } from "./layout";

const DEFAULT_REPLY_TO = "dance@bamsocal.com";

async function fetchLogoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  try {
    const { data } = await supabase
      .from("studio_settings")
      .select("logo_url")
      .limit(1)
      .single();
    return data?.logo_url || DEFAULT_LOGO_URL;
  } catch {
    return DEFAULT_LOGO_URL;
  }
}

/**
 * Send a branded email using a stored template.
 *
 * @param slug - Template slug (e.g., 'welcome', 'class_reminder')
 * @param to - Recipient email address
 * @param variables - Key-value pairs to replace {{variable}} placeholders
 * @param options - Optional overrides (threadToken for reply-to threading)
 */
export async function sendEmail(
  slug: string,
  to: string,
  variables: Record<string, string> = {},
  options?: { threadToken?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

  // Fetch logo URL from studio settings
  const logoUrl = await fetchLogoUrl(supabase);

  // Fetch template
  const { data: template, error: fetchError } = await supabase
    .from("email_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (fetchError || !template) {
    console.error("[email:send] Template not found:", slug, fetchError);
    return { success: false, error: `Template "${slug}" not found or inactive` };
  }

  // Add default variables
  const vars: Record<string, string> = {
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com",
    ...variables,
  };

  // Replace placeholders in subject and body
  const subject = replacePlaceholders(template.subject, vars);
  const bodyHtml = replacePlaceholders(template.body_html, vars);
  const headerText = template.header_text
    ? replacePlaceholders(template.header_text, vars)
    : null;
  const buttonText = template.button_text
    ? replacePlaceholders(template.button_text, vars)
    : null;
  const buttonUrl = template.button_url
    ? replacePlaceholders(template.button_url, vars)
    : null;

  // Render full HTML
  const html = renderEmailHtml({
    headerText,
    bodyHtml,
    buttonText,
    buttonUrl,
    footerText: template.footer_text,
    logoUrl,
  });

  // Build reply-to: thread token takes priority over template default, fallback to studio email
  let replyTo: string = template.reply_to || DEFAULT_REPLY_TO;
  if (options?.threadToken) {
    replyTo = `reply+${options.threadToken}@mail.balletacademyandmovement.com`;
  }

  // Send via Resend
  const { error: sendError } = await resend.emails.send({
    from: `${template.from_name} <${template.from_email}>`,
    to,
    replyTo,
    subject,
    html,
  });

  if (sendError) {
    console.error("[email:send] Resend error:", sendError);
    return { success: false, error: sendError.message };
  }

  return { success: true };
}

/**
 * Send a raw branded email (not template-based).
 * Used by the communications inbox for direct replies.
 */
export async function sendRawEmail({
  to,
  subject,
  bodyHtml,
  threadToken,
  fromName,
  fromEmail,
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  threadToken?: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();
  const logoUrl = await fetchLogoUrl(supabase);

  const senderName = fromName ?? "Ballet Academy and Movement";
  const senderEmail =
    fromEmail ?? process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";

  const html = renderEmailHtml({
    bodyHtml,
    footerText: null,
    logoUrl,
  });

  const replyTo = threadToken
    ? `reply+${threadToken}@mail.balletacademyandmovement.com`
    : DEFAULT_REPLY_TO;

  const { error: sendError } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to,
    replyTo,
    subject,
    html,
  });

  if (sendError) {
    console.error("[email:sendRaw] Resend error:", sendError);
    return { success: false, error: sendError.message };
  }

  return { success: true };
}

function replacePlaceholders(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}
