import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the substitute request
  const { data: subReq, error: reqErr } = await supabase
    .from("substitute_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (reqErr || !subReq) {
    return NextResponse.json(
      { error: "Substitute request not found" },
      { status: 404 }
    );
  }

  if (subReq.status !== "open") {
    return NextResponse.json(
      { error: "Request is not open" },
      { status: 400 }
    );
  }

  // Get the class info for matching subs
  const { data: instance } = await supabase
    .from("schedule_instances")
    .select("class_id")
    .eq("id", subReq.instance_id)
    .single();

  const { data: classInfo } = instance?.class_id
    ? await supabase
        .from("classes")
        .select("level, style")
        .eq("id", instance.class_id)
        .single()
    : { data: null };

  // Find eligible subs sorted by priority
  let subQuery = supabase
    .from("substitute_authorizations")
    .select("teacher_id, priority_order")
    .eq("tenant_id", subReq.tenant_id)
    .eq("is_active", true)
    .order("priority_order");

  const { data: eligibleSubs } = await subQuery;

  // Create substitute alerts for each eligible sub
  if (eligibleSubs && eligibleSubs.length > 0) {
    const alerts = eligibleSubs.map((sub) => ({
      tenant_id: subReq.tenant_id,
      request_id: subReq.id,
      teacher_id: sub.teacher_id,
      alert_channel: ["email", "sms"],
    }));

    const { error: alertErr } = await supabase
      .from("substitute_alerts")
      .insert(alerts);

    if (alertErr) {
      console.error("[api:sub-requests:approve:alerts]", alertErr);
    }
  }

  return NextResponse.json({
    data: {
      request: subReq,
      alerts_sent: eligibleSubs?.length ?? 0,
    },
  });
}
