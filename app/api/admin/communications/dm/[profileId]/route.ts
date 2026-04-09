import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/communications/dm/[profileId]
 * Returns (or creates) a direct-message thread between the current admin
 * and the target profile, plus all messages and the other party's profile.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const me = await requireAdmin();
  const { profileId: otherId } = await params;

  if (otherId === me.id) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? me.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 500 });
  }

  // Find existing direct thread between these two
  const { data: existing } = await supabase
    .from("communication_threads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("thread_type", "direct")
    .eq("channel", "in_app")
    .or(
      `and(created_by.eq.${me.id},staff_user_id.eq.${otherId}),and(created_by.eq.${otherId},staff_user_id.eq.${me.id})`
    )
    .limit(1)
    .maybeSingle();

  let thread = existing;

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
      .select("*")
      .single();
    if (createErr) {
      console.error("[dm] thread create failed:", createErr);
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    thread = created;
  }

  const { data: messages } = await supabase
    .from("communication_messages")
    .select("id, sender_id, sender_name, body_text, body_html, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  const { data: other } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, role")
    .eq("id", otherId)
    .single();

  return NextResponse.json({
    thread,
    messages: messages ?? [],
    other,
    me_id: me.id,
  });
}
