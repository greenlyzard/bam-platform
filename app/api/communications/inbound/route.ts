import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import {
  extractThreadToken,
  getOrCreateThread,
  appendMessage,
} from "@/lib/communications/thread";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  return createServiceClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Verify Resend webhook signature.
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

/**
 * Sanitize HTML — strip script tags, iframes, and on* event attributes.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<iframe[\s\S]*?\/?>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, "");
}

/**
 * Extract email from "Name <email@example.com>" or plain email format.
 */
function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await req.text();

  // Verify signature if secret is configured
  if (webhookSecret) {
    const signature = req.headers.get("resend-signature");
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[inbound] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toAddresses: string[] = Array.isArray(payload.to)
    ? payload.to
    : typeof payload.to === "string"
    ? [payload.to]
    : [];

  const fromRaw = (payload.from as string) ?? "";
  const { name: senderName, email: senderEmail } = parseEmailAddress(fromRaw);
  const subject = (payload.subject as string) ?? "";
  const htmlBody = sanitizeHtml((payload.html as string) ?? "");
  const textBody = (payload.text as string) ?? "";

  // Find thread token from the to address
  let threadToken: string | null = null;
  for (const addr of toAddresses) {
    threadToken = extractThreadToken(addr);
    if (threadToken) break;
  }

  if (!threadToken) {
    console.warn("[inbound] No thread token found in to addresses:", toAddresses);
    return NextResponse.json({ error: "No thread token" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Get default tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .limit(1)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "No tenant found" }, { status: 500 });
  }

  const tenantId = tenant.id;

  // Match sender to a profile
  let senderId: string | null = null;
  let familyId: string | null = null;
  let leadId: string | null = null;
  let matched = false;

  // 1. Check families by billing_email
  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("billing_email", senderEmail)
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  if (family) {
    familyId = family.id;
    matched = true;
  }

  // 2. Check leads by email
  if (!matched) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("email", senderEmail)
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    if (lead) {
      leadId = lead.id;
      matched = true;
    }
  }

  // 3. Check profiles by email
  if (!matched) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", senderEmail)
      .limit(1)
      .single();

    if (profile) {
      senderId = profile.id;
      matched = true;
    }
  }

  // 4. Also check family_contacts
  if (!matched) {
    const { data: contact } = await supabase
      .from("family_contacts")
      .select("family_id")
      .eq("email", senderEmail)
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    if (contact) {
      familyId = contact.family_id;
      matched = true;
    }
  }

  // Get or create the thread
  const thread = await getOrCreateThread({
    tenantId,
    threadToken,
    subject: subject || undefined,
    familyId,
    leadId,
    contactName: senderName,
    contactEmail: senderEmail,
  });

  // Append inbound message
  await appendMessage({
    tenantId,
    threadId: thread.id,
    direction: "inbound",
    senderId,
    senderName,
    senderEmail,
    subject: subject || null,
    bodyHtml: htmlBody || null,
    bodyText: textBody || null,
    matched,
  });

  // Update thread: reopen if resolved, increment unread
  await supabase
    .from("communication_threads")
    .update({
      unread_count: (thread.unread_count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
      message_count: (thread.message_count ?? 0) + 1,
      // Reopen if it was resolved
      ...(thread.state === "resolved" ? { state: "open" } : {}),
      // Update contact info if we matched
      ...(matched && familyId ? { family_id: familyId } : {}),
      ...(matched && leadId ? { lead_id: leadId } : {}),
      contact_name: senderName,
      contact_email: senderEmail,
    })
    .eq("id", thread.id);

  // Log notification (if notifications table exists, insert; otherwise log)
  console.log(
    `[inbound] New message in thread ${thread.id} from ${senderEmail} (matched: ${matched})`
  );

  return NextResponse.json({ success: true, thread_id: thread.id });
}
