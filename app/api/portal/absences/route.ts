import { NextRequest, NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreateAbsenceBody {
  student_id: string;
  schedule_instance_ids: string[];
  parent_note?: string;
}

/**
 * POST /api/portal/absences
 * Creates absence_records for one or more upcoming class sessions, pre-marks
 * attendance_records as 'excused', and notifies the assigned teacher + admins.
 */
export async function POST(req: NextRequest) {
  const user = await requireParent();
  const body = (await req.json().catch(() => ({}))) as Partial<CreateAbsenceBody>;

  if (!body.student_id || !Array.isArray(body.schedule_instance_ids) || body.schedule_instance_ids.length === 0) {
    return NextResponse.json({ error: "student_id and schedule_instance_ids are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify student belongs to parent
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_id, tenant_id")
    .eq("id", body.student_id)
    .single();

  if (!student || student.parent_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tenantId = student.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Student missing tenant" }, { status: 500 });
  }

  // Load instances
  const { data: instances } = await supabase
    .from("schedule_instances")
    .select("id, class_id, event_date, teacher_id")
    .in("id", body.schedule_instance_ids);

  if (!instances || instances.length === 0) {
    return NextResponse.json({ error: "No matching sessions" }, { status: 404 });
  }

  const classIds = [...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[])];
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);
  const classMap = new Map<string, string>();
  for (const c of classes ?? []) classMap.set(c.id, c.name);

  const studentName = `${student.first_name} ${student.last_name}`;
  const note = (body.parent_note ?? "").trim() || null;
  const nowIso = new Date().toISOString();

  // Insert absence_records
  const absenceRows = instances.map((i) => ({
    tenant_id: tenantId,
    student_id: student.id,
    class_id: i.class_id,
    schedule_instance_id: i.id,
    absence_date: i.event_date,
    reported_by: user.id,
    report_channel: "portal" as const,
    parent_note: note,
    status: "excused" as const,
    notified_teacher_at: nowIso,
    notified_admin_at: nowIso,
  }));

  const { error: absErr } = await supabase.from("absence_records").insert(absenceRows);
  if (absErr) {
    console.error("[absences] insert failed:", absErr);
    return NextResponse.json({ error: absErr.message }, { status: 500 });
  }

  // Pre-mark attendance_records as excused (one per (class, student, date))
  const attendanceRows = instances
    .filter((i) => i.class_id && i.teacher_id)
    .map((i) => ({
      tenant_id: tenantId,
      class_id: i.class_id as string,
      student_id: student.id,
      teacher_id: i.teacher_id as string,
      date: i.event_date,
      status: "excused",
      notes: note ? `Parent reported: ${note}` : "Parent reported absence",
    }));

  if (attendanceRows.length > 0) {
    await supabase
      .from("attendance_records")
      .upsert(attendanceRows, { onConflict: "class_id,student_id,date" });
  }

  // Notify teachers (one notification per session/teacher)
  const teacherNotifs = instances
    .filter((i) => i.teacher_id)
    .map((i) => ({
      tenant_id: tenantId,
      recipient_id: i.teacher_id as string,
      notification_type: "absence_reported",
      title: `${studentName} will be absent`,
      body: `${classMap.get(i.class_id ?? "") ?? "Class"} on ${i.event_date}${note ? ` — ${note}` : ""}`,
      metadata: {
        student_id: student.id,
        class_id: i.class_id,
        schedule_instance_id: i.id,
        absence_date: i.event_date,
      },
    }));

  if (teacherNotifs.length > 0) {
    await supabase.from("notifications").insert(teacherNotifs);
  }

  // Notify admins (in-app only)
  const { data: admins } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true);

  const adminIds = Array.from(
    new Set((admins ?? []).map((a) => a.user_id).filter(Boolean) as string[])
  );

  if (adminIds.length > 0) {
    const adminNotifs = adminIds.map((id) => ({
      tenant_id: tenantId,
      recipient_id: id,
      notification_type: "absence_reported",
      title: `${studentName} reported absent`,
      body: `${instances.length} session(s) — reported by parent${note ? `: ${note}` : ""}`,
      metadata: {
        student_id: student.id,
        schedule_instance_ids: body.schedule_instance_ids,
      },
    }));
    await supabase.from("notifications").insert(adminNotifs);
  }

  return NextResponse.json({ success: true, count: absenceRows.length });
}
