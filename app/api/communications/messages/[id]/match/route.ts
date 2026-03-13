import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  // Admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    family_id,
    lead_id,
    staff_user_id,
    create_lead,
    sender_name,
    sender_email,
  } = body;

  // Get the message and its thread
  const { data: message } = await supabase
    .from("communication_messages")
    .select("id, thread_id, sender_name, sender_email, tenant_id")
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // If create_lead, create a new lead record
  let resolvedLeadId = lead_id;
  if (create_lead) {
    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        tenant_id: message.tenant_id,
        first_name: sender_name ?? message.sender_name ?? "Unknown",
        email: sender_email ?? message.sender_email,
        source: "email",
        status: "new",
      })
      .select("id")
      .single();

    if (leadError) {
      return NextResponse.json(
        { error: leadError.message },
        { status: 500 }
      );
    }
    resolvedLeadId = newLead?.id;
  }

  // Mark message as matched
  await supabase
    .from("communication_messages")
    .update({ matched: true })
    .eq("id", messageId);

  // Update thread contact linkage
  const threadUpdates: Record<string, unknown> = {};
  if (family_id) threadUpdates.family_id = family_id;
  if (resolvedLeadId) threadUpdates.lead_id = resolvedLeadId;
  if (staff_user_id) threadUpdates.staff_user_id = staff_user_id;

  if (Object.keys(threadUpdates).length > 0) {
    await supabase
      .from("communication_threads")
      .update(threadUpdates)
      .eq("id", message.thread_id);
  }

  return NextResponse.json({ success: true });
}
