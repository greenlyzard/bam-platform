import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
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

  if (
    !profile ||
    !["teacher", "admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { response } = body;

  if (!response || !["accepted", "declined"].includes(response)) {
    return NextResponse.json(
      { error: "response must be 'accepted' or 'declined'" },
      { status: 400 }
    );
  }

  // Fetch the alert
  const { data: alert, error: alertErr } = await supabase
    .from("substitute_alerts")
    .select("*")
    .eq("id", id)
    .single();

  if (alertErr || !alert) {
    return NextResponse.json(
      { error: "Alert not found" },
      { status: 404 }
    );
  }

  // Verify this teacher owns the alert
  if (alert.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (alert.response) {
    return NextResponse.json(
      { error: "Already responded" },
      { status: 400 }
    );
  }

  // Update this alert
  const { error: updateErr } = await supabase
    .from("substitute_alerts")
    .update({
      response,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[api:sub-alerts:respond]", updateErr);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }

  if (response === "accepted") {
    // Mark all other alerts for this request as no_response
    await supabase
      .from("substitute_alerts")
      .update({ response: "no_response" })
      .eq("request_id", alert.request_id)
      .neq("id", id)
      .is("response", null);

    // Update the substitute request
    await supabase
      .from("substitute_requests")
      .update({
        status: "filled",
        filled_by: user.id,
        filled_at: new Date().toISOString(),
      })
      .eq("id", alert.request_id);

    // Update the schedule instance with substitute teacher
    const { data: subReq } = await supabase
      .from("substitute_requests")
      .select("instance_id")
      .eq("id", alert.request_id)
      .single();

    if (subReq) {
      await supabase
        .from("schedule_instances")
        .update({ substitute_teacher_id: user.id })
        .eq("id", subReq.instance_id);
    }

    // Increment substitute session count and check 1099 threshold
    const { data: teacher } = await supabase
      .from("teachers")
      .select("substitute_session_count, substitute_session_threshold, employment_type")
      .eq("id", user.id)
      .single();

    if (teacher) {
      const newCount = (teacher.substitute_session_count ?? 0) + 1;
      const updates: Record<string, unknown> = {
        substitute_session_count: newCount,
      };

      // Check 1099 threshold
      if (
        newCount >= (teacher.substitute_session_threshold ?? 3) &&
        teacher.employment_type === "contractor_1099"
      ) {
        updates.employment_type = "pending_classification";
      }

      await supabase
        .from("teachers")
        .update(updates)
        .eq("id", user.id);
    }
  }

  return NextResponse.json({
    data: { alert_id: id, response },
  });
}
