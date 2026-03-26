import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createEvaluationsForClass } from "@/app/(admin)/admin/evaluations/actions";
import { BatchEvaluationClient } from "./batch-evaluation-client";

export default async function ClassEvaluationPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("teacher", "admin", "super_admin");
  const { classId } = await params;
  const supabase = await createClient();

  // Fetch class details
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, levels, tenant_id")
    .eq("id", classId)
    .single();

  if (!cls) {
    return (
      <div className="p-8 text-center text-charcoal/60">
        <p className="text-lg">Class not found.</p>
      </div>
    );
  }

  const levelTag = cls.levels?.[0] ?? null;

  // Find matching evaluation template
  const { data: template } = levelTag
    ? await supabase
        .from("evaluation_templates")
        .select("id, name, level_tag")
        .eq("tenant_id", cls.tenant_id)
        .eq("level_tag", levelTag)
        .eq("is_active", true)
        .single()
    : { data: null };

  if (!template) {
    return (
      <div className="p-8 text-center text-charcoal/60">
        <p className="text-lg">No evaluation template configured for this class level.</p>
        <p className="mt-1 text-sm">
          Ask an administrator to set up a template for &ldquo;{levelTag ?? "unknown"}&rdquo;.
        </p>
      </div>
    );
  }

  // Fetch template sections + questions (join through to question bank)
  const { data: sections } = await supabase
    .from("evaluation_template_sections")
    .select(
      "id, name, slug, visibility, sort_order, evaluation_template_questions(id, question_id, sort_order, is_required, evaluation_question_bank(id, slug, label, question_type))"
    )
    .eq("template_id", template.id)
    .order("sort_order");

  // Fetch enrolled students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  const studentIds = (enrollments ?? []).map((e) => e.student_id);

  if (studentIds.length === 0) {
    return (
      <div className="p-8 text-center text-charcoal/60">
        <p className="text-lg">No students enrolled in this class.</p>
      </div>
    );
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, avatar_url, current_level")
    .in("id", studentIds)
    .order("last_name")
    .order("first_name");

  // Ensure evaluations exist for all students
  const fd = new FormData();
  fd.set("class_id", classId);
  fd.set("template_id", template.id);
  fd.set("tenant_id", cls.tenant_id);
  await createEvaluationsForClass(fd);

  // Fetch all evaluations for this class + template
  const { data: evaluations } = await supabase
    .from("student_evaluations")
    .select("id, student_id, status")
    .eq("class_id", classId)
    .eq("template_id", template.id);

  const evalIds = (evaluations ?? []).map((e) => e.id);

  // Fetch all responses
  const { data: responses } = evalIds.length > 0
    ? await supabase
        .from("student_evaluation_responses")
        .select("evaluation_id, question_id, nse_value, text_value")
        .in("evaluation_id", evalIds)
    : { data: [] };

  // Transform sections for client
  const sectionData = (sections ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    visibility: s.visibility ?? "always",
    sortOrder: s.sort_order,
    questions: ((s.evaluation_template_questions as any[]) ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((tq: any) => ({
        id: tq.id,
        questionId: tq.evaluation_question_bank.id,
        slug: tq.evaluation_question_bank.slug,
        label: tq.evaluation_question_bank.label,
        questionType: tq.evaluation_question_bank.question_type,
        isRequired: tq.is_required,
        sortOrder: tq.sort_order,
      })),
  }));

  const studentData = (students ?? []).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    avatarUrl: s.avatar_url,
    currentLevel: s.current_level,
  }));

  const evalData = (evaluations ?? []).map((e) => ({
    id: e.id,
    studentId: e.student_id,
    status: e.status,
  }));

  const responseData = (responses ?? []).map((r) => ({
    evaluationId: r.evaluation_id,
    questionId: r.question_id,
    nseValue: r.nse_value,
    textValue: r.text_value,
  }));

  return (
    <BatchEvaluationClient
      students={studentData}
      sections={sectionData}
      evaluations={evalData}
      responses={responseData}
      classId={classId}
      className={cls.name}
      tenantId={cls.tenant_id}
    />
  );
}
