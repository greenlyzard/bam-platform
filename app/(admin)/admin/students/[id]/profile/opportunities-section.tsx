"use client";

import { useState } from "react";

interface Opportunity {
  id: string;
  opportunity_type: string;
  title: string;
  description: string | null;
  action_label: string | null;
  action_url: string | null;
}

const ICONS: Record<string, string> = {
  private_recommended: "🎯",
  bundle_upgrade: "📈",
  re_enrollment: "🔄",
  attendance_drop: "⚠️",
  lapsed: "💤",
  level_ready: "⭐",
  competition_eligible: "🏆",
  trial_conversion: "🩰",
};

export function OpportunitiesSection({
  studentId,
  initial,
}: {
  studentId: string;
  initial: Opportunity[];
}) {
  const [items, setItems] = useState<Opportunity[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function patch(oppId: string, action: "dismiss" | "snooze") {
    setPendingId(oppId);
    try {
      await fetch(`/api/admin/students/${studentId}/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setItems((prev) => prev.filter((o) => o.id !== oppId));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">💜</span>
        <h3 className="font-heading text-lg font-semibold text-charcoal">
          Opportunities
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-mist">No active opportunities right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-silver/60 bg-cloud/30 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">
                  {ICONS[o.opportunity_type] ?? "💡"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-charcoal">{o.title}</p>
                  {o.description && (
                    <p className="mt-0.5 text-xs text-slate">{o.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.action_url && (
                      <a
                        href={o.action_url}
                        className="inline-flex h-8 items-center rounded-md bg-lavender px-3 text-xs font-semibold text-white hover:bg-lavender-dark"
                      >
                        {o.action_label ?? "Take Action"}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => patch(o.id, "snooze")}
                      disabled={pendingId === o.id}
                      className="inline-flex h-8 items-center rounded-md border border-silver bg-white px-3 text-xs font-medium text-slate hover:bg-cloud disabled:opacity-50"
                    >
                      Snooze 30d
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(o.id, "dismiss")}
                      disabled={pendingId === o.id}
                      className="inline-flex h-8 items-center rounded-md border border-silver bg-white px-3 text-xs font-medium text-slate hover:bg-cloud disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
