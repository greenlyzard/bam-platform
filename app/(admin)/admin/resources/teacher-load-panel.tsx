"use client";

import type { TeacherLoad } from "@/lib/resources/types";

const STATUS_COLORS: Record<string, string> = {
  balanced: "bg-success",
  approaching_max: "bg-warning",
  over_max: "bg-error",
  underloaded: "bg-slate/30",
};

const STATUS_LABELS: Record<string, string> = {
  balanced: "Balanced",
  approaching_max: "Near Max",
  over_max: "Over Max",
  underloaded: "Low Hours",
};

export function TeacherLoadPanel({ loads }: { loads: TeacherLoad[] }) {
  if (loads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
        No teachers with scheduled hours.
      </div>
    );
  }

  // Sort: over_max first, then approaching_max, then underloaded, then balanced
  const sortOrder: Record<string, number> = {
    over_max: 0,
    approaching_max: 1,
    underloaded: 2,
    balanced: 3,
  };
  const sorted = [...loads].sort(
    (a, b) => (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4)
  );

  return (
    <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
      {sorted.map((load) => {
        const name = [load.teacher.firstName, load.teacher.lastName]
          .filter(Boolean)
          .join(" ");
        const barWidth = Math.min(load.utilizationPercent, 100);
        const barColor = STATUS_COLORS[load.status] ?? "bg-slate";

        return (
          <div key={load.teacher.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-charcoal">
                  {name || "Unnamed Teacher"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate">
                  {load.scheduledHours}h / {load.maxHours}h
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    load.status === "over_max"
                      ? "bg-error/10 text-error"
                      : load.status === "approaching_max"
                        ? "bg-warning/10 text-warning"
                        : load.status === "underloaded"
                          ? "bg-cloud text-mist"
                          : "bg-success/10 text-success"
                  }`}
                >
                  {STATUS_LABELS[load.status] ?? load.status}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-cloud overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {/* Classes list */}
            {load.classes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {load.classes.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded bg-cloud px-1.5 py-0.5 text-[10px] text-slate"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
