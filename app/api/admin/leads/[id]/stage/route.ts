import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STAGES = [
  "inquiry", "trial_requested", "trial_scheduled", "trial_attended",
  "evaluation_requested", "evaluation_scheduled", "placement_recommended",
  "contract_pending", "enrolled", "waitlisted", "lost",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const stage = body?.stage as string | undefined;

  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("leads")
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin:leads:stage]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
