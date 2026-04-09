import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const GROUP_TYPES = ["class", "production", "privates", "private_session", "studio_wide", "custom"];
const CHAT_MODES = ["broadcast", "two_way", "disabled"];

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const name = (body.name ?? "").trim();
  const groupType = body.group_type;
  const chatMode = body.chat_mode ?? "broadcast";
  const description = (body.description ?? "").trim() || null;

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!GROUP_TYPES.includes(groupType)) {
    return NextResponse.json({ error: "Invalid group_type" }, { status: 400 });
  }
  if (!CHAT_MODES.includes(chatMode)) {
    return NextResponse.json({ error: "Invalid chat_mode" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? user.tenantId ?? process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 500 });
  }

  const { data: group, error } = await supabase
    .from("communication_groups")
    .insert({
      tenant_id: tenantId,
      name,
      group_type: groupType,
      chat_mode: chatMode,
      description,
      created_by: user.id,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[admin/communications/groups] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/admin/communications/groups");
  return NextResponse.json({ success: true, id: group.id });
}
