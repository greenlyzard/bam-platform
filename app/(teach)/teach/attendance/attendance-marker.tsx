"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { markAttendance, logHoursFromAttendance } from "./actions";
import type { AttendanceResult } from "./actions";

interface ClassOption {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string | null;
}

interface RosterStudent {
  id: string;
  student_id: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    current_level: string | null;
    medical_notes: string | null;
  } | null;
}

type AttendanceStatus = "present" | "absent" | "excused" | "late";

const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-success/10 text-success border-success/30",
  absent: "bg-error/10 text-error border-error/30",
  excused: "bg-info/10 text-info border-info/30",
  late: "bg-warning/10 text-warning border-warning/30",
};

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function AttendanceMarker({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state for timesheet prompt
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [timesheetDetails, setTimesheetDetails] = useState<
    AttendanceResult["classDetails"] | null
  >(null);
  const [loggingHours, setLoggingHours] = useState(false);

  // Use URL param to preselect class
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classParam = params.get("class");
    if (classParam && classes.some((c) => c.id === classParam)) {
      setSelectedClassId(classParam);
    }
  }, [classes]);

  const loadRoster = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/teach/roster?classId=${classId}&date=${date}`
      );
      const data = await res.json();
      if (data.roster) {
        setRoster(data.roster);
        const existing: Record<string, AttendanceStatus> = {};
        for (const rec of data.attendance ?? []) {
          existing[rec.student_id] = rec.status as AttendanceStatus;
        }
        const merged: Record<string, AttendanceStatus> = {};
        for (const r of data.roster) {
          const sid = r.students?.id ?? r.student_id;
          merged[sid] = existing[sid] ?? "present";
        }
        setAttendance(merged);
      }
    } catch {
      setError("Failed to load roster.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (selectedClassId) {
      loadRoster(selectedClassId);
    }
  }, [selectedClassId, date, loadRoster]);

  function toggleStatus(studentId: string) {
    const order: AttendanceStatus[] = [
      "present",
      "absent",
      "late",
      "excused",
    ];
    const current = attendance[studentId] ?? "present";
    const next = order[(order.indexOf(current) + 1) % order.length];
    setAttendance((prev) => ({ ...prev, [studentId]: next }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const records = Object.entries(attendance).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    const result = await markAttendance({
      classId: selectedClassId,
      date,
      records,
    });

    setSaving(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Attendance saved.");

      // Show timesheet prompt if hours haven't been logged yet
      if (result.classDetails && !result.classDetails.alreadyLogged) {
        setTimesheetDetails(result.classDetails);
        setShowTimesheetModal(true);
      }
    }
  }

  async function handleLogHours() {
    if (!timesheetDetails) return;
    setLoggingHours(true);

    const result = await logHoursFromAttendance({
      classId: timesheetDetails.classId,
      className: timesheetDetails.className,
      date: timesheetDetails.date,
      startTime: timesheetDetails.startTime,
      endTime: timesheetDetails.endTime,
      hours: timesheetDetails.hours,
    });

    setLoggingHours(false);

    if (result?.error) {
      setError(result.error);
      setShowTimesheetModal(false);
    } else {
      setShowTimesheetModal(false);
      router.push("/teach/timesheets");
    }
  }

  function handleSkipHours() {
    setShowTimesheetModal(false);
    setTimesheetDetails(null);
  }

  return (
    <div className="space-y-4">
      {/* Class + Date selectors */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="classSelect"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Class
          </label>
          <select
            id="classSelect"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          >
            <option value="">Select a class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="dateSelect"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Date
          </label>
          <input
            id="dateSelect"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      {success && !showTimesheetModal && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-silver bg-white p-6 text-center text-sm text-mist">
          Loading roster...
        </div>
      )}

      {/* No class selected */}
      {!selectedClassId && !loading && (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center">
          <span className="text-3xl text-mist">●</span>
          <p className="mt-2 text-sm text-slate">
            Select a class to mark attendance.
          </p>
        </div>
      )}

      {/* Roster */}
      {selectedClassId && !loading && roster.length === 0 && (
        <div className="rounded-xl border border-silver bg-white p-6 text-center text-sm text-mist">
          No students enrolled in this class.
        </div>
      )}

      {selectedClassId && !loading && roster.length > 0 && (
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {roster.map((r) => {
            const student = r.students;
            if (!student) return null;
            const status = attendance[student.id] ?? "present";

            return (
              <div
                key={student.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-charcoal truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  {student.current_level && (
                    <p className="text-xs text-mist">
                      {student.current_level.replace("_", " ")}
                    </p>
                  )}
                  {student.medical_notes && (
                    <p className="text-xs text-warning mt-0.5 truncate">
                      Medical: {student.medical_notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleStatus(student.id)}
                  className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${statusStyles[status]}`}
                >
                  {status}
                </button>
              </div>
            );
          })}

          {/* Save button */}
          <div className="px-4 py-3 bg-cloud/30">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>
      )}

      {/* Feature 1 — Timesheet prompt modal */}
      {showTimesheetModal && timesheetDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-heading font-semibold text-charcoal">
                Log Hours for This Session?
              </h2>
              <p className="mt-1 text-sm text-slate">
                Would you like to log a timesheet entry for the class you just
                took attendance for?
              </p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="rounded-lg bg-cloud/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate">Class</span>
                  <span className="font-medium text-charcoal">
                    {timesheetDetails.className}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Date</span>
                  <span className="font-medium text-charcoal">
                    {new Date(
                      timesheetDetails.date + "T12:00:00"
                    ).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {timesheetDetails.startTime && timesheetDetails.endTime && (
                  <div className="flex justify-between">
                    <span className="text-slate">Time</span>
                    <span className="font-medium text-charcoal">
                      {formatTime12h(timesheetDetails.startTime)} –{" "}
                      {formatTime12h(timesheetDetails.endTime)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-silver pt-2">
                  <span className="text-slate font-medium">Hours</span>
                  <span className="font-semibold text-lavender-dark text-base">
                    {timesheetDetails.hours.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={handleSkipHours}
                className="flex-1 h-10 rounded-lg border border-silver bg-white text-sm font-medium text-slate hover:bg-cloud transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleLogHours}
                disabled={loggingHours}
                className="flex-1 h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loggingHours ? "Logging..." : "Log Hours"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
