import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; oppId: string }> }
) {
  const user = await requireAdmin();
  const { id: studentId, oppId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  const supabase = createAdminClient();

  let update: Record<string, unknown>;
  if (action === "dismiss") {
    update = {
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_by: user.id,
    };
  } else if (action === "snooze") {
    const snooze = new Date();
    snooze.setDate(snooze.getDate() + 30);
    update = {
      status: "snoozed",
      snoozed_until: snooze.toISOString().split("T")[0],
    };
  } else if (action === "convert") {
    update = {
      status: "converted",
      converted_at: new Date().toISOString(),
    };
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { error } = await supabase
    .from("student_opportunities")
    .update(update)
    .eq("id", oppId)
    .eq("student_id", studentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
