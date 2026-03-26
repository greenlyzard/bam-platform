"use client";

import { useState } from "react";
import Link from "next/link";

interface ClassItem {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  levels: string[] | null;
  enrolled: number;
  capacity: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ScheduleClient({ classes }: { classes: ClassItem[] }) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const todayDow = today.getDay();
  const currentMonday = getMonday(today);
  const monday = addDays(currentMonday, weekOffset * 7);

  const byDay: Record<number, ClassItem[]> = {};
  for (const cls of classes) {
    if (cls.dayOfWeek == null) continue;
    if (!byDay[cls.dayOfWeek]) byDay[cls.dayOfWeek] = [];
    byDay[cls.dayOfWeek].push(cls);
  }

  // Sort each day by start time
  for (const day of Object.keys(byDay)) {
    byDay[Number(day)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const totalClasses = classes.length;
  const weekLabel = `${formatDateShort(monday)} – ${formatDateShort(addDays(monday, 5))}`;
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">My Schedule</h1>
          <p className="mt-1 text-sm text-slate">
            {weekLabel} &middot; {totalClasses} class{totalClasses !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1 rounded-lg border border-silver p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-lavender text-white" : "text-slate hover:text-charcoal"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "grid" ? "bg-lavender text-white" : "text-slate hover:text-charcoal"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          &larr; Previous
        </button>
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-lavender hover:bg-lavender/10 transition-colors"
          >
            This Week
          </button>
        )}
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          Next &rarr;
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No classes assigned to your schedule.</p>
        </div>
      ) : viewMode === "list" || typeof window !== "undefined" ? (
        /* LIST VIEW */
        viewMode === "list" ? (
          <div className="space-y-6">
            {WEEK_DAYS.map((dow) => {
              const dayDate = addDays(monday, dow - 1);
              const isToday = isCurrentWeek && todayDow === dow;
              const dayClasses = byDay[dow] ?? [];

              return (
                <section key={dow}>
                  <h2
                    className={`text-base font-heading font-semibold mb-3 ${
                      isToday ? "text-lavender-dark" : "text-charcoal"
                    }`}
                  >
                    {DAY_NAMES[dow]}
                    <span className="ml-2 text-sm font-normal text-slate">{formatDateShort(dayDate)}</span>
                    {isToday && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark">
                        Today
                      </span>
                    )}
                  </h2>
                  {dayClasses.length > 0 ? (
                    <div className="space-y-2">
                      {dayClasses.map((cls) => (
                        <div key={cls.id} className="flex items-center gap-3 rounded-xl border border-silver bg-white p-3 hover:shadow-sm transition-shadow">
                          <Link href={`/teach/classes/${cls.id}/roster`} className="min-w-0 flex-1">
                            <p className="font-semibold text-charcoal text-sm truncate">{cls.name}</p>
                            <p className="text-xs text-slate">
                              {formatTime(cls.startTime)} – {formatTime(cls.endTime)}
                              {cls.room && <span className="text-mist"> &middot; {cls.room}</span>}
                              <span className="text-mist"> &middot; {cls.enrolled}/{cls.capacity}</span>
                            </p>
                          </Link>
                          {isToday && (
                            <Link
                              href={`/teach/classes/${cls.id}/attendance`}
                              className="shrink-0 inline-flex h-8 items-center rounded-lg bg-lavender/10 px-3 text-xs font-medium text-lavender-dark hover:bg-lavender/20 transition-colors"
                            >
                              Attendance
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-mist pl-1">No classes</p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          /* GRID VIEW */
          <div className="hidden md:grid grid-cols-6 gap-3">
            {WEEK_DAYS.map((dow) => {
              const dayDate = addDays(monday, dow - 1);
              const isToday = isCurrentWeek && todayDow === dow;
              const dayClasses = byDay[dow] ?? [];

              return (
                <div
                  key={dow}
                  className={`rounded-xl border border-silver p-3 min-h-[120px] ${
                    isToday ? "bg-lavender/5" : "bg-white"
                  }`}
                >
                  <p className={`text-xs font-semibold mb-2 ${isToday ? "text-lavender-dark" : "text-charcoal"}`}>
                    {DAY_NAMES[dow].slice(0, 3)} {formatDateShort(dayDate)}
                  </p>
                  <div className="space-y-2">
                    {dayClasses.map((cls) => (
                      <Link
                        key={cls.id}
                        href={`/teach/classes/${cls.id}/roster`}
                        className="block rounded-lg bg-lavender/10 p-2 hover:bg-lavender/20 transition-colors"
                      >
                        <p className="text-xs font-semibold text-charcoal truncate">{cls.name}</p>
                        <p className="text-[10px] text-slate">
                          {formatTime(cls.startTime)} – {formatTime(cls.endTime)}
                        </p>
                        <p className="text-[10px] text-mist">
                          {cls.room && `${cls.room} · `}{cls.enrolled}/{cls.capacity}
                        </p>
                      </Link>
                    ))}
                    {dayClasses.length === 0 && (
                      <p className="text-[10px] text-mist">No classes</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
