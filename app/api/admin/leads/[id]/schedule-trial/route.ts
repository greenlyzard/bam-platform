import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const trialDate = body?.trial_date as string | undefined;

  if (!trialDate || !/^\d{4}-\d{2}-\d{2}$/.test(trialDate)) {
    return NextResponse.json({ error: "Invalid trial_date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load existing intake_form_data to merge trial_date in
  const { data: existing } = await supabase
    .from("leads")
    .select("intake_form_data")
    .eq("id", id)
    .single();

  const intake = (existing?.intake_form_data as Record<string, unknown> | null) ?? {};
  const merged = { ...intake, trial_date: trialDate };

  const { error } = await supabase
    .from("leads")
    .update({
      pipeline_stage: "trial_scheduled",
      intake_form_data: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[admin:leads:schedule-trial]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
