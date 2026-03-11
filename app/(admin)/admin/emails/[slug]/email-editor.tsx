"use client";

import { useState } from "react";
import { updateEmailTemplate } from "../actions";

interface EmailTemplate {
  slug: string;
  name: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  subject: string;
  header_text: string | null;
  body_html: string;
  button_text: string | null;
  button_url: string | null;
  footer_text: string | null;
  is_active: boolean;
}

// Sample variables for preview rendering
const sampleVars: Record<string, string> = {
  app_url: "https://portal.balletacademyandmovement.com",
  student_name: "Sofia Martinez",
  class_name: "Ballet Level 1",
  class_time: "4:00 PM",
  class_day: "Mondays",
  class_room: "Studio A",
  teacher_name: "Ms. Amanda",
  trial_date: "March 18, 2026",
  performance_name: "The Nutcracker 2026",
  performance_details:
    "December 12–14, 2026 at the San Clemente Community Center.",
  magic_link: "#preview-link",
};

function replacePlaceholders(text: string): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => sampleVars[key] ?? match
  );
}

export function EmailEditor({ template }: { template: EmailTemplate }) {
  const [fromName, setFromName] = useState(template.from_name);
  const [fromEmail, setFromEmail] = useState(template.from_email);
  const [replyTo, setReplyTo] = useState(template.reply_to ?? "");
  const [subject, setSubject] = useState(template.subject);
  const [headerText, setHeaderText] = useState(template.header_text ?? "");
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [buttonText, setButtonText] = useState(template.button_text ?? "");
  const [buttonUrl, setButtonUrl] = useState(template.button_url ?? "");
  const [footerText, setFooterText] = useState(template.footer_text ?? "");
  const [isActive, setIsActive] = useState(template.is_active);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.set("slug", template.slug);
    formData.set("from_name", fromName);
    formData.set("from_email", fromEmail);
    formData.set("reply_to", replyTo);
    formData.set("subject", subject);
    formData.set("header_text", headerText);
    formData.set("body_html", bodyHtml);
    formData.set("button_text", buttonText);
    formData.set("button_url", buttonUrl);
    formData.set("footer_text", footerText);
    formData.set("is_active", String(isActive));

    const result = await updateEmailTemplate(formData);
    setSaving(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Template saved.");
    }
  }

  async function handleSendTest() {
    setSending(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/emails/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo || undefined,
          subject,
          header_text: headerText || undefined,
          body_html: bodyHtml,
          button_text: buttonText || undefined,
          button_url: buttonUrl || undefined,
          footer_text: footerText || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(`Test email sent to ${data.sentTo}`);
      }
    } catch {
      setError("Failed to send test email.");
    } finally {
      setSending(false);
    }
  }

  // Build preview HTML
  const previewHtml = buildPreviewHtml({
    headerText: headerText ? replacePlaceholders(headerText) : null,
    bodyHtml: replacePlaceholders(bodyHtml),
    buttonText: buttonText ? replacePlaceholders(buttonText) : null,
    buttonUrl: buttonUrl ? replacePlaceholders(buttonUrl) : null,
    footerText: footerText || null,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left panel: form */}
      <div className="space-y-4">
        {/* Status messages */}
        {error && (
          <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-charcoal">
            Active
          </label>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isActive ? "bg-lavender" : "bg-silver"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="From Name"
            value={fromName}
            onChange={setFromName}
          />
          <Field
            label="From Email"
            value={fromEmail}
            onChange={setFromEmail}
            type="email"
          />
        </div>

        <Field
          label="Reply To"
          value={replyTo}
          onChange={setReplyTo}
          type="email"
          placeholder="dance@bamsocal.com"
        />

        <Field
          label="Subject"
          value={subject}
          onChange={setSubject}
          hint="Use {{variable}} for dynamic content"
        />

        <Field
          label="Header Text"
          value={headerText}
          onChange={setHeaderText}
          placeholder="Optional heading above body"
        />

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Body HTML
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-sm font-mono placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-y"
          />
          <p className="mt-1 text-xs text-mist">
            HTML supported. Use {`{{variable}}`} placeholders.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Button Text"
            value={buttonText}
            onChange={setButtonText}
            placeholder="Optional CTA"
          />
          <Field
            label="Button URL"
            value={buttonUrl}
            onChange={setButtonUrl}
            placeholder="{{app_url}}/portal/..."
          />
        </div>

        <Field
          label="Footer Text"
          value={footerText}
          onChange={setFooterText}
          placeholder="Studio address and contact"
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending}
            className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal hover:border-lavender font-medium text-sm px-6 transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Test Email"}
          </button>
        </div>
      </div>

      {/* Right panel: live preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal">Preview</h3>
          <p className="text-xs text-mist">
            Subject: {replacePlaceholders(subject)}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <iframe
            srcDoc={previewHtml}
            className="w-full border-0"
            style={{ minHeight: 600 }}
            title="Email preview"
            sandbox=""
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
    </div>
  );
}

function buildPreviewHtml({
  headerText,
  bodyHtml,
  buttonText,
  buttonUrl,
  footerText,
}: {
  headerText: string | null;
  bodyHtml: string;
  buttonText: string | null;
  buttonUrl: string | null;
  footerText: string | null;
}): string {
  const btn =
    buttonText && buttonUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="border-radius:8px;background-color:#9C8BBF;"><a href="${buttonUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${buttonText}</a></td></tr></table>`
      : "";

  const footer =
    footerText ||
    "Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#FAF7F2;font-family:Arial,sans-serif;color:#2C2C2C;}</style></head><body>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF7F2;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
<tr><td style="background:#9C8BBF;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#fff;letter-spacing:.5px;">Ballet Academy and Movement</p>
</td></tr>
${headerText ? `<tr><td style="background:#fff;padding:32px 32px 0 32px;"><h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:600;color:#2C2C2C;">${headerText}</h1></td></tr>` : ""}
<tr><td style="background:#fff;padding:${headerText ? "16px" : "32px"} 32px 32px 32px;font-size:15px;line-height:1.7;color:#2C2C2C;">
${bodyHtml}${btn}
</td></tr>
<tr><td style="background:#F5F0E8;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
<p style="margin:0;font-size:12px;color:#6B6B7B;line-height:1.5;">${footer}</p>
<p style="margin:8px 0 0 0;font-size:11px;color:#A8A8B8;">balletacademyandmovement.com</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
