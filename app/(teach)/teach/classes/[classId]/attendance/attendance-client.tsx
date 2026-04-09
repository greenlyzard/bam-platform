"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  enrollmentStatus: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: string;
  notes: string | null;
}

interface Props {
  classId: string;
  className: string;
  students: Student[];
  existingRecords: AttendanceRecord[];
  tenantId: string;
  teacherId: string;
  preMarkedAbsences?: Record<string, string | null>;
}

type StatusType = "present" | "absent" | "late" | "excused";

const STATUS_CONFIG: Record<StatusType, { label: string; short: string; activeBg: string; inactiveBorder: string }> = {
  present: { label: "Present", short: "P", activeBg: "bg-success text-white", inactiveBorder: "border border-success/30 text-success" },
  absent: { label: "Absent", short: "A", activeBg: "bg-error text-white", inactiveBorder: "border border-error/30 text-error" },
  late: { label: "Late", short: "L", activeBg: "bg-gold text-white", inactiveBorder: "border border-gold/30 text-gold-dark" },
  excused: { label: "Excused", short: "E", activeBg: "bg-slate text-white", inactiveBorder: "border border-silver text-slate" },
};

const STATUSES: StatusType[] = ["present", "absent", "late", "excused"];

function buildInitialRecords(
  students: Student[],
  existing: AttendanceRecord[]
): Record<string, { status: string; notes: string }> {
  const map: Record<string, { status: string; notes: string }> = {};
  for (const s of students) {
    map[s.id] = { status: "", notes: "" };
  }
  for (const r of existing) {
    if (map[r.studentId] !== undefined) {
      map[r.studentId] = { status: r.status, notes: r.notes ?? "" };
    }
  }
  return map;
}

export function AttendanceClient({ classId, className, students, existingRecords, tenantId, teacherId, preMarkedAbsences = {} }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState(() => buildInitialRecords(students, existingRecords));
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordsForDate = useCallback(async (date: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("attendance_records")
      .select("id, student_id, status, notes")
      .eq("class_id", classId)
      .eq("date", date);

    const fetched = (data ?? []).map((r: any) => ({
      id: r.id,
      studentId: r.student_id,
      status: r.status,
      notes: r.notes,
    }));
    setRecords(buildInitialRecords(students, fetched));
  }, [classId, students]);

  useEffect(() => {
    if (selectedDate !== today) {
      fetchRecordsForDate(selectedDate);
    }
  }, [selectedDate, today, fetchRecordsForDate]);

  function toggleStatus(studentId: string, status: StatusType) {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId].status === status ? "" : status,
      },
    }));
    setSaved(false);
    setError(null);
  }

  function setNotes(studentId: string, notes: string) {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const toUpsert = Object.entries(records)
      .filter(([, r]) => r.status)
      .map(([studentId, r]) => ({
        tenant_id: tenantId,
        class_id: classId,
        student_id: studentId,
        teacher_id: teacherId,
        date: selectedDate,
        status: r.status,
        notes: r.notes || null,
      }));

    if (toUpsert.length === 0) {
      setSaving(false);
      setError("No attendance marked. Tap a status button for at least one student.");
      return;
    }

    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(toUpsert, { onConflict: "class_id,student_id,date" });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const markedCount = Object.values(records).filter((r) => r.status).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate">
        <Link href="/teach/classes" className="hover:text-charcoal transition-colors">My Classes</Link>
        <span>/</span>
        <Link href={`/teach/classes/${classId}/roster`} className="hover:text-charcoal transition-colors">Roster</Link>
        <span>/</span>
        <span className="text-charcoal">Attendance</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">{className}</h1>
          <p className="mt-1 text-sm text-slate">
            Mark attendance for {markedCount}/{students.length} students
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          min={minDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
        />
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No students enrolled in this class.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const initials = `${s.firstName[0]}${s.lastName[0]}`.toUpperCase();
            const rec = records[s.id];
            const showNotes = expandedNotes[s.id] ?? false;

            return (
              <div key={s.id} className="rounded-xl border border-silver bg-white p-3">
                <div className="flex items-center gap-3">
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender/10 text-sm font-semibold text-lavender-dark shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-charcoal text-sm truncate">
                      {s.firstName} {s.lastName}
                    </p>
                    {s.id in preMarkedAbsences && (
                      <p className="mt-0.5 text-[11px] font-medium text-slate">
                        <span className="inline-flex items-center rounded-full bg-lavender/10 px-1.5 py-0.5 text-lavender-dark">
                          Parent reported absence
                        </span>
                        {preMarkedAbsences[s.id] ? ` — ${preMarkedAbsences[s.id]}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {STATUSES.map((status) => {
                      const cfg = STATUS_CONFIG[status];
                      const isActive = rec?.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => toggleStatus(s.id, status)}
                          className={`h-10 w-10 rounded-lg font-semibold text-sm transition-colors ${
                            isActive ? cfg.activeBg : cfg.inactiveBorder
                          }`}
                          title={cfg.label}
                        >
                          {cfg.short}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setExpandedNotes((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                      className="h-10 w-10 rounded-lg border border-silver text-slate hover:text-charcoal text-sm font-medium transition-colors"
                      title="Add note"
                    >
                      +
                    </button>
                  </div>
                </div>
                {showNotes && (
                  <textarea
                    value={rec?.notes ?? ""}
                    onChange={(e) => setNotes(s.id, e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="mt-2 w-full rounded-md border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 resize-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {students.length > 0 && (
        <div className="sticky bottom-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-lavender px-6 py-3 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50 transition-colors shadow-lg"
          >
            {saving ? "Saving..." : saved ? "Saved \u2713" : "Save Attendance"}
          </button>
          {error && (
            <p className="mt-2 text-center text-sm text-error">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
