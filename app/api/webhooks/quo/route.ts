import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Always return 200 — Quo retries on non-200
  try {
    // Verify webhook signature if configured
    const secret = process.env.QUO_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get("x-openphone-signature");
      // Basic signature check — production should use HMAC verification
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

    const fromPhone = data?.from;
    const messageBody = data?.body ?? data?.content ?? "";
    const timestamp = data?.createdAt ?? new Date().toISOString();

    if (!fromPhone || !messageBody) {
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();

    // Look up sender by phone number
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("phone", fromPhone)
      .single();

    if (profile) {
      // Create a DM or log the inbound message
      // For now: insert into sms_threads or log
      try {
        await supabase.from("sms_threads").insert({
          from_phone: fromPhone,
          user_id: profile.id,
          direction: "inbound",
          body: messageBody,
          received_at: timestamp,
        });
      } catch {
        // sms_threads may not exist — log only
        console.log(
          `[quo:webhook] Inbound from ${profile.first_name}: ${messageBody}`
        );
      }
    } else {
      // Unmatched phone — log for admin review
      console.warn(
        `[quo:webhook] Unmatched phone ${fromPhone}: ${messageBody}`
      );
      try {
        await supabase.from("sms_threads").insert({
          from_phone: fromPhone,
          direction: "inbound",
          body: messageBody,
          received_at: timestamp,
        });
      } catch {
        // Table may not exist
      }
    }
  } catch (e) {
    console.error("[quo:webhook] Error processing:", e);
  }

  return NextResponse.json({ ok: true });
}
