import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id: groupId } = await params;
  const body = await req.json().catch(() => ({}));
  const postId = body.post_id;
  const emoji = body.emoji;

  if (!postId || !emoji) {
    return NextResponse.json({ error: "post_id and emoji required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Toggle: delete if exists, else insert
  const { data: existing } = await supabase
    .from("group_post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("group_post_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("group_post_reactions").insert({
      post_id: postId,
      user_id: user.id,
      emoji,
    });
  }

  revalidatePath(`/admin/communications/groups/${groupId}`);
  return NextResponse.json({ success: true });
}
