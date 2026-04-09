"use client";

import { useState, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";
import {
  updateStudentBasics,
  updateStudentLevel,
  toggleStudentActive,
  awardBadge,
  revokeBadge,
  createEvaluation,
  deleteEvaluation,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  createRelative,
  updateRelativeActive,
  updateSharePermission,
  setStudentSkillStatus,
} from "./actions";
import { AddToClassModal } from "./add-to-class-modal";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  current_level: string | null;
  avatar_url: string | null;
  active: boolean;
  medical_notes: string | null;
  allergy_notes: string | null;
  created_at: string;
  tenant_id: string;
}

interface BadgeAward {
  id: string;
  awarded_at: string;
  notes: string | null;
  badge_id: string;
  awarded_by: string | null;
  awardedByName: string | null;
  badges: { name: string; description: string | null; category: string; tier: string } | null;
}

interface BadgeOption {
  id: string;
  name: string;
  category: string;
  tier: string;
}

interface Evaluation {
  id: string;
  evaluation_type: string;
  title: string | null;
  body: string | null;
  is_private: boolean;
  attributed_to_name: string | null;
  created_at: string;
}

interface Album {
  id: string;
  label: string;
  album_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Relative {
  id: string;
  name: string;
  relationship: string;
  email: string | null;
  share_token: string;
  vanity_slug: string | null;
  is_active: boolean;
}

interface Permission {
  id: string;
  relative_id: string;
  section_key: string;
  is_visible: boolean;
}

type SkillStatus = "not_started" | "in_progress" | "achieved" | "mastered";

interface CurriculumSkill {
  id: string;
  name: string;
  description: string | null;
  badge_color_hex: string | null;
  sort_order: number;
  category_id: string;
  category_name: string;
  category_sort: number;
}

interface SkillRecord {
  skill_id: string;
  status: string; // narrowed at use site
  rating: number | null;
  awarded_at: string | null;
}

interface ActiveSeason {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LEVELS = [
  "Petites", "Level 1", "Level 2", "Level 2A", "Level 2B", "Level 2B+",
  "Level 2C", "Level 2C+", "Level 3A", "Level 3B", "Level 3C",
  "Level 4", "Level 4A", "Level 4B", "Level 4C", "Adult/Teen",
];

const EVAL_TYPES = [
  { value: "formal", label: "Formal Evaluation" },
  { value: "progress_note", label: "Progress Note" },
  { value: "goal_setting", label: "Goal Setting" },
  { value: "achievement_note", label: "Achievement Note" },
];

const SECTION_KEYS = [
  { key: "bio", label: "Bio & Name" },
  { key: "level", label: "Level Progress" },
  { key: "badges", label: "Badges" },
  { key: "photos", label: "Photo Gallery" },
  { key: "performances", label: "Performances" },
  { key: "highlight_reel", label: "Highlight Reel" },
  { key: "competitions", label: "Competitions" },
  { key: "schedule", label: "Schedule" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob + "T12:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Shared inline components
// ---------------------------------------------------------------------------
const inputCls =
  "w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const textareaCls =
  "w-full rounded-md border border-silver bg-white px-3 py-2 text-sm text-charcoal resize-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none";
const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-4 h-9 transition-colors";
const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-silver text-slate text-sm font-medium px-4 h-9 transition-colors";
const cardCls = "rounded-xl border border-silver bg-white p-5 space-y-3";
const headingCls = "text-lg font-heading font-semibold text-charcoal";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AdminStudentProfile({
  student: initialStudent,
  badges: initialBadges,
  allBadges,
  evaluations: initialEvals,
  albums: initialAlbums,
  relatives: initialRelatives,
  permissions: initialPerms,
  tenantId,
  activeSeason,
  curriculumSkills,
  skillRecords: initialSkillRecords,
}: {
  student: Student;
  badges: BadgeAward[];
  allBadges: BadgeOption[];
  evaluations: Evaluation[];
  albums: Album[];
  relatives: Relative[];
  permissions: Permission[];
  tenantId: string;
  activeSeason: ActiveSeason | null;
  curriculumSkills: CurriculumSkill[];
  skillRecords: SkillRecord[];
}) {
  // ── State ──
  const [student, setStudent] = useState(initialStudent);
  const [badges, setBadges] = useState(initialBadges);
  const [evaluations, setEvaluations] = useState(initialEvals);
  const [albums, setAlbums] = useState(initialAlbums);
  const [relatives, setRelatives] = useState(initialRelatives);
  const [permissions, setPermissions] = useState(initialPerms);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState("");
  const [addToClassOpen, setAddToClassOpen] = useState(false);

  // Section form toggles
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: student.first_name,
    last_name: student.last_name,
    preferred_name: student.preferred_name ?? "",
    date_of_birth: student.date_of_birth ?? "",
    medical_notes: student.medical_notes ?? "",
    allergy_notes: student.allergy_notes ?? "",
  });
  const [selectedLevel, setSelectedLevel] = useState(student.current_level ?? "");

  // Badge award
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [badgeFormId, setBadgeFormId] = useState("");
  const [badgeFormNotes, setBadgeFormNotes] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Skills (curriculum)
  const [skillRecords, setSkillRecords] = useState<SkillRecord[]>(initialSkillRecords);

  // Evaluation
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [evalForm, setEvalForm] = useState({
    evaluation_type: "progress_note",
    title: "",
    body: "",
    is_private: false,
    attributed_to_name: "",
  });
  const [confirmDeleteEval, setConfirmDeleteEval] = useState<string | null>(null);

  // Albums
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumForm, setAlbumForm] = useState({ label: "", album_url: "" });
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState<string | null>(null);

