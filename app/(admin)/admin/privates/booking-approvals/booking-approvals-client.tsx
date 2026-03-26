"use client";

import { useState, useEffect } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createBookingApproval, toggleApprovalActive, deleteBookingApproval } from "./actions";

interface Approval {
  id: string;
  teacher_id: string;
  family_id: string;
  student_ids: string[] | null;
  approved_by: string | null;
  approved_at: string;
  is_active: boolean;
  notes: string | null;
}
interface Props {
  approvals: Approval[];
  teacherMap: Record<string, string>;
  familyMap: Record<string, string>;
  studentMap: Record<string, string>;
  approverMap: Record<string, string>;
  teachers: { id: string; name: string }[];
  families: { id: string; name: string }[];
}

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export function BookingApprovalsClient({
  approvals, teacherMap, familyMap, studentMap, approverMap, teachers, families,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [notes, setNotes] = useState("");
  const [familyStudents, setFamilyStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!familyId) { setFamilyStudents([]); setSelectedStudentIds([]); return; }
    (async () => {
      setLoadingStudents(true);
      const supabase = createClient();
      const { data } = await supabase.from("students").select("id, first_name, last_name")
        .eq("family_id", familyId).order("first_name");
      setFamilyStudents((data ?? []).map((s) => ({
        id: s.id, name: [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unknown",
      })));
      setSelectedStudentIds([]);
      setLoadingStudents(false);
    })();
  }, [familyId]);

  const toggleStudent = (id: string) =>
    setSelectedStudentIds((p) => (p.includes(id) ? p.filter((s) => s !== id) : [...p, id]));

  function resetForm() {
    setShowForm(false); setTeacherId(""); setFamilyId("");
    setNotes(""); setSelectedStudentIds([]); setFamilyStudents([]);
  }

  async function handleCreate() {
    setSaving(true);
    const fd = new FormData();
    fd.set("teacher_id", teacherId);
    fd.set("family_id", familyId);
    if (selectedStudentIds.length > 0) fd.set("student_ids", JSON.stringify(selectedStudentIds));
    fd.set("notes", notes);
    const res = await createBookingApproval(fd);
    setSaving(false);
    if (res?.error) { showToast(res.error, "error"); } else { showToast("Approval created", "success"); resetForm(); }
  }

  async function handleToggle(id: string, active: boolean) {
    const fd = new FormData();
    fd.set("id", id); fd.set("is_active", String(!active));
    const res = await toggleApprovalActive(fd);
    if (res?.error) showToast(res.error, "error");
    else showToast(active ? "Approval deactivated" : "Approval activated", "success");
  }

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    const res = await deleteBookingApproval(fd);
    setConfirmDeleteId(null);
    if (res?.error) showToast(res.error, "error"); else showToast("Approval deleted", "success");
  }

  const thCls = "px-4 py-3 text-left font-medium text-charcoal";

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === "success" ? "bg-success/10 text-success border border-success/20"
            : "bg-error/10 text-error border border-error/20"}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal font-display">Booking Approvals</h1>
          <p className="text-sm text-slate mt-1">
            Manage which families are approved to book private lessons with specific teachers.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors">
            + New Approval
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl border border-silver/50 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-charcoal font-display">New Booking Approval</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Teacher</label>
              <SimpleSelect value={teacherId} onValueChange={setTeacherId}
                options={teachers.map((t) => ({ value: t.id, label: t.name }))} placeholder="Select teacher..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Family</label>
              <SimpleSelect value={familyId} onValueChange={setFamilyId}
                options={families.map((f) => ({ value: f.id, label: f.name }))} placeholder="Select family..." />
            </div>
          </div>
          {familyId && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                Students {loadingStudents && <span className="text-slate">(loading...)</span>}
              </label>
              {familyStudents.length === 0 && !loadingStudents
                ? <p className="text-sm text-slate">No students found for this family.</p>
                : <div className="flex flex-wrap gap-3">{familyStudents.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg border border-silver/50 px-3 py-2 text-sm cursor-pointer hover:border-lavender/50 transition-colors">
                      <input type="checkbox" checked={selectedStudentIds.includes(s.id)}
                        onChange={() => toggleStudent(s.id)} className="rounded border-silver text-lavender focus:ring-lavender/20" />
                      {s.name}
                    </label>
                  ))}</div>}
              {familyStudents.length > 0 && selectedStudentIds.length === 0 && (
                <p className="text-xs text-slate mt-1">Leave unchecked to approve all students in this family.</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes about this approval..."
              className="w-full rounded-lg border border-silver/50 px-3 py-2 text-sm text-charcoal placeholder:text-silver focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleCreate} disabled={saving || !teacherId || !familyId}
              className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : "Save Approval"}
            </button>
            <button onClick={resetForm}
              className="rounded-lg border border-silver/50 px-4 py-2 text-sm font-medium text-charcoal hover:bg-cloud/50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-silver/50 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver/30 bg-cream/30">
                <th className={thCls}>Teacher</th><th className={thCls}>Family</th>
                <th className={thCls}>Students</th><th className={thCls}>Approved By</th>
                <th className={thCls}>Date</th>
                <th className="px-4 py-3 text-center font-medium text-charcoal">Active</th>
                <th className="px-4 py-3 text-right font-medium text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate">
                  No booking approvals yet. Click &quot;+ New Approval&quot; to get started.
                </td></tr>
              ) : approvals.map((a) => (
                <tr key={a.id} className="border-b border-silver/20 hover:bg-cream/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-charcoal">{teacherMap[a.teacher_id] || "Unknown"}</td>
                  <td className="px-4 py-3 text-charcoal">{familyMap[a.family_id] || "Unknown"}</td>
                  <td className="px-4 py-3 text-charcoal">
                    {a.student_ids?.length
                      ? a.student_ids.map((sid) => studentMap[sid] || "Unknown").join(", ")
                      : <span className="text-slate italic">All students</span>}
                  </td>
                  <td className="px-4 py-3 text-slate">{a.approved_by ? approverMap[a.approved_by] || "Unknown" : "—"}</td>
                  <td className="px-4 py-3 text-slate">{fmtDate(a.approved_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(a.id, a.is_active)}
                      title={a.is_active ? "Active — click to deactivate" : "Inactive — click to activate"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.is_active ? "bg-success" : "bg-silver"}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${a.is_active ? "translate-x-4" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmDeleteId === a.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button onClick={() => handleDelete(a.id)} className="text-xs font-medium text-error hover:underline">Confirm</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium text-slate hover:underline">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(a.id)}
                        className="text-xs font-medium text-error/70 hover:text-error transition-colors">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
