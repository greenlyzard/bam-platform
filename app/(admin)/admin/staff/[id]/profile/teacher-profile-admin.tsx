"use client";

import { useState, useTransition, useEffect } from "react";
import { SimpleSelect } from "@/components/ui/select";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  updateTeacherBasics, toggleTeacherActive, addSpecialty, removeSpecialty,
  updateSpecialtyOrder, upsertRateCard, updateCompliance, updateSubEligibility,
} from "./actions";
import {
  updateEnhancedBio, addDiscipline, removeDiscipline, reorderDisciplines,
  addAffiliation, removeAffiliation, reorderAffiliations,
  uploadTeacherPhoto, updatePhotoCaption, deletePhoto, reorderPhotos, togglePhotoActive,
} from "./enhanced-actions";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconPicker } from "@/components/ui/icon-picker";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface Teacher {
  id: string; first_name: string; last_name: string; email: string;
  phone: string | null; avatar_url: string | null;
  title?: string | null; bio_short?: string | null; bio_full?: string | null;
  years_experience?: number | null; education?: string | null;
  social_instagram?: string | null; social_linkedin?: string | null;
  isActive: boolean;
}
interface IconItem { id: string; name: string; image_url: string | null; category: string | null; sort_order: number }
interface Discipline { id: string; teacher_id: string; icon_id: string | null; name: string; is_certified: boolean; sort_order: number; icon_library?: IconItem | null }
interface Affiliation { id: string; teacher_id: string; icon_id: string | null; name: string; affiliation_type: string; role: string | null; years: string | null; location: string | null; sort_order: number; icon_library?: IconItem | null }
interface TeacherPhoto { id: string; teacher_id: string; photo_url: string; caption: string | null; sort_order: number; is_active?: boolean }
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

