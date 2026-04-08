/**
 * AI-powered classifier for inbound communications.
 * Uses Claude Haiku for fast/cheap classification.
 * Falls back to a keyword-based heuristic if the API call fails.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ClassifierLabel = "inquiry" | "review" | "spam";

export interface ClassifierResult {
  label: ClassifierLabel;
  signals: string[];
  special_type: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a classifier for Ballet Academy and Movement, a classical ballet studio in San Clemente, CA. Classify inbound emails into one of three categories:
- inquiry: A real person interested in classes, enrollment, trials, pricing, schedules, teachers, performances, absences, or anything studio-related. Err on the side of inquiry when unsure.
- spam: Unsolicited marketing, sales pitches, SEO offers, bulk email, automated system notifications from non-studio software.
- review: Genuinely ambiguous — could be real, needs human eyes.

Also detect special types:
- absence: Parent notifying of a student absence
- cancellation: Parent wanting to cancel enrollment or leave the studio
- retention_risk: Dissatisfaction, complaint, or any hint of leaving

Respond with JSON only, no markdown:
{ "label": "inquiry"|"review"|"spam", "signals": string[], "special_type": "absence"|"cancellation"|"retention_risk"|null, "confidence": number }`;

export async function classifyMessage(
  subject: string,
  body: string,
  senderEmail: string,
  senderName: string
): Promise<ClassifierResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackClassify(subject, body, senderEmail, senderName);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userMessage = `Subject: ${subject}\nFrom: ${senderName} <${senderEmail}>\nBody: ${body.slice(0, 2000)}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Strip any accidental code fence wrapping
    const raw = textBlock.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw);

    const label: ClassifierLabel =
      parsed.label === "inquiry" || parsed.label === "spam" || parsed.label === "review"
        ? parsed.label
        : "review";

    return {
      label,
      signals: Array.isArray(parsed.signals) ? parsed.signals.map(String) : [],
      special_type: typeof parsed.special_type === "string" ? parsed.special_type : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (e) {
    console.error("[classify] AI classification failed, using fallback:", e);
    return fallbackClassify(subject, body, senderEmail, senderName);
  }
}

// ── Fallback heuristic classifier (used when Anthropic API is unavailable) ──

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

const NOREPLY_PATTERNS = ["noreply", "no-reply", "donotreply", "do-not-reply", "bounce", "mailer-daemon"];

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
  for (const p of NOREPLY_PATTERNS) if (n.includes(p)) return false;
  if (n.includes("@")) return false;
  return n.trim().split(/\s+/).length >= 1;
}
function senderDomain(email: string): string {
  const idx = email.indexOf("@");
  return idx >= 0 ? email.slice(idx + 1).toLowerCase() : "";
}

function fallbackClassify(
  subject: string,
  body: string,
  senderEmail: string,
  senderName: string
): ClassifierResult {
  const subjLower = lower(subject);
  const bodyLower = lower(body);
  const fullText = `${subjLower} ${bodyLower}`;
  const signals: string[] = [];

  let inquirySignals = 0;
  for (const kw of INQUIRY_KEYWORDS) {
    if (fullText.includes(kw)) {
      signals.push(`inquiry:keyword:${kw}`);
      inquirySignals++;
      break;
    }
  }
  if (isRealName(senderName)) { signals.push("inquiry:real_name"); inquirySignals++; }
  if (body.includes("?")) { signals.push("inquiry:question_mark"); inquirySignals++; }

  let spamSignals = 0;
  for (const kw of SPAM_SUBJECT_KEYWORDS) {
    if (subjLower.includes(kw)) { signals.push(`spam:subject:${kw}`); spamSignals++; break; }
  }
  const domain = senderDomain(senderEmail);
  if (BULK_SENDER_DOMAINS.some((d) => domain.endsWith(d))) {
    signals.push(`spam:bulk_sender:${domain}`); spamSignals++;
  }
  if (countLinks(body) > 3) { signals.push("spam:many_links"); spamSignals++; }
  const localPart = senderEmail.split("@")[0]?.toLowerCase() ?? "";
  if (NOREPLY_PATTERNS.some((p) => localPart.includes(p))) { signals.push("spam:noreply_sender"); spamSignals++; }

  let label: ClassifierLabel = "review";
  if (spamSignals >= 2) label = "spam";
  else if (inquirySignals >= 1) label = "inquiry";

  return { label, signals, special_type: null, confidence: 0.5 };
}
