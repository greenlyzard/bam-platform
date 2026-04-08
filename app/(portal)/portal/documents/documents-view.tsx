"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  family_id: string | null;
  student_id: string | null;
  document_type: string;
  title: string;
  description: string | null;
  status: string;
  expires_at: string | null;
  requires_signature: boolean;
  file_url: string | null;
  external_url: string | null;
  created_at: string;
  signed_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  waiver: "Waiver",
  policy_acknowledgment: "Policy",
  invoice: "Invoice",
  health_record: "Health Record",
  registration: "Registration",
  custom_upload: "Document",
  google_doc: "Document",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ctaLabel(doc: Doc): string {
  if (doc.document_type === "invoice") return "Pay";
  if (doc.document_type === "policy_acknowledgment") return "Acknowledge";
  if (doc.document_type === "health_record") return "Complete";
  if (doc.document_type === "registration") return "Complete";
  if (doc.requires_signature) return "Sign";
  return "View";
}

export function DocumentsView({
  documents,
  studentMap,
}: {
  documents: Doc[];
  studentMap: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"todo" | "all">("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const todos = documents.filter((d) => d.status === "pending");
  const all = documents;

  async function acknowledge(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/${id}/acknowledge`, { method: "POST" });
      if (res.ok) {
        setToast("Acknowledged");
        startTransition(() => router.refresh());
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "Failed");
      }
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function sign(id: string) {
    const name = window.prompt("Type your full name to sign:");
    if (!name) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: name }),
      });
      if (res.ok) {
        setToast("Signed");
        startTransition(() => router.refresh());
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "Failed");
      }
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function renderDocCard(doc: Doc, isTodo: boolean) {
    const studentName = doc.student_id ? studentMap[doc.student_id] : null;
    const typeLabel = TYPE_LABELS[doc.document_type] ?? doc.document_type;
    const cta = ctaLabel(doc);
    const url = doc.file_url ?? doc.external_url;

    return (
      <div key={doc.id} className="rounded-xl border border-silver bg-white p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-mist uppercase tracking-wide">{typeLabel}</div>
            <div className="text-sm font-medium text-charcoal mt-0.5">{doc.title}</div>
            {studentName && <div className="text-xs text-mist mt-0.5">For: {studentName}</div>}
            {doc.description && <div className="text-xs text-slate mt-1">{doc.description}</div>}
            {doc.expires_at && (
              <div className="text-xs text-mist mt-1">Expires: {formatDate(doc.expires_at)}</div>
            )}
            {!isTodo && doc.signed_at && (
              <div className="text-xs text-success mt-1">✓ Completed {formatDate(doc.signed_at)}</div>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {isTodo ? (
              <>
                {doc.document_type === "policy_acknowledgment" ? (
                  <button disabled={busy === doc.id} onClick={() => acknowledge(doc.id)}
                          className="h-8 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-3 disabled:opacity-50">
                    {cta}
                  </button>
                ) : doc.requires_signature ? (
                  <button disabled={busy === doc.id} onClick={() => sign(doc.id)}
                          className="h-8 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-3 disabled:opacity-50">
                    {cta}
                  </button>
                ) : url ? (
                  <a href={url} target="_blank" rel="noreferrer"
                     className="h-8 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-3 inline-flex items-center">
                    {cta}
                  </a>
                ) : null}
              </>
            ) : (
              url && (
                <a href={url} target="_blank" rel="noreferrer"
                   className="h-8 rounded-lg border border-silver text-slate hover:bg-cloud text-xs font-semibold px-3 inline-flex items-center">
                  View
                </a>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-charcoal text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Documents</h1>
        <p className="mt-1 text-sm text-slate">Contracts, waivers, invoices, and forms.</p>
      </div>

      <div className="flex gap-2 border-b border-silver">
        <button
          onClick={() => setTab("todo")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "todo" ? "border-lavender text-lavender" : "border-transparent text-mist hover:text-charcoal"}`}
        >
          To Do {todos.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center bg-error text-white text-[10px] rounded-full px-1.5 min-w-[18px]">
              {todos.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "all" ? "border-lavender text-lavender" : "border-transparent text-mist hover:text-charcoal"}`}
        >
          All Documents
        </button>
      </div>

      <div className="space-y-3">
        {tab === "todo" ? (
          todos.length === 0 ? (
            <div className="rounded-xl border border-silver bg-white p-8 text-center text-mist text-sm">
              All caught up — no outstanding items.
            </div>
          ) : (
            todos.map((d) => renderDocCard(d, true))
          )
        ) : all.length === 0 ? (
          <div className="rounded-xl border border-silver bg-white p-8 text-center text-mist text-sm">
            No documents yet.
          </div>
        ) : (
          all.map((d) => renderDocCard(d, false))
        )}
      </div>
    </div>
  );
}
