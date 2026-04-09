"use client";

import { useEffect, useState } from "react";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  status: string;
  file_url: string | null;
  external_url: string | null;
  requires_signature: boolean | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  signed: "bg-success/10 text-success",
  acknowledged: "bg-success/10 text-success",
  expired: "bg-error/10 text-error",
  void: "bg-mist/10 text-mist",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function DocCard({ d }: { d: Doc }) {
  const link = d.file_url ?? d.external_url ?? "#";
  return (
    <div className="rounded-xl border border-silver bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-charcoal hover:text-lavender-dark"
          >
            {d.title}
          </a>
          {d.description && <p className="mt-0.5 text-xs text-slate">{d.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mist">
            <span>{d.document_type}</span>
            <span>·</span>
            <span>Created {formatDate(d.created_at)}</span>
            {d.expires_at && (
              <>
                <span>·</span>
                <span>Expires {formatDate(d.expires_at)}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            STATUS_STYLES[d.status] ?? "bg-cloud text-slate"
          }`}
        >
          {d.status}
        </span>
      </div>
    </div>
  );
}

export function DocumentsTab({ studentId }: { studentId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/documents`)
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <p className="text-sm text-mist">Loading documents…</p>;
  }

  const outstanding = docs.filter((d) => d.status === "pending");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-heading text-lg text-charcoal">
          Outstanding ({outstanding.length})
        </h2>
        {outstanding.length === 0 ? (
          <p className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-mist">
            Nothing outstanding. ✓
          </p>
        ) : (
          <div className="space-y-2">
            {outstanding.map((d) => (
              <DocCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg text-charcoal">
          All Documents ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-mist">No documents on file for this student.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <DocCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
