import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  await requireAdmin();
  const { id: groupId, profileId } = await params;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("communication_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", profileId);

  if (error) {
    console.error("[group members] delete failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/admin/communications/groups/${groupId}`);
  return NextResponse.json({ success: true });
}
