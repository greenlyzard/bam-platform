import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sendRawEmail } from "@/lib/email/send";
import {
  generateThreadToken,
  appendMessage,
} from "@/lib/communications/thread";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state") ?? "open";
  const priority = searchParams.get("priority");
  const type = searchParams.get("type");
  const assignedTo = searchParams.get("assigned_to");
  const familyId = searchParams.get("family_id");
  const leadId = searchParams.get("lead_id");
  const unmatched = searchParams.get("unmatched");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "50", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = supabase
    .from("communication_threads")
    .select(
      "id, thread_token, subject, thread_type, state, priority, channel, family_id, lead_id, staff_user_id, contact_name, contact_email, assigned_to, unread_count, message_count, last_message_at, created_at"
    )
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Teacher: only see assigned threads
  if (user.role === "teacher") {
    query = query.eq("assigned_to", user.id);
  }

  if (state && state !== "all") {
    query = query.eq("state", state);
  }
  if (priority) {
    query = query.eq("priority", priority);
  }
  if (type) {
    query = query.eq("thread_type", type);
  }
  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }
  if (familyId) {
    query = query.eq("family_id", familyId);
  }
  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data: threads, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If unmatched filter, get threads with unmatched messages
  let result = threads ?? [];
  if (unmatched === "true") {
    const { data: unmatchedMsgs } = await supabase
      .from("communication_messages")
      .select("thread_id")
      .eq("matched", false);

    const unmatchedThreadIds = new Set(
      (unmatchedMsgs ?? []).map((m) => m.thread_id)
    );
    result = result.filter((t) => unmatchedThreadIds.has(t.id));
  }

  // Fetch last message preview for each thread
  const threadIds = result.map((t) => t.id);
  const { data: previews } = await supabase
    .from("communication_messages")
    .select("thread_id, body_text, body_html, direction, sender_name, created_at")
    .in("thread_id", threadIds.length > 0 ? threadIds : ["__none__"])
    .order("created_at", { ascending: false });

  const previewMap: Record<string, { thread_id: string; body_text: string | null; body_html: string | null; direction: string; sender_name: string | null; created_at: string }> = {};
  for (const p of (previews ?? []) as { thread_id: string; body_text: string | null; body_html: string | null; direction: string; sender_name: string | null; created_at: string }[]) {
    if (!previewMap[p.thread_id]) {
      previewMap[p.thread_id] = p;
    }
  }

  const threadsWithPreview = result.map((t) => {
    const pm = previewMap[t.id];
    return {
      ...t,
      last_message: pm
        ? {
            preview: (pm.body_text ?? pm.body_html?.replace(/<[^>]+>/g, "") ?? "").slice(0, 80),
            direction: pm.direction,
            sender_name: pm.sender_name,
            created_at: pm.created_at,
          }
        : null,
    };
  });

  return NextResponse.json({ threads: threadsWithPreview });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    to_email,
    to_name,
    subject,
    body_html,
    family_id,
    lead_id,
    staff_user_id,
  } = body;

  if (!to_email || !subject || !body_html) {
    return NextResponse.json(
      { error: "to_email, subject, and body_html are required" },
      { status: 400 }
    );
  }

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .limit(1)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "No tenant" }, { status: 500 });
  }

  const threadToken = generateThreadToken(
    crypto.randomUUID(),
    tenant.id
  );

  // Create thread
  const { data: thread, error: threadError } = await supabase
    .from("communication_threads")
    .insert({
      tenant_id: tenant.id,
      thread_token: threadToken,
      subject,
      thread_type: "direct",
      channel: "email",
      family_id: family_id ?? null,
      lead_id: lead_id ?? null,
      staff_user_id: staff_user_id ?? null,
      contact_name: to_name ?? to_email,
      contact_email: to_email,
      created_by: user.id,
      message_count: 1,
    })
    .select("*")
    .single();

  if (threadError) {
    return NextResponse.json(
      { error: threadError.message },
      { status: 500 }
    );
  }

  // Send email with reply-to
  const senderName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ") || "Ballet Academy and Movement";

  const emailResult = await sendRawEmail({
    to: to_email,
    subject,
    bodyHtml: body_html,
    threadToken,
    fromName: senderName,
  });

  if (!emailResult.success) {
    console.error("[threads:POST] Email send failed:", emailResult.error);
  }

  // Insert outbound message
  await appendMessage({
    tenantId: tenant.id,
    threadId: thread.id,
    direction: "outbound",
    senderId: user.id,
    senderName,
    senderEmail: user.email,
    subject,
    bodyHtml: body_html,
  });

  return NextResponse.json({ thread }, { status: 201 });
}
