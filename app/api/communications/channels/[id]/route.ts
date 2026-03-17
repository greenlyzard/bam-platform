import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/communications/channels/[id]
 * Get channel details with members.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Fetch channel
  const { data: channel, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Non-admin must be a member
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("id")
      .eq("channel_id", id)
      .eq("profile_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
  }

  // Get members with profile info
  const { data: members } = await supabase
    .from("channel_members")
    .select("profile_id, role, joined_at, profiles!inner(first_name, last_name)")
    .eq("channel_id", id);

  const enrichedMembers = (members ?? []).map((m: any) => ({
    profile_id: m.profile_id,
    role: m.role,
    joined_at: m.joined_at,
    name: [m.profiles?.first_name, m.profiles?.last_name]
      .filter(Boolean)
      .join(" "),
  }));

  // Mark as read
  await supabase
    .from("channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", id)
    .eq("profile_id", user.id);

  return NextResponse.json({
    channel,
    members: enrichedMembers,
  });
}

/**
 * PATCH /api/communications/channels/[id]
 * Update channel (admin or channel owner).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  if (!isAdmin) {
    // Check if user is channel owner
    const { data: membership } = await supabase
      .from("channel_members")
      .select("role")
      .eq("channel_id", id)
      .eq("profile_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.is_archived !== undefined) updates.is_archived = body.is_archived;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channel });
}
