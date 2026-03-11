"use client";

import { useState } from "react";
import { deleteProduction } from "./actions";

interface Production {
  id: string;
  name: string;
  production_type: string;
  season: string | null;
  performance_date: string | null;
  approval_status: string;
  is_published: boolean;
  danceCount: number;
  castCount: number;
  competition_org: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  recital: "Recital",
  competition: "Competition",
  showcase: "Showcase",
  mixed: "Mixed",
};

const TYPE_COLORS: Record<string, string> = {
  recital: "bg-lavender/10 text-lavender-dark",
  competition: "bg-gold/10 text-gold",
  showcase: "bg-success/10 text-success",
  mixed: "bg-info/10 text-info",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-cloud text-mist",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  published: "bg-lavender/10 text-lavender-dark",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  published: "Published",
};

export function ProductionList({ productions }: { productions: Production[] }) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this production and all its dances, casting, and rehearsals?")) return;
    setDeleting(id);
    const result = await deleteProduction(id);
    if (result.error) alert(result.error);
    setDeleting(null);
  }

  if (productions.length === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-12 text-center">
        <p className="text-lg font-heading font-semibold text-charcoal mb-2">
          No productions yet
        </p>
        <p className="text-sm text-slate mb-4">
          Create your first production to start managing casting and rehearsals.
        </p>
        <a
          href="/admin/productions/new"
          className="inline-flex h-10 items-center rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors"
        >
          Create Production
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {productions.map((p) => (
        <a
          key={p.id}
          href={`/admin/productions/${p.id}`}
          className="block rounded-xl border border-silver bg-white p-4 hover:border-lavender/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-charcoal">
                  {p.name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.production_type] ?? "bg-cloud text-slate"}`}>
                  {TYPE_LABELS[p.production_type] ?? p.production_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.approval_status]}`}>
                  {STATUS_LABELS[p.approval_status] ?? p.approval_status}
                </span>
              </div>
              <p className="text-xs text-slate">
                {p.season && `${p.season} · `}
                {p.competition_org && `${p.competition_org} · `}
                {p.performance_date
                  ? new Date(p.performance_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Date TBD"}
                {` · ${p.danceCount} dance${p.danceCount !== 1 ? "s" : ""}`}
                {` · ${p.castCount} cast`}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleDelete(p.id);
              }}
              disabled={deleting === p.id}
              className="h-8 rounded-lg border border-silver text-xs font-medium px-3 flex items-center hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-slate disabled:opacity-50 shrink-0"
            >
              {deleting === p.id ? "..." : "Delete"}
            </button>
          </div>
        </a>
      ))}
    </div>
  );
}
