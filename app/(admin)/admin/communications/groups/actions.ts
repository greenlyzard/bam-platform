"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MODES = ["broadcast", "two_way", "disabled"] as const;
type ChatMode = (typeof ALLOWED_MODES)[number];

export async function updateGroupChatMode(groupId: string, chatMode: ChatMode) {
  const user = await requireAdmin();
  if (!["admin", "super_admin"].includes(user.role)) {
    throw new Error("Forbidden");
  }
  if (!ALLOWED_MODES.includes(chatMode)) {
    throw new Error("Invalid chat mode");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("communication_groups")
    .update({ chat_mode: chatMode, updated_at: new Date().toISOString() })
    .eq("id", groupId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/communications/groups");
}
