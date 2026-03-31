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

export function ScheduleClient({ classes, userId }: { classes: ClassItem[]; userId: string }) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCalSub, setShowCalSub] = useState(false);
  const [calSubData, setCalSubData] = useState<{
    feedUrl: string;
    googleUrl: string;
    outlookUrl: string;
  } | null>(null);
  const [calSubLoading, setCalSubLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubscribe() {
    if (calSubData) {
      setShowCalSub(true);
      return;
    }
    setCalSubLoading(true);
    const res = await fetch("/api/cal/subscribe", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCalSubData(data);
      setShowCalSub(true);
    }
    setCalSubLoading(false);
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubscribe}
            disabled={calSubLoading}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-xs font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors inline-flex items-center gap-1.5"
          >
            {calSubLoading ? "Loading..." : "Subscribe to Calendar"}
          </button>
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

      {/* Calendar Subscribe Modal */}
      {showCalSub && calSubData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCalSub(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-charcoal">Subscribe to My Schedule</h3>
              <button onClick={() => setShowCalSub(false)} className="text-slate hover:text-charcoal text-lg">✕</button>
            </div>
            <p className="text-sm text-mist">
              Your classes will automatically sync to your calendar app.
            </p>
            <div className="space-y-2">
              <a
                href={calSubData.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-4 py-2.5 border border-silver rounded-lg hover:bg-cloud/50 text-sm text-charcoal transition-colors"
              >
                <span>&#128197;</span> Add to Google Calendar
              </a>
              <a
                href={calSubData.feedUrl}
                className="flex items-center gap-2 w-full px-4 py-2.5 border border-silver rounded-lg hover:bg-cloud/50 text-sm text-charcoal transition-colors"
              >
                <span>&#127822;</span> Add to Apple Calendar
              </a>
              <a
                href={calSubData.outlookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-4 py-2.5 border border-silver rounded-lg hover:bg-cloud/50 text-sm text-charcoal transition-colors"
              >
                <span>&#128231;</span> Add to Outlook
              </a>
            </div>
            <div className="mt-2 p-2 bg-cloud/50 rounded-lg text-xs text-mist break-all flex items-start gap-2">
              <span className="flex-1">{calSubData.feedUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(calSubData.feedUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-lavender hover:text-lavender-dark shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
