"use client";

import { useEffect, useState } from "react";

interface Evaluation {
  id: string;
  evaluation_type: string;
  title: string | null;
  body: string | null;
  is_private: boolean;
  status: string;
  created_at: string;
  author_name: string | null;
}

const TYPES = [
  { value: "general", label: "General" },
  { value: "progress_check", label: "Progress Check" },
  { value: "level_assessment", label: "Level Assessment" },
  { value: "goal_setting", label: "Goal Setting" },
  { value: "achievement_note", label: "Achievement Note" },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EvaluationsTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shareWithParent, setShareWithParent] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/admin/students/${studentId}/evaluations`)
      .then((r) => r.json())
      .then((d) => setItems(d.evaluations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [studentId]);

  async function submit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_type: type,
          title: title || undefined,
          body: body.trim(),
          is_private: !shareWithParent,
        }),
      });
      if (res.ok) {
        setTitle("");
        setBody("");
        setType("general");
        setShareWithParent(true);
        setShowForm(false);
        load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-charcoal">
          Evaluations ({items.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="h-10 rounded-lg bg-lavender px-4 text-sm font-semibold text-white hover:bg-lavender-dark"
        >
          {showForm ? "Cancel" : "+ New Evaluation"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-silver bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-12 w-full appearance-none rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-silver bg-white px-3 py-2 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate">
            <input
              type="checkbox"
              checked={shareWithParent}
              onChange={(e) => setShareWithParent(e.target.checked)}
              className="rounded border-silver"
            />
            Share with parent
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !body.trim()}
            className="h-12 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Evaluation"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-mist">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-mist">
          No evaluations yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <article key={e.id} className="rounded-xl border border-silver bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-[11px] font-semibold text-lavender-dark">
                      {TYPE_LABEL[e.evaluation_type] ?? e.evaluation_type}
                    </span>
                    {e.is_private ? (
                      <span className="rounded-full bg-mist/10 px-2 py-0.5 text-[11px] font-semibold text-mist">
                        Private
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                        Shared
                      </span>
                    )}
                  </div>
                  {e.title && (
                    <h3 className="mt-2 text-sm font-semibold text-charcoal">{e.title}</h3>
                  )}
                  {e.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal">{e.body}</p>
                  )}
                  <p className="mt-2 text-[11px] text-mist">
                    {formatDate(e.created_at)}
                    {e.author_name ? ` · ${e.author_name}` : ""}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
