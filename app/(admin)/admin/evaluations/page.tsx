import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EvaluationReviewClient } from "./evaluation-review-client";
import { seedDefaultTemplates } from "./actions";

export default async function AdminEvaluationsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Auto-seed evaluation templates on first load if none exist
  let templateSeeded = false;
  try {
    const { count } = await supabase
      .from("evaluation_templates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.tenantId!);

    if (count === 0 || count === null) {
      const fd = new FormData();
      fd.set("tenantId", user.tenantId!);
      await seedDefaultTemplates(fd);
      templateSeeded = true;
    }
  } catch (e) {
    // evaluation_templates table may not exist yet — skip seeding gracefully
    console.warn("[evaluations] Template seed skipped — table may not exist", e);
  }

  // 1. Fetch all evaluations in reviewable statuses
  const { data: evalRows } = await supabase
    .from("student_evaluations")
    .select(
      "id, student_id, class_id, template_id, evaluation_type, title, status, admin_note, attributed_to_name, evaluator_id, created_at, updated_at"
    )
    .in("status", ["submitted", "changes_requested", "approved", "published"])
    .order("updated_at", { ascending: false });

  const evaluations = evalRows ?? [];

  // 2. Fetch student names for all referenced student IDs
  const studentIds = [...new Set(evaluations.map((e) => e.student_id).filter(Boolean))];
  const studentMap: Record<string, string> = {};

  if (studentIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", studentIds);

    for (const s of studentRows ?? []) {
      studentMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  }

  // 3. Fetch evaluator names from profiles
  const evaluatorIds = [...new Set(evaluations.map((e) => e.evaluator_id).filter(Boolean) as string[])];
  const evaluatorMap: Record<string, string> = {};

  if (evaluatorIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", evaluatorIds);

    for (const p of profileRows ?? []) {
      evaluatorMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  }

  // 4. Fetch class names for evaluations with class_id
  const classIds = [...new Set(evaluations.map((e) => e.class_id).filter(Boolean) as string[])];
  const classMap: Record<string, string> = {};

  if (classIds.length > 0) {
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, name, simple_name")
      .in("id", classIds);

    for (const c of classRows ?? []) {
      classMap[c.id] = c.simple_name || c.name;
    }
  }

  // 5. Build enriched evaluation list
  const enrichedEvaluations = evaluations.map((ev) => ({
    id: ev.id,
    studentName: studentMap[ev.student_id] ?? "Unknown Student",
    className: ev.class_id ? classMap[ev.class_id] ?? "Unknown Class" : null,
    teacherName: ev.attributed_to_name || (ev.evaluator_id ? evaluatorMap[ev.evaluator_id] : null) || "Unknown",
    evaluatorId: ev.evaluator_id,
    status: ev.status as string,
    title: ev.title,
    evaluationType: ev.evaluation_type,
    adminNote: ev.admin_note,
    createdAt: ev.created_at,
    updatedAt: ev.updated_at,
  }));

  // 6. Fetch teacher list for filter dropdown
  const { data: teacherProfileRows } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("first_name");

  const teachers = (teacherProfileRows ?? []).map((tp) => ({
    id: tp.id,
    name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
  }));

  // 7. Fetch class list for filter dropdown
  const { data: classListRows } = await supabase
    .from("classes")
    .select("id, name, simple_name")
    .eq("is_active", true)
    .order("name");

  const classes = (classListRows ?? []).map((c) => ({
    id: c.id,
    name: c.simple_name || c.name,
  }));

  return (
    <EvaluationReviewClient
      evaluations={enrichedEvaluations}
      teachers={teachers}
      classes={classes}
      templateSeeded={templateSeeded}
    />
  );
}
