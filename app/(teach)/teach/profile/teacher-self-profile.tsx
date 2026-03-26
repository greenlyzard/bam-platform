"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateTeacherBasics, addSpecialty, removeSpecialty, updateSubEligibility,
} from "./actions";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface Teacher {
  id: string; first_name: string; last_name: string; email: string;
  phone: string | null; avatar_url: string | null; bio: string | null;
  isActive: boolean;
}
interface Specialty { id: string; specialty: string; sort_order: number }
interface Compliance {
  id: string;
  background_check_status: string | null; background_check_date: string | null; background_check_expiry: string | null;
  mandated_reporter_status: string | null; mandated_reporter_date: string | null; mandated_reporter_expiry: string | null;
  w9_status: string | null; w9_received_date: string | null;
  cpr_status: string | null; cpr_expiry: string | null;
  notes: string | null;
}
interface SubEligibility {
  id: string; is_sub_eligible: boolean;
  eligible_levels: string[]; eligible_disciplines: string[];
  notes: string | null;
}
interface ClassAssignment {
  classId: string; className: string; dayOfWeek: number;
  startTime: string; endTime: string; levels: string[] | null;
  enrolled: number; capacity: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LEVELS = ["Petites","Level 1","Level 2A","Level 2B","Level 2B+","Level 2C","Level 3A","Level 3B","Level 3C","Level 4A","Level 4B","Level 4C","Adult"];
const DISCIPLINES = ["Ballet","Jazz","Contemporary","Hip Hop","Pilates","Musical Theater"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const COMPLIANCE_LABELS: Record<string, string> = {
  pending: "Pending", cleared: "Cleared", certified: "Certified",
  on_file: "On File", expired: "Expired", failed: "Failed",
};
const COMPLIANCE_BADGE: Record<string, string> = {
  pending: "bg-gold/10 text-gold-dark", cleared: "bg-success/10 text-success",
  certified: "bg-success/10 text-success", on_file: "bg-success/10 text-success",
  expired: "bg-error/10 text-error", failed: "bg-error/10 text-error",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function badge(status: string | null) {
  if (!status) return "bg-silver/20 text-slate";
  return COMPLIANCE_BADGE[status] ?? "bg-silver/20 text-slate";
}
function isExpired(expiry: string | null) {
  if (!expiry) return false;
  return new Date(expiry + "T23:59:59") < new Date();
}

// Shared classes
const inputCls = "w-full h-9 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const textareaCls = "w-full rounded-md border border-silver bg-white px-3 py-2 text-sm text-charcoal resize-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const btnPrimary = "inline-flex items-center justify-center rounded-md bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-4 h-9 transition-colors";
const btnSecondary = "inline-flex items-center justify-center rounded-md border border-silver text-slate text-sm font-medium px-4 h-9 transition-colors";
const cardCls = "rounded-xl border border-silver bg-white p-5 space-y-3";
const headingCls = "text-lg font-heading font-semibold text-charcoal";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TeacherSelfProfile({
  teacher: init, specialties: initSpecs, compliance, subEligibility: initSub,
  classes, privateCount, tenantId,
}: {
  teacher: Teacher; specialties: Specialty[];
  compliance: Compliance | null; subEligibility: SubEligibility | null;
  classes: ClassAssignment[]; privateCount: number; tenantId: string;
}) {
  const [teacher, setTeacher] = useState(init);
  const [specs, setSpecs] = useState(initSpecs);
  const [sub, setSub] = useState<SubEligibility | null>(initSub);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState("");

  // Edit states
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: teacher.first_name, last_name: teacher.last_name,
    email: teacher.email, phone: teacher.phone ?? "", bio: teacher.bio ?? "",
  });
  const [newSpec, setNewSpec] = useState("");

  // Sub eligibility form
  const [subForm, setSubForm] = useState({
    is_sub_eligible: sub?.is_sub_eligible ?? false,
    eligible_levels: sub?.eligible_levels ?? [] as string[],
    eligible_disciplines: sub?.eligible_disciplines ?? [] as string[],
    notes: sub?.notes ?? "",
  });

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  // ── A. Save basics ──
  function saveBasics() {
    const fd = new FormData();
    fd.set("teacherId", teacher.id);
    fd.set("first_name", infoForm.first_name); fd.set("last_name", infoForm.last_name);
    fd.set("email", infoForm.email); fd.set("phone", infoForm.phone); fd.set("bio", infoForm.bio);
    startTransition(async () => {
      const res = await updateTeacherBasics(fd);
      if (res.error) return flash(res.error);
      setTeacher(t => ({ ...t, ...infoForm, phone: infoForm.phone || null, bio: infoForm.bio || null }));
      setEditingInfo(false);
      flash("Profile updated");
    });
  }

  // ── B. Specialties ──
  function handleAddSpec() {
    if (!newSpec.trim()) return;
    const fd = new FormData();
    fd.set("tenantId", tenantId); fd.set("teacherId", teacher.id); fd.set("specialty", newSpec.trim());
    startTransition(async () => {
      const res = await addSpecialty(fd);
      if (res.error) return flash(res.error);
      setSpecs(s => [...s, { id: crypto.randomUUID(), specialty: newSpec.trim(), sort_order: s.length }]);
      setNewSpec("");
      flash("Specialty added");
    });
  }

  function handleRemoveSpec(id: string) {
    const fd = new FormData(); fd.set("specialtyId", id);
    startTransition(async () => {
      const res = await removeSpecialty(fd);
      if (res.error) return flash(res.error);
      setSpecs(s => s.filter(x => x.id !== id));
      flash("Specialty removed");
    });
  }

  // ── E. Sub eligibility save ──
  function saveSubElig() {
    const fd = new FormData(); fd.set("teacherId", teacher.id);
    fd.set("is_sub_eligible", String(subForm.is_sub_eligible));
    fd.set("eligible_levels", JSON.stringify(subForm.eligible_levels));
    fd.set("eligible_disciplines", JSON.stringify(subForm.eligible_disciplines));
    fd.set("notes", subForm.notes);
    startTransition(async () => {
      const res = await updateSubEligibility(fd);
      if (res.error) return flash(res.error);
      setSub(s => ({ ...(s ?? { id: "" }), ...subForm } as SubEligibility));
      flash("Sub eligibility updated");
    });
  }

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-charcoal text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* A. Profile Header */}
      <div className={cardCls}>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-lavender/20 flex items-center justify-center text-lavender text-xl font-heading font-bold shrink-0">
            {teacher.avatar_url ? (
              <img src={teacher.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              `${teacher.first_name[0]}${teacher.last_name[0]}`
            )}
          </div>
          <div className="flex-1 min-w-0">
            {!editingInfo ? (
              <>
                <h2 className="text-xl font-heading font-bold text-charcoal">
                  {teacher.first_name} {teacher.last_name}
                </h2>
                <p className="text-sm text-slate">{teacher.email}</p>
                {teacher.phone && <p className="text-sm text-slate">{teacher.phone}</p>}
                {teacher.bio && <p className="text-sm text-slate mt-1">{teacher.bio}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teacher.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                    {teacher.isActive ? "Active" : "Inactive"}
                  </span>
                  <button onClick={() => setEditingInfo(true)} className="text-xs text-lavender hover:underline">
                    Edit Info
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} value={infoForm.first_name} onChange={e => setInfoForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                  <input className={inputCls} value={infoForm.last_name} onChange={e => setInfoForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                </div>
                <input className={inputCls} value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                <input className={inputCls} value={infoForm.phone} onChange={e => setInfoForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
                <textarea className={textareaCls} rows={3} value={infoForm.bio} onChange={e => setInfoForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell us about yourself..." />
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={saveBasics} disabled={isPending}>Save</button>
                  <button className={btnSecondary} onClick={() => { setEditingInfo(false); setInfoForm({ first_name: teacher.first_name, last_name: teacher.last_name, email: teacher.email, phone: teacher.phone ?? "", bio: teacher.bio ?? "" }); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* B. Specialties */}
      <div className={cardCls}>
        <h2 className={headingCls}>Specialties</h2>
        <div className="flex flex-wrap gap-2">
          {specs.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-lavender/10 text-lavender-dark px-3 py-1 text-sm">
              {s.specialty}
              <button onClick={() => handleRemoveSpec(s.id)} className="ml-1 text-lavender hover:text-error">&times;</button>
            </span>
          ))}
          {specs.length === 0 && <span className="text-sm text-slate">No specialties added yet</span>}
        </div>
        <div className="flex gap-2">
          <input className={inputCls + " max-w-xs"} value={newSpec} onChange={e => setNewSpec(e.target.value)}
            placeholder="Add specialty..." onKeyDown={e => e.key === "Enter" && handleAddSpec()} />
          <button className={btnPrimary} onClick={handleAddSpec} disabled={isPending || !newSpec.trim()}>Add</button>
        </div>
      </div>

      {/* C. My Classes */}
      <div className={cardCls}>
        <h2 className={headingCls}>My Classes</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-slate">No class assignments</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver text-left text-xs text-slate">
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Day/Time</th>
                  <th className="pb-2 font-medium">Levels</th>
                  <th className="pb-2 font-medium text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.classId} className="border-b border-silver/50">
                    <td className="py-2 text-charcoal font-medium">{c.className}</td>
                    <td className="py-2 text-slate">{DAY_NAMES[c.dayOfWeek]} {formatTime(c.startTime)}&ndash;{formatTime(c.endTime)}</td>
                    <td className="py-2 text-slate">{c.levels?.join(", ") ?? "\u2014"}</td>
                    <td className="py-2 text-right text-slate">{c.enrolled}/{c.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* D. Compliance Status (Read-Only) */}
      <div className={cardCls}>
        <h2 className={headingCls}>Compliance Status</h2>
        {!compliance ? (
          <p className="text-sm text-slate">No compliance records on file</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComplianceReadOnly label="Background Check" status={compliance.background_check_status} expiry={compliance.background_check_expiry} date={compliance.background_check_date} />
            <ComplianceReadOnly label="Mandated Reporter" status={compliance.mandated_reporter_status} expiry={compliance.mandated_reporter_expiry} date={compliance.mandated_reporter_date} />
            <ComplianceReadOnly label="W-9" status={compliance.w9_status} date={compliance.w9_received_date} />
            <ComplianceReadOnly label="CPR Certification" status={compliance.cpr_status} expiry={compliance.cpr_expiry} />
          </div>
        )}
      </div>

      {/* E. Sub Eligibility */}
      <div className={cardCls}>
        <h2 className={headingCls}>Sub Eligibility</h2>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={subForm.is_sub_eligible} onChange={e => setSubForm(f => ({ ...f, is_sub_eligible: e.target.checked }))}
            className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender" />
          Available to substitute
        </label>
        <div>
          <p className="text-xs font-medium text-slate mb-1">Eligible Levels</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => (
              <label key={l} className="flex items-center gap-1 text-xs text-charcoal">
                <input type="checkbox" checked={subForm.eligible_levels.includes(l)}
                  onChange={() => setSubForm(f => ({ ...f, eligible_levels: toggleArr(f.eligible_levels, l) }))}
                  className="h-3.5 w-3.5 rounded border-silver text-lavender focus:ring-lavender" />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate mb-1">Eligible Disciplines</p>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map(d => (
              <label key={d} className="flex items-center gap-1 text-xs text-charcoal">
                <input type="checkbox" checked={subForm.eligible_disciplines.includes(d)}
                  onChange={() => setSubForm(f => ({ ...f, eligible_disciplines: toggleArr(f.eligible_disciplines, d) }))}
                  className="h-3.5 w-3.5 rounded border-silver text-lavender focus:ring-lavender" />
                {d}
              </label>
            ))}
          </div>
        </div>
        <textarea className={textareaCls} rows={2} value={subForm.notes} onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes..." />
        <button className={btnPrimary} onClick={saveSubElig} disabled={isPending}>Save Sub Eligibility</button>
      </div>

      {/* F. My Privates */}
      <div className={cardCls}>
        <h2 className={headingCls}>Private Lessons</h2>
        <div className="text-center py-2">
          <p className="text-2xl font-heading font-bold text-charcoal">{privateCount}</p>
          <p className="text-xs text-slate">Upcoming Sessions</p>
        </div>
        <Link href="/teach/privates" className="text-sm text-lavender hover:underline">
          View all private lessons &rarr;
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ComplianceReadOnly({ label, status, expiry, date }: {
  label: string; status: string | null; expiry?: string | null; date?: string | null;
}) {
  const expired = isExpired(expiry ?? null);
  const isPending = status === "pending";

  return (
    <div className="space-y-1 rounded-lg border border-silver/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-charcoal">{label}</span>
        {status ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expired ? "bg-error/10 text-error" : badge(status)}`}>
            {expired ? "Expired" : (COMPLIANCE_LABELS[status] ?? status)}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-silver/20 text-slate">
            Not on file
          </span>
        )}
      </div>
      <div className="flex gap-4 text-xs text-slate">
        {date && <span>Date: {formatDate(date)}</span>}
        {expiry && (
          <span className={expired ? "text-error font-medium" : isPending ? "text-gold-dark font-medium" : ""}>
            Expiry: {formatDate(expiry)}
          </span>
        )}
      </div>
    </div>
  );
}
