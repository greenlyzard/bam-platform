"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateSessionsForClass, checkClassAtRisk } from "./generate-sessions";

export async function upsertClass(data: {
  id?: string;
  full_name: string;
  short_name?: string;
  simple_name?: string;
  display_name?: string;
  short_description?: string;
  long_description?: string;
  class_type: string;
  program_division?: string;
  levels?: string[];
  min_age?: number | null;
  max_age?: number | null;
  start_date: string;
  end_date: string;
  room?: string;
  location_notes?: string;
  lead_teacher_id?: string | null;
  assistant_teacher_ids?: string[];
  max_enrollment?: number | null;
  min_enrollment?: number | null;
  production_id?: string | null;
  status: string;
  is_published?: boolean;
  is_open_enrollment?: boolean;
  trial_eligible?: boolean;
  trial_requires_approval?: boolean;
  trial_max_per_class?: number;
  color_code?: string;
  // recurrence
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .limit(1)
    .single();

  if (!tenant) return { error: "Tenant not found" };

  const classPayload = {
    tenant_id: tenant.id,
    name: data.full_name,
    full_name: data.full_name,
    short_name: data.short_name || null,
    simple_name: data.simple_name || data.full_name,
    display_name: data.display_name || null,
    short_description: data.short_description || null,
    long_description: data.long_description || null,
    class_type: data.class_type,
    program_division: data.program_division || null,
    levels: data.levels ?? [],
    min_age: data.min_age ?? null,
    max_age: data.max_age ?? null,
    start_date: data.start_date,
    end_date: data.end_date,
    room: data.room || null,
    location_notes: data.location_notes || null,
    lead_teacher_id: data.lead_teacher_id || null,
    assistant_teacher_ids: data.assistant_teacher_ids ?? [],
    max_enrollment: data.max_enrollment ?? null,
    min_enrollment: data.min_enrollment ?? null,
    production_id: data.production_id || null,
    status: data.status,
    is_published: data.is_published ?? false,
    is_open_enrollment: data.is_open_enrollment ?? true,
    trial_eligible: data.trial_eligible ?? false,
    trial_requires_approval: data.trial_requires_approval ?? false,
    trial_max_per_class: data.trial_max_per_class ?? 2,
    color_code: data.color_code || null,
    created_by: user.id,
  };

  let classId = data.id;

  if (classId) {
    // Update
    const { error } = await supabase
      .from("classes")
      .update({ ...classPayload, updated_at: new Date().toISOString() })
      .eq("id", classId);
    if (error) return { error: error.message };
  } else {
    // Insert
    const { data: inserted, error } = await supabase
      .from("classes")
      .insert(classPayload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    classId = inserted.id;
  }

  // Upsert recurrence rule
  if (data.days_of_week && data.days_of_week.length > 0 && data.start_time && data.end_time) {
    // Delete existing rules
    await supabase
      .from("class_recurrence_rules")
      .delete()
      .eq("class_id", classId!);

    const { error: ruleErr } = await supabase
      .from("class_recurrence_rules")
      .insert({
        class_id: classId!,
        tenant_id: tenant.id,
        days_of_week: data.days_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        frequency: "weekly",
      });
    if (ruleErr) return { error: ruleErr.message };
  }

  // If status changed to active and no sessions exist, generate them
  if (data.status === "active") {
    const { count } = await supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId!);

    if ((count ?? 0) === 0) {
      await generateSessionsForClass(classId!, tenant.id);
    }
  }

  revalidatePath("/admin/schedule/classes");
  revalidatePath("/admin/schedule");
  return { success: true, classId };
}

export async function cancelSession(sessionId: string, reason: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("class_sessions")
    .update({
      is_cancelled: true,
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Get tenant
  const { data: session } = await supabase
    .from("class_sessions")
    .select("tenant_id, class_id")
    .eq("id", sessionId)
    .single();

  if (session) {
    // Create makeup_needed task
    await supabase.from("admin_tasks").insert({
      tenant_id: session.tenant_id,
      task_type: "makeup_needed",
      title: "Makeup session needed for cancelled class",
      description: `Session cancelled: ${reason}`,
      priority: "normal",
      related_session_id: sessionId,
      related_class_id: session.class_id,
    });
  }

  revalidatePath("/admin/schedule");
  return { success: true };
}

export async function setCancellationPayDecision(
  sessionId: string,
  decision: string,
  rateOverride?: number
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_sessions")
    .update({
      cancellation_pay_decision: decision,
      cancellation_pay_rate_override: rateOverride ?? null,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Resolve any pending pay decision tasks
  await supabase
    .from("admin_tasks")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("related_session_id", sessionId)
    .eq("task_type", "cancellation_pay_decision")
    .eq("status", "open");

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/tasks");
  return { success: true };
}

export async function createPayDecisionTask(sessionId: string, teacherId: string) {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("class_sessions")
    .select("tenant_id, class_id")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session not found" };

  await supabase.from("admin_tasks").insert({
    tenant_id: session.tenant_id,
    task_type: "cancellation_pay_decision",
    title: "Pay decision needed for cancelled session",
    priority: "normal",
    related_session_id: sessionId,
    related_class_id: session.class_id,
    related_teacher_id: teacherId,
  });

  return { success: true };
}

export async function resolveTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("admin_tasks")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath("/admin/tasks");
  return { success: true };
}

export async function dismissTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("admin_tasks")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath("/admin/tasks");
  return { success: true };
}

export async function submitAttendance(
  sessionId: string,
  records: Array<{
    student_id: string;
    status: string;
    notes?: string;
    checkin_source?: string;
    propagated_from_session_id?: string | null;
  }>
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: session } = await supabase
    .from("class_sessions")
    .select("tenant_id, attendance_locked_at")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.attendance_locked_at) return { error: "Attendance already locked" };

  const attendanceRecords = records.map((r) => ({
    tenant_id: session.tenant_id,
    session_id: sessionId,
    student_id: r.student_id,
    status: r.status,
    notes: r.notes || null,
    checkin_source: r.checkin_source ?? "teacher_roster",
    propagated_from_session_id: r.propagated_from_session_id ?? null,
    checked_in_at: new Date().toISOString(),
    checked_in_by: user.id,
  }));

  const { error: insertErr } = await supabase
    .from("session_attendance")
    .upsert(attendanceRecords, { onConflict: "session_id,student_id" });

  if (insertErr) return { error: insertErr.message };

  // Lock attendance
  await supabase
    .from("class_sessions")
    .update({ attendance_locked_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath(`/teach/schedule/${sessionId}`);
  return { success: true };
}

export async function markTeacherAbsent(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: session } = await supabase
    .from("class_sessions")
    .select("tenant_id, class_id, lead_teacher_id")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session not found" };

  // Mark session as needing coverage
  await supabase
    .from("class_sessions")
    .update({ needs_coverage: true })
    .eq("id", sessionId);

  // Create coverage_needed task
  await supabase.from("admin_tasks").insert({
    tenant_id: session.tenant_id,
    task_type: "coverage_needed",
    title: "Substitute needed — teacher marked absent",
    priority: "urgent",
    related_session_id: sessionId,
    related_class_id: session.class_id,
    related_teacher_id: user.id,
  });

  revalidatePath(`/teach/schedule/${sessionId}`);
  revalidatePath("/admin/tasks");
  return { success: true };
}
