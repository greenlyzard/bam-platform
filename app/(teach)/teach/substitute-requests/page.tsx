"use client";

import { useEffect, useState } from "react";

interface SubAlert {
  id: string;
  request_id: string;
  alert_sent_at: string;
  response: string | null;
  responded_at: string | null;
  className?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  roomName?: string;
  originalTeacher?: string;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${dh}:${m} ${ampm}`;
}

export default function SubstituteRequestsTeacherPage() {
  const [alerts, setAlerts] = useState<SubAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    // In production, fetch from a dedicated teacher sub alerts endpoint
    setLoading(false);
  }, []);

  const handleRespond = async (alertId: string, response: "accepted" | "declined") => {
    setResponding(alertId);
    try {
      const res = await fetch(`/api/teacher/substitute-alerts/${alertId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });

      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, response, responded_at: new Date().toISOString() } : a
          )
        );
      }
    } catch {
      // Handle error
    } finally {
      setResponding(null);
    }
  };

  const pendingAlerts = alerts.filter((a) => !a.response);
  const pastAlerts = alerts.filter((a) => a.response);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Substitute Opportunities
        </h1>
        <p className="mt-1 text-sm text-slate">
          View and respond to substitute teaching requests
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-mist">Loading...</p>
      ) : (
        <>
          {/* Pending Alerts */}
          {pendingAlerts.length > 0 ? (
            <div>
              <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
                Pending Requests
              </h2>
              <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
                {pendingAlerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-4">
                    <h3 className="font-semibold text-charcoal">
                      {alert.className ?? "Class"}
                    </h3>
                    {alert.event_date && (
                      <p className="text-sm text-slate mt-1">
                        {new Date(alert.event_date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { weekday: "long", month: "long", day: "numeric" }
                        )}
                        {alert.start_time &&
                          alert.end_time &&
                          ` · ${formatTime(alert.start_time)} – ${formatTime(alert.end_time)}`}
                      </p>
                    )}
                    {alert.roomName && (
                      <p className="text-xs text-mist mt-0.5">
                        {alert.roomName}
                        {alert.originalTeacher && ` · Originally: ${alert.originalTeacher}`}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRespond(alert.id, "accepted")}
                        disabled={responding === alert.id}
                        className="rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-white hover:bg-success/90 transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(alert.id, "declined")}
                        disabled={responding === alert.id}
                        className="rounded-lg border border-silver px-4 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
              <p className="text-sm text-mist">
                No pending substitute requests
              </p>
              <p className="text-xs text-mist mt-1">
                You&apos;ll be notified when a substitute opportunity is available.
              </p>
            </div>
          )}

          {/* Past Responses */}
          {pastAlerts.length > 0 && (
            <div>
              <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
                History
              </h2>
              <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
                {pastAlerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-charcoal">
                          {alert.className ?? "Class"}
                        </p>
                        <p className="text-xs text-mist mt-0.5">
                          {alert.responded_at
                            ? new Date(alert.responded_at).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          alert.response === "accepted"
                            ? "bg-success/10 text-success"
                            : "bg-cloud text-slate"
                        }`}
                      >
                        {alert.response === "accepted" ? "Accepted" : "Declined"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
