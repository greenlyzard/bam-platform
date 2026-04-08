/**
 * Classify an inbound message as inquiry, review, or spam.
 * Per docs/COMMUNICATIONS_TRIAGE.md Section 2.
 */

export type ClassifierLabel = "inquiry" | "review" | "spam";

export interface ClassifierResult {
  label: ClassifierLabel;
  signals: string[];
}

const INQUIRY_KEYWORDS = [
  "class", "ballet", "dance", "teacher", "enrollment", "registration",
  "trial", "schedule", "tuition", "payment", "performance",
  "competition", "nutcracker", "recital", "audition", "costume",
];

const SPAM_SUBJECT_KEYWORDS = [
  "seo", "marketing", "loan", "investment", "crypto", "casino",
  "pills", "congratulations you've won", "unsubscribe",
];

const BULK_SENDER_DOMAINS = [
  "sendgrid.net", "mailchimp.com", "constantcontact.com",
  "campaign-archive.com", "mailerlite.com", "mailgun.org",
];

const NOREPLY_PATTERNS = [
  "noreply", "no-reply", "donotreply", "do-not-reply", "bounce", "mailer-daemon",
];

function lower(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function countLinks(body: string): number {
  const matches = body.match(/https?:\/\/[^\s)]+/gi);
  return matches ? matches.length : 0;
}

function isRealName(name: string): boolean {
  const n = lower(name);
  if (!n.trim()) return false;
  for (const p of NOREPLY_PATTERNS) {
    if (n.includes(p)) return false;
  }
  // Heuristic: real names have at least one space and no @ symbol
  if (n.includes("@")) return false;
  return n.trim().split(/\s+/).length >= 1;
}

function senderDomain(email: string): string {
  const idx = email.indexOf("@");
  return idx >= 0 ? email.slice(idx + 1).toLowerCase() : "";
}

function mentionsChildOrAge(body: string): boolean {
  // child name reference or age reference
  if (/\b(my (son|daughter|child|kid)|her name is|his name is)\b/i.test(body)) return true;
  if (/\b(\d{1,2})\s*(year|yr|yo|years old)\b/i.test(body)) return true;
  if (/\bage\s*\d{1,2}\b/i.test(body)) return true;
  return false;
}

export function classifyMessage(
  subject: string,
  body: string,
  senderEmail: string,
  senderName: string
): ClassifierResult {
  const subjLower = lower(subject);
  const bodyLower = lower(body);
  const fullText = `${subjLower} ${bodyLower}`;
  const signals: string[] = [];

  // ── Inquiry signals ──
  let inquirySignals = 0;
  for (const kw of INQUIRY_KEYWORDS) {
    if (fullText.includes(kw)) {
      signals.push(`inquiry:keyword:${kw}`);
      inquirySignals++;
      break; // one keyword is enough; just record first
    }
  }
  if (isRealName(senderName)) {
    signals.push("inquiry:real_name");
    inquirySignals++;
  }
  if (mentionsChildOrAge(body)) {
    signals.push("inquiry:child_or_age");
    inquirySignals++;
  }
  if (body.includes("?")) {
    signals.push("inquiry:question_mark");
    inquirySignals++;
  }

  // ── Spam signals ──
  let spamSignals = 0;
  for (const kw of SPAM_SUBJECT_KEYWORDS) {
    if (subjLower.includes(kw)) {
      signals.push(`spam:subject:${kw}`);
      spamSignals++;
      break;
    }
  }
  const domain = senderDomain(senderEmail);
  if (BULK_SENDER_DOMAINS.some((d) => domain.endsWith(d))) {
    signals.push(`spam:bulk_sender:${domain}`);
    spamSignals++;
  }
  if (countLinks(body) > 3) {
    signals.push("spam:many_links");
    spamSignals++;
  }
  const localPart = senderEmail.split("@")[0]?.toLowerCase() ?? "";
  if (NOREPLY_PATTERNS.some((p) => localPart.includes(p))) {
    signals.push("spam:noreply_sender");
    spamSignals++;
  }
  if (body.length > 2000 && !body.includes("?") && !isRealName(senderName)) {
    signals.push("spam:long_no_question_no_name");
    spamSignals++;
  }
  // SMS-style: short body + link
  if (body.trim().split(/\s+/).length < 5 && countLinks(body) > 0) {
    signals.push("spam:short_with_link");
    spamSignals++;
  }

  // ── Decision ──
  if (spamSignals >= 2) return { label: "spam", signals };
  if (inquirySignals >= 1) return { label: "inquiry", signals };
  return { label: "review", signals };
}
