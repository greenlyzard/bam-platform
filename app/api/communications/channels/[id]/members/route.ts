import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { isTeacherOnly } from "@/lib/auth/role-check";

/**
 * GET /api/communications/channels/[id]/members?search=name
 * List channel members, or search tenant profiles to add.
 * When ?search= is provided, returns matching tenant users NOT already in the channel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Verify membership or admin
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
  const search = searchParams.get("search")?.trim();

  // If search query provided, find tenant users NOT already in channel
  if (search && search.length >= 2) {
    // Get current member IDs
    const { data: existing } = await supabase
      .from("channel_members")
      .select("profile_id")
      .eq("channel_id", channelId);

    const existingIds = (existing ?? []).map((m) => m.profile_id);

    // Get channel tenant_id
    const { data: channel } = await supabase
      .from("channels")
      .select("tenant_id")
      .eq("id", channelId)
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Find active users in this tenant matching the search
    const { data: roles } = await supabase
      .from("profile_roles")
      .select("user_id, role")
      .eq("tenant_id", channel.tenant_id)
      .eq("is_active", true);

    const tenantUserIds = (roles ?? []).map((r) => r.user_id);
    const roleMap: Record<string, string> = {};
    for (const r of roles ?? []) {
      roleMap[r.user_id] = r.role;
    }

    if (tenantUserIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Search profiles by name
    const searchPattern = `%${search}%`;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", tenantUserIds)
      .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
      .limit(20);

    const teacherOnly = isTeacherOnly(user);
    const results = (profiles ?? [])
      .filter((p) => !existingIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        email: teacherOnly ? null : p.email,
        tenant_role: roleMap[p.id] ?? "unknown",
      }));

    return NextResponse.json({ results });
  }

  // Default: list current members
  const { data: members } = await supabase
    .from("channel_members")
    .select(
      "id, profile_id, role, joined_at, is_muted, profiles!inner(first_name, last_name, email)"
    )
    .eq("channel_id", channelId)
    .order("joined_at", { ascending: true });

  const teacherOnly = isTeacherOnly(user);
  const enriched = (members ?? []).map((m: any) => ({
    id: m.id,
    profile_id: m.profile_id,
    role: m.role,
    joined_at: m.joined_at,
    is_muted: m.is_muted,
    name: [m.profiles?.first_name, m.profiles?.last_name]
      .filter(Boolean)
      .join(" "),
    email: teacherOnly ? null : (m.profiles?.email ?? null),
  }));

  return NextResponse.json({ members: enriched });
}

/**
 * POST /api/communications/channels/[id]/members
 * Add a member to a channel. Body: { profile_id, role? }
 * Admin or channel owner only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Must be admin or channel owner
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("role")
      .eq("channel_id", channelId)
      .eq("profile_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { profile_id, role } = body;

  if (!profile_id || typeof profile_id !== "string") {
    return NextResponse.json(
      { error: "profile_id is required" },
      { status: 400 }
    );
  }

  const memberRole = role && ["owner", "admin", "member"].includes(role)
    ? role
    : "member";

  // Check not already a member
  const { data: existing } = await supabase
    .from("channel_members")
    .select("id")
    .eq("channel_id", channelId)
    .eq("profile_id", profile_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already a member" },
      { status: 409 }
    );
  }

  const { data: member, error } = await supabase
    .from("channel_members")
    .insert({
      channel_id: channelId,
      profile_id,
      role: memberRole,
    })
    .select("id, profile_id, role, joined_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get the profile name for the response
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", profile_id)
    .single();

  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Unknown";

  // Insert system message
  await supabase.from("channel_messages").insert({
    channel_id: channelId,
    content: `${name} was added to the channel`,
    message_type: "system",
  });

  return NextResponse.json(
    {
      ...member,
      name,
      email: isTeacherOnly(user) ? null : (profile?.email ?? null),
      is_muted: false,
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/communications/channels/[id]/members
 * Remove a member from a channel. Body: { profile_id }
 * Admin or channel owner only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Must be admin or channel owner
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("role")
      .eq("channel_id", channelId)
      .eq("profile_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { profile_id } = body;

  if (!profile_id || typeof profile_id !== "string") {
    return NextResponse.json(
      { error: "profile_id is required" },
      { status: 400 }
    );
  }

  // Cannot remove the channel owner
  const { data: target } = await supabase
    .from("channel_members")
    .select("role")
    .eq("channel_id", channelId)
    .eq("profile_id", profile_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Not a member" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the channel owner" },
      { status: 403 }
    );
  }

  // Get name before deleting
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", profile_id)
    .single();

  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Unknown";

  const { error } = await supabase
    .from("channel_members")
    .delete()
    .eq("channel_id", channelId)
    .eq("profile_id", profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert system message
  await supabase.from("channel_messages").insert({
    channel_id: channelId,
    content: `${name} was removed from the channel`,
    message_type: "system",
  });

  return NextResponse.json({ success: true });
}
