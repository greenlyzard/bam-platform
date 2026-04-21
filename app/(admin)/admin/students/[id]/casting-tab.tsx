"use client";

import { useEffect, useState } from "react";

interface Role {
  id: string;
  role: string;
  is_alternate: boolean;
  music_title: string | null;
  costume_notes: string | null;
  notes: string | null;
}

interface Production {
  id: string;
  name: string;
  production_type: string;
  season: string | null;
  performance_date: string | null;
  roles: Role[];
}

const TYPE_BADGE: Record<string, string> = {
  recital: "bg-lavender/10 text-lavender-dark",
  competition: "bg-gold/20 text-gold-dark",
  showcase: "bg-success/10 text-success",
};

export function CastingTab({ studentId }: { studentId: string }) {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/casting`)
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <p className="text-sm text-mist">Loading casting history…</p>;

  if (productions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white/50 p-8 text-center text-sm text-mist">
        No casting history yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {productions.map((p) => (
        <article key={p.id} className="rounded-xl border border-silver bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">🩰</span>
            <h3 className="font-heading text-base font-semibold text-charcoal">{p.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                TYPE_BADGE[p.production_type] ?? "bg-cloud text-slate"
              }`}
            >
              {p.production_type}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate">
            {p.season ?? ""}
            {p.performance_date ? ` · ${new Date(p.performance_date).toLocaleDateString()}` : ""}
          </p>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-charcoal">Roles</p>
            <ul className="space-y-1 pl-1">
              {p.roles.map((r) => (
                <li key={r.id} className="flex items-start gap-1.5 text-sm text-charcoal">
                  <span className="text-mist">•</span>
                  <span>
                    <span className="font-medium">{r.role}</span>
                    {r.music_title && (
                      <span className="text-slate"> — {r.music_title}</span>
                    )}
                    {r.is_alternate && (
                      <span className="ml-1.5 rounded bg-gold/20 px-1 py-0.5 text-[10px] font-semibold text-gold-dark">
                        Alternate
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {p.roles.some((r) => r.costume_notes) && (
            <p className="mt-2 text-xs text-slate">
              <span className="font-semibold">Costume:</span>{" "}
              {p.roles.map((r) => r.costume_notes).filter(Boolean).join("; ")}
            </p>
          )}
          {p.roles.some((r) => r.notes) && (
            <p className="mt-1 text-xs text-slate">
              <span className="font-semibold">Notes:</span>{" "}
              {p.roles.map((r) => r.notes).filter(Boolean).join("; ")}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
