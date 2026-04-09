import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const POST_TYPES = ["announcement", "event", "absence_notice", "schedule_change", "file", "poll"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id: groupId } = await params;
  const body = await req.json().catch(() => ({}));

  const content = (body.content ?? "").trim();
  const postType = body.post_type ?? "announcement";
  const metadata = body.metadata ?? {};

  if (!content && postType === "announcement") {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }
  if (!POST_TYPES.includes(postType)) {
    return NextResponse.json({ error: "Invalid post_type" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: group } = await supabase
    .from("communication_groups")
    .select("tenant_id")
    .eq("id", groupId)
    .single();
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { data: post, error } = await supabase
    .from("group_posts")
    .insert({
      tenant_id: group.tenant_id,
      group_id: groupId,
      author_id: user.id,
      post_type: postType,
      content: content || null,
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[group posts] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/admin/communications/groups/${groupId}`);
  return NextResponse.json({ success: true, id: post.id });
}
