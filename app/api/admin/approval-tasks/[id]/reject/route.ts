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

  // Verify authorization
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

  const body = await req.json().catch(() => ({}));
  const rejectionReason = (body as Record<string, unknown>).rejection_reason as string | undefined;

  // Update the change request to rejected
  const { error: updateCrError } = await supabase
    .from("schedule_change_requests")
    .update({
      approval_status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? null,
    })
    .eq("id", task.change_request_id);

  if (updateCrError) {
    console.error("[api:approval-tasks:reject:cr]", updateCrError);
    return NextResponse.json(
      { error: "Failed to update change request" },
      { status: 500 }
    );
  }

  // Mark all tasks for this change request as dismissed
  const { error: taskUpdateError } = await supabase
    .from("approval_tasks")
    .update({
      status: "dismissed",
      completed_at: new Date().toISOString(),
    })
    .eq("change_request_id", task.change_request_id);

  if (taskUpdateError) {
    console.error("[api:approval-tasks:reject:tasks]", taskUpdateError);
  }

  return NextResponse.json({
    data: {
      rejected: true,
      change_request_id: task.change_request_id,
      rejection_reason: rejectionReason ?? null,
    },
  });
}
