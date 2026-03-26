import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TemplateListClient } from "./template-list-client";

export default async function EvaluationTemplatesPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // 1. Fetch all evaluation templates for the tenant
  const { data: templateRows } = await supabase
    .from("evaluation_templates")
    .select("id, name, slug, level_tag, program_tag, is_active, created_at")
    .eq("tenant_id", user.tenantId!)
    .order("created_at", { ascending: false });

  const templates = templateRows ?? [];

  // 2. Count sections per template
  const templateIds = templates.map((t) => t.id);
  const sectionCountMap: Record<string, number> = {};
  const questionCountMap: Record<string, number> = {};

  if (templateIds.length > 0) {
    const { data: sectionRows } = await supabase
      .from("evaluation_template_sections")
      .select("id, template_id")
      .in("template_id", templateIds);

    for (const s of sectionRows ?? []) {
      sectionCountMap[s.template_id] = (sectionCountMap[s.template_id] ?? 0) + 1;
    }

    // 3. Count questions per template
    const { data: questionRows } = await supabase
      .from("evaluation_template_questions")
      .select("id, template_id")
      .in("template_id", templateIds);

    for (const q of questionRows ?? []) {
      questionCountMap[q.template_id] = (questionCountMap[q.template_id] ?? 0) + 1;
    }
  }

  // 4. Build enriched template list
  const enrichedTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    level_tag: t.level_tag,
    program_tag: t.program_tag,
    is_active: t.is_active,
    sectionCount: sectionCountMap[t.id] ?? 0,
    questionCount: questionCountMap[t.id] ?? 0,
    created_at: t.created_at,
  }));

  return <TemplateListClient templates={enrichedTemplates} tenantId={user.tenantId!} />;
}
