"use client";

import { useState, useTransition } from "react";
import { submitAttendance } from "@/lib/schedule/actions";

type AttendanceStatus = "present" | "absent" | "tardy" | "excused";

interface StudentRecord {
  student_id: string;
  name: string;
  status: AttendanceStatus;
  notes: string;
  checkin_source: string;
  propagated_from_session_id: string | null;
  fromClassName?: string;
}

const STATUS_STYLES: Record<
  AttendanceStatus,
  { selected: string; label: string }
> = {
  present: {
    selected: "bg-[#5A9E6F]/10 text-[#5A9E6F] border-[#5A9E6F]/30",
    label: "Present",
  },
  absent: {
    selected: "bg-[#C45B5B]/10 text-[#C45B5B] border-[#C45B5B]/30",
    label: "Absent",
  },
  tardy: {
    selected: "bg-[#D4A843]/10 text-[#D4A843] border-[#D4A843]/30",
    label: "Tardy",
  },
  excused: {
    selected: "bg-[#5B8FC4]/10 text-[#5B8FC4] border-[#5B8FC4]/30",
    label: "Excused",
  },
};

const UNSELECTED = "bg-white text-[#5A5662] border-[#D4D1D8]";

export function CheckinForm({
  sessionId,
  sessionDate,
  students,
  existingAttendance,
  isLocked,
  backToBackStudents,
}: {
  sessionId: string;
  sessionDate: string;
  students: Array<{ id: string; name: string }>;
  existingAttendance: Array<{
    student_id: string;
    status: string;
    notes: string;
  }>;
  isLocked: boolean;
  backToBackStudents?: Array<{ student_id: string; fromClassName: string }>;
}) {
  const bbMap = new Map(
    (backToBackStudents ?? []).map((b) => [b.student_id, b.fromClassName])
  );

  const existingMap = new Map(
    existingAttendance.map((a) => [a.student_id, a])
  );

  const initialRecords: StudentRecord[] = students.map((s) => {
    const existing = existingMap.get(s.id);
    const isBB = bbMap.has(s.id);

    if (existing) {
      return {
        student_id: s.id,
        name: s.name,
        status: existing.status as AttendanceStatus,
        notes: existing.notes ?? "",
        checkin_source: "teacher_roster",
        propagated_from_session_id: null,
        fromClassName: isBB ? bbMap.get(s.id) : undefined,
      };
    }

    return {
      student_id: s.id,
      name: s.name,
      status: isBB ? "present" : "present",
      notes: "",
      checkin_source: isBB ? "propagated" : "teacher_roster",
      propagated_from_session_id: null,
      fromClassName: isBB ? bbMap.get(s.id) : undefined,
    };
  });

  const [records, setRecords] = useState<StudentRecord[]>(initialRecords);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if session date is in the future
  const today = new Date().toISOString().split("T")[0];
  const isFuture = sessionDate > today;

  function updateStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) =>
      prev.map((r) =>
        r.student_id === studentId ? { ...r, status } : r
      )
    );
  }

  function updateNotes(studentId: string, notes: string) {
    setRecords((prev) =>
      prev.map((r) =>
        r.student_id === studentId ? { ...r, notes } : r
      )
    );
  }

  function toggleNotes(studentId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await submitAttendance(
        sessionId,
        records.map((r) => ({
          student_id: r.student_id,
          status: r.status,
          notes: r.notes || undefined,
          checkin_source: r.checkin_source,
          propagated_from_session_id: r.propagated_from_session_id,
        }))
      );
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  const disabled = isLocked || isFuture || isPending;

  const statuses: AttendanceStatus[] = ["present", "absent", "tardy", "excused"];

  return (
    <div>
      <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
        Take Attendance
      </h2>

      {isLocked && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 mb-4">
          <p className="text-sm font-medium text-[#5A9E6F]">
            Attendance has been submitted and locked for this session.
          </p>
        </div>
      )}

      {isFuture && !isLocked && (
        <div className="rounded-lg bg-[#5B8FC4]/10 border border-[#5B8FC4]/20 px-4 py-3 mb-4">
          <p className="text-sm text-[#5B8FC4]">
            Attendance can only be submitted on or after the session date.
          </p>
        </div>
      )}

      {submitted && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 mb-4">
          <p className="text-sm font-medium text-[#5A9E6F]">
            Attendance submitted successfully.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 mb-4">
          <p className="text-sm text-[#C45B5B]">{errorMsg}</p>
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-8 text-center">
          <p className="text-sm text-[#9E99A7]">
            No students enrolled in this class.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[#D4D1D8] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F0EDF3]/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-[#5A5662]">
                    Student
                  </th>
                  <th className="px-4 py-3 font-medium text-[#5A5662]">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-[#5A5662] w-10">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4D1D8]">
                {records.map((record) => {
                  const notesOpen = expandedNotes.has(record.student_id);
                  return (
                    <tr key={record.student_id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#2D2A33]">
                          {record.name}
                        </p>
                        {record.fromClassName && (
                          <p className="text-xs text-[#5B8FC4] mt-0.5 flex items-center gap-1">
                            <span>&#8505;&#65039;</span>
                            Carried forward from {record.fromClassName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {statuses.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateStatus(record.student_id, s)}
                              disabled={disabled && !submitted}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                record.status === s
                                  ? STATUS_STYLES[s].selected
                                  : UNSELECTED
                              } ${disabled && !submitted ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                            >
                              {STATUS_STYLES[s].label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleNotes(record.student_id)}
                          disabled={disabled && !submitted}
                          className="text-xs text-[#5A5662] hover:text-[#2D2A33] transition-colors disabled:opacity-50"
                        >
                          {notesOpen ? "Close" : "Add"}
                        </button>
                        {notesOpen && (
                          <textarea
                            value={record.notes}
                            onChange={(e) =>
                              updateNotes(record.student_id, e.target.value)
                            }
                            disabled={disabled && !submitted}
                            placeholder="Add a note..."
                            rows={2}
                            className="mt-2 w-full rounded-lg border border-[#D4D1D8] px-3 py-2 text-xs text-[#2D2A33] placeholder-[#9E99A7] focus:outline-none focus:border-[#9C8BBF] disabled:opacity-50 disabled:bg-[#F0EDF3]"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Submit button */}
          <div className="mt-4 flex items-center justify-end gap-3">
            {!submitted && !isLocked && (
              <button
                onClick={handleSubmit}
                disabled={disabled}
                className="h-9 rounded-lg bg-[#9C8BBF] px-4 text-sm font-semibold text-white hover:bg-[#6B5A99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Submitting..." : "Submit Attendance"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
