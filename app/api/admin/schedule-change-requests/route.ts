import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const changeType = searchParams.get("change_type");

  let query = supabase
    .from("schedule_change_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("approval_status", status);
  }
  if (changeType) {
    query = query.eq("change_type", changeType);
  }
  if (dateFrom) {
    query = query.gte("requested_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("requested_at", dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api:schedule-change-requests:GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch change requests" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
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
    !["admin", "super_admin", "teacher"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { instance_id, change_type, previous_state, proposed_state } = body;

  if (!instance_id || !change_type || !previous_state || !proposed_state) {
    return NextResponse.json(
      { error: "instance_id, change_type, previous_state, and proposed_state are required" },
      { status: 400 }
    );
  }

  // Get tenant_id from the referenced instance
  const { data: instance, error: instanceError } = await supabase
    .from("schedule_instances")
    .select("tenant_id")
    .eq("id", instance_id)
    .single();

  if (instanceError || !instance) {
    return NextResponse.json(
      { error: "Schedule instance not found" },
      { status: 404 }
    );
  }

  // Create the change request
  const { data: changeRequest, error: crError } = await supabase
    .from("schedule_change_requests")
    .insert({
      tenant_id: instance.tenant_id,
      instance_id,
      change_type,
      requested_by: user.id,
      previous_state,
      proposed_state,
      approval_status: "pending",
    })
    .select()
    .single();

  if (crError) {
    console.error("[api:schedule-change-requests:POST]", crError);
    return NextResponse.json(
      { error: "Failed to create change request" },
      { status: 500 }
    );
  }

  // Find all approvers in scope
  const { data: approvers } = await supabase
    .from("schedule_approvers")
    .select("staff_id")
    .in("scope", ["all", change_type === "cancellation" ? "rehearsal" : "production"]);

  // Create approval tasks for each approver
  if (approvers && approvers.length > 0) {
    const tasks = approvers.map((a) => ({
      tenant_id: instance.tenant_id,
      change_request_id: changeRequest.id,
      assigned_to: a.staff_id,
      status: "pending" as const,
      prompt_channel: ["platform", "email"],
    }));

    const { error: taskError } = await supabase
      .from("approval_tasks")
      .insert(tasks);

    if (taskError) {
      console.error("[api:schedule-change-requests:POST:tasks]", taskError);
    }
  }

  return NextResponse.json({ data: changeRequest }, { status: 201 });
}