  // Relatives
  const [showRelForm, setShowRelForm] = useState(false);
  const [relForm, setRelForm] = useState({ name: "", relationship: "", email: "", vanity_slug: "" });

  // ── Toast helper ──
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Action helpers ──
  function saveBasics() {
    const fd = new FormData();
    fd.set("studentId", student.id);
    fd.set("first_name", infoForm.first_name);
    fd.set("last_name", infoForm.last_name);
    fd.set("preferred_name", infoForm.preferred_name);
    fd.set("date_of_birth", infoForm.date_of_birth);
    fd.set("medical_notes", infoForm.medical_notes);
    fd.set("allergy_notes", infoForm.allergy_notes);
    startTransition(async () => {
      const res = await updateStudentBasics(fd);
      if (res.error) return flash(res.error);
      setStudent((s) => ({
        ...s,
        first_name: infoForm.first_name,
        last_name: infoForm.last_name,
        preferred_name: infoForm.preferred_name || null,
        date_of_birth: infoForm.date_of_birth || null,
        medical_notes: infoForm.medical_notes || null,
        allergy_notes: infoForm.allergy_notes || null,
      }));
      setEditingInfo(false);
      flash("Student info updated");
    });
  }

  function saveLevel() {
    if (!selectedLevel) return;
    const fd = new FormData();
    fd.set("studentId", student.id);
    fd.set("level", selectedLevel);
    startTransition(async () => {
      const res = await updateStudentLevel(fd);
      if (res.error) return flash(res.error);
      setStudent((s) => ({ ...s, current_level: selectedLevel }));
      flash("Level updated");
    });
  }

  function handleToggleActive() {
    const fd = new FormData();
    fd.set("studentId", student.id);
    fd.set("active", String(!student.active));
    startTransition(async () => {
      const res = await toggleStudentActive(fd);
      if (res.error) return flash(res.error);
      setStudent((s) => ({ ...s, active: !s.active }));
      flash(student.active ? "Student deactivated" : "Student activated");
    });
  }

  function handleAwardBadge() {
    if (!badgeFormId) return;
    const fd = new FormData();
    fd.set("studentId", student.id);
    fd.set("badgeId", badgeFormId);
    fd.set("notes", badgeFormNotes);
    startTransition(async () => {
      const res = await awardBadge(fd);
      if (res.error) return flash(res.error);
      const chosen = allBadges.find((b) => b.id === badgeFormId);
      setBadges((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          awarded_at: new Date().toISOString(),
          notes: badgeFormNotes || null,
          badge_id: badgeFormId,
          awarded_by: null,
          awardedByName: null,
          badges: chosen ? { name: chosen.name, description: null, category: chosen.category, tier: chosen.tier } : null,
        },
      ]);
      setBadgeFormId("");
      setBadgeFormNotes("");
      setShowBadgeForm(false);
      flash("Badge awarded");
    });
  }

  function handleRevokeBadge(id: string) {
    const fd = new FormData();
    fd.set("badgeAwardId", id);
    startTransition(async () => {
      const res = await revokeBadge(fd);
      if (res.error) return flash(res.error);
      setBadges((prev) => prev.filter((b) => b.id !== id));
      setConfirmRevoke(null);
      flash("Badge revoked");
    });
  }

