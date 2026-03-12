import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const supabase = await createClient();

  // Verify user is participant
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, subject, participant_ids, class_id, created_at")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Admins can view all threads; participants can view their own
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  if (!isAdmin && !thread.participant_ids.includes(user.id)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Get participant names
  const { data: participants } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("id", thread.participant_ids);

  const participantMap: Record<
    string,
    { name: string; role: string }
  > = {};
  for (const p of participants ?? []) {
    // Teachers should not see parent last names for privacy
    const name =
      user.role === "teacher" && p.role === "parent"
        ? p.first_name ?? "Parent"
        : [p.first_name, p.last_name].filter(Boolean).join(" ");
    participantMap[p.id] = { name, role: p.role };
  }

  // Get messages
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, read_at, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[messages:thread] Error:", error);
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  // Mark unread messages from others as read
  const unreadIds = (messages ?? [])
    .filter((m) => m.sender_id !== user.id && !m.read_at)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  // Enrich messages with sender names
  const enrichedMessages = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: participantMap[m.sender_id]?.name ?? "Unknown",
    body: m.body,
    is_own: m.sender_id === user.id,
    created_at: m.created_at,
  }));

  return Response.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      participants: participantMap,
    },
    messages: enrichedMessages,
  });
}
