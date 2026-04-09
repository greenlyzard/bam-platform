// LEGACY — tech debt. The canonical student profile is
// app/(admin)/admin/students/[id]/profile/admin-student-profile.tsx.
// Do NOT add new features here. This file should be removed once the
// remaining surfaces that link to /admin/students/[id] are migrated to
// /admin/students/[id]/profile.
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateStudent, addExtendedContact, removeExtendedContact } from "../actions";
import {
  addGuardian,
  createProfileAndLinkGuardian,
  removeGuardian,
} from "../../families/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/constants/us-states";
import { PhotosTab } from "./photos-tab";
import { DocumentsTab } from "./documents-tab";
import { SkillsTab } from "./skills-tab";
import { EvaluationsTab } from "./evaluations-tab";

// ── Types ────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  current_level: string | null;
  active: boolean;
  avatar_url: string | null;
  media_consent: boolean;
  media_consent_date: string | null;
  medical_notes: string | null;
  emergency_contact: { name?: string; phone?: string; relationship?: string; email?: string } | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  family_id: string | null;
  parent_id: string | null;
  [key: string]: unknown;
}

interface EnrollmentRow {
  id: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  dropped_at: string | null;
  class_id: string;
  class: {
    id: string;
    name: string;
    simple_name?: string | null;
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    room: string | null;
    teacher_id: string | null;
    fee_cents: number | null;
    level: string | null;
    style: string | null;
  } | null;
  teacherName: string | null;
}

interface ScheduleRow {
  id: string;
  class_id: string | null;
  teacher_id: string | null;
  room_id: string | null;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  className: string | null;
  teacherName: string | null;
  roomName: string | null;
}

interface GuardianRow {
  id: string;
  profile_id: string;
  relationship: string;
  is_primary: boolean;
  is_billing: boolean;
  is_emergency: boolean;
  portal_access: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
}

interface ExtendedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  notify_live_stream: boolean;
  notify_recordings: boolean;
  notify_photos: boolean;
  notes: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
}

interface StudentDetailProps {
  student: Student;
  enrollments: EnrollmentRow[];
  schedule: ScheduleRow[];
  guardians: GuardianRow[];
  extendedContacts: ExtendedContact[];
}

// ── Styles ───────────────────────────────────────────────────

const INPUT =
  "w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const CARD = "rounded-xl border border-silver bg-white p-5 space-y-4";
const LABEL = "block text-xs font-medium text-slate mb-1";
const TAB_BASE =
  "px-4 py-2 text-sm font-medium transition-colors border-b-2";
const TAB_ACTIVE = "text-lavender-dark border-lavender";
const TAB_INACTIVE = "text-mist border-transparent hover:text-charcoal";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlist: "bg-[#D4A843]/10 text-[#D4A843]",
  dropped: "bg-[#C45B5B]/10 text-[#C45B5B]",
};

