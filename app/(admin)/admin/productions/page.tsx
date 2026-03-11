import { getAllProductions } from "@/lib/queries/productions";
import { ProductionList } from "./production-list";

export const metadata = {
  title: "Productions — Studio Admin",
};

export default async function ProductionsPage() {
  const productions = await getAllProductions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">
            Productions
          </h1>
          <p className="mt-1 text-sm text-slate">
            Manage recitals, competitions, showcases, and workshops.
          </p>
        </div>
        <a
          href="/admin/productions/new"
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors"
        >
          New Production
        </a>
      </div>

      <ProductionList productions={productions} />
    </div>
  );
}
