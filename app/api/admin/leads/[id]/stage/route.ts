import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STAGES = [
  "inquiry", "trial_requested", "trial_scheduled", "trial_attended",
  "evaluation_requested", "evaluation_scheduled", "placement_recommended",
  "contract_pending", "enrolled", "waitlisted", "lost",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const stage = body?.stage as string | undefined;
  const note = (body?.note as string | undefined) ?? null;

  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch existing lead to get from_stage
  const { data: existing } = await supabase
    .from("leads")
    .select("pipeline_stage")
    .eq("id", id)
    .single();

  const fromStage = existing?.pipeline_stage ?? null;

  // Update the lead
  const { error } = await supabase
    .from("leads")
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin:leads:stage]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert history row only if stage actually changed
  if (fromStage !== stage) {
    // Look up moved_by_name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const movedByName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null
      : null;

    const { error: histErr } = await supabase.from("lead_stage_history").insert({
      tenant_id: user.tenantId!,
      lead_id: id,
      from_stage: fromStage,
      to_stage: stage,
      moved_by: user.id,
      moved_by_name: movedByName,
      note,
    });
    if (histErr) {
      console.error("[admin:leads:stage:history]", histErr);
    }
  }

  return NextResponse.json({ success: true });
}
