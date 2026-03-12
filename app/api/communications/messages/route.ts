import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get threads where user is a participant
  const { data: threads, error } = await supabase
    .from("message_threads")
    .select("id, subject, participant_ids, class_id, last_message_at, created_at")
    .contains("participant_ids", [user.id])
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[messages:get] Error:", error);
    return Response.json({ error: "Failed to fetch threads" }, { status: 500 });
  }

  // Get participant names and last message for each thread
  const enrichedThreads = await Promise.all(
    (threads ?? []).map(async (thread) => {
      // Get other participant names
      const otherIds = thread.participant_ids.filter(
        (id: string) => id !== user.id
      );
      let participantNames: string[] = [];
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role")
          .in("id", otherIds);

        participantNames = (profiles ?? []).map((p) => {
          // Teachers seeing parent threads: show first name only
          if (user.role === "teacher" && p.role === "parent") {
            return p.first_name ?? "Parent";
          }
          return [p.first_name, p.last_name].filter(Boolean).join(" ");
        });
      }

      // Get last message
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("body, sender_id, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Count unread messages
      const { count: unreadCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id)
        .neq("sender_id", user.id)
        .is("read_at", null);

      return {
        id: thread.id,
        subject: thread.subject,
        participant_names: participantNames,
        last_message_preview: lastMsg?.body?.slice(0, 100) ?? null,
        last_message_at: thread.last_message_at,
        unread_count: unreadCount ?? 0,
      };
    })
  );

  return Response.json({ threads: enrichedThreads });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    threadId?: string;
    recipientId?: string;
    subject?: string;
    body?: string;
    classId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.body || typeof body.body !== "string" || !body.body.trim()) {
    return Response.json({ error: "body is required" }, { status: 400 });
  }

  const messageBody = body.body.trim().slice(0, 5000);
  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  let threadId = body.threadId;

  // Create new thread if no threadId
  if (!threadId) {
    if (!body.recipientId) {
      return Response.json(
        { error: "recipientId is required for new threads" },
        { status: 400 }
      );
    }

    // Verify recipient exists
    const { data: recipient } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.recipientId)
      .single();

    if (!recipient) {
      return Response.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Check if thread already exists between these two users
    const { data: existingThreads } = await supabase
      .from("message_threads")
      .select("id")
      .contains("participant_ids", [user.id, body.recipientId])
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      threadId = existingThreads[0].id;
    } else {
      const { data: newThread, error: threadErr } = await supabase
        .from("message_threads")
        .insert({
          tenant_id: tenantId,
          subject: body.subject || null,
          participant_ids: [user.id, body.recipientId],
          class_id: body.classId || null,
        })
        .select("id")
        .single();

      if (threadErr || !newThread) {
        console.error("[messages:post] Thread creation error:", threadErr);
        return Response.json({ error: "Failed to create thread" }, { status: 500 });
      }

      threadId = newThread.id;
    }
  } else {
    // Verify user is participant in existing thread
    const { data: thread } = await supabase
      .from("message_threads")
      .select("participant_ids")
      .eq("id", threadId)
      .single();

    if (!thread || !thread.participant_ids.includes(user.id)) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
  }

  // Insert message
  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      sender_id: user.id,
      body: messageBody,
    })
    .select("id, created_at")
    .single();

  if (msgErr || !message) {
    console.error("[messages:post] Message insert error:", msgErr);
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }

  // Update thread last_message_at
  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  // Send email notification to other participants
  const { data: thread } = await supabase
    .from("message_threads")
    .select("participant_ids")
    .eq("id", threadId)
    .single();

  if (thread) {
    const otherIds = thread.participant_ids.filter(
      (id: string) => id !== user.id
    );

    for (const otherId of otherIds) {
      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", otherId)
        .single();

      if (otherProfile?.email) {
        const senderName = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(" ");
        const preview =
          messageBody.length > 150
            ? messageBody.slice(0, 150) + "..."
            : messageBody;

        await sendEmail("new_message", otherProfile.email, {
          sender_name: senderName,
          preview,
        });
      }
    }
  }

  return Response.json({
    id: message.id,
    thread_id: threadId,
    created_at: message.created_at,
  });
}
