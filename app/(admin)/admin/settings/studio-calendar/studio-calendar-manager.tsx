"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Closure {
  id: string;
  closed_date: string;
  reason: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
}

function getAffectedCount(closedDate: string, classes: ClassInfo[]): number {
  const date = new Date(closedDate + "T12:00:00");
  const dayOfWeek = date.getDay();
  return classes.filter((c) => {
    if (!c.start_date || !c.end_date || !c.days_of_week) return false;
    const start = new Date(c.start_date + "T00:00:00");
    const end = new Date(c.end_date + "T23:59:59");
    return date >= start && date <= end && c.days_of_week.includes(dayOfWeek);
  }).length;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StudioCalendarManager({
  initialData,
  classes,
  tenantId,
}: {
  initialData: Closure[];
  classes: ClassInfo[];
  tenantId: string;
}) {
  const [closures, setClosures] = useState<Closure[]>(initialData);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "range">("single");
  const [newDate, setNewDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const supabase = createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const flash = useCallback((msg: string, isError = false) => {
    setMessage((isError ? "Error: " : "") + msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const upcoming = closures.filter((c) => c.closed_date >= todayStr);
  const past = closures.filter((c) => c.closed_date < todayStr);

  async function addClosure() {
    if (!newDate) return;
    setSaving(true);

    if (closures.some((c) => c.closed_date === newDate)) {
      flash("A closure already exists for this date", true);
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("studio_closures")
      .insert({
        tenant_id: tenantId,
        closed_date: newDate,
        reason: newReason.trim() || null,
      })
      .select()
      .single();

    if (error) {
      flash(error.message, true);
    } else if (data) {
      const updated = [...closures, data].sort((a, b) =>
        a.closed_date.localeCompare(b.closed_date)
      );
      setClosures(updated);
      setNewDate("");
      setNewReason("");
      setShowAdd(false);
      flash("Closure added");
    }
    setSaving(false);
  }

  async function addRange() {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      flash("Invalid date range", true);
      return;
    }
    setSaving(true);

    const dates: string[] = [];
    const current = new Date(rangeStart + "T12:00:00");
    const end = new Date(rangeEnd + "T12:00:00");
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      if (!closures.some((c) => c.closed_date === dateStr)) {
        dates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    if (dates.length === 0) {
      flash("All dates in range already have closures", true);
      setSaving(false);
      return;
    }

    const rows = dates.map((d) => ({
      tenant_id: tenantId,
      closed_date: d,
      reason: newReason.trim() || null,
    }));

    const { data, error } = await supabase
      .from("studio_closures")
      .insert(rows)
      .select();

    if (error) {
      flash(error.message, true);
    } else if (data) {
      const updated = [...closures, ...data].sort((a, b) =>
        a.closed_date.localeCompare(b.closed_date)
      );
      setClosures(updated);
      setRangeStart("");
      setRangeEnd("");
      setNewReason("");
      setShowAdd(false);
      flash(`${data.length} closure date${data.length !== 1 ? "s" : ""} added`);
    }
    setSaving(false);
  }

  async function deleteClosure(id: string) {
    const { error } = await supabase
      .from("studio_closures")
      .delete()
      .eq("id", id);

    if (!error) {
      setClosures(closures.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
      flash("Closure removed");
    }
  }

  const affectedWarning = newDate ? getAffectedCount(newDate, classes) : 0;

  function renderClosureRow(closure: Closure) {
    const affected = getAffectedCount(closure.closed_date, classes);
    const isPast = closure.closed_date < todayStr;
    return (
      <div
        key={closure.id}
        className={`flex items-center gap-3 px-4 py-3 ${isPast ? "opacity-60" : ""}`}
      >
        <div className="flex-1">
          <p className="text-sm font-medium text-charcoal">
            {formatDate(closure.closed_date)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {closure.reason && (
              <span className="text-xs text-mist">{closure.reason}</span>
            )}
            {affected > 0 && !isPast && (
              <span className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                {affected} session{affected !== 1 ? "s" : ""} affected
              </span>
            )}
          </div>
        </div>

        {confirmDeleteId === closure.id ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteClosure(closure.id)}
              className="rounded-lg bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="rounded-lg bg-cloud px-2 py-1 text-xs text-charcoal hover:bg-silver"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeleteId(closure.id)}
            className="text-mist hover:text-red-500 transition-colors text-sm"
            title="Delete closure"
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.startsWith("Error:")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Upcoming closures */}
      <div>
        <h3 className="text-xs font-semibold text-mist uppercase tracking-wide mb-2">
          Upcoming Closures ({upcoming.length})
        </h3>
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {upcoming.length === 0 && (
            <div className="p-6 text-center text-sm text-mist">
              No upcoming closure dates. The studio is open every scheduled day.
            </div>
          )}
          {upcoming.map(renderClosureRow)}
        </div>
      </div>

      {/* Past closures (collapsible) */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="text-xs font-semibold text-mist uppercase tracking-wide mb-2 hover:text-charcoal transition-colors flex items-center gap-1"
          >
            <span className={`transition-transform ${showPast ? "rotate-90" : ""}`}>&#9654;</span>
            Past Closures ({past.length})
          </button>
          {showPast && (
            <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
              {past.map(renderClosureRow)}
            </div>
          )}
        </div>
      )}

      {/* Add closure */}
      {showAdd ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-charcoal">Add Closure</p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setAddMode("single")}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  addMode === "single"
                    ? "bg-white shadow text-charcoal font-medium"
                    : "text-mist hover:text-charcoal"
                }`}
              >
                Single Date
              </button>
              <button
                onClick={() => setAddMode("range")}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  addMode === "range"
                    ? "bg-white shadow text-charcoal font-medium"
                    : "text-mist hover:text-charcoal"
                }`}
              >
                Date Range
              </button>
            </div>
          </div>

          {addMode === "single" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-mist mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mist mb-1">Reason</label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Spring Break, Holiday"
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  onKeyDown={(e) => { if (e.key === "Enter") addClosure(); }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-mist mb-1">Start Date</label>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mist mb-1">End Date</label>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mist mb-1">Reason</label>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Spring Break"
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  />
                </div>
              </div>
              {rangeStart && rangeEnd && rangeStart <= rangeEnd && (
                <p className="text-xs text-mist">
                  {Math.ceil((new Date(rangeEnd + "T12:00:00").getTime() - new Date(rangeStart + "T12:00:00").getTime()) / 86400000) + 1} days
                </p>
              )}
            </div>
          )}

          {addMode === "single" && affectedWarning > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This date affects {affectedWarning} scheduled session{affectedWarning !== 1 ? "s" : ""}.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={addMode === "single" ? addClosure : addRange}
              disabled={saving || (addMode === "single" ? !newDate : !rangeStart || !rangeEnd)}
              className="rounded-lg bg-lavender px-4 py-2 text-sm text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : addMode === "single" ? "Add Closure" : "Add Date Range"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewDate("");
                setRangeStart("");
                setRangeEnd("");
                setNewReason("");
              }}
              className="rounded-lg bg-cloud px-4 py-2 text-sm text-charcoal hover:bg-silver"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border border-dashed border-silver bg-white p-4 text-sm text-lavender hover:border-lavender hover:bg-lavender/5 transition-colors"
        >
          + Add Closure
        </button>
      )}
    </div>
  );
}
