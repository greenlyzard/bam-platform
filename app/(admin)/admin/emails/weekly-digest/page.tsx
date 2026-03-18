"use client";

import { useState, useEffect, useCallback } from "react";

interface ParentPreview {
  id: string;
  name: string;
  email: string | null;
}

interface DigestChild {
  childName: string;
  rows: Array<{
    className: string;
    day: string;
    time: string;
    teacher: string | null;
    room: string | null;
    changed: boolean;
    changeNote: string | null;
  }>;
}

interface DigestPreview {
  parentName: string;
  weekLabel: string;
  children: DigestChild[];
  studioAnnouncements: string[];
}

export default function WeeklyDigestPage() {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().split("T")[0];
  });

  const [parents, setParents] = useState<ParentPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState("");

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/emails/weekly-digest?week_start=${weekStart}`);
      const data = await res.json();
      setParents(data.parents ?? []);
      setWeekLabel(data.weekLabel ?? "");
    } catch {
      setParents([]);
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchParents();
    setSelectedParent(null);
    setPreview(null);
    setPreviewHtml(null);
  }, [fetchParents]);

  const loadPreview = async (parentId: string) => {
    setSelectedParent(parentId);
    setPreviewLoading(true);
    setPreview(null);
    setPreviewHtml(null);

    try {
      const res = await fetch(
        `/api/admin/emails/weekly-digest?week_start=${weekStart}&profile_id=${parentId}`
      );
      const data = await res.json();
      if (data.data) {
        setPreview(data.data);
        setPreviewHtml(data.html);
      }
    } catch {
      // ignore
    }
    setPreviewLoading(false);
  };

  const sendToParent = async (parentId: string) => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/weekly-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, profile_id: parentId }),
      });
      const data = await res.json();
      setResult(data.success ? "Sent successfully!" : `Error: ${data.error}`);
    } catch (err) {
      setResult("Failed to send");
    }
    setSending(false);
  };

  const sendToAll = async () => {
    if (!confirm(`Send weekly digest to ${parents.length} families for week of ${weekLabel}?`)) {
      return;
    }
    setSendingAll(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/weekly-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart }),
      });
      const data = await res.json();
      setResult(
        data.success
          ? `Sent ${data.sent} digests${data.failed ? `, ${data.failed} failed` : ""}`
          : `Error: ${data.error}`
      );
    } catch {
      setResult("Failed to send");
    }
    setSendingAll(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-charcoal">
            Weekly Digest
          </h1>
          <p className="mt-1 text-sm text-slate">
            Preview and send personalized weekly schedule emails to families.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate">Week of:</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="rounded-lg border border-mist/30 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender"
          />
        </div>
      </div>

      {result && (
        <div
          className={`rounded-lg p-3 text-sm ${
            result.startsWith("Error") || result.startsWith("Failed")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {result}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Parent list */}
        <div className="rounded-xl border border-mist/20 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-mist/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-charcoal">
              Families ({parents.length})
            </h2>
            <button
              onClick={sendToAll}
              disabled={sendingAll || parents.length === 0}
              className="rounded-lg bg-lavender px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-lavender-dark disabled:opacity-50"
            >
              {sendingAll ? "Sending..." : "Send All"}
            </button>
          </div>

          <div className="max-h-[600px] divide-y divide-mist/10 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate">Loading...</div>
            ) : parents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate">
                No families with active enrollments.
              </div>
            ) : (
              parents.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPreview(p.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-cloud ${
                    selectedParent === p.id ? "bg-lavender/5" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-charcoal">{p.name}</p>
                  <p className="text-xs text-slate">{p.email}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="rounded-xl border border-mist/20 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-mist/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-charcoal">Preview</h2>
            {selectedParent && (
              <button
                onClick={() => sendToParent(selectedParent)}
                disabled={sending || !preview}
                className="rounded-lg bg-lavender px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-lavender-dark disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send to This Family"}
              </button>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto p-4">
            {!selectedParent ? (
              <p className="text-center text-sm text-slate">
                Select a family to preview their digest.
              </p>
            ) : previewLoading ? (
              <p className="text-center text-sm text-slate">Loading preview...</p>
            ) : !preview ? (
              <p className="text-center text-sm text-slate">
                No schedule data for this family.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Data preview */}
                <div className="space-y-3">
                  <p className="text-sm text-slate">
                    To: <strong>{preview.parentName}</strong> &middot; Week of{" "}
                    {preview.weekLabel}
                  </p>

                  {preview.children.map((child) => (
                    <div
                      key={child.childName}
                      className="rounded-lg border border-mist/20 overflow-hidden"
                    >
                      <div className="bg-cream px-3 py-2">
                        <p className="font-display text-sm font-semibold text-charcoal">
                          {child.childName}
                        </p>
                      </div>
                      {child.rows.length === 0 ? (
                        <p className="px-3 py-2 text-xs italic text-slate">
                          No classes this week
                        </p>
                      ) : (
                        <div className="divide-y divide-mist/10">
                          {child.rows.map((row, i) => (
                            <div
                              key={i}
                              className={`px-3 py-2 ${
                                row.changed ? "bg-amber-50" : ""
                              }`}
                            >
                              <p className="text-xs font-medium text-charcoal">
                                {row.className}
                              </p>
                              <p className="text-xs text-slate">
                                {row.day} &middot; {row.time}
                                {row.teacher ? ` · ${row.teacher}` : ""}
                                {row.room ? ` · ${row.room}` : ""}
                              </p>
                              {row.changed && row.changeNote && (
                                <p className="mt-0.5 text-xs font-semibold text-amber-600">
                                  {row.changeNote}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {preview.studioAnnouncements.length > 0 && (
                    <div className="rounded-lg bg-cream p-3">
                      <p className="text-xs font-semibold text-charcoal mb-1">
                        Studio Updates
                      </p>
                      {preview.studioAnnouncements.map((a, i) => (
                        <p key={i} className="text-xs text-slate">
                          &bull; {a}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email HTML preview */}
                {previewHtml && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-lavender hover:text-lavender-dark">
                      View Email HTML
                    </summary>
                    <div className="mt-2 overflow-hidden rounded-lg border border-mist/20">
                      <iframe
                        srcDoc={previewHtml}
                        className="h-[500px] w-full"
                        title="Email preview"
                        sandbox=""
                      />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-cream p-4 text-xs text-slate">
        <p>
          <strong>Automatic sending:</strong> Digests are sent automatically every
          Sunday at 10 AM Pacific for the upcoming week. Use this page to preview,
          test individual sends, or manually trigger a bulk send.
        </p>
      </div>
    </div>
  );
}
