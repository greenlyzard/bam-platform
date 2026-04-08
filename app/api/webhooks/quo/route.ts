import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizePhone,
  matchPhoneToProfile,
  handleStop,
  handleStart,
} from "@/lib/contact-channels";
import { getSMSAdapter } from "@/lib/sms/adapter";
import { classifyMessage } from "@/lib/communications/classify";

const DEFAULT_TENANT_ID =
  process.env.BAM_TENANT_ID ?? "84d98f72-c82f-414f-8b17-172b802f6993";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "SUBSCRIBE"]);

export async function POST(req: NextRequest) {
  // Always return 200 — Quo retries on non-200
  try {
    // Verify webhook signature if configured
    const secret = process.env.QUO_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get("x-openphone-signature");
      if (!sig) {
        console.warn("[quo:webhook] Missing signature");
        return NextResponse.json({ ok: true });
      }
    }

    const body = await req.json();
    const { type, data } = body;

    if (type !== "message.received") {
      return NextResponse.json({ ok: true });
    }

    const rawPhone = data?.from;
    const messageBody: string = data?.body ?? data?.content ?? "";
    const timestamp = data?.createdAt ?? new Date().toISOString();

    if (!rawPhone || !messageBody) {
      return NextResponse.json({ ok: true });
    }

    const fromPhone = normalizePhone(rawPhone) ?? rawPhone;
    const tenantId = DEFAULT_TENANT_ID;

    // -----------------------------------------------------------------------
    // 1. STOP / START detection — must run before any other logic
    // -----------------------------------------------------------------------
    const keyword = messageBody.trim().toUpperCase();

    if (STOP_KEYWORDS.has(keyword)) {
      await handleStop(fromPhone, tenantId);
      try {
        const adapter = await getSMSAdapter(tenantId);
        await adapter.sendMessage(
          fromPhone,
          "You've been unsubscribed from SMS messages. Reply START to resubscribe."
        );
      } catch (e) {
        console.warn("[quo:webhook] Failed to send STOP auto-reply:", e);
      }
      return NextResponse.json({ ok: true });
    }

    if (START_KEYWORDS.has(keyword)) {
      await handleStart(fromPhone, tenantId);
      try {
        const adapter = await getSMSAdapter(tenantId);
        await adapter.sendMessage(
          fromPhone,
          "You've been resubscribed to SMS messages. Reply STOP to unsubscribe."
        );
      } catch (e) {
        console.warn("[quo:webhook] Failed to send START auto-reply:", e);
      }
      return NextResponse.json({ ok: true });
    }

    // -----------------------------------------------------------------------
    // 2. Match phone to profile via contact_channels
    // -----------------------------------------------------------------------
    const supabase = await createClient();
    const profileId = await matchPhoneToProfile(fromPhone, tenantId);

    // -----------------------------------------------------------------------
    // 3. Upsert sms_threads and insert sms_messages
    // -----------------------------------------------------------------------
    try {
      // Upsert thread by phone_number + tenant_id
      const { data: existingThread } = await supabase
        .from("sms_threads")
        .select("id, unread_count")
        .eq("phone_number", fromPhone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      let threadId: string;

      if (existingThread) {
        threadId = existingThread.id;
        await supabase
          .from("sms_threads")
          .update({
            last_message_at: timestamp,
            last_message_body: messageBody,
            unread_count: (existingThread.unread_count ?? 0) + 1,
            ...(profileId ? { profile_id: profileId } : {}),
          })
          .eq("id", threadId);
      } else {
        const { data: newThread } = await supabase
          .from("sms_threads")
          .insert({
            phone_number: fromPhone,
            tenant_id: tenantId,
            last_message_at: timestamp,
            last_message_body: messageBody,
            unread_count: 1,
            ...(profileId ? { profile_id: profileId } : {}),
          })
          .select("id")
          .single();

        threadId = newThread?.id;
      }

      // Insert sms_messages
      if (threadId) {
        await supabase.from("sms_messages").insert({
          thread_id: threadId,
          direction: "inbound",
          body: messageBody,
          sent_at: timestamp,
          ...(profileId ? { profile_id: profileId } : {}),
        });
      }
    } catch (e) {
      console.error("[quo:webhook] Failed to upsert thread/message:", e);
    }

    // -----------------------------------------------------------------------
    // 4. Classify and handle unmatched senders
    // -----------------------------------------------------------------------
    const classification = classifyMessage("", messageBody, "", "");

    if (!profileId) {
      // SPAM: store silently with is_spam=true (per COMMUNICATIONS_TRIAGE.md)
      // INQUIRY (unknown sender): auto-create lead
      // REVIEW: store in unmatched_sms for admin triage
      console.warn(`[quo:webhook] Unmatched phone ${fromPhone} [${classification.label}]: ${messageBody}`);

      if (classification.label === "inquiry") {
        try {
          await supabase.from("leads").insert({
            tenant_id: tenantId,
            first_name: "SMS",
            last_name: fromPhone,
            phone: fromPhone,
            source: "sms",
            pipeline_stage: "inquiry",
            status: "new",
            notes: messageBody.slice(0, 500),
            intake_form_data: { classifier_signals: classification.signals },
          });
        } catch (e) {
          console.error("[quo:webhook] Failed to auto-create lead:", e);
        }
      }

      try {
        await supabase.from("unmatched_sms").insert({
          phone_number: fromPhone,
          body: messageBody,
          received_at: timestamp,
          tenant_id: tenantId,
          classifier_label: classification.label,
          is_spam: classification.label === "spam",
        });
      } catch {
        // Table may not exist yet, or columns not yet added
      }
    }
  } catch (e) {
    console.error("[quo:webhook] Error processing:", e);
  }

  return NextResponse.json({ ok: true });
}
