"use client";

import { useState, useRef, useEffect } from "react";

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  period: string | null;
  year: number | null;
  is_active: boolean | null;
  is_public: boolean | null;
  is_ongoing: boolean;
  registration_open: boolean | null;
  display_priority: number;
}

type FormState = Partial<Season> & { open: boolean };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SeasonsManager({ initialSeasons }: { initialSeasons: Season[] }) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [form, setForm] = useState<FormState>({ open: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  useEffect(() => {
    if (form.open) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }, [form.open, form.id]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        const res = await fetch(`/api/admin/seasons/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            start_date: form.start_date,
            end_date: form.end_date,
            period: form.period || null,
            year: form.year ?? null,
            is_public: form.is_public ?? false,
            is_ongoing: form.is_ongoing ?? false,
            registration_open: form.registration_open ?? false,
            display_priority: form.display_priority ?? 0,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Failed"); setSaving(false); return; }
        if (json.season) {
          setSeasons((prev) => prev.map((s) => (s.id === json.season.id ? json.season : s)));
        }
        flash("Season updated");
      } else {
        const res = await fetch("/api/admin/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            start_date: form.start_date,
            end_date: form.end_date,
            period: form.period || null,
            year: form.year ?? null,
            is_public: form.is_public ?? false,
            is_ongoing: form.is_ongoing ?? false,
            registration_open: form.registration_open ?? false,
            display_priority: form.display_priority ?? 0,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Failed"); setSaving(false); return; }
        if (json.season) setSeasons((prev) => [json.season, ...prev]);
        flash("Season created");
      }
      setForm({ open: false });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setSaving(false);
  }

  async function setActive(id: string) {
    const season = seasons.find((s) => s.id === id);
    const current = seasons.find((s) => s.is_active);
    const msg = current
      ? `Setting "${season?.name}" as active will deactivate "${current.name}". Enrollment, skills, and curriculum will reference the new season. Continue?`
      : `Set "${season?.name}" as the active season?`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/admin/seasons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set_active: true }),
    });
    if (res.ok) {
      setSeasons((prev) =>
        prev.map((s) => ({ ...s, is_active: s.id === id }))
      );
      flash("Active season updated");
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this season? It will be deactivated.")) return;
    const res = await fetch(`/api/admin/seasons/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSeasons((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: false } : s))
      );
      flash("Season archived");
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{toast}</div>
      )}

      <div className="flex justify-end">
        {!form.open && (
          <button
            type="button"
            onClick={() => setForm({ open: true, name: "", display_priority: 0 })}
            className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark"
          >
            + New Season
          </button>
        )}
      </div>

      {/* Season list */}
      <div className="space-y-2">
        {seasons.length === 0 && !form.open && (
          <div className="rounded-xl border border-dashed border-silver bg-white/50 p-8 text-center text-sm text-mist">
            No seasons configured. Create your first one.
          </div>
        )}
        {seasons.map((s) => (
          <div
            key={s.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 ${
              form.open && form.id === s.id ? "border-lavender ring-1 ring-lavender" : "border-silver"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-charcoal">{s.name}</p>
              <p className="text-xs text-slate">
                {fmtDate(s.start_date)} — {fmtDate(s.end_date)}
                {s.period ? ` · ${s.period}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {s.is_active && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Active
                </span>
              )}
              {s.registration_open && (
                <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-semibold text-lavender-dark">
                  Registration Open
                </span>
              )}
              <button
                type="button"
                onClick={() => setForm({ open: true, ...s })}
                className="text-xs text-lavender hover:text-lavender-dark"
              >
                Edit
              </button>
              {!s.is_active && (
                <>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className="text-xs text-slate hover:text-charcoal"
                  >
                    Set Active
                  </button>
                  <button
                    type="button"
                    onClick={() => archive(s.id)}
                    className="text-xs text-slate hover:text-error"
                  >
                    Archive
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {form.open && (
        <div ref={formRef} className="space-y-3 rounded-xl border border-lavender bg-white p-4 shadow-md">
          <h3 className="text-sm font-semibold text-charcoal">
            {form.id ? "Edit Season" : "New Season"}
          </h3>
          <input
            type="text"
            placeholder="Season name (e.g. 2026/2027)"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Start Date</label>
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">End Date</label>
              <input
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Period</label>
              <input
                type="text"
                placeholder="Fall, Spring, Summer..."
                value={form.period ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Year</label>
              <input
                type="number"
                placeholder="2026"
                value={form.year ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value ? parseInt(e.target.value, 10) : null }))}
                className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.registration_open ?? false}
                onChange={(e) => setForm((f) => ({ ...f, registration_open: e.target.checked }))}
                className="rounded border-silver"
              />
              Registration Open
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.is_public ?? false}
                onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
                className="rounded border-silver"
              />
              Is Public
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.is_ongoing ?? false}
                onChange={(e) => setForm((f) => ({ ...f, is_ongoing: e.target.checked }))}
                className="rounded border-silver"
              />
              Is Ongoing
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Display Priority</label>
            <input
              type="number"
              value={form.display_priority ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, display_priority: parseInt(e.target.value, 10) || 0 }))}
              className="h-12 w-24 rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.name?.trim() || !form.start_date || !form.end_date}
              className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setForm({ open: false }); setError(null); }}
              className="h-10 rounded-lg border border-silver px-4 text-sm text-slate hover:bg-cloud"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
