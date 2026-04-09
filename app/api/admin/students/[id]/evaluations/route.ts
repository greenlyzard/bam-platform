import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const TYPES = ["progress_check", "level_assessment", "goal_setting", "achievement_note", "general"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("student_evaluations")
    .select(
      "id, evaluation_type, title, body, attributed_to_name, evaluator_id, is_private, status, created_at"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const evaluatorIds = Array.from(
    new Set((data ?? []).map((e) => e.evaluator_id).filter(Boolean) as string[])
  );
  const { data: profiles } = evaluatorIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", evaluatorIds)
    : { data: [] };
  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Staff");
  }

  const evaluations = (data ?? []).map((e) => ({
    ...e,
    author_name:
      e.attributed_to_name ?? (e.evaluator_id ? nameMap.get(e.evaluator_id) ?? null : null),
  }));

  return NextResponse.json({ evaluations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  const { id: studentId } = await params;
  const body = await req.json().catch(() => ({}));

  const evalType = body.evaluation_type ?? "general";
  if (!TYPES.includes(evalType)) {
    return NextResponse.json({ error: "Invalid evaluation_type" }, { status: 400 });
  }
  const title = (body.title ?? "").trim() || null;
  const text = (body.body ?? "").trim();
  const sharedWithParent = !body.is_private;

  if (!text) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .single();
  if (!student?.tenant_id) {
    return NextResponse.json({ error: "Student missing tenant" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("student_evaluations")
    .insert({
      tenant_id: student.tenant_id,
      student_id: studentId,
      evaluator_id: user.id,
      evaluation_type: evalType,
      title,
      body: text,
      is_private: !sharedWithParent,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
