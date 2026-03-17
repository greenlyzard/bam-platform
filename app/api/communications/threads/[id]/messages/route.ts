import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sendRawEmail } from "@/lib/email/send";
import { appendMessage } from "@/lib/communications/thread";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: threadId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch thread
  const { data: thread } = await supabase
    .from("communication_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Teacher: can only reply to assigned threads
  if (user.role === "teacher" && thread.assigned_to !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { body_html, body_text } = body;

  if (!body_html) {
    return NextResponse.json(
      { error: "body_html is required" },
      { status: 400 }
    );
  }

  // Send email to thread contact
  if (thread.contact_email) {
    const senderName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ") || "Ballet Academy and Movement";

    const emailResult = await sendRawEmail({
      to: thread.contact_email,
      subject: thread.subject
        ? `Re: ${thread.subject}`
        : "Message from Ballet Academy and Movement",
      bodyHtml: body_html,
      threadToken: thread.thread_token,
      fromName: senderName,
    });

    if (!emailResult.success) {
      console.error("[reply] Email send failed:", emailResult.error);
    }
  }

  // Insert outbound message
  const message = await appendMessage({
    tenantId: thread.tenant_id,
    threadId,
    direction: "outbound",
    senderId: user.id,
    senderName: [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" "),
    senderEmail: user.email,
    bodyHtml: body_html,
    bodyText: body_text ?? null,
  });

  // Update thread counters
  await supabase
    .from("communication_threads")
    .update({
      last_message_at: new Date().toISOString(),
      message_count: (thread.message_count ?? 0) + 1,
    })
    .eq("id", threadId);

  return NextResponse.json({ message }, { status: 201 });
}
