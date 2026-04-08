import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  // Optional: verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  // 1. Mark documents past expiry as expired
  const { data: expiredRows } = await supabase
    .from("family_documents")
    .update({ status: "expired", updated_at: nowIso })
    .lt("expires_at", today)
    .neq("status", "expired")
    .neq("status", "voided")
    .select("id, family_id, document_type, title");

  // 2. Send 30-day expiry reminders
  const { data: expiringRows } = await supabase
    .from("family_documents")
    .select("id, family_id, title")
    .lte("expires_at", in30Str)
    .gte("expires_at", today)
    .is("expiry_reminder_sent_at", null)
    .eq("status", "completed");

  let remindersSent = 0;
  for (const doc of expiringRows ?? []) {
    if (!doc.family_id) continue;
    const { data: family } = await supabase
      .from("families")
      .select("primary_contact_id")
      .eq("id", doc.family_id)
      .single();
    if (family?.primary_contact_id) {
      await supabase.from("notifications").insert({
        recipient_id: family.primary_contact_id,
        notification_type: "document_expiring",
        title: "Document expires soon",
        body: doc.title,
        metadata: { document_id: doc.id },
      });
      await supabase
        .from("family_documents")
        .update({ expiry_reminder_sent_at: nowIso })
        .eq("id", doc.id);
      remindersSent++;
    }
  }

  return NextResponse.json({
    expired: expiredRows?.length ?? 0,
    reminders_sent: remindersSent,
  });
}
