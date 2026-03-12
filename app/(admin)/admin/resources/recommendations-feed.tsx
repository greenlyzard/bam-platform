"use client";

import { useState } from "react";
import type { ResourceRecommendation } from "@/lib/resources/types";

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  fill_class: { label: "Fill Class", className: "bg-info/10 text-info" },
  add_class: { label: "Add Class", className: "bg-success/10 text-success" },
  move_class: { label: "Move Class", className: "bg-warning/10 text-warning" },
  rental_opportunity: { label: "Rental", className: "bg-gold/10 text-gold-dark" },
  teacher_load: { label: "Teacher Load", className: "bg-lavender/10 text-lavender-dark" },
  room_conflict: { label: "Conflict", className: "bg-error/10 text-error" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-error",
  medium: "bg-warning",
  low: "bg-slate",
};

export function RecommendationsFeed({
  recommendations: initial,
}: {
  recommendations: ResourceRecommendation[];
}) {
  const [recommendations, setRecommendations] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleDismiss(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/resources/recommendations/${id}/dismiss`, {
      method: "POST",
    });
    if (res.ok) {
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    }
    setLoading(null);
  }

  async function handleAct(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/resources/recommendations/${id}/act`, {
      method: "POST",
    });
    if (res.ok) {
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    }
    setLoading(null);
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
        No active recommendations. The studio is running efficiently.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => {
        const badge = TYPE_BADGES[rec.recommendation_type] ?? {
          label: rec.recommendation_type,
          className: "bg-cloud text-slate",
        };
        const isLoading = loading === rec.id;

        return (
          <div
            key={rec.id}
            className="rounded-xl border border-silver bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[rec.priority] ?? "bg-slate"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-mist">
                    {rec.priority} priority
                  </span>
                </div>
                <h4 className="font-medium text-sm text-charcoal">
                  {rec.title}
                </h4>
                <p className="text-xs text-slate mt-1">{rec.description}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAct(rec.id)}
                    disabled={isLoading}
                    className="rounded-lg bg-lavender px-3 py-1.5 text-xs font-medium text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
                  >
                    Mark as Done
                  </button>
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    disabled={isLoading}
                    className="rounded-lg bg-cloud px-3 py-1.5 text-xs font-medium text-slate hover:bg-silver transition-colors disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
