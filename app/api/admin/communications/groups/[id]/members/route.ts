import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: groupId } = await params;
  const body = await req.json().catch(() => ({}));
  const profileId = body.profile_id;

  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: group } = await supabase
    .from("communication_groups")
    .select("tenant_id")
    .eq("id", groupId)
    .single();
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { error } = await supabase
    .from("communication_group_members")
    .insert({
      tenant_id: group.tenant_id,
      group_id: groupId,
      user_id: profileId,
      role: "member",
      can_post: false,
    });

  if (error) {
    // Unique violation = already a member
    if (error.code === "23505") {
      return NextResponse.json({ success: true, already_member: true });
    }
    console.error("[group members] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/admin/communications/groups/${groupId}`);
  return NextResponse.json({ success: true });
}
