import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { PipelineBoard } from "./pipeline-board";

export const metadata = {
  title: "Enrollment Pipeline — Admin",
  description: "Kanban view of new student enrollment pipeline.",
};

export default async function EnrollmentPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; urgency?: string }>;
}) {
  await requireAdmin();
  const { source, urgency } = await searchParams;

  const supabase = createAdminClient();

  let query = supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, source, notes, pipeline_stage, intake_form_data, created_at, updated_at, evaluation_scheduled_at"
    )
    .order("updated_at", { ascending: false });

  if (source) query = query.eq("source", source);

  const { data: leads, error } = await query;
  if (error) console.error("[pipeline]", error);

  // Compute days_in_stage at query time
  const now = Date.now();
  const enriched = (leads ?? []).map((l) => {
    const updated = new Date(l.updated_at).getTime();
    const daysInStage = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    return { ...l, daysInStage };
  });

  // Apply urgency filter
  let filtered = enriched;
  if (urgency === "3") filtered = enriched.filter((l) => l.daysInStage >= 3);
  if (urgency === "7") filtered = enriched.filter((l) => l.daysInStage >= 7);

  return <PipelineBoard leads={filtered} initialSource={source ?? ""} initialUrgency={urgency ?? ""} />;
}
