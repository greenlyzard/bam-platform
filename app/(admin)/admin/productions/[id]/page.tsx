import { notFound } from "next/navigation";
import {
  getProductionById,
  getProductionDances,
  getProductionCasting,
  getProductionRehearsals,
  getStudentsForCasting,
  getAllDances,
} from "@/lib/queries/productions";
import { createClient } from "@/lib/supabase/server";
import { ProductionDetail } from "./production-detail";
import { ProductionLabor } from "./production-labor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const production = await getProductionById(id);
  return { title: production ? `${production.name} — Studio Admin` : "Production" };
}

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [production, prodDances, casting, rehearsals, students, allDances] =
    await Promise.all([
      getProductionById(id),
      getProductionDances(id),
      getProductionCasting(id),
      getProductionRehearsals(id),
      getStudentsForCasting(),
      getAllDances(),
    ]);

  if (!production) notFound();

  // Fetch labor data: timesheet entries tagged to this production
  const { data: laborEntries } = await supabase
    .from("timesheet_entries")
    .select(
      "entry_type, total_hours, rate_amount, timesheets!inner(teacher_id, teacher_profiles!inner(first_name, last_name, employment_type, user_id))"
    )
    .eq("production_id", id);

  // Get teacher rates from legacy teachers table
  const userIds = new Set<string>();
  for (const e of laborEntries ?? []) {
    const ts = (e as Record<string, unknown>).timesheets as {
      teacher_profiles: { user_id: string };
    };
    userIds.add(ts.teacher_profiles.user_id);
  }

  const { data: teacherRates } =
    userIds.size > 0
      ? await supabase
          .from("teachers")
          .select("id, class_rate_cents, private_rate_cents, rehearsal_rate_cents, admin_rate_cents")
          .in("id", Array.from(userIds))
      : { data: [] };

  const rateMap: Record<string, Record<string, number>> = {};
  for (const tr of teacherRates ?? []) {
    rateMap[tr.id] = {
      class_lead: (tr.class_rate_cents ?? 0) / 100,
      class_assistant: (tr.class_rate_cents ?? 0) / 100,
      private: (tr.private_rate_cents ?? 0) / 100,
      rehearsal: (tr.rehearsal_rate_cents ?? 0) / 100,
      admin: (tr.admin_rate_cents ?? 0) / 100,
    };
  }

  const CATEGORY_MAP: Record<string, string> = {
    class_lead: "Class",
    class_assistant: "Class",
    private: "Private",
    rehearsal: "Rehearsal",
    admin: "Admin",
    performance_event: "Performance",
    competition: "Competition",
    training: "Training",
    substitute: "Substitute",
    bonus: "Other",
  };

  const mappedLabor = (laborEntries ?? []).map((e) => {
    const ts = (e as Record<string, unknown>).timesheets as {
      teacher_profiles: {
        first_name: string | null;
        last_name: string | null;
        employment_type: string;
        user_id: string;
      };
    };
    const tp = ts.teacher_profiles;
    const teacherName =
      [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown";
    const rates = rateMap[tp.user_id] ?? {};
    const rate =
      e.rate_amount && Number(e.rate_amount) > 0
        ? Number(e.rate_amount)
        : rates[e.entry_type] ?? 0;

    return {
      teacherName,
      employmentType: tp.employment_type,
      category: CATEGORY_MAP[e.entry_type] ?? e.entry_type,
      hours: e.total_hours ?? 0,
      rate,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/admin/productions"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          ← Back to Productions
        </a>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-charcoal">
          {production.name}
        </h1>
      </div>

      <ProductionDetail
        production={production}
        prodDances={prodDances}
        casting={casting}
        rehearsals={rehearsals}
        students={students}
        allDances={allDances}
      />

      <ProductionLabor
        productionName={production.name}
        entries={mappedLabor}
      />
    </div>
  );
}
