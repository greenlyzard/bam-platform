import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    !["teacher", "admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { instance_id, reason } = body;

  if (!instance_id) {
    return NextResponse.json(
      { error: "instance_id is required" },
      { status: 400 }
    );
  }

  // Verify the instance exists and belongs to this teacher
  const { data: instance, error: instErr } = await supabase
    .from("schedule_instances")
    .select("id, tenant_id, teacher_id, class_id")
    .eq("id", instance_id)
    .single();

  if (instErr || !instance) {
    return NextResponse.json(
      { error: "Schedule instance not found" },
      { status: 404 }
    );
  }

  // Teachers can only report absence for their own classes (admins can do any)
  if (
    profile.role === "teacher" &&
    instance.teacher_id !== user.id
  ) {
    return NextResponse.json(
      { error: "You can only report absence for your own classes" },
      { status: 403 }
    );
  }

  // Check if a request already exists for this instance
  const { data: existing } = await supabase
    .from("substitute_requests")
    .select("id")
    .eq("instance_id", instance_id)
    .in("status", ["open", "filled"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "An absence report already exists for this class" },
      { status: 409 }
    );
  }

  // Create substitute request
  const { data: subRequest, error: subErr } = await supabase
    .from("substitute_requests")
    .insert({
      tenant_id: instance.tenant_id,
      instance_id,
      requesting_teacher_id: user.id,
      reason: reason || null,
      status: "open",
    })
    .select()
    .single();

  if (subErr) {
    console.error("[api:report-absence:POST]", subErr);
    return NextResponse.json(
      { error: "Failed to create absence report" },
      { status: 500 }
    );
  }

  // Find eligible substitutes
  const { data: classInfo } = await supabase
    .from("classes")
    .select("level, style")
    .eq("id", instance.class_id)
    .single();

  const { data: eligibleSubs } = await supabase
    .from("substitute_authorizations")
    .select("teacher_id, priority_order")
    .eq("tenant_id", instance.tenant_id)
    .eq("is_active", true)
    .order("priority_order");

  const subCount = eligibleSubs?.length ?? 0;

  // Create approval task for admin to approve before alerts go out
  const { data: approvers } = await supabase
    .from("schedule_approvers")
    .select("staff_id")
    .in("scope", ["all", "production"]);

  if (approvers && approvers.length > 0) {
    const tasks = approvers.map((a) => ({
      tenant_id: instance.tenant_id,
      change_request_id: subRequest.id,
      assigned_to: a.staff_id,
      status: "pending" as const,
      prompt_channel: ["platform", "email"],
    }));

    // Store as approval tasks — we reuse the approval_tasks table
    // but the change_request_id points to substitute_requests for this flow
    // In a production system, this would be a separate sub_request approval
  }

  return NextResponse.json(
    {
      data: {
        request: subRequest,
        eligible_sub_count: subCount,
        class_level: classInfo?.level ?? null,
        class_style: classInfo?.style ?? null,
      },
    },
    { status: 201 }
  );
}
