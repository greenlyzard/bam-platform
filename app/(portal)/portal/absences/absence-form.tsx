"use client";

import { useEffect, useState } from "react";

interface Student {
  id: string;
  name: string;
}

interface UpcomingClass {
  schedule_instance_id: string;
  class_id: string;
  class_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
}

function formatWhen(date: string, time: string) {
  const d = new Date(`${date}T${time}`);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AbsenceForm({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setSelected(new Set());
    fetch(`/api/portal/absences/upcoming-classes?student_id=${studentId}`)
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      setError("Select at least one class");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          schedule_instance_ids: Array.from(selected),
          parent_note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSuccess(true);
      setSelected(new Set());
      setNote("");
      // Refresh upcoming list
      const r = await fetch(`/api/portal/absences/upcoming-classes?student_id=${studentId}`);
      const d = await r.json();
      setClasses(d.classes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-6 text-center text-sm text-slate">
        No active dancers on your account.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {students.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-charcoal">Dancer</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="h-12 w-full appearance-none rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-charcoal">
          Upcoming classes (next 14 days)
        </label>
        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-mist">
            No upcoming classes to report.
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map((c) => {
              const checked = selected.has(c.schedule_instance_id);
              return (
                <button
                  key={c.schedule_instance_id}
                  type="button"
                  onClick={() => toggle(c.schedule_instance_id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                    checked
                      ? "border-lavender bg-lavender/5"
                      : "border-silver bg-white hover:border-lavender/40"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-charcoal">{c.class_name}</p>
                    <p className="text-sm text-slate">
                      {formatWhen(c.event_date, c.start_time)}
                    </p>
                  </div>
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      checked ? "border-lavender bg-lavender text-white" : "border-silver"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-charcoal">
          Note for teacher (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Doctor appointment"
          className="w-full rounded-md border border-silver px-3 py-2 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {success && (
        <p className="text-sm text-success">
          ✓ Your teacher has been notified. See you next time!
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || selected.size === 0}
        className="h-12 w-full rounded-xl bg-lavender text-base font-semibold text-white shadow-lg transition-colors hover:bg-lavender-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : `Confirm Absence${selected.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
