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
  visible_to_parent: boolean;
  external_url: string | null;
  file_url: string | null;
  created_at: string;
}

interface Family { id: string; family_name: string }
interface Student { id: string; first_name: string; last_name: string; family_id: string | null }

const DOC_TYPES = [
  "contract", "waiver", "policy_acknowledgment", "invoice",
  "health_record", "registration", "custom_upload", "google_doc",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  voided: "bg-gray-100 text-gray-600",
  uploaded: "bg-blue-100 text-blue-700",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function expiryClass(expiresAt: string | null): string {
  if (!expiresAt) return "text-mist";
  const exp = new Date(expiresAt + "T00:00:00").getTime();
  const now = Date.now();
  const days = (exp - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 30) return "text-amber-600 font-semibold";
  return "text-charcoal";
}

export function DocumentsTable({
  documents,
  familyMap,
  studentMap,
  allFamilies,
  allStudents,
  initialStatus,
  initialType,
}: {
  documents: Doc[];
  familyMap: Record<string, string>;
  studentMap: Record<string, string>;
  allFamilies: Family[];
  allStudents: Student[];
  initialStatus: string;
  initialType: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState(initialType);
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    family_id: "",
    student_id: "",
    document_type: "custom_upload",
    title: "",
    description: "",
    external_url: "",
    file_url: "",
    requires_signature: false,
    visible_to_parent: true,
    expires_at: "",
  });

  function applyFilters(s: string, t: string) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (t) params.set("type", t);
    router.push(`/admin/documents${params.toString() ? `?${params}` : ""}`);
  }

  async function uploadDoc() {
    if (!form.title || !form.document_type) {
      setToast("Title and type are required");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          family_id: form.family_id || null,
          student_id: form.student_id || null,
          expires_at: form.expires_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Failed");
      } else {
        setToast("Document created");
        setShowUpload(false);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function sendReminder(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${id}/remind`, { method: "POST" });
      setToast(res.ok ? "Reminder sent" : "Failed to send reminder");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function voidDoc(id: string) {
    if (!confirm("Void this document?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${id}/void`, { method: "PATCH" });
      if (res.ok) {
        setToast("Voided");
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  // Filter students by selected family in upload form
  const studentsForFamily = form.family_id
    ? allStudents.filter((s) => s.family_id === form.family_id)
    : allStudents;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-charcoal text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Documents</h1>
          <p className="mt-1 text-sm text-slate">{documents.length} documents</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); applyFilters(e.target.value, type); }}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
            <option value="uploaded">Uploaded</option>
            <option value="voided">Voided</option>
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); applyFilters(status, e.target.value); }}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
          >
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <button
            onClick={() => setShowUpload(true)}
            className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4"
          >
            + Upload
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver bg-cloud/50 text-left">
              <th className="px-4 py-2 font-medium text-slate">Family</th>
              <th className="px-4 py-2 font-medium text-slate">Student</th>
              <th className="px-4 py-2 font-medium text-slate">Type</th>
              <th className="px-4 py-2 font-medium text-slate">Title</th>
              <th className="px-4 py-2 font-medium text-slate">Status</th>
              <th className="px-4 py-2 font-medium text-slate">Created</th>
              <th className="px-4 py-2 font-medium text-slate">Expires</th>
              <th className="px-4 py-2 font-medium text-slate">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silver">
            {documents.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-mist text-sm">No documents</td></tr>
            )}
            {documents.map((d) => (
              <tr key={d.id} className="hover:bg-cloud/30">
                <td className="px-4 py-2 text-charcoal">{d.family_id ? familyMap[d.family_id] ?? "—" : "—"}</td>
                <td className="px-4 py-2 text-charcoal">{d.student_id ? studentMap[d.student_id] ?? "—" : "—"}</td>
                <td className="px-4 py-2 text-mist text-xs uppercase tracking-wide">{d.document_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-2 text-charcoal">{d.title}</td>
                <td className="px-4 py-2">
                  <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[d.status] ?? "bg-gray-100"}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-mist text-xs">{formatDate(d.created_at)}</td>
                <td className={`px-4 py-2 text-xs ${expiryClass(d.expires_at)}`}>{formatDate(d.expires_at)}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {(d.file_url || d.external_url) && (
                      <a href={d.file_url ?? d.external_url ?? "#"} target="_blank" rel="noreferrer"
                         className="text-[11px] text-lavender hover:underline">View</a>
                    )}
                    {d.status === "pending" && (
                      <button disabled={busy} onClick={() => sendReminder(d.id)}
                              className="text-[11px] text-lavender hover:underline disabled:opacity-50">
                        Remind
                      </button>
                    )}
                    {d.status !== "voided" && (
                      <button disabled={busy} onClick={() => voidDoc(d.id)}
                              className="text-[11px] text-error hover:underline disabled:opacity-50">
                        Void
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-silver flex items-center justify-between">
              <h3 className="font-heading text-lg font-semibold text-charcoal">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="text-mist hover:text-charcoal text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Family</label>
                <select value={form.family_id}
                        onChange={(e) => setForm((f) => ({ ...f, family_id: e.target.value, student_id: "" }))}
                        className="w-full h-10 rounded-lg border border-silver px-3 text-sm">
                  <option value="">— Family-level (no family) —</option>
                  {allFamilies.map((f) => <option key={f.id} value={f.id}>{f.family_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Student (optional)</label>
                <select value={form.student_id}
                        onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-silver px-3 text-sm">
                  <option value="">— None —</option>
                  {studentsForFamily.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Type *</label>
                <select value={form.document_type}
                        onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-silver px-3 text-sm">
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                       className="w-full h-10 rounded-lg border border-silver px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full rounded-lg border border-silver px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">File URL or Google Doc URL</label>
                <input value={form.external_url} onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
                       placeholder="https://..."
                       className="w-full h-10 rounded-lg border border-silver px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Expires (optional)</label>
                <input type="date" value={form.expires_at}
                       onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                       className="w-full h-10 rounded-lg border border-silver px-3 text-sm" />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.requires_signature}
                         onChange={(e) => setForm((f) => ({ ...f, requires_signature: e.target.checked }))} />
                  Requires signature
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.visible_to_parent}
                         onChange={(e) => setForm((f) => ({ ...f, visible_to_parent: e.target.checked }))} />
                  Visible to parent
                </label>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-silver flex justify-end gap-2">
              <button onClick={() => setShowUpload(false)}
                      className="h-9 rounded-lg border border-silver px-4 text-sm text-slate hover:bg-cloud">
                Cancel
              </button>
              <button disabled={busy} onClick={uploadDoc}
                      className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">
                {busy ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
