"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  badge_color_hex: string | null;
  category_name: string;
  category_sort: number;
}

interface SkillRec {
  skill_id: string;
  status: string;
  awarded_at: string | null;
}

interface Data {
  activeSeason: { id: string; name: string } | null;
  level: string | null;
  skills: Skill[];
  records: SkillRec[];
}

const STATUS_LABEL: { [k: string]: string } = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
  mastered: "Mastered",
};

const STATUS_STYLE: { [k: string]: string } = {
  not_started: "bg-cloud text-mist",
  in_progress: "bg-gold/20 text-gold-dark",
  achieved: "bg-lavender/20 text-lavender-dark",
  mastered: "bg-success/20 text-success",
};

export function SkillsTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/skills`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <p className="text-sm text-mist">Loading skills…</p>;
  if (!data) return <p className="text-sm text-mist">No skills data.</p>;

  if (!data.activeSeason) {
    return (
      <p className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-slate">
        No active season set. Mark a season as active in Admin → Seasons.
      </p>
    );
  }

  if (!data.level) {
    return (
      <p className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-slate">
        Set this student&apos;s level in the Profile tab to view curriculum.
      </p>
    );
  }

  if (data.skills.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-slate">
        No curriculum loaded for &ldquo;{data.level}&rdquo; in {data.activeSeason.name}.
      </p>
    );
  }

  const statusMap = new Map<string, string>();
  for (const r of data.records) statusMap.set(r.skill_id, r.status);

  // Group by category
  const groups: { [k: string]: Skill[] } = {};
  const groupOrder: { name: string; sort: number }[] = [];
  for (const s of data.skills) {
    if (!groups[s.category_name]) {
      groups[s.category_name] = [];
      groupOrder.push({ name: s.category_name, sort: s.category_sort });
    }
    groups[s.category_name].push(s);
  }
  groupOrder.sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg text-charcoal">
            {data.activeSeason.name} · {data.level}
          </h2>
          <p className="text-xs text-mist">{data.skills.length} skills in curriculum</p>
        </div>
        <Link
          href={`/admin/students/${studentId}/profile`}
          className="rounded-md border border-silver px-3 py-1.5 text-xs font-semibold text-slate hover:bg-cloud"
        >
          Edit in full profile →
        </Link>
      </div>

      {groupOrder.map((g) => (
        <section key={g.name}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
            {g.name}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups[g.name].map((s) => {
              const status = statusMap.get(s.id) ?? "not_started";
              return (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-silver bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-charcoal">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-slate">{s.description}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      STATUS_STYLE[status] ?? "bg-cloud text-mist"
                    }`}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
