"use client";

import { useState } from "react";
import Link from "next/link";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

interface MyClass {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  room_id: string | null;
  enrolled_count: number;
  max_enrollment: number | null;
}

export function DashboardViewToggle({
  isTeacher,
  myClasses,
  roomMap,
  adminContent,
}: {
  isTeacher: boolean;
  myClasses: MyClass[];
  roomMap: Record<string, string>;
  adminContent: React.ReactNode;
}) {
  const [viewMode, setViewMode] = useState<"admin" | "teacher">("admin");

  if (!isTeacher) {
    return <>{adminContent}</>;
  }

  const today = new Date();
  const todayDow = today.getDay();
  const todayName = DAY_NAMES[todayDow];

  const todaysClasses = myClasses
    .filter((c) => c.day_of_week === todayDow)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const weekClasses = [1, 2, 3, 4, 5, 6, 0]
    .map((dow) => ({
      day: DAY_NAMES[dow],
      dow,
      classes: myClasses
        .filter((c) => c.day_of_week === dow)
        .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
    }))
    .filter((g) => g.classes.length > 0);

  function roomName(c: MyClass): string {
    if (c.room_id && roomMap[c.room_id]) return roomMap[c.room_id];
    return c.room ?? "";
  }

  return (
    <div className="space-y-8">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            {viewMode === "admin" ? "Studio Overview" : "My Classes"}
          </h1>
          <p className="mt-1 text-sm text-slate">
            Ballet Academy and Movement — San Clemente, CA
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setViewMode("admin")}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              viewMode === "admin"
                ? "bg-white shadow text-charcoal font-medium"
                : "text-mist hover:text-charcoal"
            }`}
          >
            Admin View
          </button>
          <button
            onClick={() => setViewMode("teacher")}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              viewMode === "teacher"
                ? "bg-white shadow text-charcoal font-medium"
                : "text-mist hover:text-charcoal"
            }`}
          >
            My Classes
          </button>
        </div>
      </div>

      {viewMode === "admin" ? (
        adminContent
      ) : (
        <div className="space-y-6">
          {/* Today's Classes */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
              Today — {todayName}
            </h2>
            {todaysClasses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-8 text-center">
                <p className="text-sm text-mist">No classes today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysClasses.map((c) => (
                  <div key={c.id} className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-charcoal">{c.name}</h3>
                      <p className="text-sm text-slate mt-0.5">
                        {c.start_time && formatTime(c.start_time)}
                        {c.end_time && ` – ${formatTime(c.end_time)}`}
                        {roomName(c) && <span className="text-mist"> · {roomName(c)}</span>}
                        <span className="text-mist"> · {c.enrolled_count}/{c.max_enrollment ?? "—"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/teach/classes/${c.id}/roster`}
                        className="h-8 rounded-lg border border-silver px-3 text-xs font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors inline-flex items-center"
                      >
                        Roster
                      </Link>
                      <Link
                        href={`/teach/classes/${c.id}/attendance`}
                        className="h-8 rounded-lg bg-lavender px-3 text-xs font-medium text-white hover:bg-lavender-dark transition-colors inline-flex items-center"
                      >
                        Attendance
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Weekly Overview */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">This Week</h2>
            <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
              {weekClasses.map((g) => (
                <div key={g.dow} className="px-4 py-3">
                  <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${g.dow === todayDow ? "text-lavender" : "text-mist"}`}>
                    {g.day} {g.dow === todayDow && "(Today)"}
                  </h4>
                  <div className="space-y-1">
                    {g.classes.map((c) => (
                      <Link
                        key={c.id}
                        href={`/teach/classes/${c.id}/roster`}
                        className="flex items-center justify-between text-sm hover:text-lavender transition-colors"
                      >
                        <span className="text-charcoal font-medium">{c.name}</span>
                        <span className="text-slate">
                          {c.start_time && formatTime(c.start_time)}
                          {c.end_time && ` – ${formatTime(c.end_time)}`}
                          {roomName(c) && ` · ${roomName(c)}`}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Links */}
          <section>
            <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">Quick Links</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickLink href="/teach/schedule" icon="▦" label="My Full Schedule" />
              <QuickLink href="/teach/timesheets" icon="◷" label="My Timesheets" />
              <QuickLink href="/teach/privates" icon="◇" label="My Privates" />
              <QuickLink href="/teach/dashboard" icon="→" label="Teacher Portal" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-silver bg-white p-4 text-center hover:border-lavender hover:shadow-sm transition-all"
    >
      <span className="text-xl text-lavender">{icon}</span>
      <span className="text-xs font-medium text-charcoal">{label}</span>
    </Link>
  );
}
