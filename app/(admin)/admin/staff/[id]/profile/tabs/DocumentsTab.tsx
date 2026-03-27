"use client";
import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { SimpleSelect } from "@/components/ui/select";

const DOC_TYPES: Record<string, string> = {
  w9: "W-9", w4: "W-4", i9: "I-9",
  background_check: "Background Check", mandated_reporter: "Mandated Reporter",
  policy_acknowledgment: "Policy", certification: "Certification",
  contract: "Contract", other: "Other",
};

const DOC_OPTIONS = Object.entries(DOC_TYPES).map(([value, label]) => ({ value, label }));

export default function DocumentsTab({ teacherId }: { teacherId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("other");
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");

  async function fetchDocs() {
    const supabase = createClient();
    const { data } = await supabase
      .from("staff_documents")
      .select("*")
      .eq("profile_id", teacherId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchDocs(); }, [teacherId]);

  const grouped = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.group_name || "General";
    (acc[key] ||= []).push(d);
    return acc;
  }, {});

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    const supabase = createClient();
    await supabase.from("staff_documents").update({ is_active: false }).eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function handleUpload() {
    if (!file) return;
    startUpload(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", docType);
      if (groupName) form.append("group_name", groupName);
      if (notes) form.append("notes", notes);
      // tenant_id resolved server-side from profile_roles in the API route

      await fetch(`/api/admin/staff/${teacherId}/documents`, { method: "POST", body: form });
      setShowUpload(false);
      setFile(null);
      setDocType("other");
      setGroupName("");
      setNotes("");
      await fetchDocs();
    });
  }

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-cloud rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700">Documents</h3>
        <button onClick={() => setShowUpload(!showUpload)} className="text-sm text-lavender hover:underline">
          {showUpload ? "Cancel" : "+ Upload Document"}
        </button>
      </div>

      {showUpload && (
        <div className="p-4 bg-white border border-cloud rounded-lg space-y-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          <SimpleSelect value={docType} onValueChange={setDocType} options={DOC_OPTIONS} placeholder="Document Type" />
          <input
            type="text" placeholder="Group name (optional)" value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full text-sm border border-cloud rounded-lg px-3 py-2"
          />
          <input
            type="text" placeholder="Notes (optional)" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm border border-cloud rounded-lg px-3 py-2"
          />
          <button
            onClick={handleUpload} disabled={!file || uploading}
            className="px-4 py-2 bg-lavender text-white text-sm rounded-lg disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && <p className="text-sm text-slate-500">No documents uploaded.</p>}

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{group}</h4>
          <div className="space-y-1">
            {items.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-cloud">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-lavender/10 text-lavender shrink-0">
                    {DOC_TYPES[d.document_type] || d.document_type}
                  </span>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-lavender hover:underline truncate">
                    {d.file_name}
                  </a>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                  {d.notes && <span className="text-xs text-slate-400 truncate">{d.notes}</span>}
                </div>
                <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-2">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
