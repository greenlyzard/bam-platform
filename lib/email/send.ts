import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderEmailHtml } from "./layout";

/**
 * Send a branded email using a stored template.
 *
 * @param slug - Template slug (e.g., 'welcome', 'class_reminder')
 * @param to - Recipient email address
 * @param variables - Key-value pairs to replace {{variable}} placeholders
 */
export async function sendEmail(
  slug: string,
  to: string,
  variables: Record<string, string> = {}
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

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
  });

  // Send via Resend
  const { error: sendError } = await resend.emails.send({
    from: `${template.from_name} <${template.from_email}>`,
    to,
    replyTo: template.reply_to || undefined,
    subject,
    html,
  });

  if (sendError) {
    console.error("[email:send] Resend error:", sendError);
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
