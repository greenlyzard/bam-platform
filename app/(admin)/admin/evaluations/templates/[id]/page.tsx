import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TemplateBuilderClient } from "./template-builder-client";

export default async function TemplateBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const tenantId = admin.tenantId!;

  // Fetch template
  const { data: template, error: templateErr } = await supabase
    .from("evaluation_templates")
    .select("id, name, slug, level_tag, program_tag, is_active, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (templateErr || !template) notFound();

  // Fetch sections ordered by sort_order
  const { data: sections } = await supabase
    .from("evaluation_template_sections")
    .select("id, title, slug, display_mode, sort_order")
    .eq("template_id", id)
    .order("sort_order");

  // Fetch questions for this template ordered by sort_order
  const { data: questions } = await supabase
    .from("evaluation_template_questions")
    .select(
      "id, section_id, label, slug, hint_text, question_type, is_required, sort_order"
    )
    .eq("template_id", id)
    .order("sort_order");

  // Fetch active question bank for this tenant
  const { data: questionBank } = await supabase
    .from("evaluation_question_bank")
    .select("id, label, slug, question_type, default_section, hint_text")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("default_section")
    .order("label");

  return (
    <TemplateBuilderClient
      template={template}
      sections={sections ?? []}
      questions={questions ?? []}
      questionBank={questionBank ?? []}
      tenantId={tenantId}
    />
  );
}