  function handleCreateEval() {
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("studentId", student.id);
    fd.set("evaluation_type", evalForm.evaluation_type);
    fd.set("title", evalForm.title);
    fd.set("body", evalForm.body);
    fd.set("is_private", String(evalForm.is_private));
    fd.set("attributed_to_name", evalForm.attributed_to_name);
    startTransition(async () => {
      const res = await createEvaluation(fd);
      if (res.error) return flash(res.error);
      setEvaluations((prev) => [
        {
          id: crypto.randomUUID(),
          evaluation_type: evalForm.evaluation_type,
          title: evalForm.title || null,
          body: evalForm.body || null,
          is_private: evalForm.is_private,
          attributed_to_name: evalForm.attributed_to_name || null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setEvalForm({ evaluation_type: "progress_note", title: "", body: "", is_private: false, attributed_to_name: "" });
      setShowEvalForm(false);
      flash("Evaluation created");
    });
  }

  function handleDeleteEval(id: string) {
    const fd = new FormData();
    fd.set("evaluationId", id);
    startTransition(async () => {
      const res = await deleteEvaluation(fd);
      if (res.error) return flash(res.error);
      setEvaluations((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteEval(null);
      flash("Evaluation deleted");
    });
  }

  function handleCreateAlbum() {
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("studentId", student.id);
    fd.set("label", albumForm.label);
    fd.set("album_url", albumForm.album_url);
    fd.set("sort_order", String(albums.length));
    startTransition(async () => {
      const res = await createAlbum(fd);
      if (res.error) return flash(res.error);
      setAlbums((prev) => [
        ...prev,
        { id: crypto.randomUUID(), label: albumForm.label, album_url: albumForm.album_url, sort_order: prev.length, is_active: true },
      ]);
      setAlbumForm({ label: "", album_url: "" });
      setShowAlbumForm(false);
      flash("Album created");
    });
  }

  function handleUpdateAlbum(id: string) {
    const fd = new FormData();
    fd.set("albumId", id);
    fd.set("label", albumForm.label);
    fd.set("album_url", albumForm.album_url);
    startTransition(async () => {
      const res = await updateAlbum(fd);
      if (res.error) return flash(res.error);
      setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, label: albumForm.label, album_url: albumForm.album_url } : a)));
      setEditingAlbumId(null);
      setAlbumForm({ label: "", album_url: "" });
      flash("Album updated");
    });
  }

  function handleDeleteAlbum(id: string) {
    const fd = new FormData();
    fd.set("albumId", id);
    startTransition(async () => {
      const res = await deleteAlbum(fd);
      if (res.error) return flash(res.error);
      setAlbums((prev) => prev.filter((a) => a.id !== id));
      setConfirmDeleteAlbum(null);
      flash("Album deleted");
    });
  }

  function handleCreateRelative() {
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("studentId", student.id);
    fd.set("name", relForm.name);
    fd.set("relationship", relForm.relationship);
    fd.set("email", relForm.email);
    fd.set("vanity_slug", relForm.vanity_slug);
    startTransition(async () => {
      const res = await createRelative(fd);
      if (res.error) return flash(res.error);
      setRelatives((prev) => [
        ...prev,
        {
          id: res.id ?? crypto.randomUUID(),
          name: relForm.name,
          relationship: relForm.relationship,
          email: relForm.email || null,
          share_token: res.share_token ?? "",
          vanity_slug: relForm.vanity_slug || null,
          is_active: true,
        },
      ]);
      setRelForm({ name: "", relationship: "", email: "", vanity_slug: "" });
      setShowRelForm(false);
      flash("Relative added");
    });
  }

  function handleRelativeActive(rel: Relative) {
    const fd = new FormData();
    fd.set("relativeId", rel.id);
    fd.set("isActive", String(!rel.is_active));
    startTransition(async () => {
      const res = await updateRelativeActive(fd);
      if (res.error) return flash(res.error);
      setRelatives((prev) => prev.map((r) => (r.id === rel.id ? { ...r, is_active: !r.is_active } : r)));
    });
  }

  function handlePermToggle(relId: string, sectionKey: string, current: boolean) {
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("relativeId", relId);
    fd.set("section_key", sectionKey);
    fd.set("is_visible", String(!current));
    startTransition(async () => {
      const res = await updateSharePermission(fd);
      if (res.error) return flash(res.error);
      setPermissions((prev) => {
        const idx = prev.findIndex((p) => p.relative_id === relId && p.section_key === sectionKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], is_visible: !current };
          return next;
        }
        return [...prev, { id: crypto.randomUUID(), relative_id: relId, section_key: sectionKey, is_visible: !current }];
      });
    });
  }

  function permVisible(relId: string, key: string) {
    const p = permissions.find((x) => x.relative_id === relId && x.section_key === key);
    return p ? p.is_visible : true;
  }

  function copyLink(text: string) {
    navigator.clipboard.writeText(text);
    flash("Link copied");
  }

  const initials = (student.first_name[0] ?? "") + (student.last_name[0] ?? "");
  const age = calculateAge(student.date_of_birth);
  const displayName = student.preferred_name
    ? `${student.preferred_name} ${student.last_name}`
    : `${student.first_name} ${student.last_name}`;

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] bg-charcoal text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* ── Section 1: Profile Header ── */}
      <div className={cardCls}>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-full bg-lavender/20 flex items-center justify-center text-lavender text-2xl font-heading font-semibold shrink-0 overflow-hidden">
            {student.avatar_url ? (
              <img src={student.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials.toUpperCase()
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-heading font-semibold text-charcoal">{displayName}</h2>
                {student.preferred_name && (
                  <p className="text-sm text-slate">Legal: {student.first_name} {student.last_name}</p>
                )}
              </div>
              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate">{student.active ? "Active" : "Inactive"}</span>
                <input type="checkbox" checked={student.active} onChange={handleToggleActive} className="sr-only peer" />
                <span className="relative w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
              </label>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate">
              {student.date_of_birth && <span>DOB: {formatDate(student.date_of_birth)}</span>}
              {age !== null && <span>Age: {age}</span>}
              {student.current_level && (
                <span className="inline-flex items-center rounded-full bg-lavender/10 text-lavender px-2 py-0.5 text-xs font-medium">
                  {student.current_level}
                </span>
              )}
            </div>
            {(student.medical_notes || student.allergy_notes) && (
              <div className="mt-2 space-y-1 text-xs text-slate/70">
                {student.medical_notes && <p>Medical: {student.medical_notes}</p>}
                {student.allergy_notes && <p>Allergies: {student.allergy_notes}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Edit form */}
        {!editingInfo ? (
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => { setInfoForm({ first_name: student.first_name, last_name: student.last_name, preferred_name: student.preferred_name ?? "", date_of_birth: student.date_of_birth ?? "", medical_notes: student.medical_notes ?? "", allergy_notes: student.allergy_notes ?? "" }); setEditingInfo(true); }} className="text-xs text-lavender hover:text-lavender-dark">
              Edit Info
            </button>
            <button
              onClick={() => setAddToClassOpen(true)}
              className="h-8 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-xs px-4 transition-colors"
            >
              + Add to Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-silver">
            <input className={inputCls} placeholder="First name" value={infoForm.first_name} onChange={(e) => setInfoForm((f) => ({ ...f, first_name: e.target.value }))} />
            <input className={inputCls} placeholder="Last name" value={infoForm.last_name} onChange={(e) => setInfoForm((f) => ({ ...f, last_name: e.target.value }))} />
            <input className={inputCls} placeholder="Preferred name" value={infoForm.preferred_name} onChange={(e) => setInfoForm((f) => ({ ...f, preferred_name: e.target.value }))} />
            <input className={inputCls} type="date" value={infoForm.date_of_birth} onChange={(e) => setInfoForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
            <textarea className={textareaCls + " col-span-2"} rows={2} placeholder="Medical notes" value={infoForm.medical_notes} onChange={(e) => setInfoForm((f) => ({ ...f, medical_notes: e.target.value }))} />
            <textarea className={textareaCls + " col-span-2"} rows={2} placeholder="Allergy notes" value={infoForm.allergy_notes} onChange={(e) => setInfoForm((f) => ({ ...f, allergy_notes: e.target.value }))} />
            <div className="col-span-2 flex gap-2">
              <button onClick={saveBasics} disabled={isPending} className={btnPrimary}>Save</button>
              <button onClick={() => setEditingInfo(false)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Level ── */}
      <div className={cardCls}>
        <h3 className={headingCls}>Level</h3>
        {student.current_level && (
          <span className="inline-flex items-center rounded-full bg-lavender/10 text-lavender px-3 py-1 text-sm font-medium">
            {student.current_level}
          </span>
        )}
        <div className="flex items-center gap-3">
          <SimpleSelect
            className="w-full"
            value={selectedLevel}
            onValueChange={setSelectedLevel}
            options={LEVELS.map((l) => ({ value: l, label: l }))}
            placeholder="Select level..."
          />
          <button onClick={saveLevel} disabled={isPending || !selectedLevel} className={btnPrimary + " shrink-0"}>
            Update Level
          </button>
        </div>
      </div>

      {/* ── Section: Skills (curriculum-based) ── */}
      <SkillsSection
        student={student}
        activeSeason={activeSeason}
        curriculumSkills={curriculumSkills}
        skillRecords={skillRecords}
        tenantId={tenantId}
        onChange={(skillId, status) => {
          setSkillRecords((prev) => {
            const next = prev.filter((r) => r.skill_id !== skillId);
            const isAwarded = status === "achieved" || status === "mastered";
            next.push({
              skill_id: skillId,
              status,
              rating: null,
              awarded_at: isAwarded ? new Date().toISOString() : null,
            });
            return next;
          });
        }}
      />

      {/* ── Section 3: Badges ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className={headingCls}>Badges &amp; Achievements ({badges.length})</h3>
          <button onClick={() => setShowBadgeForm(true)} className="text-xs text-lavender hover:text-lavender-dark">Award Badge</button>
        </div>
        {showBadgeForm && (
          <div className="space-y-2 border-t border-silver pt-3">
            <SimpleSelect
              className="w-full"
              value={badgeFormId}
              onValueChange={setBadgeFormId}
              options={allBadges.map((b) => ({ value: b.id, label: `${b.name} (${b.category})` }))}
              placeholder="Select badge..."
            />
            <textarea className={textareaCls} rows={2} placeholder="Notes (optional)" value={badgeFormNotes} onChange={(e) => setBadgeFormNotes(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAwardBadge} disabled={isPending || !badgeFormId} className={btnPrimary}>Save</button>
              <button onClick={() => { setShowBadgeForm(false); setBadgeFormId(""); setBadgeFormNotes(""); }} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        {badges.length > 0 && (
          <div className="divide-y divide-silver">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-charcoal">{b.badges?.name ?? "Unknown"}</span>
                  {b.badges?.category && (
                    <span className="ml-2 inline-flex rounded-full bg-gold/10 text-gold text-xs px-2 py-0.5">{b.badges.category}</span>
                  )}
                  {b.badges?.tier && (
                    <span className="ml-1 inline-flex rounded-full bg-charcoal/5 text-slate text-xs px-2 py-0.5">{b.badges.tier}</span>
                  )}
                  <span className="ml-2 text-xs text-slate">{formatDate(b.awarded_at)}</span>
                  {b.awardedByName && <span className="ml-1 text-xs text-slate">by {b.awardedByName}</span>}
                  {b.notes && <p className="text-xs text-slate/70 mt-0.5">{b.notes}</p>}
                </div>
                {confirmRevoke === b.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    <span className="text-error">Delete?</span>
                    <button onClick={() => handleRevokeBadge(b.id)} className="text-error font-medium">Yes</button>
                    <button onClick={() => setConfirmRevoke(null)} className="text-slate">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmRevoke(b.id)} className="text-xs text-error shrink-0">Revoke</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Evaluations ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className={headingCls}>Evaluations ({evaluations.length})</h3>
          <button onClick={() => setShowEvalForm(true)} className="text-xs text-lavender hover:text-lavender-dark">Add Evaluation</button>
        </div>
        {showEvalForm && (
          <div className="space-y-2 border-t border-silver pt-3">
            <SimpleSelect
              className="w-full"
              value={evalForm.evaluation_type}
              onValueChange={(v) => setEvalForm((f) => ({ ...f, evaluation_type: v }))}
              options={EVAL_TYPES}
              placeholder="Type..."
            />
            <input className={inputCls} placeholder="Title" value={evalForm.title} onChange={(e) => setEvalForm((f) => ({ ...f, title: e.target.value }))} />
            <textarea className={textareaCls} rows={4} placeholder="Body" value={evalForm.body} onChange={(e) => setEvalForm((f) => ({ ...f, body: e.target.value }))} />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-charcoal">
                <input type="checkbox" checked={evalForm.is_private} onChange={(e) => setEvalForm((f) => ({ ...f, is_private: e.target.checked }))} className="sr-only peer" />
                <span className="relative w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                Private
              </label>
            </div>
            <input className={inputCls} placeholder="e.g. Ms. Lauryn" value={evalForm.attributed_to_name} onChange={(e) => setEvalForm((f) => ({ ...f, attributed_to_name: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={handleCreateEval} disabled={isPending} className={btnPrimary}>Save</button>
              <button onClick={() => setShowEvalForm(false)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        {evaluations.length > 0 && (
          <div className="divide-y divide-silver">
            {evaluations.map((ev) => (
              <div key={ev.id} className="flex items-start justify-between py-2 text-sm gap-2">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-lavender/10 text-lavender text-xs px-2 py-0.5 mr-1">
                    {EVAL_TYPES.find((t) => t.value === ev.evaluation_type)?.label ?? ev.evaluation_type}
                  </span>
                  {ev.is_private && <span className="inline-flex rounded-full bg-error/10 text-error text-xs px-2 py-0.5 mr-1">Private</span>}
                  {ev.title && <span className="font-medium text-charcoal">{ev.title}</span>}
                  {ev.body && <p className="text-xs text-slate mt-0.5">{ev.body.length > 100 ? ev.body.slice(0, 100) + "..." : ev.body}</p>}
                  <p className="text-xs text-slate/70 mt-0.5">
                    {formatDate(ev.created_at)}
                    {ev.attributed_to_name && <span> &middot; {ev.attributed_to_name}</span>}
                  </p>
                </div>
                {confirmDeleteEval === ev.id ? (
                  <span className="flex items-center gap-1 text-xs shrink-0">
                    <span className="text-error">Delete?</span>
                    <button onClick={() => handleDeleteEval(ev.id)} className="text-error font-medium">Yes</button>
                    <button onClick={() => setConfirmDeleteEval(null)} className="text-slate">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDeleteEval(ev.id)} className="text-xs text-error shrink-0">Delete</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 5: Photo Albums ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className={headingCls}>Photo Albums</h3>
          <button onClick={() => { setAlbumForm({ label: "", album_url: "" }); setEditingAlbumId(null); setShowAlbumForm(true); }} className="text-xs text-lavender hover:text-lavender-dark">Add Album</button>
        </div>
        {(showAlbumForm || editingAlbumId) && (
          <div className="space-y-2 border-t border-silver pt-3">
            <input className={inputCls} placeholder="Label" value={albumForm.label} onChange={(e) => setAlbumForm((f) => ({ ...f, label: e.target.value }))} />
            <input className={inputCls} placeholder="Album URL" value={albumForm.album_url} onChange={(e) => setAlbumForm((f) => ({ ...f, album_url: e.target.value }))} />
            <div className="flex gap-2">
              <button
                onClick={() => editingAlbumId ? handleUpdateAlbum(editingAlbumId) : handleCreateAlbum()}
                disabled={isPending || !albumForm.label || !albumForm.album_url}
                className={btnPrimary}
              >
                Save
              </button>
              <button onClick={() => { setShowAlbumForm(false); setEditingAlbumId(null); }} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        {albums.length > 0 && (
          <div className="divide-y divide-silver">
            {albums.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-charcoal">{a.label}</span>
                  <p className="text-xs text-slate truncate">{a.album_url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setAlbumForm({ label: a.label, album_url: a.album_url }); setEditingAlbumId(a.id); setShowAlbumForm(false); }}
                    className="text-xs text-lavender hover:text-lavender-dark"
                  >
                    Edit
                  </button>
                  {confirmDeleteAlbum === a.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="text-error">Delete?</span>
                      <button onClick={() => handleDeleteAlbum(a.id)} className="text-error font-medium">Yes</button>
                      <button onClick={() => setConfirmDeleteAlbum(null)} className="text-slate">No</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteAlbum(a.id)} className="text-xs text-error">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 6: Relative Access ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className={headingCls}>Shareable Links</h3>
          <button onClick={() => setShowRelForm(true)} className="text-xs text-lavender hover:text-lavender-dark">Add Relative</button>
        </div>
        {showRelForm && (
          <div className="space-y-2 border-t border-silver pt-3">
            <input className={inputCls} placeholder="Name" value={relForm.name} onChange={(e) => setRelForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={inputCls} placeholder="Relationship" value={relForm.relationship} onChange={(e) => setRelForm((f) => ({ ...f, relationship: e.target.value }))} />
            <input className={inputCls} type="email" placeholder="Email (optional)" value={relForm.email} onChange={(e) => setRelForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={inputCls} placeholder="Vanity slug (optional)" value={relForm.vanity_slug} onChange={(e) => setRelForm((f) => ({ ...f, vanity_slug: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={handleCreateRelative} disabled={isPending || !relForm.name || !relForm.relationship} className={btnPrimary}>Save</button>
              <button onClick={() => setShowRelForm(false)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        {relatives.length > 0 && (
          <div className="space-y-4 pt-2">
            {relatives.map((rel) => {
              const slug = rel.vanity_slug || rel.share_token;
              const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/dancer/${slug}`;
              return (
                <div key={rel.id} className="rounded-lg border border-silver p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-charcoal text-sm">{rel.name}</span>
                      <span className="ml-2 text-xs text-slate">{rel.relationship}</span>
                      {rel.email && <span className="ml-2 text-xs text-slate">{rel.email}</span>}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-slate">{rel.is_active ? "Active" : "Inactive"}</span>
                      <input type="checkbox" checked={rel.is_active} onChange={() => handleRelativeActive(rel)} className="sr-only peer" />
                      <span className="relative w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate truncate">/dancer/{slug}</span>
                    <button onClick={() => copyLink(shareUrl)} className="text-lavender hover:text-lavender-dark font-medium shrink-0">Copy</button>
                  </div>
                  {/* Permissions grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SECTION_KEYS.map((sk) => {
                      const vis = permVisible(rel.id, sk.key);
                      return (
                        <label key={sk.key} className="flex items-center gap-2 cursor-pointer text-xs text-charcoal">
                          <input type="checkbox" checked={vis} onChange={() => handlePermToggle(rel.id, sk.key, vis)} className="sr-only peer" />
                          <span className="relative w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shrink-0" />
                          {sk.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add to Class Modal */}
      {addToClassOpen && (
        <AddToClassModal
          student={student}
          tenantId={tenantId}
          onClose={() => setAddToClassOpen(false)}
          onEnrolled={() => {
            flash("Enrolled in class");
            setAddToClassOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillsSection — curriculum-based badge wall
// ---------------------------------------------------------------------------
const SKILL_STATUS_OPTIONS: { value: SkillStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "achieved", label: "Achieved" },
  { value: "mastered", label: "Mastered" },
];

function SkillsSection({
  student,
  activeSeason,
  curriculumSkills,
  skillRecords,
  tenantId,
  onChange,
}: {
  student: Student;
  activeSeason: ActiveSeason | null;
  curriculumSkills: CurriculumSkill[];
  skillRecords: SkillRecord[];
  tenantId: string;
  onChange: (skillId: string, status: SkillStatus) => void;
}) {
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);

  // Empty states
  if (!activeSeason) {
    return (
      <div className={cardCls}>
        <h3 className={headingCls}>Skills</h3>
        <p className="text-sm text-slate">
          No active season set. Mark a season as active in{" "}
          <span className="text-slate/70">Admin → Seasons</span>.
        </p>
      </div>
    );
  }

  if (!student.current_level) {
    return (
      <div className={cardCls}>
        <h3 className={headingCls}>Skills</h3>
        <p className="text-sm text-slate">
          Set this student&apos;s level in the Level section above to view
          curriculum.
        </p>
      </div>
    );
  }

  if (curriculumSkills.length === 0) {
    return (
      <div className={cardCls}>
        <h3 className={headingCls}>Skills</h3>
        <p className="text-sm text-slate">
          No curriculum loaded for &ldquo;{student.current_level}&rdquo; in{" "}
          {activeSeason.name}. Looking for level:{" "}
          <code className="rounded bg-charcoal/5 px-1">
            {student.current_level}
          </code>
          . If the level tag in your season curriculum is spelled differently,
          fix it in Admin → Settings → Curriculum.
        </p>
      </div>
    );
  }

  // Build status map
  const statusMap = new Map<string, SkillStatus>();
  const awardedAtMap = new Map<string, string | null>();
  for (const r of skillRecords) {
    const s = (
      ["not_started", "in_progress", "achieved", "mastered"].includes(r.status)
        ? r.status
        : "not_started"
    ) as SkillStatus;
    statusMap.set(r.skill_id, s);
    awardedAtMap.set(r.skill_id, r.awarded_at);
  }

  const bucketOf = (skillId: string): "achieved" | "in_progress" | "coming_up" => {
    const s = statusMap.get(skillId) ?? "not_started";
    if (s === "achieved" || s === "mastered") return "achieved";
    if (s === "in_progress") return "in_progress";
    return "coming_up";
  };

  // Counts
  const achievedCount = curriculumSkills.filter(
    (s) => bucketOf(s.id) === "achieved"
  ).length;
  const inProgressCount = curriculumSkills.filter(
    (s) => bucketOf(s.id) === "in_progress"
  ).length;
  const totalCount = curriculumSkills.length;

  // Group by category, preserving category sort then sort_order within
  const byCategory = new Map<
    string,
    { name: string; sort: number; skills: CurriculumSkill[] }
  >();
  for (const s of curriculumSkills) {
    const entry = byCategory.get(s.category_id);
    if (entry) {
      entry.skills.push(s);
    } else {
      byCategory.set(s.category_id, {
        name: s.category_name,
        sort: s.category_sort,
        skills: [s],
      });
    }
  }
  const categories = Array.from(byCategory.values()).sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name)
  );

  function handleStatusChange(skill: CurriculumSkill, next: SkillStatus) {
    setPendingSkillId(skill.id);
    const fd = new FormData();
    fd.set("studentId", student.id);
    fd.set("skillId", skill.id);
    fd.set("seasonId", activeSeason!.id);
    fd.set("tenantId", tenantId);
    fd.set("status", next);
    setStudentSkillStatus(fd)
      .then((res) => {
        if (res?.error) {
          alert(res.error);
        } else {
          onChange(skill.id, next);
        }
      })
      .finally(() => setPendingSkillId(null));
  }

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className={headingCls}>Skills</h3>
        <span className="text-xs text-slate">
          {activeSeason.name} · {student.current_level} · {achievedCount}/
          {totalCount} achieved
          {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
        </span>
      </div>

      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.name}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
              {cat.name}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {cat.skills
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((skill) => {
                  const bucket = bucketOf(skill.id);
                  const status =
                    statusMap.get(skill.id) ?? ("not_started" as SkillStatus);
                  const awardedAt = awardedAtMap.get(skill.id);
                  const color = skill.badge_color_hex || "#9C8BBF";
                  const isPending = pendingSkillId === skill.id;
                  return (
                    <div
                      key={skill.id}
                      className="flex flex-col items-center rounded-lg border border-silver bg-white p-3 text-center"
                    >
                      <div
                        className="mb-2 flex h-14 w-14 items-center justify-center rounded-full text-lg"
                        style={
                          bucket === "achieved"
                            ? {
                                backgroundColor: color,
                                color: "#fff",
                                boxShadow: `0 0 0 3px ${color}33`,
                              }
                            : bucket === "in_progress"
                            ? {
                                background: `conic-gradient(${color} 50%, #E5E5E5 50%)`,
                                color: "#fff",
                              }
                            : {
                                backgroundColor: "#F2F2F2",
                                color: "#9CA3AF",
                              }
                        }
                        aria-label={
                          bucket === "achieved"
                            ? "Achieved"
                            : bucket === "in_progress"
                            ? "In progress"
                            : "Coming up"
                        }
                      >
                        {bucket === "achieved" ? "✓" : bucket === "in_progress" ? "◐" : "🔒"}
                      </div>
                      <p
                        className={`text-xs font-medium leading-tight ${
                          bucket === "coming_up" ? "text-slate/60" : "text-charcoal"
                        }`}
                        title={skill.description ?? undefined}
                      >
                        {skill.name}
                      </p>
                      {bucket === "achieved" && awardedAt && (
                        <p className="mt-0.5 text-[10px] text-slate">
                          {formatDate(awardedAt.slice(0, 10))}
                        </p>
                      )}
                      <SimpleSelect
                        className="mt-2 w-full"
                        value={status}
                        onValueChange={(v) =>
                          handleStatusChange(skill, v as SkillStatus)
                        }
                        options={SKILL_STATUS_OPTIONS}
                        placeholder="Status"
                      />
                      {isPending && (
                        <p className="mt-1 text-[10px] text-slate">Saving…</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
