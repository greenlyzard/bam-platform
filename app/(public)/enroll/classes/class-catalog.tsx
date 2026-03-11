"use client";

import { useState } from "react";

interface ClassInfo {
  id: string;
  name: string;
  style: string;
  level: string;
  description: string | null;
  ageMin: number | null;
  ageMax: number | null;
  maxStudents: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacherName: string | null;
  activeCount: number;
  spotsRemaining: number;
  isFull: boolean;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STYLE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  pre_ballet: "Pre-Ballet",
  creative_movement: "Creative Movement",
  pointe: "Pointe",
  jazz: "Jazz",
  contemporary: "Contemporary",
  lyrical: "Lyrical",
  musical_theatre: "Musical Theatre",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function ClassCatalog({ classes }: { classes: ClassInfo[] }) {
  const [styleFilter, setStyleFilter] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  const styles = [...new Set(classes.map((c) => c.style))];
  const days = [...new Set(classes.map((c) => c.dayOfWeek))].sort();

  let filtered = classes;
  if (styleFilter) filtered = filtered.filter((c) => c.style === styleFilter);
  if (dayFilter !== null)
    filtered = filtered.filter((c) => c.dayOfWeek === dayFilter);

  // Group by day
  const grouped = new Map<number, ClassInfo[]>();
  for (const cls of filtered) {
    const existing = grouped.get(cls.dayOfWeek) ?? [];
    existing.push(cls);
    grouped.set(cls.dayOfWeek, existing);
  }

  // Monday-first sort
  const sortedDays = [...grouped.keys()].sort(
    (a, b) => ((a + 6) % 7) - ((b + 6) % 7)
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStyleFilter("")}
          className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
            !styleFilter
              ? "bg-lavender text-white border-lavender"
              : "bg-white text-slate border-silver hover:border-lavender"
          }`}
        >
          All Styles
        </button>
        {styles.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyleFilter(styleFilter === s ? "" : s)}
            className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
              styleFilter === s
                ? "bg-lavender text-white border-lavender"
                : "bg-white text-slate border-silver hover:border-lavender"
            }`}
          >
            {STYLE_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDayFilter(null)}
          className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
            dayFilter === null
              ? "bg-lavender text-white border-lavender"
              : "bg-white text-slate border-silver hover:border-lavender"
          }`}
        >
          All Days
        </button>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDayFilter(dayFilter === d ? null : d)}
            className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
              dayFilter === d
                ? "bg-lavender text-white border-lavender"
                : "bg-white text-slate border-silver hover:border-lavender"
            }`}
          >
            {DAYS[d]}
          </button>
        ))}
      </div>

      {/* Results */}
      {sortedDays.length === 0 && (
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-slate">
            No classes match your filters. Try adjusting your selection.
          </p>
        </div>
      )}

      {sortedDays.map((day) => (
        <div key={day}>
          <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">
            {DAYS[day]}
          </h3>
          <div className="space-y-3">
            {grouped.get(day)!.map((cls) => (
              <div
                key={cls.id}
                className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-charcoal">
                      {cls.name}
                    </h4>
                    <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full">
                      {STYLE_LABELS[cls.style] ?? cls.style}
                    </span>
                  </div>
                  <p className="text-xs text-slate">
                    {formatTime(cls.startTime)}–{formatTime(cls.endTime)}
                    {cls.teacherName && ` · ${cls.teacherName}`}
                    {cls.ageMin && ` · Ages ${cls.ageMin}–${cls.ageMax ?? "up"}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {cls.isFull ? (
                    <span className="text-xs text-warning font-medium">
                      Waitlist
                    </span>
                  ) : (
                    <span className="text-xs text-success font-medium">
                      {cls.spotsRemaining} spot
                      {cls.spotsRemaining !== 1 ? "s" : ""}
                    </span>
                  )}
                  <a
                    href={`/enroll?class=${cls.id}`}
                    className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-4 flex items-center transition-colors"
                  >
                    {cls.isFull ? "Waitlist" : "Enroll"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* CTA */}
      <div className="text-center pt-4">
        <p className="text-sm text-slate mb-2">
          Not sure which class is right? We can help.
        </p>
        <a
          href="/enroll"
          className="inline-flex h-11 items-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors"
        >
          Take the Class Quiz
        </a>
      </div>
    </div>
  );
}
