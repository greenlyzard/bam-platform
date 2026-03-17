import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/communications/channels
 * List channels the current user belongs to (or all for admins).
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const archived = searchParams.get("archived") === "true";

  if (isAdmin) {
    // Admins see all channels in the tenant
    let query = supabase
      .from("channels")
      .select(
        "id, name, description, type, icon_url, is_archived, class_id, production_id, last_message_at, created_at"
      )
      .eq("is_archived", archived)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (type) query = query.eq("type", type);

    const { data: channels, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread counts per channel for this user
    const channelIds = (channels ?? []).map((c) => c.id);
    const unreadMap = await getUnreadCounts(supabase, user.id, channelIds);

    const enriched = (channels ?? []).map((c) => ({
      ...c,
      unread_count: unreadMap[c.id] ?? 0,
    }));

    return NextResponse.json({ channels: enriched });
  }

  // Non-admin: only channels user is a member of
  const { data: memberships, error: memErr } = await supabase
    .from("channel_members")
    .select("channel_id, last_read_at, is_muted")
    .eq("profile_id", user.id);

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const channelIds = (memberships ?? []).map((m) => m.channel_id);
  if (channelIds.length === 0) {
    return NextResponse.json({ channels: [] });
  }

  let query = supabase
    .from("channels")
    .select(
      "id, name, description, type, icon_url, is_archived, class_id, production_id, last_message_at, created_at"
    )
    .in("id", channelIds)
    .eq("is_archived", archived)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (type) query = query.eq("type", type);

  const { data: channels, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build unread counts using membership last_read_at
  const readMap = Object.fromEntries(
    (memberships ?? []).map((m) => [m.channel_id, m.last_read_at])
  );

  const unreadMap = await getUnreadCounts(supabase, user.id, channelIds);

  const enriched = (channels ?? []).map((c) => ({
    ...c,
    unread_count: unreadMap[c.id] ?? 0,
  }));

  return NextResponse.json({ channels: enriched });
}

/**
 * POST /api/communications/channels
 * Create a new channel (admin only).
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await req.json();
  const { name, description, type, class_id, production_id, member_ids } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }

  const validTypes = [
    "class_group", "production_group", "admin_group",
    "parent_group", "student_group", "direct_message",
    "announcement", "general",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid channel type" }, { status: 400 });
  }

  // Get tenant
  const tenantId = user.tenantId ?? process.env.DEFAULT_TENANT_ID!;

  const { data: channel, error: createErr } = await supabase
    .from("channels")
    .insert({
      tenant_id: tenantId,
      name,
      description: description ?? null,
      type,
      class_id: class_id ?? null,
      production_id: production_id ?? null,
      created_by: user.id,
    })
    .select("id, name, type, created_at")
    .single();

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  // Add creator as owner
  const members = [
    { channel_id: channel.id, profile_id: user.id, role: "owner" },
  ];

  // Add additional members
  if (Array.isArray(member_ids)) {
    for (const mid of member_ids) {
      if (mid !== user.id) {
        members.push({ channel_id: channel.id, profile_id: mid, role: "member" });
      }
    }
  }

  await supabase.from("channel_members").insert(members);

  // Insert system message
  await supabase.from("channel_messages").insert({
    channel_id: channel.id,
    sender_id: user.id,
    content: `${[user.firstName, user.lastName].filter(Boolean).join(" ")} created this channel`,
    message_type: "system",
  });

  return NextResponse.json({ channel }, { status: 201 });
}

// ── Helper ──────────────────────────────────────────────────

async function getUnreadCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  channelIds: string[]
): Promise<Record<string, number>> {
  if (channelIds.length === 0) return {};

  // Get user's last_read_at per channel
  const { data: memberships } = await supabase
    .from("channel_members")
    .select("channel_id, last_read_at")
    .eq("profile_id", userId)
    .in("channel_id", channelIds);

  const readMap: Record<string, string | null> = {};
  for (const m of memberships ?? []) {
    readMap[m.channel_id] = m.last_read_at;
  }

  const counts: Record<string, number> = {};
  for (const cid of channelIds) {
    const lastRead = readMap[cid];
    let query = supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", cid)
      .neq("sender_id", userId)
      .is("deleted_at", null);

    if (lastRead) {
      query = query.gt("created_at", lastRead);
    }

    const { count } = await query;
    counts[cid] = count ?? 0;
  }

  return counts;
}
