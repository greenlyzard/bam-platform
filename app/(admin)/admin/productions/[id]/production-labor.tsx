"use client";

interface LaborEntry {
  teacherName: string;
  employmentType: string;
  category: string;
  hours: number;
  rate: number;
}

interface ProductionLaborProps {
  productionName: string;
  entries: LaborEntry[];
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function ProductionLabor({
  productionName,
  entries,
}: ProductionLaborProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-6">
        <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">
          Labor Costs
        </h3>
        <p className="text-sm text-mist">
          No timesheet entries tagged to {productionName}.
        </p>
      </div>
    );
  }

  // Aggregate by teacher
  const teacherMap = new Map<
    string,
    {
      name: string;
      employmentType: string;
      hours: number;
      cost: number;
      categories: Map<string, { hours: number; cost: number }>;
    }
  >();

  for (const e of entries) {
    let teacher = teacherMap.get(e.teacherName);
    if (!teacher) {
      teacher = {
        name: e.teacherName,
        employmentType: e.employmentType,
        hours: 0,
        cost: 0,
        categories: new Map(),
      };
      teacherMap.set(e.teacherName, teacher);
    }
    teacher.hours += e.hours;
    teacher.cost += e.hours * e.rate;

    const cat = teacher.categories.get(e.category) ?? { hours: 0, cost: 0 };
    cat.hours += e.hours;
    cat.cost += e.hours * e.rate;
    teacher.categories.set(e.category, cat);
  }

  const teachers = Array.from(teacherMap.values()).sort(
    (a, b) => b.hours - a.hours
  );

  const totalHours = teachers.reduce((s, t) => s + t.hours, 0);
  const totalCost = teachers.reduce((s, t) => s + t.cost, 0);
  const w2Cost = teachers
    .filter((t) => t.employmentType === "w2")
    .reduce((s, t) => s + t.cost, 0);
  const contractorCost = teachers
    .filter((t) => t.employmentType === "1099")
    .reduce((s, t) => s + t.cost, 0);

  // Category breakdown
  const categoryTotals = new Map<string, { hours: number; cost: number }>();
  for (const t of teachers) {
    for (const [cat, data] of t.categories) {
      const prev = categoryTotals.get(cat) ?? { hours: 0, cost: 0 };
      prev.hours += data.hours;
      prev.cost += data.cost;
      categoryTotals.set(cat, prev);
    }
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-6 space-y-5">
      <h3 className="font-heading text-lg font-semibold text-charcoal">
        Labor Costs
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg bg-cloud/50 p-3">
          <div className="text-xs text-slate">Total Hours</div>
          <div className="text-lg font-semibold text-charcoal">
            {totalHours.toFixed(1)}
          </div>
        </div>
        <div className="rounded-lg bg-cloud/50 p-3">
          <div className="text-xs text-slate">Estimated Labor Cost</div>
          <div className="text-lg font-semibold text-charcoal">
            {formatCurrency(totalCost)}
          </div>
        </div>
        <div className="rounded-lg bg-cloud/50 p-3">
          <div className="text-xs text-slate">W-2 Cost</div>
          <div className="text-sm font-semibold text-charcoal">
            {formatCurrency(w2Cost)}
          </div>
        </div>
        <div className="rounded-lg bg-cloud/50 p-3">
          <div className="text-xs text-slate">1099 Cost</div>
          <div className="text-sm font-semibold text-charcoal">
            {formatCurrency(contractorCost)}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h4 className="text-sm font-medium text-charcoal mb-2">
          By Category
        </h4>
        <div className="flex flex-wrap gap-3">
          {Array.from(categoryTotals.entries()).map(([cat, data]) => (
            <div
              key={cat}
              className="rounded-lg border border-silver px-3 py-2 text-xs"
            >
              <span className="font-medium text-charcoal capitalize">
                {cat}
              </span>
              <span className="text-slate ml-2">
                {data.hours.toFixed(1)} hrs · {formatCurrency(data.cost)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Teacher breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver">
              <th className="pb-2 text-left font-medium text-slate">
                Teacher
              </th>
              <th className="pb-2 text-left font-medium text-slate">Type</th>
              <th className="pb-2 text-right font-medium text-slate">Hours</th>
              <th className="pb-2 text-right font-medium text-slate">
                Est. Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silver">
            {teachers.map((t) => (
              <tr key={t.name} className="hover:bg-cloud/30 transition-colors">
                <td className="py-2 font-medium text-charcoal">{t.name}</td>
                <td className="py-2 text-slate text-xs">
                  {t.employmentType === "1099" ? "1099" : "W-2"}
                </td>
                <td className="py-2 text-right text-charcoal">
                  {t.hours.toFixed(1)}
                </td>
                <td className="py-2 text-right font-medium text-charcoal">
                  {formatCurrency(t.cost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-silver">
              <td
                colSpan={2}
                className="py-2 font-semibold text-charcoal"
              >
                Total
              </td>
              <td className="py-2 text-right font-semibold text-charcoal">
                {totalHours.toFixed(1)}
              </td>
              <td className="py-2 text-right font-semibold text-charcoal">
                {formatCurrency(totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
