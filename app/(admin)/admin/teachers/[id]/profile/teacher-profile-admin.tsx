"use client";

import { useState, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";
import Link from "next/link";
import {
  updateTeacherBasics, toggleTeacherActive, addSpecialty, removeSpecialty,
  updateSpecialtyOrder, upsertRateCard, updateCompliance, updateSubEligibility,
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
interface RateCard {
  id: string; session_type: string;
  market_rate_60: number | null; market_rate_45: number | null; market_rate_30: number | null;
  standard_rate_60: number | null; standard_rate_45: number | null; standard_rate_30: number | null;
  point_cost: number | null; cancellation_notice_hours: number | null;
  late_cancel_charge_pct: number | null; no_show_charge_pct: number | null;
  is_active: boolean;
}
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
const SESSION_TYPES = ["solo", "duet", "group", "pilates", "hybrid"];
const LEVELS = ["Petites","Level 1","Level 2A","Level 2B","Level 2B+","Level 2C","Level 3A","Level 3B","Level 3C","Level 4A","Level 4B","Level 4C","Adult"];
const DISCIPLINES = ["Ballet","Jazz","Contemporary","Hip Hop","Pilates","Musical Theater"];
const COMPLIANCE_STATUSES = [
  { value: "pending", label: "Pending" }, { value: "cleared", label: "Cleared" },
  { value: "certified", label: "Certified" }, { value: "on_file", label: "On File" },
  { value: "expired", label: "Expired" }, { value: "failed", label: "Failed" },
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
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

// Shared classes
const inputCls = "w-full h-9 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const textareaCls = "w-full rounded-md border border-silver bg-white px-3 py-2 text-sm text-charcoal resize-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const btnPrimary = "inline-flex items-center justify-center rounded-md bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-4 h-9 transition-colors";
const btnSecondary = "inline-flex items-center justify-center rounded-md border border-silver text-slate text-sm font-medium px-4 h-9 transition-colors";
const btnDanger = "inline-flex items-center justify-center rounded-md bg-error/10 text-error text-sm font-medium px-3 h-8 transition-colors hover:bg-error/20";
const cardCls = "rounded-xl border border-silver bg-white p-5 space-y-3";
const headingCls = "text-lg font-heading font-semibold text-charcoal";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TeacherProfileAdmin({
  teacher: init, specialties: initSpecs, rateCards: initRates,
  compliance: initComp, subEligibility: initSub, classes,
  availabilityCount, privateCount, tenantId,
}: {
  teacher: Teacher; specialties: Specialty[]; rateCards: RateCard[];
  compliance: Compliance | null; subEligibility: SubEligibility | null;
  classes: ClassAssignment[]; availabilityCount: number; privateCount: number; tenantId: string;
}) {
  const [teacher, setTeacher] = useState(init);
  const [specs, setSpecs] = useState(initSpecs);
  const [rates, setRates] = useState(initRates);
  const [comp, setComp] = useState<Compliance | null>(initComp);
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

  // Compliance form
  const [compForm, setCompForm] = useState({
    background_check_status: comp?.background_check_status ?? "",
    background_check_date: comp?.background_check_date ?? "",
    background_check_expiry: comp?.background_check_expiry ?? "",
    mandated_reporter_status: comp?.mandated_reporter_status ?? "",
    mandated_reporter_date: comp?.mandated_reporter_date ?? "",
    mandated_reporter_expiry: comp?.mandated_reporter_expiry ?? "",
    w9_status: comp?.w9_status ?? "",
    w9_received_date: comp?.w9_received_date ?? "",
    cpr_status: comp?.cpr_status ?? "",
    cpr_expiry: comp?.cpr_expiry ?? "",
    notes: comp?.notes ?? "",
  });

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
      flash("Teacher info updated");
    });
  }

  function toggleActive() {
    const fd = new FormData();
    fd.set("teacherId", teacher.id);
    fd.set("is_active", String(!teacher.isActive));
    startTransition(async () => {
      const res = await toggleTeacherActive(fd);
      if (res.error) return flash(res.error);
      setTeacher(t => ({ ...t, isActive: !t.isActive }));
      flash(teacher.isActive ? "Teacher deactivated" : "Teacher activated");
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

  // ── D. Rate card save ──
  function saveRate(type: string, vals: Record<string, string>) {
    const fd = new FormData();
    fd.set("tenantId", tenantId); fd.set("teacherId", teacher.id); fd.set("sessionType", type);
    for (const [k, v] of Object.entries(vals)) fd.set(k, v);
    startTransition(async () => {
      const res = await upsertRateCard(fd);
      if (res.error) return flash(res.error);
      setRates(prev => {
        const idx = prev.findIndex(r => r.session_type === type);
        const updated = { ...prev[idx], session_type: type, market_rate_60: Number(vals.market_rate_60) || null,
          standard_rate_60: Number(vals.standard_rate_60) || null, point_cost: Number(vals.point_cost) || null } as RateCard;
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, { ...updated, id: crypto.randomUUID() } as RateCard];
      });
      flash(`Rate card saved for ${type}`);
    });
  }

  // ── E. Compliance save ──
  function saveCompliance() {
    const fd = new FormData(); fd.set("teacherId", teacher.id);
    for (const [k, v] of Object.entries(compForm)) fd.set(k, v);
    startTransition(async () => {
      const res = await updateCompliance(fd);
      if (res.error) return flash(res.error);
      setComp(c => ({ ...(c ?? { id: "" }), ...compForm } as Compliance));
      flash("Compliance updated");
    });
  }

  // ── F. Sub eligibility save ──
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
                <h1 className="text-xl font-heading font-bold text-charcoal">
                  {teacher.first_name} {teacher.last_name}
                </h1>
                <p className="text-sm text-slate">{teacher.email}</p>
                {teacher.phone && <p className="text-sm text-slate">{teacher.phone}</p>}
                {teacher.bio && <p className="text-sm text-slate mt-1">{teacher.bio}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teacher.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                    {teacher.isActive ? "Active" : "Inactive"}
                  </span>
                  <button onClick={toggleActive} disabled={isPending} className="text-xs text-lavender hover:underline">
                    {teacher.isActive ? "Deactivate" : "Activate"}
                  </button>
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
                <textarea className={textareaCls} rows={2} value={infoForm.bio} onChange={e => setInfoForm(f => ({ ...f, bio: e.target.value }))} placeholder="Bio" />
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={saveBasics} disabled={isPending}>Save</button>
                  <button className={btnSecondary} onClick={() => setEditingInfo(false)}>Cancel</button>
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
          {specs.length === 0 && <span className="text-sm text-slate">No specialties</span>}
        </div>
        <div className="flex gap-2">
          <input className={inputCls + " max-w-xs"} value={newSpec} onChange={e => setNewSpec(e.target.value)}
            placeholder="Add specialty..." onKeyDown={e => e.key === "Enter" && handleAddSpec()} />
          <button className={btnPrimary} onClick={handleAddSpec} disabled={isPending || !newSpec.trim()}>Add</button>
        </div>
      </div>

      {/* C. Class Schedule */}
      <div className={cardCls}>
        <h2 className={headingCls}>Class Schedule</h2>
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
                    <td className="py-2 text-slate">{c.levels?.join(", ") ?? "—"}</td>
                    <td className="py-2 text-right text-slate">{c.enrolled}/{c.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* D. Rate Cards */}
      <div className={cardCls}>
        <h2 className={headingCls}>Rate Cards</h2>
        <div className="space-y-3">
          {SESSION_TYPES.map(type => {
            const existing = rates.find(r => r.session_type === type);
            return <RateCardRow key={type} type={type} existing={existing ?? null} onSave={vals => saveRate(type, vals)} isPending={isPending} />;
          })}
        </div>
      </div>

      {/* E. Compliance */}
      <div className={cardCls}>
        <h2 className={headingCls}>Compliance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComplianceItem label="Background Check" statusKey="background_check_status" dateKey="background_check_date" expiryKey="background_check_expiry" form={compForm} setForm={setCompForm} />
          <ComplianceItem label="Mandated Reporter" statusKey="mandated_reporter_status" dateKey="mandated_reporter_date" expiryKey="mandated_reporter_expiry" form={compForm} setForm={setCompForm} />
          <ComplianceItem label="W-9" statusKey="w9_status" dateKey="w9_received_date" form={compForm} setForm={setCompForm} />
          <ComplianceItem label="CPR Certification" statusKey="cpr_status" expiryKey="cpr_expiry" form={compForm} setForm={setCompForm} />
        </div>
        <textarea className={textareaCls} rows={2} value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))} placeholder="Compliance notes..." />
        <button className={btnPrimary} onClick={saveCompliance} disabled={isPending}>Save Compliance</button>
      </div>

      {/* F. Sub Eligibility */}
      <div className={cardCls}>
        <h2 className={headingCls}>Sub Eligibility</h2>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={subForm.is_sub_eligible} onChange={e => setSubForm(f => ({ ...f, is_sub_eligible: e.target.checked }))}
            className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender" />
          Eligible to substitute
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

      {/* G. Private Lessons */}
      <div className={cardCls}>
        <h2 className={headingCls}>Private Lessons</h2>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading font-bold text-charcoal">{availabilityCount}</p>
            <p className="text-xs text-slate">Open Slots</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold text-charcoal">{privateCount}</p>
            <p className="text-xs text-slate">Upcoming Sessions</p>
          </div>
        </div>
        <Link href={`/admin/privates?teacher=${teacher.id}`} className="text-sm text-lavender hover:underline">
          View all private lessons &rarr;
        </Link>
      </div>

      {/* H. Productions */}
      <div className={cardCls}>
        <h2 className={headingCls}>Productions</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-slate">No production assignments</p>
        ) : (
          <ul className="space-y-1">
            {classes.map(c => (
              <li key={c.classId} className="text-sm text-charcoal">
                {c.className} <span className="text-slate">— {DAY_NAMES[c.dayOfWeek]} {formatTime(c.startTime)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function RateCardRow({ type, existing, onSave, isPending }: {
  type: string; existing: RateCard | null;
  onSave: (vals: Record<string, string>) => void; isPending: boolean;
}) {
  const [vals, setVals] = useState({
    market_rate_60: existing?.market_rate_60?.toString() ?? "",
    standard_rate_60: existing?.standard_rate_60?.toString() ?? "",
    point_cost: existing?.point_cost?.toString() ?? "",
  });
  const numInput = "w-20 h-8 rounded-md border border-silver bg-white px-2 text-sm text-charcoal text-right focus:border-lavender focus:ring-1 focus:ring-lavender/20 focus:outline-none";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="w-20 text-sm font-medium text-charcoal capitalize">{type}</span>
      <label className="text-xs text-slate">
        Mkt/60
        <input className={numInput} value={vals.market_rate_60} onChange={e => setVals(v => ({ ...v, market_rate_60: e.target.value }))} />
      </label>
      <label className="text-xs text-slate">
        Std/60
        <input className={numInput} value={vals.standard_rate_60} onChange={e => setVals(v => ({ ...v, standard_rate_60: e.target.value }))} />
      </label>
      <label className="text-xs text-slate">
        Points
        <input className={numInput} value={vals.point_cost} onChange={e => setVals(v => ({ ...v, point_cost: e.target.value }))} />
      </label>
      <button onClick={() => onSave(vals)} disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-lavender/10 text-lavender text-xs font-medium px-3 h-8 hover:bg-lavender/20 transition-colors">
        Save
      </button>
    </div>
  );
}

function ComplianceItem({ label, statusKey, dateKey, expiryKey, form, setForm }: {
  label: string; statusKey: string; dateKey?: string; expiryKey?: string;
  form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<any>>;
}) {
  const status = form[statusKey] || "";
  const dateCls = "h-8 rounded-md border border-silver bg-white px-2 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender/20 focus:outline-none";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-charcoal">{label}</span>
        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge(status)}`}>
            {COMPLIANCE_STATUSES.find(s => s.value === status)?.label ?? status}
          </span>
        )}
      </div>
      <SimpleSelect value={status} onValueChange={v => setForm((f: any) => ({ ...f, [statusKey]: v }))}
        options={COMPLIANCE_STATUSES} placeholder="Select status" />
      <div className="flex gap-2">
        {dateKey && (
          <label className="text-xs text-slate flex-1">
            Date
            <input type="date" className={dateCls + " w-full"} value={form[dateKey] ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, [dateKey]: e.target.value }))} />
          </label>
        )}
        {expiryKey && (
          <label className="text-xs text-slate flex-1">
            Expiry
            <input type="date" className={dateCls + " w-full"} value={form[expiryKey] ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, [expiryKey]: e.target.value }))} />
          </label>
        )}
      </div>
    </div>
  );
}
