"use client";

import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function googleCalendarUrl(params: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
}): string {
  const dtStart = params.date.replace(/-/g, "") + "T" + params.startTime.replace(/:/g, "") + "00";
  const dtEnd = params.date.replace(/-/g, "") + "T" + params.endTime.replace(/:/g, "") + "00";
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.title);
  url.searchParams.set("dates", `${dtStart}/${dtEnd}`);
  if (params.location) url.searchParams.set("location", params.location);
  return url.toString();
}

function downloadICS(params: {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
}) {
  const dtStart = params.date.replace(/-/g, "") + "T" + params.startTime.replace(/:/g, "") + "00";
  const dtEnd = params.date.replace(/-/g, "") + "T" + params.endTime.replace(/:/g, "") + "00";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${params.id}@balletacademyandmovement.com`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${params.title}`,
    params.location ? `LOCATION:${params.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.title.replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  current_level: string | null;
}

interface ClassData {
  id: string;
  name: string;
  style: string | null;
  level: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  teacher_id: string | null;
  max_students: number | null;
  enrolled_count: number;
}

interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  classes: ClassData | null;
}

interface Instance {
  id: string;
  class_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  room_id: string | null;
  teacher_id: string | null;
  notes: string | null;
}

interface RecommendedClass extends ClassData {
  age_min: number | null;
  age_max: number | null;
}

interface Props {
  userId: string;
  students: Student[];
  enrollments: Enrollment[];
  instances: Instance[];
  teacherNames: Record<string, string>;
  roomNames: Record<string, string>;
  recommended: RecommendedClass[];
  hasPrivateLessons: boolean;
}

// ── Component ─────────────────────────────────────────────────

export function PortalScheduleView({
  userId,
  students,
  enrollments,
  instances,
  teacherNames,
  roomNames,
  recommended,
  hasPrivateLessons,
}: Props) {
  const [tab, setTab] = useState<"schedule" | "recommended">("schedule");
  const [view, setView] = useState<"month" | "list">("list");
  const [copied, setCopied] = useState(false);

  const calendarUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/portal/calendar?token=${userId}`;

  const handleCopyCalendarUrl = async () => {
    await navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map class_id → class info from enrollments
  const classMap: Record<string, ClassData> = {};
  const classToStudents: Record<string, string[]> = {};
  for (const e of enrollments) {
    if (e.classes) classMap[e.class_id] = e.classes;
    if (!classToStudents[e.class_id]) classToStudents[e.class_id] = [];
    classToStudents[e.class_id].push(e.student_id);
  }

  const studentMap: Record<string, Student> = {};
  for (const s of students) studentMap[s.id] = s;

  // ── List View ───────────────────────────────────────────────

  const renderListView = () => {
    // Group instances by date
    const byDate: Record<string, Instance[]> = {};
    for (const inst of instances) {
      if (!byDate[inst.event_date]) byDate[inst.event_date] = [];
      byDate[inst.event_date].push(inst);
    }
    const sortedDates = Object.keys(byDate).sort();

    if (sortedDates.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No upcoming classes found. Check back after enrollment!
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sortedDates.map((date) => {
          const d = new Date(date + "T00:00:00");
          const dateLabel = d.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          });

          return (
            <div key={date}>
              <h3 className="text-sm font-semibold text-charcoal mb-2">{dateLabel}</h3>
              <div className="space-y-2">
                {byDate[date].map((inst) => {
                  const cls = classMap[inst.class_id];
                  const enrolledStudents = (classToStudents[inst.class_id] ?? [])
                    .map((sid) => studentMap[sid])
                    .filter(Boolean);
                  const roomName = inst.room_id ? roomNames[inst.room_id] : cls?.room;
                  const teacher = inst.teacher_id ? teacherNames[inst.teacher_id] : cls?.teacher_id ? teacherNames[cls.teacher_id] : null;

                  return (
                    <div
                      key={inst.id}
                      className="rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-charcoal">{cls?.name ?? "Class"}</h4>
                          <p className="text-sm text-slate mt-0.5">
                            {formatTime(inst.start_time)} – {formatTime(inst.end_time)}
                            {roomName && ` · ${roomName}`}
                          </p>
                          {teacher && (
                            <p className="text-xs text-mist mt-0.5">
                              {teacher}
                            </p>
                          )}
                          {enrolledStudents.length > 0 && (
                            <p className="text-xs text-lavender-dark mt-1">
                              {enrolledStudents.map((s) => s.first_name).join(", ")}
                            </p>
                          )}
                          {inst.notes && (
                            <p className="text-xs text-mist mt-1 italic">{inst.notes}</p>
                          )}
                        </div>

                        {/* Add to Calendar */}
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={googleCalendarUrl({
                              title: cls?.name ?? "Class",
                              date: inst.event_date,
                              startTime: inst.start_time,
                              endTime: inst.end_time,
                              location: roomName ? `${roomName} - Ballet Academy and Movement` : undefined,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-silver px-2 py-1.5 text-xs text-slate hover:bg-cloud transition-colors"
                            title="Add to Google Calendar"
                          >
                            Google
                          </a>
                          <button
                            onClick={() =>
                              downloadICS({
                                id: inst.id,
                                title: cls?.name ?? "Class",
                                date: inst.event_date,
                                startTime: inst.start_time,
                                endTime: inst.end_time,
                                location: roomName ? `${roomName} - Ballet Academy and Movement` : undefined,
                              })
                            }
                            className="rounded-lg border border-silver px-2 py-1.5 text-xs text-slate hover:bg-cloud transition-colors"
                            title="Download .ics for Apple Calendar"
                          >
                            Apple
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Month View ──────────────────────────────────────────────

  const renderMonthView = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOffset = firstDay.getDay();
    const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Build date strings for this month
    const dates: string[] = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      dates.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
      );
    }

    // Group instances by date
    const byDate: Record<string, Instance[]> = {};
    for (const inst of instances) {
      if (!byDate[inst.event_date]) byDate[inst.event_date] = [];
      byDate[inst.event_date].push(inst);
    }

    // Also add weekly recurring classes that don't have instances yet
    // (They show as recurring classes on the enrollment view)

    const cells: Array<{ date: string | null }> = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push({ date: null });
    for (const d of dates) cells.push({ date: d });
    while (cells.length % 7 !== 0) cells.push({ date: null });

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return (
      <div>
        <div className="mb-3 text-center font-heading text-lg font-semibold text-charcoal">
          {monthLabel}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-xl border border-silver bg-silver overflow-hidden">
          {DAY_ABBR.map((dh) => (
            <div key={dh} className="bg-cloud px-2 py-1.5 text-center text-xs font-medium text-slate">
              {dh}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell.date) {
              return <div key={`empty-${i}`} className="min-h-[80px] bg-cream" />;
            }
            const dayInsts = byDate[cell.date] ?? [];
            const isToday = cell.date === todayStr;
            return (
              <div
                key={cell.date}
                className={`min-h-[80px] bg-white p-1 ${isToday ? "ring-2 ring-inset ring-lavender" : ""}`}
              >
                <div className={`mb-0.5 text-xs font-medium ${isToday ? "text-lavender" : "text-slate"}`}>
                  {parseInt(cell.date.split("-")[2], 10)}
                </div>
                <div className="space-y-0.5">
                  {dayInsts.slice(0, 3).map((inst) => {
                    const cls = classMap[inst.class_id];
                    return (
                      <div
                        key={inst.id}
                        className="rounded px-1 py-0.5 text-[10px] leading-tight bg-lavender/10 text-lavender-dark truncate"
                      >
                        {formatTime(inst.start_time)} {cls?.name ?? ""}
                      </div>
                    );
                  })}
                  {dayInsts.length > 3 && (
                    <div className="px-1 text-[10px] text-mist">+{dayInsts.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Recommended Tab ─────────────────────────────────────────

  const renderRecommended = () => {
    if (recommended.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No additional class recommendations right now.
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {recommended.map((cls) => {
          const teacher = cls.teacher_id ? teacherNames[cls.teacher_id] : null;
          const spotsLeft = cls.max_students ? cls.max_students - cls.enrolled_count : null;
          return (
            <div
              key={cls.id}
              className="rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {cls.level && (
                    <span className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark">
                      {cls.level}
                    </span>
                  )}
                  <h4 className="mt-1 font-semibold text-charcoal">{cls.name}</h4>
                  {cls.day_of_week != null && cls.start_time && (
                    <p className="text-sm text-slate mt-0.5">
                      {DAY_NAMES[cls.day_of_week]}s {formatTime(cls.start_time)}
                      {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                    </p>
                  )}
                  {teacher && <p className="text-xs text-mist mt-0.5">{teacher}</p>}
                  {cls.room && <p className="text-xs text-mist">{cls.room}</p>}
                  {spotsLeft != null && (
                    <p className={`text-xs mt-1 ${spotsLeft <= 3 ? "text-warning font-medium" : "text-mist"}`}>
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                    </p>
                  )}
                </div>
                <a
                  href={`/portal/enroll?class=${cls.id}`}
                  className="shrink-0 rounded-lg bg-lavender px-3 py-1.5 text-xs font-medium text-white hover:bg-lavender-dark transition-colors"
                >
                  Enroll
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Main Render ─────────────────────────────────────────────

  return (
    <>
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Schedule</h1>
        <p className="mt-1 text-sm text-slate">
          Your dancers&apos; upcoming classes and events.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-silver">
        <button
          onClick={() => setTab("schedule")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "schedule"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-slate"
          }`}
        >
          My Schedule
        </button>
        <button
          onClick={() => setTab("recommended")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "recommended"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-slate"
          }`}
        >
          Recommended Classes
          {recommended.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-lavender/15 px-1.5 text-xs text-lavender-dark">
              {recommended.length}
            </span>
          )}
        </button>
      </div>

      {tab === "schedule" && (
        <>
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-silver bg-white">
              <button
                onClick={() => setView("list")}
                className={`rounded-l-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "list" ? "bg-lavender text-white" : "text-slate hover:bg-cloud"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView("month")}
                className={`rounded-r-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "month" ? "bg-lavender text-white" : "text-slate hover:bg-cloud"
                }`}
              >
                Month
              </button>
            </div>

            {/* Subscribe to Calendar */}
            <button
              onClick={handleCopyCalendarUrl}
              className="rounded-lg border border-silver bg-white px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {copied ? "Copied!" : "Subscribe to Calendar"}
            </button>

            {/* Book a Private */}
            {hasPrivateLessons && (
              <a
                href="/portal/private-lessons"
                className="rounded-lg bg-gold/10 border border-gold/20 px-3 py-1.5 text-sm font-medium text-gold-dark hover:bg-gold/20 transition-colors flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Book a Private
              </a>
            )}
          </div>

          {/* Content */}
          {view === "list" ? renderListView() : renderMonthView()}
        </>
      )}

      {tab === "recommended" && renderRecommended()}
    </>
  );
}
