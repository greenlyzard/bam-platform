import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/communications/channels/[id]/messages
 * Fetch messages for a channel with sender names.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Verify membership (admins bypass)
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("id")
      .eq("channel_id", channelId)
      .eq("profile_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "50", 10),
    100
  );
  const before = searchParams.get("before"); // cursor for pagination

  let query = supabase
    .from("channel_messages")
    .select("id, channel_id, sender_id, content, message_type, reply_to_id, edited_at, deleted_at, created_at")
    .eq("channel_id", channelId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data: messages, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve sender names
  const senderIds = [
    ...new Set((messages ?? []).map((m) => m.sender_id).filter(Boolean) as string[]),
  ];

  let senderMap: Record<string, string> = {};
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", senderIds);

    for (const p of profiles ?? []) {
      senderMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  // Strip contact info from sender names for teacher role viewing parent data
  const enriched = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    channel_id: m.channel_id,
    sender_id: m.sender_id,
    sender_name: m.sender_id ? (senderMap[m.sender_id] ?? "Unknown") : "System",
    content: m.content,
    message_type: m.message_type,
    reply_to_id: m.reply_to_id,
    is_own: m.sender_id === user.id,
    edited_at: m.edited_at,
    created_at: m.created_at,
  }));

  // Mark as read
  await supabase
    .from("channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("profile_id", user.id);

  return NextResponse.json({ messages: enriched });
}

/**
 * POST /api/communications/channels/[id]/messages
 * Send a message in a channel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Verify membership
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("id, is_muted")
      .eq("channel_id", channelId)
      .eq("profile_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if muted
    if (membership.is_muted) {
      return NextResponse.json(
        { error: "You are muted in this channel" },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  const { content, reply_to_id } = body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const trimmed = content.trim().slice(0, 5000);

  const { data: message, error: insertErr } = await supabase
    .from("channel_messages")
    .insert({
      channel_id: channelId,
      sender_id: user.id,
      content: trimmed,
      message_type: "text",
      reply_to_id: reply_to_id ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Update channel last_message_at
  await supabase
    .from("channels")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", channelId);

  // Update sender's last_read_at
  await supabase
    .from("channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("profile_id", user.id);

  const senderName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return NextResponse.json(
    {
      id: message.id,
      channel_id: channelId,
      sender_id: user.id,
      sender_name: senderName,
      content: trimmed,
      message_type: "text",
      is_own: true,
      created_at: message.created_at,
    },
    { status: 201 }
  );
}