const ROLE_BADGES: Record<string, string> = {
  primary: "bg-lavender/10 text-lavender-dark",
  billing: "bg-[#D4A843]/10 text-[#D4A843]",
  emergency: "bg-[#C45B5B]/10 text-[#C45B5B]",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "stepparent", label: "Stepparent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "guardian", label: "Guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function googleCalendarUrl(row: ScheduleRow): string {
  const date = row.event_date.replace(/-/g, "");
  const start = row.start_time.replace(/:/g, "").slice(0, 4) + "00";
  const end = row.end_time.replace(/:/g, "").slice(0, 4) + "00";
  const title = encodeURIComponent(row.className || "Class");
  const location = encodeURIComponent(row.roomName || "");
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}T${start}/${date}T${end}&location=${location}`;
}

// ── Component ────────────────────────────────────────────────

type Tab = "profile" | "classes" | "skills" | "evaluations" | "schedule" | "tuition" | "contacts" | "photos" | "documents";

export function StudentDetail({
  student,
  enrollments,
  schedule,
  guardians,
  extendedContacts,
}: StudentDetailProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile form state
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [preferredName, setPreferredName] = useState(student.preferred_name ?? "");
  const [dob, setDob] = useState(student.date_of_birth);
  const [active, setActive] = useState(student.active);
  const [medicalNotes, setMedicalNotes] = useState(student.medical_notes ?? "");
  const [mediaConsent, setMediaConsent] = useState(student.media_consent);
  const [addressLine1, setAddressLine1] = useState(student.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(student.address_line_2 ?? "");
  const [city, setCity] = useState(student.city ?? "");
  const [stateVal, setStateVal] = useState(student.state ?? "");
  const [zipCode, setZipCode] = useState(student.zip_code ?? "");
  const [avatarUrl, setAvatarUrl] = useState(student.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emergency contact state
  const [ecName, setEcName] = useState(student.emergency_contact?.name ?? "");
  const [ecPhone, setEcPhone] = useState(student.emergency_contact?.phone ?? "");
  const [ecRelationship, setEcRelationship] = useState(student.emergency_contact?.relationship ?? "");
  const [ecEmail, setEcEmail] = useState(student.emergency_contact?.email ?? "");

  // Schedule week
  const [weekOffset, setWeekOffset] = useState(0);

  // Contacts tab
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showAddExtended, setShowAddExtended] = useState(false);
  const [guardianSearchQ, setGuardianSearchQ] = useState("");
  const [guardianResults, setGuardianResults] = useState<SearchResult[]>([]);
  const [guardianSearched, setGuardianSearched] = useState(false);
  const [newGuardianMode, setNewGuardianMode] = useState<"search" | "form">("search");
  const [newGuardian, setNewGuardian] = useState({
    profileId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    relationship: "mother",
    isPrimary: false,
    isBilling: false,
    isEmergency: true,
  });

  const age = calculateAge(dob);
  const activeEnrollments = enrollments.filter((e) =>
    ["active", "trial"].includes(e.status)
  );
  const droppedEnrollments = enrollments.filter((e) => e.status === "dropped");

  // ── Handlers ──────────────────────────────────────────────

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/avatar`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.url) setAvatarUrl(data.url);
    } catch {
      setError("Failed to upload avatar");
    }
    setUploading(false);
  }

  async function handleSaveProfile() {
    if (!mediaConsent) {
      setError("Media consent is required before saving.");
      return;
    }
    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set("id", student.id);
    fd.set("first_name", firstName);
    fd.set("last_name", lastName);
    fd.set("preferred_name", preferredName);
    fd.set("date_of_birth", dob);
    fd.set("active", String(active));
    fd.set("medical_notes", medicalNotes);
    fd.set("media_consent", String(mediaConsent));
    fd.set("address_line_1", addressLine1);
    fd.set("address_line_2", addressLine2);
    fd.set("city", city);
    fd.set("state", stateVal);
    fd.set("zip_code", zipCode);
    fd.set(
      "emergency_contact",
      JSON.stringify({
        name: ecName,
        phone: ecPhone,
        relationship: ecRelationship,
        email: ecEmail,
      })
    );

    const result = await updateStudent(fd);
    setSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      // Geocode address if present
      if (addressLine1 || city || zipCode) {
        fetch("/api/admin/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "students",
            record_id: student.id,
            address_line_1: addressLine1,
            city,
            state: stateVal,
            zip_code: zipCode,
          }),
        }).catch(() => {});
      }
      router.refresh();
    }
  }

  async function searchGuardians(q: string) {
    if (q.length < 2) return;
    const res = await fetch(`/api/admin/profiles/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGuardianResults(data.profiles ?? []);
    setGuardianSearched(true);
  }

  async function handleAddGuardian() {
    setSaving(true);
    setError(null);
    if (newGuardian.profileId) {
      const fd = new FormData();
      fd.set("student_id", student.id);
      fd.set("profile_id", newGuardian.profileId);
      fd.set("relationship", newGuardian.relationship);
      fd.set("is_primary", String(newGuardian.isPrimary));
      fd.set("is_billing", String(newGuardian.isBilling));
      fd.set("is_emergency", String(newGuardian.isEmergency));
      fd.set("portal_access", "true");
      const result = await addGuardian(fd);
      if ("error" in result && result.error) setError(result.error);
    } else {
      const fd = new FormData();
      fd.set("student_id", student.id);
      fd.set("first_name", newGuardian.firstName);
      fd.set("last_name", newGuardian.lastName);
      fd.set("email", newGuardian.email);
      fd.set("phone", newGuardian.phone);
      fd.set("relationship", newGuardian.relationship);
      fd.set("is_primary", String(newGuardian.isPrimary));
      fd.set("is_billing", String(newGuardian.isBilling));
      fd.set("is_emergency", String(newGuardian.isEmergency));
      const result = await createProfileAndLinkGuardian(fd);
      if ("error" in result && result.error) setError(result.error);
    }
    setSaving(false);
    setShowAddGuardian(false);
    setNewGuardianMode("search");
    setNewGuardian({
      profileId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      relationship: "mother",
      isPrimary: false,
      isBilling: false,
      isEmergency: true,
    });
    router.refresh();
  }

  async function handleAddExtendedContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("student_id", student.id);
    const result = await addExtendedContact(fd);
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setShowAddExtended(false);
      router.refresh();
    }
  }

  async function handleRemoveExtended(contactId: string) {
    const fd = new FormData();
    fd.set("contact_id", contactId);
    fd.set("student_id", student.id);
    await removeExtendedContact(fd);
    router.refresh();
  }

  async function handleRemoveGuardian(guardianId: string) {
    const fd = new FormData();
    fd.set("id", guardianId);
    await removeGuardian(fd);
    router.refresh();
  }

  // ── Render ─────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "classes", label: "Classes" },
    { key: "skills", label: "Skills" },
    { key: "evaluations", label: "Evaluations" },
    { key: "schedule", label: "Schedule" },
    { key: "photos", label: "Photos" },
    { key: "documents", label: "Documents" },
    { key: "tuition", label: "Tuition" },
    { key: "contacts", label: "Contacts" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-cloud flex items-center justify-center overflow-hidden border-2 border-silver">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-heading text-lavender">
                {firstName[0]}
                {lastName[0]}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-lavender text-white flex items-center justify-center text-xs hover:bg-lavender-dark transition-colors"
          >
            {uploading ? "..." : "+"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            {preferredName || firstName} {lastName}
            {preferredName && preferredName !== firstName && (
              <span className="text-base text-mist ml-2">
                ({firstName})
              </span>
            )}
          </h1>
          <p className="text-sm text-slate">
            Age {age} &middot; {student.current_level ?? "No level"} &middot;{" "}
            <span className={active ? "text-[#5A9E6F]" : "text-[#C45B5B]"}>
              {active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
      </div>

      {/* Media consent warning */}
      {!mediaConsent && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
          Media consent has not been recorded for this student. Consent is
          required before saving profile changes.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-silver flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`${TAB_BASE} ${tab === t.key ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Profile ── */}
      {tab === "profile" && (
        <div className="space-y-6">
          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Basic Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>First Name *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Last Name *</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Preferred Name</label>
                <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="If different from first name" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Date of Birth *</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={INPUT} />
                <p className="text-xs text-mist mt-1">Age: {age}</p>
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <div
                role="switch"
                aria-checked={active}
                onClick={() => setActive(!active)}
                className={`w-10 h-6 rounded-full cursor-pointer transition-colors ${active ? "bg-[#5A9E6F]" : "bg-silver"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${active ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </div>
              <span className="text-charcoal">Active Student</span>
            </label>
          </div>

          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Address
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL}>Address Line 1</label>
                <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={INPUT} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Address Line 2</label>
                <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>State</label>
                <Select value={stateVal || "__none__"} onValueChange={(v) => setStateVal(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select state</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={LABEL}>ZIP Code</label>
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={INPUT} maxLength={10} />
              </div>
            </div>
          </div>

          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Emergency Contact
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Name</label>
                <input type="text" value={ecName} onChange={(e) => setEcName(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Relationship</label>
                <input type="text" value={ecRelationship} onChange={(e) => setEcRelationship(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} className={INPUT} />
              </div>
            </div>
          </div>

          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Medical &amp; Consent
            </h2>
            <div>
              <label className={LABEL}>Medical Notes</label>
              <textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={mediaConsent} onChange={(e) => setMediaConsent(e.target.checked)} className="rounded border-silver accent-lavender" />
              Media consent granted *
            </label>
            {student.media_consent_date && (
              <p className="text-xs text-mist">
                Consent recorded: {new Date(student.media_consent_date).toLocaleDateString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving || !mediaConsent}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      )}

      {/* ── Tab 2: Classes ── */}
      {tab === "classes" && (
        <div className="space-y-6">
          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Active Enrollments ({activeEnrollments.length})
            </h2>
            {activeEnrollments.length === 0 ? (
              <p className="text-sm text-mist">No active enrollments.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver">
                      <th className="text-left py-2 font-medium text-slate">Class</th>
                      <th className="text-left py-2 font-medium text-slate">Schedule</th>
                      <th className="text-left py-2 font-medium text-slate">Teacher</th>
                      <th className="text-left py-2 font-medium text-slate">Type</th>
                      <th className="text-left py-2 font-medium text-slate">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver/50">
                    {activeEnrollments.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 text-charcoal">{e.class?.simple_name || e.class?.name || "-"}</td>
                        <td className="py-2 text-slate">
                          {e.class?.day_of_week != null
                            ? `${DAY_NAMES[e.class.day_of_week]} ${formatTime(e.class.start_time)} - ${formatTime(e.class.end_time)}`
                            : "-"}
                        </td>
                        <td className="py-2 text-slate">{e.teacherName || "-"}</td>
                        <td className="py-2 text-slate capitalize">{e.enrollment_type}</td>
                        <td className="py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[e.status] ?? "bg-cloud text-slate"}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {droppedEnrollments.length > 0 && (
            <div className={CARD}>
              <h2 className="text-lg font-heading font-semibold text-charcoal">
                Enrollment History ({droppedEnrollments.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver">
                      <th className="text-left py-2 font-medium text-slate">Class</th>
                      <th className="text-left py-2 font-medium text-slate">Enrolled</th>
                      <th className="text-left py-2 font-medium text-slate">Dropped</th>
                      <th className="text-left py-2 font-medium text-slate">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver/50">
                    {droppedEnrollments.map((e) => (
                      <tr key={e.id} className="text-mist">
                        <td className="py-2">{e.class?.simple_name || e.class?.name || "-"}</td>
                        <td className="py-2">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                        <td className="py-2">{e.dropped_at ? new Date(e.dropped_at).toLocaleDateString() : "-"}</td>
                        <td className="py-2">
                          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-[#C45B5B]/10 text-[#C45B5B]">
                            Dropped
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Schedule ── */}
      {tab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setWeekOffset(weekOffset - 1)} className="h-8 px-3 rounded-lg border border-silver bg-white text-sm hover:bg-cloud">Prev</button>
            <button type="button" onClick={() => setWeekOffset(0)} className="h-8 px-3 rounded-lg border border-silver bg-white text-sm hover:bg-cloud">This Week</button>
            <button type="button" onClick={() => setWeekOffset(weekOffset + 1)} className="h-8 px-3 rounded-lg border border-silver bg-white text-sm hover:bg-cloud">Next</button>
            <span className="text-sm text-mist">
              {weekOffset === 0 ? "This week" : weekOffset > 0 ? `${weekOffset} week${weekOffset > 1 ? "s" : ""} ahead` : `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? "s" : ""} ago`}
            </span>
          </div>

          <div className={CARD}>
            {schedule.length === 0 ? (
              <p className="text-sm text-mist">No scheduled sessions this week.</p>
            ) : (
              <div className="divide-y divide-silver/50">
                {schedule.map((s) => {
                  const dayName = DAY_NAMES[new Date(s.event_date + "T00:00:00").getDay()];
                  return (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-charcoal text-sm">
                          {dayName}, {new Date(s.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-sm text-slate">
                          {formatTime(s.start_time)} - {formatTime(s.end_time)} &middot; {s.className || "Class"}{" "}
                          {s.teacherName && <span className="text-mist">&middot; {s.teacherName}</span>}{" "}
                          {s.roomName && <span className="text-mist">&middot; {s.roomName}</span>}
                        </p>
                      </div>
                      <a
                        href={googleCalendarUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-lavender hover:text-lavender-dark font-medium shrink-0"
                      >
                        + Calendar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 4: Tuition ── */}
      {tab === "tuition" && (
        <div className="space-y-6">
          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Current Monthly Tuition
            </h2>
            {activeEnrollments.length === 0 ? (
              <p className="text-sm text-mist">No active enrollments.</p>
            ) : (
              <>
                <div className="divide-y divide-silver/50">
                  {activeEnrollments.map((e) => {
                    const fee = e.class?.fee_cents ? e.class.fee_cents / 100 : 0;
                    return (
                      <div key={e.id} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="text-charcoal font-medium">{e.class?.simple_name || e.class?.name || "Class"}</p>
                          <p className="text-xs text-mist">
                            {e.class?.level ?? ""} {e.class?.style ?? ""}
                          </p>
                        </div>
                        <span className="text-charcoal font-medium">
                          {fee > 0 ? `$${fee.toFixed(2)}/mo` : "TBD"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-silver pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-charcoal">Total</span>
                  <span className="text-lg font-heading font-semibold text-charcoal">
                    ${(
                      activeEnrollments.reduce(
                        (sum, e) => sum + (e.class?.fee_cents ?? 0),
                        0
                      ) / 100
                    ).toFixed(2)}
                    /mo
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 5: Contacts ── */}
      {tab === "contacts" && (
        <div className="space-y-6">
          {/* Guardians */}
          <div className={CARD}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-semibold text-charcoal">
                Guardians ({guardians.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddGuardian(!showAddGuardian);
                  setNewGuardianMode("search");
                  setGuardianSearched(false);
                }}
                className="text-sm text-lavender hover:text-lavender-dark font-medium"
              >
                {showAddGuardian ? "Cancel" : "+ Add Guardian"}
              </button>
            </div>

            {showAddGuardian && (
              <div className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3">
                {newGuardianMode === "search" && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guardianSearchQ}
                        onChange={(e) => setGuardianSearchQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchGuardians(guardianSearchQ); } }}
                        placeholder="Search existing profiles..."
                        className={`flex-1 ${INPUT}`}
                      />
                      <button type="button" onClick={() => searchGuardians(guardianSearchQ)} className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud px-4 text-sm">Search</button>
                    </div>
                    {guardianResults.length > 0 && (
                      <div className="rounded-lg border border-silver bg-white divide-y divide-silver/50 max-h-32 overflow-y-auto">
                        {guardianResults.map((p) => (
                          <button key={p.id} type="button" onClick={() => { setNewGuardian((g) => ({ ...g, profileId: p.id, firstName: p.name.split(" ")[0] ?? "", lastName: p.name.split(" ").slice(1).join(" "), email: p.email ?? "" })); setNewGuardianMode("form"); setGuardianResults([]); }} className="w-full text-left px-3 py-2 hover:bg-lavender/5 text-sm">
                            <span className="font-medium">{p.name}</span>
                            {p.email && <span className="text-mist ml-2">{p.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {guardianSearched && guardianResults.length === 0 && (
                      <p className="text-xs text-mist">No profiles found.</p>
                    )}
                    <button type="button" onClick={() => setNewGuardianMode("form")} className="text-sm text-lavender font-medium">Create new profile</button>
                  </>
                )}

                {newGuardianMode === "form" && (
                  <>
                    {newGuardian.profileId && (
                      <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-3 py-2 flex items-center justify-between text-sm">
                        <span>Linking: <strong>{newGuardian.firstName} {newGuardian.lastName}</strong></span>
                        <button type="button" onClick={() => { setNewGuardian((g) => ({ ...g, profileId: "" })); setNewGuardianMode("search"); }} className="text-xs text-[#C45B5B]">Clear</button>
                      </div>
                    )}
                    {!newGuardian.profileId && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className={LABEL}>First Name *</label><input type="text" value={newGuardian.firstName} onChange={(e) => setNewGuardian((g) => ({ ...g, firstName: e.target.value }))} className={INPUT} /></div>
                        <div><label className={LABEL}>Last Name *</label><input type="text" value={newGuardian.lastName} onChange={(e) => setNewGuardian((g) => ({ ...g, lastName: e.target.value }))} className={INPUT} /></div>
                        <div><label className={LABEL}>Email</label><input type="email" value={newGuardian.email} onChange={(e) => setNewGuardian((g) => ({ ...g, email: e.target.value }))} className={INPUT} /></div>
                        <div><label className={LABEL}>Phone</label><input type="tel" value={newGuardian.phone} onChange={(e) => setNewGuardian((g) => ({ ...g, phone: e.target.value }))} className={INPUT} /></div>
                      </div>
                    )}
                    <div>
                      <label className={LABEL}>Relationship</label>
                      <Select value={newGuardian.relationship} onValueChange={(v) => setNewGuardian((g) => ({ ...g, relationship: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIPS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isPrimary} onChange={(e) => setNewGuardian((g) => ({ ...g, isPrimary: e.target.checked }))} className="rounded border-silver" />Primary</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isBilling} onChange={(e) => setNewGuardian((g) => ({ ...g, isBilling: e.target.checked }))} className="rounded border-silver" />Billing</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isEmergency} onChange={(e) => setNewGuardian((g) => ({ ...g, isEmergency: e.target.checked }))} className="rounded border-silver" />Emergency</label>
                    </div>
                    <button type="button" disabled={saving || (!newGuardian.profileId && (!newGuardian.firstName || !newGuardian.lastName))} onClick={handleAddGuardian} className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">
                      {saving ? "Adding..." : "Add Guardian"}
                    </button>
                  </>
                )}
              </div>
            )}

            {guardians.length === 0 ? (
              <p className="text-sm text-mist">No guardians linked.</p>
            ) : (
              <div className="divide-y divide-silver/50">
                {guardians.map((g) => (
                  <div key={g.id} className="py-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-charcoal text-sm">
                        {[g.first_name, g.last_name].filter(Boolean).join(" ")}
                        <span className="ml-2 text-xs text-mist capitalize">({g.relationship})</span>
                      </p>
                      <p className="text-xs text-mist">
                        {g.email ?? ""}{g.phone ? ` \u00B7 ${g.phone}` : ""}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {g.is_primary && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_BADGES.primary}`}>Primary</span>}
                        {g.is_billing && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_BADGES.billing}`}>Billing</span>}
                        {g.is_emergency && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_BADGES.emergency}`}>Emergency</span>}
                        {g.portal_access && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A9E6F]/10 text-[#5A9E6F]">Portal</span>}
                        {g.email_opt_in && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cloud text-mist">Email</span>}
                        {g.sms_opt_in && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cloud text-mist">SMS</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemoveGuardian(g.id)} className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extended Contacts */}
          <div className={CARD}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-semibold text-charcoal">
                Extended Contacts ({extendedContacts.length})
              </h2>
              <button type="button" onClick={() => setShowAddExtended(!showAddExtended)} className="text-sm text-lavender hover:text-lavender-dark font-medium">
                {showAddExtended ? "Cancel" : "+ Add Contact"}
              </button>
            </div>

            {showAddExtended && (
              <form onSubmit={handleAddExtendedContact} className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={LABEL}>First Name *</label><input name="first_name" required className={INPUT} /></div>
                  <div><label className={LABEL}>Last Name *</label><input name="last_name" required className={INPUT} /></div>
                  <div><label className={LABEL}>Email</label><input name="email" type="email" className={INPUT} /></div>
                  <div><label className={LABEL}>Phone</label><input name="phone" type="tel" className={INPUT} /></div>
                  <div>
                    <label className={LABEL}>Relationship</label>
                    <input name="relationship" placeholder="e.g. Grandparent, Family Friend" className={INPUT} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_live_stream" value="true" className="rounded border-silver" />Notify: Live Stream</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_recordings" value="true" className="rounded border-silver" />Notify: Recordings</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_photos" value="true" className="rounded border-silver" />Notify: Photos</label>
                </div>
                <button type="submit" disabled={saving} className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">
                  {saving ? "Adding..." : "Add Contact"}
                </button>
              </form>
            )}

            {extendedContacts.length === 0 ? (
              <p className="text-sm text-mist">No extended contacts.</p>
            ) : (
              <div className="divide-y divide-silver/50">
                {extendedContacts.map((c) => (
                  <div key={c.id} className="py-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-charcoal text-sm">
                        {c.first_name} {c.last_name}
                        {c.relationship && <span className="ml-2 text-xs text-mist">({c.relationship})</span>}
                      </p>
                      <p className="text-xs text-mist">
                        {c.email ?? ""}{c.phone ? ` \u00B7 ${c.phone}` : ""}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {c.notify_live_stream && <span className="text-[10px] px-1.5 py-0.5 rounded bg-lavender/10 text-lavender-dark">Stream</span>}
                        {c.notify_recordings && <span className="text-[10px] px-1.5 py-0.5 rounded bg-lavender/10 text-lavender-dark">Recordings</span>}
                        {c.notify_photos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-lavender/10 text-lavender-dark">Photos</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemoveExtended(c.id)} className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Skills ── */}
      {tab === "skills" && <SkillsTab studentId={student.id} />}

      {/* ── Tab: Evaluations ── */}
      {tab === "evaluations" && <EvaluationsTab studentId={student.id} />}

      {/* ── Tab: Photos ── */}
      {tab === "photos" && (
        <PhotosTab studentId={student.id} initialAvatarUrl={avatarUrl} />
      )}

      {/* ── Tab: Documents ── */}
      {tab === "documents" && <DocumentsTab studentId={student.id} />}
    </div>
  );
}
