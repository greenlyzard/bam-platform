import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function ClassCurriculumPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = createAdminClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("curriculum_ids, discipline, levels")
    .eq("id", classId)
    .single();

  const curriculumIds = cls?.curriculum_ids ?? [];

  let curriculumItems: any[] = [];
  if (curriculumIds.length > 0) {
    const { data } = await supabase
      .from("dance_curriculum")
      .select("id, name, description, is_active, sort_order")
      .in("id", curriculumIds)
      .eq("is_active", true)
      .order("sort_order");
    curriculumItems = data ?? [];
  }

  if (curriculumItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center space-y-3">
        <p className="text-sm text-mist">Curriculum coming soon.</p>
        <p className="text-xs text-mist">
          Curriculum can be configured in{" "}
          <Link href="/admin/settings/curriculum" className="text-lavender hover:underline">
            Settings &rarr; Curriculum
          </Link>
        </p>
        {cls?.discipline && (
          <p className="text-xs text-slate">
            Discipline: {cls.discipline}
            {cls.levels?.length ? ` · Levels: ${cls.levels.join(", ")}` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate">{curriculumItems.length} curriculum item{curriculumItems.length !== 1 ? "s" : ""}</p>
      {curriculumItems.map((item) => (
        <div key={item.id} className="rounded-xl border border-silver bg-white p-4">
          <h3 className="text-sm font-semibold text-charcoal">{item.name}</h3>
          {item.description && (
            <p className="text-xs text-slate mt-1">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
