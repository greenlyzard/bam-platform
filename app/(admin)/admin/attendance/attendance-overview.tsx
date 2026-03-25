"use client";

import { useState } from "react";
import Link from "next/link";
import { SimpleSelect } from "@/components/ui/select";

interface SessionRow {
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  dayLabel: string;
  startTime: string | null;
  endTime: string | null;
  date: string;
  attendanceTaken: boolean;
  presentCount: number;
  totalCount: number;
  hoursLogged: boolean;
}

interface Teacher {
  id: string;
  name: string;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function buildUrl(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  return `/admin/attendance?${search.toString()}`;
}

export function AttendanceOverview({
  rows,
  teachers,
  dateFrom,
  dateTo,
  filterTeacher,
}: {
  rows: SessionRow[];
  teachers: Teacher[];
  dateFrom: string;
  dateTo: string;
  filterTeacher: string;
}) {
  const [teacherFilter, setTeacherFilter] = useState(filterTeacher || "all");

  // Group rows by date
  const grouped: Record<string, SessionRow[]> = {};
  for (const row of rows) {
    if (!grouped[row.date]) grouped[row.date] = [];
    grouped[row.date].push(row);
  }
  const dates = Object.keys(grouped).sort();

  // Stats
  const totalSessions = rows.length;
  const attendanceTakenCount = rows.filter((r) => r.attendanceTaken).length;
  const hoursLoggedCount = rows.filter((r) => r.hoursLogged).length;
  const missingHours = rows.filter(
    (r) => r.attendanceTaken && !r.hoursLogged
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Attendance Overview
          </h1>
          <p className="mt-1 text-sm text-slate">
            Track attendance and verify teacher hours are logged.
          </p>
        </div>
        <Link
          href="/admin/timesheets"
          className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-sm font-medium text-charcoal px-4 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          Timesheets →
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wider">
            Sessions
          </p>
          <p className="mt-1 text-2xl font-semibold text-charcoal">
            {totalSessions}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wider">
            Attendance Taken
          </p>
          <p className="mt-1 text-2xl font-semibold text-success">
            {attendanceTakenCount}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wider">
            Hours Logged
          </p>
          <p className="mt-1 text-2xl font-semibold text-charcoal">
            {hoursLoggedCount}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wider">
            Missing Hours
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              missingHours > 0 ? "text-error" : "text-success"
            }`}
          >
            {missingHours}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-silver bg-white p-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              From
            </label>
            <input
              name="from"
              type="date"
              defaultValue={dateFrom}
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              To
            </label>
            <input
              name="to"
              type="date"
              defaultValue={dateTo}
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Teacher
            </label>
            <input type="hidden" name="teacher" value={teacherFilter === "all" ? "" : teacherFilter} />
            <SimpleSelect
              value={teacherFilter}
              onValueChange={setTeacherFilter}
              options={[
                { value: "all", label: "All Teachers" },
                ...teachers.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-lavender text-white text-sm font-medium px-4 hover:bg-lavender-dark transition-colors"
          >
            Apply
          </button>
          {filterTeacher && (
            <a
              href={buildUrl({ from: dateFrom, to: dateTo })}
              className="h-9 rounded-lg border border-silver text-slate text-sm px-4 hover:bg-cloud transition-colors inline-flex items-center"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Sessions table grouped by date */}
      {dates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No sessions scheduled in this date range.
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const dayRows = grouped[date];
            const dateObj = new Date(date + "T12:00:00");
            const dateLabel = dateObj.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={date}
                className="rounded-xl border border-silver bg-white overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-cloud/50 border-b border-silver">
                  <h3 className="text-sm font-semibold text-charcoal">
                    {dateLabel}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-silver/60">
                        <th className="px-4 py-2 text-left font-medium text-slate">
                          Class
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-slate">
                          Teacher
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-slate">
                          Time
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-slate">
                          Attendance
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-slate">
                          Hours Logged
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-silver/40">
                      {dayRows.map((row) => (
                        <tr
                          key={`${row.classId}-${row.date}`}
                          className="hover:bg-cloud/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-charcoal">
                            {row.className}
                          </td>
                          <td className="px-4 py-2.5 text-slate">
                            {row.teacherName}
                          </td>
                          <td className="px-4 py-2.5 text-slate whitespace-nowrap">
                            {row.startTime && row.endTime
                              ? `${formatTime12h(row.startTime)} – ${formatTime12h(row.endTime)}`
                              : row.startTime
                                ? formatTime12h(row.startTime)
                                : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.attendanceTaken ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                <span className="text-sm">✓</span>
                                {row.presentCount}/{row.totalCount}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-mist">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.hoursLogged ? (
                              <span
                                className="inline-flex items-center text-sm text-success"
                                title="Hours logged for this session"
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center text-sm text-error cursor-help"
                                title="No hours logged for this session"
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
