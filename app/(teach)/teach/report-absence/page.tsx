"use client";

import { useEffect, useState } from "react";
import { SimpleSelect } from "@/components/ui/select";

interface UpcomingInstance {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  className: string | null;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${dh}:${m} ${ampm}`;
}

export default function ReportAbsencePage() {
  const [instances, setInstances] = useState<UpcomingInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch upcoming instances for this teacher (next 14 days)
    const today = new Date();
    const twoWeeks = new Date();
    twoWeeks.setDate(today.getDate() + 14);

    const start = today.toISOString().split("T")[0];
    const end = twoWeeks.toISOString().split("T")[0];

    fetch(`/api/widget/schedule/upcoming?start=${start}&end=${end}`)
      .catch(() => null)
      .finally(() => setLoading(false));

    // For now, show empty state — the teacher's schedule query
    // requires auth which is handled server-side.
    // In production, this would be a dedicated API endpoint.
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstance) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/report-absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instance_id: selectedInstance,
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to report absence");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Absence Reported
        </h1>
        <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-6 text-center">
          <p className="text-sm font-medium text-success">
            Your absence has been reported. Amanda will be notified and
            substitutes will be alerted after approval.
          </p>
        </div>
        <a
          href="/teach/dashboard"
          className="inline-block rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Report Absence
        </h1>
        <p className="mt-1 text-sm text-slate">
          Let the studio know you cannot teach an upcoming class
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Select Class
          </label>
          {loading ? (
            <p className="text-sm text-mist">Loading your schedule...</p>
          ) : instances.length > 0 ? (
            <SimpleSelect
              value={selectedInstance}
              onValueChange={setSelectedInstance}
              options={instances.map((inst) => ({
                value: inst.id,
                label: `${inst.className ?? "Class"} — ${new Date(inst.event_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${formatTime(inst.start_time)}`,
              }))}
              placeholder="Choose a class..."
              className="w-full"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-silver px-3 py-4 text-center">
              <p className="text-sm text-mist">
                Enter the class instance ID to report an absence.
              </p>
              <input
                type="text"
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                placeholder="Schedule instance ID"
                className="mt-2 w-full rounded-lg border border-silver px-3 py-2 text-sm focus:outline-none focus:border-lavender"
                required
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Not shared with parents"
            rows={3}
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:outline-none focus:border-lavender resize-none"
          />
          <p className="text-xs text-mist mt-1">
            This reason is only visible to studio admin, not parents.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedInstance}
          className="rounded-lg bg-lavender px-6 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Absence Report"}
        </button>
      </form>
    </div>
  );
}
