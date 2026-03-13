"use client";

import { useState, useEffect, useCallback } from "react";

interface Rehearsal {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  cast_groups: string[];
  notes: string | null;
  is_cancelled: boolean;
  production_id: string | null;
  productions?: { name: string } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GROUP_COLORS: Record<string, string> = {
  "Level 1": "bg-blue-100 text-blue-800",
  "Level 2": "bg-green-100 text-green-800",
  "Level 3": "bg-purple-100 text-purple-800",
  "Level 4": "bg-amber-100 text-amber-800",
  "Company": "bg-lavender/20 text-lavender-dark",
  "Competition": "bg-gold/20 text-gold-dark",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function RehearsalAdmin() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [castGroups, setCastGroups] = useState("");
  const [notes, setNotes] = useState("");

  const fetchRehearsals = useCallback(async () => {
    const res = await fetch("/api/rehearsals");
    if (res.ok) {
      const json = await res.json();
      setRehearsals(json.rehearsals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRehearsals();
  }, [fetchRehearsals]);

  function resetForm() {
    setTitle("");
    setDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("");
    setCastGroups("");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(r: Rehearsal) {
    setTitle(r.title);
    setDate(r.date);
    setStartTime(r.start_time.slice(0, 5));
    setEndTime(r.end_time.slice(0, 5));
    setLocation(r.location ?? "");
    setCastGroups(r.cast_groups.join(", "));
    setNotes(r.notes ?? "");
    setEditingId(r.id);
    setShowForm(true);
  }

  async function handleSave() {
    const body = {
      title,
      date,
      start_time: startTime,
      end_time: endTime,
      location,
      cast_groups: castGroups
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      notes,
    };

    if (editingId) {
      await fetch(`/api/rehearsals/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/rehearsals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    resetForm();
    await fetchRehearsals();
  }

  async function handleCancel(id: string, currentState: boolean) {
    await fetch(`/api/rehearsals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_cancelled: !currentState }),
    });
    await fetchRehearsals();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rehearsals/${id}`, { method: "DELETE" });
    await fetchRehearsals();
  }

  // Group by date
  const byDate: Record<string, Rehearsal[]> = {};
  for (const r of rehearsals) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-mist">Loading rehearsals...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add button + embed code */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
        >
          + Add Rehearsal
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h3 className="font-heading text-lg font-semibold text-charcoal">
            {editingId ? "Edit Rehearsal" : "New Rehearsal"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                placeholder="e.g., Act 1 Run-Through"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                placeholder="Studio A"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate">Cast Groups (comma-separated)</label>
              <input
                type="text"
                value={castGroups}
                onChange={(e) => setCastGroups(e.target.value)}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                placeholder="Level 3, Level 4, Company"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!title || !date}
              className="rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
            >
              {editingId ? "Update" : "Add"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-silver px-4 py-2 text-sm font-medium text-slate hover:bg-cloud transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rehearsal list grouped by date */}
      {Object.keys(byDate).length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No rehearsals scheduled yet.
        </div>
      ) : (
        Object.entries(byDate).map(([dateStr, items]) => {
          const d = new Date(dateStr + "T12:00:00");
          const dayName = DAYS[d.getDay()];
          const dateLabel = d.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          return (
            <div key={dateStr} className="space-y-2">
              <h3 className="text-sm font-semibold text-charcoal">
                {dayName}, {dateLabel}
              </h3>
              {items.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border bg-white p-4 flex items-start gap-4 ${
                    r.is_cancelled
                      ? "border-error/30 opacity-60"
                      : "border-silver"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium text-charcoal ${r.is_cancelled ? "line-through" : ""}`}>
                        {r.title}
                      </h4>
                      {r.is_cancelled && (
                        <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate">
                      {formatTime(r.start_time)} – {formatTime(r.end_time)}
                      {r.location && ` · ${r.location}`}
                    </p>
                    {r.cast_groups.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.cast_groups.map((g) => (
                          <span
                            key={g}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              GROUP_COLORS[g] ?? "bg-cloud text-slate"
                            }`}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.notes && (
                      <p className="mt-1 text-xs text-mist">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(r)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-charcoal hover:bg-cloud transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCancel(r.id, r.is_cancelled)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10 transition-colors"
                    >
                      {r.is_cancelled ? "Restore" : "Cancel"}
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-error hover:bg-error/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
