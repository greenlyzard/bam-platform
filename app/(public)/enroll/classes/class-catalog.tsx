"use client";

import { useState } from "react";
import {
  matchesLocationFilter,
  deriveLocationOptionsFromClasses,
} from "@/lib/locations/validate";

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
  startDate: string | null;
  room: string | null;
  locationId: string | null;
  locationName: string | null;
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

/** True when a class's term starts after today (upcoming, not yet begun). */
function isFutureStart(startDate: string | null): boolean {
  if (!startDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return startDate > today;
}

/** "August 14" from an ISO date; parsed as local to avoid a timezone off-by-one. */
function formatStartDate(startDate: string): string {
  const [y, m, d] = startDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export function ClassCatalog({
  classes,
  onEnroll,
  isInCart,
}: {
  classes: ClassInfo[];
  /**
   * When provided (returning-family flow), the Enroll/Waitlist button adds the
   * class to the cart via this callback instead of linking to /enroll?class=…
   * When omitted (the standalone catalog page), it links out as before.
   */
  onEnroll?: (classId: string) => void;
  /** In add-to-cart mode, whether a class is already in the cart (shows "Added ✓"). */
  isInCart?: (classId: string) => boolean;
}) {
  const [styleFilter, setStyleFilter] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [locationFilter, setLocationFilter] = useState("");

  const styles = [...new Set(classes.map((c) => c.style))];
  const days = [...new Set(classes.map((c) => c.dayOfWeek))].sort();

  // Location options are derived from the classes the parent can actually see, so a
  // studio with no visible classes (e.g. RSM today) never appears. Show the filter only
  // when 2+ locations have visible classes — a single-studio filter is noise.
  const locationOptions = deriveLocationOptionsFromClasses(classes);
  const showLocationFilter = locationOptions.length >= 2;

  let filtered = classes;
  if (styleFilter) filtered = filtered.filter((c) => c.style === styleFilter);
  if (dayFilter !== null)
    filtered = filtered.filter((c) => c.dayOfWeek === dayFilter);
  if (showLocationFilter && locationFilter)
    filtered = filtered.filter((c) => matchesLocationFilter(c.locationId, locationFilter));

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
      {/* Location filter — shown only when 2+ studios have visible classes */}
      {showLocationFilter && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLocationFilter("")}
            className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
              !locationFilter
                ? "bg-lavender text-white border-lavender"
                : "bg-white text-slate border-silver hover:border-lavender"
            }`}
          >
            All Locations
          </button>
          {locationOptions.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationFilter(locationFilter === loc.id ? "" : loc.id)}
              className={`h-9 rounded-full px-4 text-xs font-medium border transition-colors ${
                locationFilter === loc.id
                  ? "bg-lavender text-white border-lavender"
                  : "bg-white text-slate border-silver hover:border-lavender"
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-charcoal">
                      {cls.name}
                    </h4>
                    <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full">
                      {STYLE_LABELS[cls.style] ?? cls.style}
                    </span>
                    {isFutureStart(cls.startDate) && (
                      <span className="text-xs bg-lavender text-white px-2 py-0.5 rounded-full font-semibold">
                        Starts {formatStartDate(cls.startDate!)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate">
                    {formatTime(cls.startTime)}–{formatTime(cls.endTime)}
                    {cls.locationName && ` · ${cls.locationName}`}
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
                  {onEnroll ? (
                    isInCart?.(cls.id) ? (
                      <span className="h-9 rounded-lg bg-success/10 text-success text-xs font-semibold px-4 flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEnroll(cls.id)}
                        className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-4 flex items-center transition-colors"
                      >
                        {cls.isFull ? "Join Waitlist" : "Add to Cart"}
                      </button>
                    )
                  ) : (
                    <a
                      href={`/enroll?class=${cls.id}`}
                      className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-4 flex items-center transition-colors"
                    >
                      {cls.isFull ? "Waitlist" : "Enroll"}
                    </a>
                  )}
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
