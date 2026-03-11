import { notFound } from "next/navigation";
import {
  getProductionById,
  getProductionDances,
  getProductionCasting,
  getProductionRehearsals,
  getStudentsForCasting,
  getAllDances,
} from "@/lib/queries/productions";
import { ProductionDetail } from "./production-detail";

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
    </div>
  );
}
