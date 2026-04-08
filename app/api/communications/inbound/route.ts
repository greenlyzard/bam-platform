import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import {
  extractThreadToken,
  getOrCreateThread,
  appendMessage,
} from "@/lib/communications/thread";
import { classifyMessage } from "@/lib/communications/classify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  return createServiceClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

// Resend webhook signatures use svix (svix-id, svix-timestamp, svix-signature headers).

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

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await req.text();

  // Verify svix signature if secret is configured
  if (webhookSecret) {
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      });
    } catch (e) {
      console.error("[inbound] svix signature verification failed:", e);
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

  // Resend webhook events wrap the email data in a "data" object.
  // Support both shapes (payload.data.* and flat payload.*) for compat.
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload;

  const toAddresses: string[] = Array.isArray(data.to)
    ? (data.to as string[])
    : typeof data.to === "string"
    ? [data.to as string]
    : [];

  const fromRaw = (data.from as string) ?? "";

  // Resend's "from" can be either "Name <email@example.com>" or just "email@example.com"
  const fromMatch = fromRaw.match(/^(?:(.*?)\s)?<?([^>]+)>?$/);
  const senderName = (fromMatch?.[1] ?? "").trim().replace(/^"|"$/g, "");
  const senderEmail = (fromMatch?.[2] ?? "").trim().toLowerCase();

  const subject = (data.subject as string) ?? "";
  const htmlBody = sanitizeHtml((data.html as string) ?? "");
  const textBody = (data.text as string) ?? "";

  if (!senderEmail) {
    console.warn("[inbound] Could not parse sender email from:", fromRaw);
    return NextResponse.json({ ok: true, error: "missing sender" });
  }

  // Find thread token from the to address
  let threadToken: string | null = null;
  for (const addr of toAddresses) {
    threadToken = extractThreadToken(addr);
    if (threadToken) break;
  }

  const supabase = getServiceClient();

  // ── First-contact path: no thread token in To addresses ──
  // Run classifier and either auto-create a lead (inquiry),
  // store as unmatched (review), or store silently (spam).
  if (!threadToken) {
    const classification = classifyMessage(subject, textBody || htmlBody, senderEmail, senderName);

    // Get default tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .limit(1)
      .single();
    if (!tenant) {
      return NextResponse.json({ ok: true });
    }
    const tenantIdLocal = tenant.id;

    // Check if sender is already known (existing lead/family/profile)
    const [{ data: existingLead }, { data: existingFamily }, { data: existingProfile }] = await Promise.all([
      supabase.from("leads").select("id").eq("email", senderEmail).eq("tenant_id", tenantIdLocal).limit(1).maybeSingle(),
      supabase.from("families").select("id").eq("billing_email", senderEmail).eq("tenant_id", tenantIdLocal).limit(1).maybeSingle(),
      supabase.from("profiles").select("id").eq("email", senderEmail).limit(1).maybeSingle(),
    ]);

    const knownSender = !!(existingLead || existingFamily || existingProfile);

    // SPAM: store silently, no notifications
    if (classification.label === "spam") {
      const { data: spamThread } = await supabase
        .from("communication_threads")
        .insert({
          tenant_id: tenantIdLocal,
          thread_token: crypto.randomUUID(),
          channel: "email",
          thread_type: "inquiry",
          contact_name: senderName,
          contact_email: senderEmail,
          subject: subject || null,
          state: "open",
        })
        .select("id")
        .single();

      if (spamThread) {
        await appendMessage({
          tenantId: tenantIdLocal,
          threadId: spamThread.id,
          direction: "inbound",
          senderId: null,
          senderName,
          senderEmail,
          subject: subject || null,
          bodyHtml: htmlBody || null,
          bodyText: textBody || null,
          matched: false,
        });
        await supabase
          .from("communication_messages")
          .update({
            is_spam: true,
            classifier_label: classification.label,
            classifier_signals: classification.signals,
          })
          .eq("thread_id", spamThread.id);
      }
      return NextResponse.json({ ok: true, classification: "spam" });
    }

    // INQUIRY (unknown sender): auto-create lead
    let newLeadId: string | null = existingLead?.id ?? null;
    if (classification.label === "inquiry" && !knownSender) {
      const nameParts = senderName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || null;
      const { data: createdLead } = await supabase
        .from("leads")
        .insert({
          tenant_id: tenantIdLocal,
          first_name: firstName,
          last_name: lastName,
          email: senderEmail,
          source: "email",
          pipeline_stage: "inquiry",
          status: "new",
          notes: (textBody || htmlBody || "").slice(0, 500),
          intake_form_data: { classifier_signals: classification.signals },
        })
        .select("id")
        .single();
      newLeadId = createdLead?.id ?? null;
    }

    // Create or get a thread for this sender
    const threadFamilyId = existingFamily?.id ?? null;
    const threadLeadId = newLeadId ?? existingLead?.id ?? null;

    const { data: thread, error: threadErr } = await supabase
      .from("communication_threads")
      .insert({
        tenant_id: tenantIdLocal,
        thread_token: crypto.randomUUID(),
        channel: "email",
        thread_type: "inquiry",
        contact_name: senderName,
        contact_email: senderEmail,
        subject: subject || null,
        state: "open",
        family_id: threadFamilyId,
        lead_id: threadLeadId,
        unread_count: 1,
        message_count: 1,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (threadErr) {
      console.error("[inbound] Failed to create thread:", threadErr);
    }

    if (thread) {
      await appendMessage({
        tenantId: tenantIdLocal,
        threadId: thread.id,
        direction: "inbound",
        senderId: existingProfile?.id ?? null,
        senderName,
        senderEmail,
        subject: subject || null,
        bodyHtml: htmlBody || null,
        bodyText: textBody || null,
        matched: knownSender || classification.label === "inquiry",
      });

      // Tag the message with classifier metadata
      await supabase
        .from("communication_messages")
        .update({
          classifier_label: classification.label,
          classifier_signals: classification.signals,
        })
        .eq("thread_id", thread.id);
    }

    // Notify admin if inquiry created a lead
    if (newLeadId) {
      console.log(`[inbound] Auto-created lead ${newLeadId} for ${senderEmail}`);
    }

    return NextResponse.json({
      ok: true,
      classification: classification.label,
      lead_id: newLeadId,
      thread_id: thread?.id ?? null,
    });
  }

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
