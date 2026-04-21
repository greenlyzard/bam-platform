"use client";

import { useEffect, useState } from "react";

interface RehearsalEntry {
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
}

interface Production {
  id: string;
  name: string;
  season: string | null;
  performance_date: string | null;
  rehearsals: RehearsalEntry[];
  total: number;
  present: number;
  rate: number;
}

const STATUS_PILL: Record<string, string> = {
  present: "bg-success/20 text-success",
  absent: "bg-error/20 text-error",
  excused: "bg-gold/20 text-gold-dark",
  late: "bg-warning/20 text-warning",
};

export function PerformanceTab({ studentId }: { studentId: string }) {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/rehearsal-attendance`)
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .finally(() => setLoading(false));
  }, [studentId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) return <p className="text-sm text-mist">Loading performance history…</p>;

  if (productions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white/50 p-8 text-center text-sm text-mist">
        No rehearsal history yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {productions.map((p) => {
        const isOpen = expanded.has(p.id);
        return (
          <article key={p.id} className="rounded-xl border border-silver bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg">🎭</span>
              <h3 className="font-heading text-base font-semibold text-charcoal">{p.name}</h3>
            </div>
            <p className="mt-1 text-xs text-slate">
              {p.season ?? ""}
              {p.performance_date ? ` · ${new Date(p.performance_date).toLocaleDateString()}` : ""}
            </p>

            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-charcoal">
                Rehearsals: <span className="font-semibold">{p.present}</span> of{" "}
                <span className="font-semibold">{p.total}</span> attended
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  p.rate >= 90
                    ? "bg-success/10 text-success"
                    : p.rate >= 75
                      ? "bg-gold/10 text-gold-dark"
                      : "bg-error/10 text-error"
                }`}
              >
                {p.rate}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => toggle(p.id)}
              className="mt-2 text-xs font-medium text-lavender hover:text-lavender-dark"
            >
              {isOpen ? "Hide breakdown" : "Show breakdown"}
            </button>

            {isOpen && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-mist uppercase">
                    <tr>
                      <th className="pb-1 pr-4">Date</th>
                      <th className="pb-1 pr-4">Status</th>
                      <th className="pb-1">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver/50">
                    {p.rehearsals.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-4 text-charcoal">
                          {new Date(r.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-1.5 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              STATUS_PILL[r.status] ?? "bg-cloud text-slate"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-1.5 text-slate">{r.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