interface ContactChannel {
  id: string; profile_id: string; channel_type: string; value: string;
  is_primary: boolean; email_opt_in: boolean | null; sms_opt_in: boolean | null;
  klaviyo_synced: boolean | null; quo_synced: boolean | null;
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
  disciplines: initDiscs = [], affiliations: initAffils = [],
  photos: initPhotos = [], iconLibrary = [],
}: {
  teacher: Teacher; specialties: Specialty[]; rateCards: RateCard[];
  compliance: Compliance | null; subEligibility: SubEligibility | null;
  classes: ClassAssignment[]; availabilityCount: number; privateCount: number; tenantId: string;
  disciplines?: Discipline[]; affiliations?: Affiliation[];
  photos?: TeacherPhoto[]; iconLibrary?: IconItem[];
}) {
  const [teacher, setTeacher] = useState(init);
  const [specs, setSpecs] = useState(initSpecs);
  const [rates, setRates] = useState(initRates);
  const [comp, setComp] = useState<Compliance | null>(initComp);
  const [sub, setSub] = useState<SubEligibility | null>(initSub);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState("");

  // Sections I-L state
  const [discs, setDiscs] = useState<Discipline[]>(initDiscs);
  const [affils, setAffils] = useState<Affiliation[]>(initAffils);
  const [tPhotos, setTPhotos] = useState<TeacherPhoto[]>(initPhotos);
  const [bioForm, setBioForm] = useState({
    title: init.title ?? "", bio_short: init.bio_short ?? "", bio_full: init.bio_full ?? "",
    years_experience: init.years_experience?.toString() ?? "", education: init.education ?? "",
    social_instagram: init.social_instagram ?? "", social_linkedin: init.social_linkedin ?? "",
  });
  const [addDiscOpen, setAddDiscOpen] = useState(false);
  const [newDiscName, setNewDiscName] = useState("");
  const [newDiscIconId, setNewDiscIconId] = useState("");
  const [newDiscCertified, setNewDiscCertified] = useState(false);
  const [addAffilOpen, setAddAffilOpen] = useState(false);
  const [newAffil, setNewAffil] = useState({ name: "", icon_id: "", affiliation_type: "company", role: "", years: "", location: "" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Edit states
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: teacher.first_name, last_name: teacher.last_name,
    email: teacher.email, phone: teacher.phone ?? "",
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

  // Contact channels state
  const [contactChannels, setContactChannels] = useState<ContactChannel[]>([]);
  useEffect(() => {
    const sb = createClient();
    sb.from("contact_channels").select("*").eq("profile_id", init.id).then(({ data }) => {
      if (data) setContactChannels(data);
    });
  }, [init.id]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  // ── A. Save basics ──
  function saveBasics() {
    const fd = new FormData();
    fd.set("teacherId", teacher.id);
    fd.set("first_name", infoForm.first_name); fd.set("last_name", infoForm.last_name);
    fd.set("email", infoForm.email); fd.set("phone", infoForm.phone);
    startTransition(async () => {
      const res = await updateTeacherBasics(fd);
      if (res.error) return flash(res.error);
      setTeacher(t => ({ ...t, ...infoForm, phone: infoForm.phone || null }));
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

  // ── I. Enhanced Bio save ──
  function saveEnhancedBio() {
    const fd = new FormData();
    fd.set("teacherId", teacher.id);
    fd.set("title", bioForm.title);
    fd.set("bio_short", bioForm.bio_short);
    fd.set("bio_full", bioForm.bio_full);
    fd.set("years_experience", bioForm.years_experience);
    fd.set("education", bioForm.education);
    fd.set("social_instagram", bioForm.social_instagram);
    fd.set("social_linkedin", bioForm.social_linkedin);
    startTransition(async () => {
      try {
        const res = await updateEnhancedBio(fd);
        if (res.error) {
          flash(`Error: ${res.error}`);
        } else {
          // Update local state to reflect saved values
          setTeacher((t) => ({
            ...t,
            title: bioForm.title || null,
            bio_short: bioForm.bio_short || null,
            bio_full: bioForm.bio_full || null,
            years_experience: bioForm.years_experience ? Number(bioForm.years_experience) : null,
            education: bioForm.education || null,
            social_instagram: bioForm.social_instagram || null,
            social_linkedin: bioForm.social_linkedin || null,
          }));
          flash("Enhanced bio saved");
        }
      } catch (e) {
        flash(`Save failed: ${e}`);
      }
    });
  }

  // ── J. Disciplines ──
  function handleAddDisc() {
    if (!newDiscName.trim()) return;
    const fd = new FormData();
    fd.set("tenantId", tenantId); fd.set("teacherId", teacher.id);
    fd.set("name", newDiscName.trim()); fd.set("icon_id", newDiscIconId); fd.set("is_certified", String(newDiscCertified));
    startTransition(async () => {
      const res = await addDiscipline(fd);
      if (res.error) return flash(res.error);
      const icon = iconLibrary.find(i => i.id === newDiscIconId) ?? null;
      setDiscs(d => [...d, { id: crypto.randomUUID(), teacher_id: teacher.id, icon_id: newDiscIconId || null, name: newDiscName.trim(), is_certified: newDiscCertified, sort_order: d.length, icon_library: icon }]);
      setNewDiscName(""); setNewDiscIconId(""); setNewDiscCertified(false); setAddDiscOpen(false);
      flash("Discipline added");
    });
  }
  function handleRemoveDisc(id: string) {
    const fd = new FormData(); fd.set("disciplineId", id);
    startTransition(async () => { const res = await removeDiscipline(fd); if (res.error) return flash(res.error); setDiscs(d => d.filter(x => x.id !== id)); flash("Discipline removed"); });
  }
  function handleDiscDragEnd(e: DragEndEvent) {
    const { active, over } = e; if (!over || active.id === over.id) return;
    setDiscs(prev => { const oi = prev.findIndex(d => d.id === active.id); const ni = prev.findIndex(d => d.id === over.id); const next = arrayMove(prev, oi, ni);
      const fd = new FormData(); fd.set("teacherId", teacher.id); fd.set("orderedIds", JSON.stringify(next.map(d => d.id)));
      startTransition(async () => { await reorderDisciplines(fd); }); return next; });
  }

  // ── K. Affiliations ──
  function handleAddAffil() {
    if (!newAffil.name.trim() || !newAffil.affiliation_type) return;
    const fd = new FormData();
    fd.set("tenantId", tenantId); fd.set("teacherId", teacher.id);
    fd.set("name", newAffil.name.trim()); fd.set("icon_id", newAffil.icon_id); fd.set("affiliation_type", newAffil.affiliation_type);
    fd.set("role", newAffil.role); fd.set("years", newAffil.years); fd.set("location", newAffil.location);
    startTransition(async () => {
      const res = await addAffiliation(fd);
      if (res.error) return flash(res.error);
      const icon = iconLibrary.find(i => i.id === newAffil.icon_id) ?? null;
      setAffils(a => [...a, { id: crypto.randomUUID(), teacher_id: teacher.id, icon_id: newAffil.icon_id || null, name: newAffil.name.trim(), affiliation_type: newAffil.affiliation_type, role: newAffil.role || null, years: newAffil.years || null, location: newAffil.location || null, sort_order: a.length, icon_library: icon }]);
      setNewAffil({ name: "", icon_id: "", affiliation_type: "company", role: "", years: "", location: "" }); setAddAffilOpen(false);
      flash("Affiliation added");
    });
  }
  function handleRemoveAffil(id: string) {
    const fd = new FormData(); fd.set("affiliationId", id);
    startTransition(async () => { const res = await removeAffiliation(fd); if (res.error) return flash(res.error); setAffils(a => a.filter(x => x.id !== id)); flash("Affiliation removed"); });
  }
  function handleAffilDragEnd(e: DragEndEvent) {
    const { active, over } = e; if (!over || active.id === over.id) return;
    setAffils(prev => { const oi = prev.findIndex(a => a.id === active.id); const ni = prev.findIndex(a => a.id === over.id); const next = arrayMove(prev, oi, ni);
      const fd = new FormData(); fd.set("teacherId", teacher.id); fd.set("orderedIds", JSON.stringify(next.map(a => a.id)));
      startTransition(async () => { await reorderAffiliations(fd); }); return next; });
  }

  // ── L. Photos ──
  const [uploadingCount, setUploadingCount] = useState(0);
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setUploadingCount(c => c + fileArr.length);
    for (const file of fileArr) {
      const fd = new FormData(); fd.set("tenantId", tenantId); fd.set("teacherId", teacher.id); fd.set("file", file);
      startTransition(async () => {
        const res = await uploadTeacherPhoto(fd);
        setUploadingCount(c => c - 1);
        if (res.error) return flash(res.error);
        setTPhotos(p => [...p, { id: res.id!, teacher_id: teacher.id, photo_url: res.url!, caption: null, sort_order: p.length, is_active: true }]);
        flash("Photo uploaded");
      });
    }
    e.target.value = "";
  }
  function handleTogglePhotoActive(photoId: string, isActive: boolean) {
    const fd = new FormData(); fd.set("photoId", photoId); fd.set("isActive", String(isActive));
    startTransition(async () => {
      const res = await togglePhotoActive(fd);
      if (res.error) return flash(res.error);
      setTPhotos(p => p.map(ph => ph.id === photoId ? { ...ph, is_active: isActive } : ph));
      flash(isActive ? "Photo activated" : "Photo hidden");
    });
  }
  function handleCaptionSave(photoId: string, caption: string) {
    const fd = new FormData(); fd.set("photoId", photoId); fd.set("caption", caption);
    startTransition(async () => { const res = await updatePhotoCaption(fd); if (res.error) return flash(res.error);
      setTPhotos(p => p.map(ph => ph.id === photoId ? { ...ph, caption } : ph)); flash("Caption updated"); });
  }
  function handleDeletePhoto(photoId: string) {
    const fd = new FormData(); fd.set("photoId", photoId);
    startTransition(async () => { const res = await deletePhoto(fd); if (res.error) return flash(res.error);
      setTPhotos(p => p.filter(ph => ph.id !== photoId)); flash("Photo deleted"); });
  }
  function handlePhotoDragEnd(e: DragEndEvent) {
    const { active, over } = e; if (!over || active.id === over.id) return;
    setTPhotos(prev => { const oi = prev.findIndex(p => p.id === active.id); const ni = prev.findIndex(p => p.id === over.id); const next = arrayMove(prev, oi, ni);
      const fd = new FormData(); fd.set("teacherId", teacher.id); fd.set("orderedIds", JSON.stringify(next.map(p => p.id)));
      startTransition(async () => { await reorderPhotos(fd); }); return next; });
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
        <div className="flex items-start gap-6">
          {/* Large avatar on left */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="h-[120px] w-[120px] rounded-full bg-lavender/20 flex items-center justify-center text-lavender text-3xl font-heading font-bold overflow-hidden">
              {teacher.avatar_url ? (
                <img src={teacher.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                `${teacher.first_name[0]}${teacher.last_name[0]}`
              )}
            </div>
            <label className="text-xs text-lavender hover:text-lavender-dark cursor-pointer">
              Change Photo
              <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("file", file);
                fd.set("teacherId", teacher.id);
                fd.set("tenantId", tenantId);
                // Upload as avatar via the profile API
                const res = await fetch(`/api/admin/students/${teacher.id}/avatar`, { method: "POST", body: fd });
                if (res.ok) {
                  const { url } = await res.json();
                  setTeacher(t => ({ ...t, avatar_url: url }));
                  flash("Photo updated");
                } else {
                  flash("Photo upload failed");
                }
                e.target.value = "";
              }} />
            </label>
          </div>
          {/* Info on right */}
          <div className="flex-1 min-w-0">
            {!editingInfo ? (
              <>
                <h1 className="text-2xl font-heading font-bold text-charcoal">
                  {teacher.first_name} {teacher.last_name}
                </h1>
                {teacher.title && <p className="text-sm text-lavender-dark font-medium">{teacher.title}</p>}
                <p className="text-sm text-slate mt-1">{teacher.email}</p>
                {teacher.phone && <p className="text-sm text-slate">{teacher.phone}</p>}
                {teacher.bio_short && <p className="text-sm text-mist mt-2 italic">{teacher.bio_short}</p>}
                <div className="flex items-center gap-3 mt-3">
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
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={saveBasics} disabled={isPending}>Save</button>
                  <button className={btnSecondary} onClick={() => setEditingInfo(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* I. Enhanced Bio — moved up for visibility */}
      <div className={cardCls}>
        <h2 className={headingCls}>Bio & Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-slate">Title<input className={inputCls} value={bioForm.title} onChange={e => setBioForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Owner, Director" /></label>
          <label className="text-xs text-slate">Years Experience<input type="number" className={inputCls} value={bioForm.years_experience} onChange={e => setBioForm(f => ({ ...f, years_experience: e.target.value }))} /></label>
        </div>
        <label className="text-xs text-slate">Short Bio (for cards)<textarea className={textareaCls} rows={2} value={bioForm.bio_short} onChange={e => setBioForm(f => ({ ...f, bio_short: e.target.value }))} placeholder="1-2 sentence summary for teacher cards" /></label>
        <label className="text-xs text-slate">Full Bio<textarea className={textareaCls} rows={6} value={bioForm.bio_full} onChange={e => setBioForm(f => ({ ...f, bio_full: e.target.value }))} placeholder="Full biography for teacher profile page" /></label>
        <label className="text-xs text-slate">Education<input className={inputCls} value={bioForm.education} onChange={e => setBioForm(f => ({ ...f, education: e.target.value }))} placeholder="e.g. B.F.A. in Dance, University of Arizona" /></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-slate">Instagram<input className={inputCls} value={bioForm.social_instagram} onChange={e => setBioForm(f => ({ ...f, social_instagram: e.target.value }))} placeholder="https://instagram.com/..." /></label>
          <label className="text-xs text-slate">LinkedIn<input className={inputCls} value={bioForm.social_linkedin} onChange={e => setBioForm(f => ({ ...f, social_linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></label>
        </div>
        <button className={btnPrimary} onClick={saveEnhancedBio} disabled={isPending}>Save Bio</button>
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

      {/* Section I moved up — see below Section A */}

      {/* J. Disciplines */}
      <div className={cardCls}>
        <h2 className={headingCls}>Disciplines</h2>
        {discs.length === 0 ? <p className="text-sm text-slate">No disciplines added</p> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDiscDragEnd}>
            <SortableContext items={discs.map(d => d.id)} strategy={verticalListSortingStrategy}>
              {[{ label: "Specialties", items: discs.filter(d => !d.is_certified) }, { label: "Certified Instructor", items: discs.filter(d => d.is_certified) }].map(group => group.items.length > 0 && (
                <div key={group.label}>
                  <p className="text-xs font-medium text-slate mb-1">{group.label}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {group.items.map(d => (
                      <SortableDiscCard key={d.id} disc={d} onRemove={() => handleRemoveDisc(d.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}
        {!addDiscOpen ? (
          <button className={btnSecondary} onClick={() => setAddDiscOpen(true)}>+ Add Discipline</button>
        ) : (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-slate">Icon<IconPicker onSelect={(icon) => setNewDiscIconId(icon.id)} selectedId={newDiscIconId} category={["discipline", "certification"]} triggerLabel="Choose icon" /></label>
            <input className={inputCls + " max-w-[200px]"} value={newDiscName} onChange={e => setNewDiscName(e.target.value)} placeholder="Discipline name" />
            <label className="flex items-center gap-1 text-xs text-charcoal"><input type="checkbox" checked={newDiscCertified} onChange={e => setNewDiscCertified(e.target.checked)} className="h-3.5 w-3.5 rounded border-silver text-lavender" />Certified</label>
            <button className={btnPrimary} onClick={handleAddDisc} disabled={isPending || !newDiscName.trim()}>Add</button>
            <button className={btnSecondary} onClick={() => setAddDiscOpen(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* K. Affiliations */}
      <div className={cardCls}>
        <h2 className={headingCls}>Affiliations</h2>
        {affils.length === 0 ? <p className="text-sm text-slate">No affiliations added</p> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAffilDragEnd}>
            <SortableContext items={affils.map(a => a.id)} strategy={verticalListSortingStrategy}>
              {[{ label: "Professional Experience", type: "company" }, { label: "Training & Education", type: "school" }, { label: "Summer Intensives", type: "intensive" }, { label: "Certifications", type: "certification" }].map(group => {
                const items = affils.filter(a => a.affiliation_type === group.type);
                if (items.length === 0) return null;
                return (
                  <div key={group.type}>
                    <p className="text-xs font-medium text-slate mb-1">{group.label}</p>
                    <div className="space-y-1 mb-2">
                      {items.map(a => (
                        <SortableAffilCard key={a.id} affil={a} onRemove={() => handleRemoveAffil(a.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
        {!addAffilOpen ? (
          <button className={btnSecondary} onClick={() => setAddAffilOpen(true)}>+ Add Affiliation</button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="text-xs text-slate">Icon<IconPicker onSelect={(icon) => setNewAffil(f => ({ ...f, icon_id: icon.id }))} selectedId={newAffil.icon_id} triggerLabel="Choose icon" /></label>
              <label className="text-xs text-slate">Type<SimpleSelect value={newAffil.affiliation_type} onValueChange={v => setNewAffil(f => ({ ...f, affiliation_type: v }))} options={[{ value: "company", label: "Company" }, { value: "school", label: "School" }, { value: "intensive", label: "Intensive" }, { value: "certification", label: "Certification" }]} placeholder="Type" /></label>
              <label className="text-xs text-slate">Name<input className={inputCls} value={newAffil.name} onChange={e => setNewAffil(f => ({ ...f, name: e.target.value }))} placeholder="Organization name" /></label>
              <label className="text-xs text-slate">Role<input className={inputCls} value={newAffil.role} onChange={e => setNewAffil(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Principal Dancer" /></label>
              <label className="text-xs text-slate">Years<input className={inputCls} value={newAffil.years} onChange={e => setNewAffil(f => ({ ...f, years: e.target.value }))} placeholder="e.g. 2018-2022" /></label>
              <label className="text-xs text-slate">Location<input className={inputCls} value={newAffil.location} onChange={e => setNewAffil(f => ({ ...f, location: e.target.value }))} placeholder="City, State" /></label>
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={handleAddAffil} disabled={isPending || !newAffil.name.trim()}>Add</button>
              <button className={btnSecondary} onClick={() => setAddAffilOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* L. Photo Gallery */}
      <div className={cardCls}>
        <h2 className={headingCls}>Photo Gallery</h2>

        {/* Drag-and-drop upload zone */}
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-silver rounded-xl p-8 cursor-pointer hover:border-lavender hover:bg-lavender/5 transition-colors"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-lavender", "bg-lavender/5"); }}
          onDragLeave={e => { e.currentTarget.classList.remove("border-lavender", "bg-lavender/5"); }}
          onDrop={e => {
            e.preventDefault(); e.currentTarget.classList.remove("border-lavender", "bg-lavender/5");
            const dt = e.dataTransfer; if (dt?.files?.length) {
              const input = e.currentTarget.querySelector("input") as HTMLInputElement;
              if (input) { input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); }
            }
          }}
        >
          <svg className="w-8 h-8 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" /></svg>
          <span className="text-sm text-slate">Drop photos here or click to browse</span>
          <span className="text-xs text-silver">JPG, PNG, WebP</span>
          <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handlePhotoUpload} />
        </label>

        {/* Uploading indicator */}
        {uploadingCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-lavender">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
            Uploading {uploadingCount} photo{uploadingCount > 1 ? "s" : ""}...
          </div>
        )}

        {/* Photo grid */}
        {tPhotos.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhotoDragEnd}>
            <SortableContext items={tPhotos.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {tPhotos.map(p => (
                  <SortablePhotoCard key={p.id} photo={p} onCaptionSave={handleCaptionSave} onDelete={handleDeletePhoto} onToggleActive={handleTogglePhotoActive} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* M. Contact Channels */}
      <div className={cardCls}>
        <h2 className={headingCls}>Contact Channels</h2>
        {contactChannels.length === 0 ? (
          <p className="text-sm text-slate">No contact channels configured</p>
        ) : (
          <>
            {/* Email channels */}
            {contactChannels.filter(c => c.channel_type === "email").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-charcoal">Email</h3>
                {contactChannels.filter(c => c.channel_type === "email").map(ch => (
                  <div key={ch.id} className="flex items-center gap-2 flex-wrap text-sm border border-silver/50 rounded-lg px-3 py-2">
                    <span className="font-medium text-charcoal">{ch.value}</span>
                    {ch.is_primary && (
                      <span className="inline-flex items-center rounded-full bg-lavender/10 text-lavender-dark px-2 py-0.5 text-[10px] font-semibold">Primary</span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ch.email_opt_in ? "bg-success/10 text-success" : "bg-silver/20 text-slate"}`}>
                      Marketing: {ch.email_opt_in ? "On" : "Off"}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ch.klaviyo_synced ? "bg-info/10 text-info" : "bg-silver/20 text-slate"}`}>
                      Klaviyo: {ch.klaviyo_synced ? "Synced" : "Not synced"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Phone channels */}
            {contactChannels.filter(c => c.channel_type === "phone").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-charcoal">Phone</h3>
                {contactChannels.filter(c => c.channel_type === "phone").map(ch => (
                  <div key={ch.id} className="flex items-center gap-2 flex-wrap text-sm border border-silver/50 rounded-lg px-3 py-2">
                    <span className="font-medium text-charcoal">{ch.value}</span>
                    {ch.is_primary && (
                      <span className="inline-flex items-center rounded-full bg-lavender/10 text-lavender-dark px-2 py-0.5 text-[10px] font-semibold">Primary</span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ch.sms_opt_in === true ? "bg-success/10 text-success" : ch.sms_opt_in === false ? "bg-error/10 text-error" : "bg-silver/20 text-slate"
                    }`}>
                      SMS: {ch.sms_opt_in === true ? "Opted In" : ch.sms_opt_in === false ? "Opted Out" : "Unknown"}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ch.quo_synced ? "bg-info/10 text-info" : "bg-silver/20 text-slate"}`}>
                      Quo: {ch.quo_synced ? "Synced" : "Not synced"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
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

// ---------------------------------------------------------------------------
// Sortable sub-components for Sections J, K, L
// ---------------------------------------------------------------------------
function SortableDiscCard({ disc, onRemove }: { disc: Discipline; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: disc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="inline-flex items-center gap-2 rounded-lg border border-silver bg-white px-3 py-2 text-sm cursor-grab">
      {disc.icon_library?.image_url ? (
        <img src={disc.icon_library.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="h-6 w-6 rounded-full bg-lavender/20 shrink-0" />
      )}
      <span className="text-charcoal font-medium">{disc.name}</span>
      {disc.is_certified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">Certified</span>}
      <button onClick={onRemove} className="ml-1 text-slate hover:text-error text-xs">&times;</button>
    </div>
  );
}

function SortableAffilCard({ affil, onRemove }: { affil: Affiliation; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: affil.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="flex items-center gap-2 rounded-lg border border-silver bg-white px-3 py-2 text-sm cursor-grab">
      {affil.icon_library?.image_url ? (
        <img src={affil.icon_library.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="h-6 w-6 rounded-full bg-lavender/20 shrink-0" />
      )}
      <span className="text-charcoal font-medium">{affil.name}</span>
      {affil.role && <span className="text-xs text-slate">{affil.role}</span>}
      {affil.years && <span className="text-xs text-slate">{affil.years}</span>}
      <button onClick={onRemove} className="ml-auto text-slate hover:text-error text-xs">&times;</button>
    </div>
  );
}

function SortablePhotoCard({ photo, onCaptionSave, onDelete, onToggleActive }: {
  photo: TeacherPhoto; onCaptionSave: (id: string, caption: string) => void; onDelete: (id: string) => void; onToggleActive: (id: string, active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActive = photo.is_active !== false;
  return (
    <div ref={setNodeRef} style={style} className={`relative group rounded-lg border ${isActive ? "border-silver" : "border-silver/50 opacity-60"} bg-white overflow-hidden`}>
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="absolute top-1 left-1 z-10 cursor-grab p-1 rounded bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-3.5 h-3.5 text-slate" fill="currentColor" viewBox="0 0 16 16"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>
      </div>

      <img src={photo.photo_url} alt={photo.caption ?? ""} className="w-full aspect-square object-cover" />

      <div className="p-2 space-y-1.5">
        {/* Caption */}
        {!editing ? (
          <p className="text-xs text-slate truncate cursor-text" onClick={() => setEditing(true)}>
            {photo.caption || "Add caption..."}
          </p>
        ) : (
          <input className="w-full text-xs border border-silver rounded px-1 py-0.5" autoFocus value={caption}
            onChange={e => setCaption(e.target.value)}
            onBlur={() => { onCaptionSave(photo.id, caption); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onCaptionSave(photo.id, caption); setEditing(false); } }} />
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between">
          {/* Active toggle */}
          <button
            onClick={() => onToggleActive(photo.id, !isActive)}
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isActive ? "bg-success/10 text-success" : "bg-silver/20 text-slate"}`}
          >
            {isActive ? "Active" : "Hidden"}
          </button>

          {/* Delete */}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="text-[10px] text-slate hover:text-error transition-colors">&times; Delete</button>
          ) : (
            <span className="text-[10px] flex items-center gap-1">
              Delete?
              <button onClick={() => { onDelete(photo.id); setConfirmDelete(false); }} className="text-error font-semibold">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="text-slate font-semibold">No</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
