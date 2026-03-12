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

  // Fetch the task
  const { data: task, error: taskError } = await supabase
    .from("approval_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (taskError || !task) {
    return NextResponse.json(
      { error: "Approval task not found" },
      { status: 404 }
    );
  }

  // Verify authorization: admin/super_admin or the assigned approver
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile && ["admin", "super_admin"].includes(profile.role);
  const isAssigned = task.assigned_to === user.id;

  if (!isAdmin && !isAssigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (task.status !== "pending") {
    return NextResponse.json(
      { error: "Task is not pending" },
      { status: 400 }
    );
  }

  // Fetch the associated change request
  const { data: changeRequest, error: crError } = await supabase
    .from("schedule_change_requests")
    .select("*")
    .eq("id", task.change_request_id)
    .single();

  if (crError || !changeRequest) {
    return NextResponse.json(
      { error: "Change request not found" },
      { status: 404 }
    );
  }

  // Update the change request to approved
  const { error: updateCrError } = await supabase
    .from("schedule_change_requests")
    .update({
      approval_status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", changeRequest.id);

  if (updateCrError) {
    console.error("[api:approval-tasks:approve:cr]", updateCrError);
    return NextResponse.json(
      { error: "Failed to update change request" },
      { status: 500 }
    );
  }

  // Apply proposed_state to the schedule instance (whitelist safe fields)
  const proposed = changeRequest.proposed_state as Record<string, unknown>;
  const ALLOWED_FIELDS = [
    "teacher_id", "substitute_teacher_id", "room_id",
    "start_time", "end_time", "event_date", "status",
    "cancellation_reason", "notes", "is_trial_eligible",
  ];
  const safeUpdate: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in proposed) safeUpdate[key] = proposed[key];
  }
  const { data: updatedInstance, error: instanceError } = await supabase
    .from("schedule_instances")
    .update(safeUpdate)
    .eq("id", changeRequest.instance_id)
    .select()
    .single();

  if (instanceError) {
    console.error("[api:approval-tasks:approve:instance]", instanceError);
  }

  // Mark this task + all sibling tasks as completed
  const { error: taskUpdateError } = await supabase
    .from("approval_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("change_request_id", changeRequest.id);

  if (taskUpdateError) {
    console.error("[api:approval-tasks:approve:tasks]", taskUpdateError);
  }

  return NextResponse.json({
    data: {
      changeRequest: { ...changeRequest, approval_status: "approved" },
      instance: updatedInstance ?? null,
    },
  });
}
