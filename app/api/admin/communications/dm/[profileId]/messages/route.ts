import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const me = await requireAdmin();
  const { profileId: otherId } = await params;
  const body = await req.json().catch(() => ({}));
  const text = (body.body_text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? me.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 500 });

  // Get or create thread (same lookup as GET)
  let { data: thread } = await supabase
    .from("communication_threads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("thread_type", "direct")
    .eq("channel", "in_app")
    .or(
      `and(created_by.eq.${me.id},staff_user_id.eq.${otherId}),and(created_by.eq.${otherId},staff_user_id.eq.${me.id})`
    )
    .limit(1)
    .maybeSingle();

  if (!thread) {
    const token = randomBytes(6).toString("base64url");
    const { data: created, error: createErr } = await supabase
      .from("communication_threads")
      .insert({
        tenant_id: tenantId,
        thread_type: "direct",
        channel: "in_app",
        thread_token: token,
        created_by: me.id,
        staff_user_id: otherId,
        state: "open",
      })
      .select("id")
      .single();
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    thread = created;
  }

  const senderName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;

  const { data: msg, error: msgErr } = await supabase
    .from("communication_messages")
    .insert({
      tenant_id: tenantId,
      thread_id: thread.id,
      direction: "outbound",
      sender_id: me.id,
      sender_name: senderName,
      sender_email: me.email,
      body_text: text,
      matched: true,
    })
    .select("id, sender_id, sender_name, body_text, created_at")
    .single();

  if (msgErr) {
    console.error("[dm] message insert failed:", msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  await supabase
    .from("communication_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", thread.id);

  return NextResponse.json({ success: true, message: msg });
}
