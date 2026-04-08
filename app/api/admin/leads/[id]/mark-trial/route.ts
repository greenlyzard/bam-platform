import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const outcome = body?.outcome as string | undefined;

  if (outcome !== "attended" && outcome !== "no_show") {
    return NextResponse.json({ error: "Invalid outcome (expected 'attended' or 'no_show')" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const nextStage = outcome === "attended" ? "trial_attended" : "lost";

  const { error } = await supabase
    .from("leads")
    .update({
      pipeline_stage: nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[admin:leads:mark-trial]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
