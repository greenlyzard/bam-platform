"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SimpleSelect } from "@/components/ui/select";
import {
  updateFamily,
  addStudentToFamily,
  addFamilyContact,
  removeFamilyContact,
  addGuardian,
  removeGuardian,
  createProfileAndLinkGuardian,
} from "../actions";
import { addExtendedContact, removeExtendedContact } from "../../students/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Family, FamilyContact } from "@/types/database";

// ── Types ────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  current_level: string | null;
  avatar_url: string | null;
  media_consent: boolean;
  active: boolean;
  [key: string]: unknown;
}

interface EnrollmentRow {
  id: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  student_id: string;
  students: { id: string; first_name: string; last_name: string } | null;
  classes: {
    id: string;
    name: string;
    simple_name: string | null;
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    room: string | null;
    fee_cents: number | null;
  } | null;
}

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface GuardianRelationshipRow {
  student_id: string;
  relationship: string;
  is_primary: boolean;
  is_billing: boolean;
  is_emergency: boolean;
  portal_access: boolean;
  guardian_id: string;
}

interface UniqueGuardian {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  relationships: GuardianRelationshipRow[];
}

interface ExtendedContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  notify_live_stream: boolean;
  notify_recordings: boolean;
  notify_photos: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
}

interface FamilyDetailProps {
  family: Family & { profiles?: ProfileData | null };
  students: StudentRow[];
  contacts: FamilyContact[];
  enrollments: EnrollmentRow[];
  guardians: UniqueGuardian[];
  extendedContacts: ExtendedContactRow[];
}

// ── Styles / Helpers ─────────────────────────────────────────

const INPUT = "w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const CARD = "rounded-xl border border-silver bg-white p-5 space-y-4";
const LABEL = "block text-xs font-medium text-slate mb-1";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ROLE_BADGES: Record<string, string> = {
  primary: "bg-lavender/10 text-lavender-dark",
  billing: "bg-[#D4A843]/10 text-[#D4A843]",
  emergency: "bg-[#C45B5B]/10 text-[#C45B5B]",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  trial: "bg-lavender/10 text-lavender-dark",
  dropped: "bg-[#C45B5B]/10 text-[#C45B5B]",
  waitlist: "bg-[#D4A843]/10 text-[#D4A843]",
};

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

// ── Component ────────────────────────────────────────────────

export function FamilyDetail({
  family,
  students,
  contacts,
  enrollments,
  guardians,
  extendedContacts,
}: FamilyDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showAddExtended, setShowAddExtended] = useState(false);
  const [addStudentGender, setAddStudentGender] = useState("");
  const [childFilter, setChildFilter] = useState("__all__");

  // Guardian add
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
    relationship: "father",
    isPrimary: false,
    isBilling: false,
    isEmergency: true,
    selectedStudentIds: [] as string[],
  });

  // Primary guardian info for header
  const primaryGuardian = guardians.find((g) =>
    g.relationships.some((r) => r.is_primary)
  );

  // Active enrollments with classes for tuition
  const activeEnrollments = enrollments.filter((e) =>
    ["active", "trial"].includes(e.status)
  );

  // Filtered enrollments by child
  const filteredEnrollments =
    childFilter === "__all__"
      ? activeEnrollments
      : activeEnrollments.filter((e) => e.student_id === childFilter);

  const totalTuitionCents = activeEnrollments.reduce((sum, e) => {
    const cls = (Array.isArray(e.classes) ? e.classes[0] : e.classes) as { fee_cents: number | null } | null;
    return sum + (cls?.fee_cents ?? 0);
  }, 0);

  // ── Handlers ──────────────────────────────────────────────

  async function handleFamilySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateFamily(fd);
    setSaving(false);
    if ("error" in result && result.error) setError(result.error);
  }

  async function handleAddStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await addStudentToFamily(fd);
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setShowAddStudent(false);
      router.refresh();
    }
  }

  async function searchGuardianProfiles(q: string) {
    if (q.length < 2) return;
    const res = await fetch(`/api/admin/profiles/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGuardianResults(data.profiles ?? []);
    setGuardianSearched(true);
  }

  async function handleAddGuardian() {
    if (newGuardian.selectedStudentIds.length === 0) {
      setError("Select at least one student");
      return;
    }
    setSaving(true);
    setError(null);
    for (const studentId of newGuardian.selectedStudentIds) {
      if (newGuardian.profileId) {
        const fd = new FormData();
        fd.set("student_id", studentId);
        fd.set("profile_id", newGuardian.profileId);
        fd.set("relationship", newGuardian.relationship);
        fd.set("is_primary", String(newGuardian.isPrimary));
        fd.set("is_billing", String(newGuardian.isBilling));
        fd.set("is_emergency", String(newGuardian.isEmergency));
        fd.set("portal_access", "true");
        await addGuardian(fd);
      } else {
        const fd = new FormData();
        fd.set("student_id", studentId);
        fd.set("first_name", newGuardian.firstName);
        fd.set("last_name", newGuardian.lastName);
        fd.set("email", newGuardian.email);
        fd.set("phone", newGuardian.phone);
        fd.set("relationship", newGuardian.relationship);
        fd.set("is_primary", String(newGuardian.isPrimary));
        fd.set("is_billing", String(newGuardian.isBilling));
        fd.set("is_emergency", String(newGuardian.isEmergency));
        await createProfileAndLinkGuardian(fd);
      }
    }
    setSaving(false);
    setShowAddGuardian(false);
    setNewGuardianMode("search");
    setNewGuardian({ profileId: "", firstName: "", lastName: "", email: "", phone: "", relationship: "father", isPrimary: false, isBilling: false, isEmergency: true, selectedStudentIds: [] });
    router.refresh();
  }

  async function handleRemoveGuardian(guardianId: string) {
    const fd = new FormData();
    fd.set("id", guardianId);
    await removeGuardian(fd);
    router.refresh();
  }

  async function handleAddExtendedContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    // Link to first student in family
    if (students.length > 0 && !fd.get("student_id")) {
      fd.set("student_id", students[0].id);
    }
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
    if (!students.length) return;
    const fd = new FormData();
    fd.set("contact_id", contactId);
    fd.set("student_id", students[0].id);
    await removeExtendedContact(fd);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">{error}</div>
      )}

      {/* Header: Primary guardian info */}
      {primaryGuardian && (
        <div className={CARD}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-charcoal">
                {[primaryGuardian.first_name, primaryGuardian.last_name].filter(Boolean).join(" ")}
              </p>
              <p className="text-sm text-mist">
                {primaryGuardian.email ?? ""}{primaryGuardian.phone ? ` \u00B7 ${primaryGuardian.phone}` : ""}
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-lavender/10 text-lavender-dark">Primary Guardian</span>
          </div>
        </div>
      )}

      {/* Section 1: Students as cards */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Students ({students.length})</h2>
          <button onClick={() => setShowAddStudent(!showAddStudent)} className="text-sm text-lavender hover:text-lavender-dark font-medium">
            {showAddStudent ? "Cancel" : "+ Add Student"}
          </button>
        </div>

        {showAddStudent && (
          <form onSubmit={handleAddStudent} className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3">
            <input type="hidden" name="family_id" value={family.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="first_name" required placeholder="First name *" className="h-9 rounded-lg border border-silver bg-white px-3 text-sm" />
              <input name="last_name" required placeholder="Last name *" className="h-9 rounded-lg border border-silver bg-white px-3 text-sm" />
              <input name="date_of_birth" type="date" required className="h-9 rounded-lg border border-silver bg-white px-3 text-sm" />
              <input type="hidden" name="gender" value={addStudentGender} />
              <SimpleSelect
                value={addStudentGender}
                onValueChange={setAddStudentGender}
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                  { value: "other", label: "Other" },
                ]}
                placeholder="Gender"
              />
            </div>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">Add Student</button>
          </form>
        )}

        {students.length === 0 ? (
          <p className="text-sm text-mist">No students.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {students.map((s) => {
              const age = calculateAge(s.date_of_birth);
              const enrollCount = activeEnrollments.filter((e) => e.student_id === s.id).length;
              return (
                <Link
                  key={s.id}
                  href={`/admin/students/${s.id}`}
                  className="flex items-center gap-3 rounded-lg border border-silver/50 bg-cloud/20 p-3 hover:bg-lavender/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-cloud flex items-center justify-center overflow-hidden border border-silver shrink-0">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.first_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-lavender">{s.first_name[0]}{s.last_name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal text-sm truncate">
                      {s.preferred_name || s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs text-mist">
                      Age {age} &middot; {s.current_level ?? "No level"} &middot; {enrollCount} class{enrollCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.active ? "bg-[#5A9E6F]/10 text-[#5A9E6F]" : "bg-[#9E99A7]/10 text-[#9E99A7]"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                    {!s.media_consent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C45B5B]/10 text-[#C45B5B]">No Consent</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: All Classes (aggregated) */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Classes</h2>
          {students.length > 1 && (
            <div className="w-48">
              <Select value={childFilter} onValueChange={setChildFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All children" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All children</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {filteredEnrollments.length === 0 ? (
          <p className="text-sm text-mist">No active enrollments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver">
                  <th className="text-left py-2 font-medium text-slate">Student</th>
                  <th className="text-left py-2 font-medium text-slate">Class</th>
                  <th className="text-left py-2 font-medium text-slate">Schedule</th>
                  <th className="text-left py-2 font-medium text-slate">Status</th>
                  <th className="text-right py-2 font-medium text-slate">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver/50">
                {filteredEnrollments.map((e) => {
                  const studentData = (Array.isArray(e.students) ? e.students[0] : e.students) as { first_name: string; last_name: string } | null;
                  const cls = (Array.isArray(e.classes) ? e.classes[0] : e.classes) as EnrollmentRow["classes"];
                  const fee = cls?.fee_cents ? cls.fee_cents / 100 : 0;
                  return (
                    <tr key={e.id}>
                      <td className="py-2 text-charcoal">{studentData ? `${studentData.first_name} ${studentData.last_name}` : "-"}</td>
                      <td className="py-2 text-charcoal">{cls?.simple_name || cls?.name || "-"}</td>
                      <td className="py-2 text-slate">{cls?.day_of_week != null ? `${DAY_NAMES[cls.day_of_week]} ${formatTime(cls.start_time)}` : "-"}</td>
                      <td className="py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[e.status] ?? "bg-cloud text-slate"}`}>{e.status}</span></td>
                      <td className="py-2 text-right text-slate">{fee > 0 ? `$${fee.toFixed(2)}` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Billing */}
      <div className={CARD}>
        <h2 className="text-lg font-heading font-semibold text-charcoal">Billing</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-mist text-xs">Total Monthly Tuition</dt>
            <dd className="text-xl font-heading font-semibold text-charcoal">
              ${(totalTuitionCents / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-mist text-xs">Account Credit</dt>
            <dd className="text-charcoal font-medium">
              ${Number(family.account_credit).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-mist text-xs">Payment Method</dt>
            <dd className="text-charcoal">
              {family.stripe_customer_id ? `Stripe: ...${family.stripe_customer_id.slice(-4)}` : "Not linked"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Section 4: Guardians */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Guardians ({guardians.length})</h2>
          <button onClick={() => { setShowAddGuardian(!showAddGuardian); setNewGuardianMode("search"); setGuardianSearched(false); }} className="text-sm text-lavender hover:text-lavender-dark font-medium">
            {showAddGuardian ? "Cancel" : "+ Add Guardian"}
          </button>
        </div>

        {showAddGuardian && (
          <div className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3">
            {newGuardianMode === "search" && (
              <>
                <div className="flex gap-2">
                  <input type="text" value={guardianSearchQ} onChange={(e) => setGuardianSearchQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchGuardianProfiles(guardianSearchQ); } }} placeholder="Search profiles..." className={`flex-1 ${INPUT}`} />
                  <button type="button" onClick={() => searchGuardianProfiles(guardianSearchQ)} className="h-10 rounded-lg border border-silver bg-white px-4 text-sm hover:bg-cloud">Search</button>
                </div>
                {guardianResults.length > 0 && (
                  <div className="rounded-lg border border-silver bg-white divide-y divide-silver/50 max-h-32 overflow-y-auto">
                    {guardianResults.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setNewGuardian((g) => ({ ...g, profileId: p.id, firstName: p.name.split(" ")[0] ?? "", lastName: p.name.split(" ").slice(1).join(" "), email: p.email ?? "" })); setNewGuardianMode("form"); setGuardianResults([]); }} className="w-full text-left px-3 py-2 hover:bg-lavender/5 text-sm">
                        <span className="font-medium">{p.name}</span>{p.email && <span className="text-mist ml-2">{p.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {guardianSearched && guardianResults.length === 0 && <p className="text-xs text-mist">No profiles found.</p>}
                <button type="button" onClick={() => setNewGuardianMode("form")} className="text-sm text-lavender font-medium">Create new profile</button>
              </>
            )}
            {newGuardianMode === "form" && (
              <>
                {newGuardian.profileId ? (
                  <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-3 py-2 flex items-center justify-between text-sm">
                    <span>Linking: <strong>{newGuardian.firstName} {newGuardian.lastName}</strong></span>
                    <button type="button" onClick={() => { setNewGuardian((g) => ({ ...g, profileId: "" })); setNewGuardianMode("search"); }} className="text-xs text-[#C45B5B]">Clear</button>
                  </div>
                ) : (
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
                    <SelectContent>{RELATIONSHIPS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={LABEL}>Link to students *</label>
                  <div className="space-y-1">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={newGuardian.selectedStudentIds.includes(s.id)} onChange={(e) => { setNewGuardian((g) => ({ ...g, selectedStudentIds: e.target.checked ? [...g.selectedStudentIds, s.id] : g.selectedStudentIds.filter((id) => id !== s.id) })); }} className="rounded border-silver" />
                        {s.first_name} {s.last_name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isPrimary} onChange={(e) => setNewGuardian((g) => ({ ...g, isPrimary: e.target.checked }))} className="rounded border-silver" />Primary</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isBilling} onChange={(e) => setNewGuardian((g) => ({ ...g, isBilling: e.target.checked }))} className="rounded border-silver" />Billing</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGuardian.isEmergency} onChange={(e) => setNewGuardian((g) => ({ ...g, isEmergency: e.target.checked }))} className="rounded border-silver" />Emergency</label>
                </div>
                <button type="button" disabled={saving || (!newGuardian.profileId && (!newGuardian.firstName || !newGuardian.lastName)) || newGuardian.selectedStudentIds.length === 0} onClick={handleAddGuardian} className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">
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
              <div key={g.profile_id} className="py-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-charcoal text-sm">{[g.first_name, g.last_name].filter(Boolean).join(" ") || "Unknown"}</p>
                    <p className="text-xs text-mist">{g.email ?? ""}{g.phone ? ` \u00B7 ${g.phone}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    {g.email_opt_in && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A9E6F]/10 text-[#5A9E6F]">Email</span>}
                    {g.sms_opt_in && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A9E6F]/10 text-[#5A9E6F]">SMS</span>}
                  </div>
                </div>
                <div className="pl-4 space-y-1">
                  {g.relationships.map((rel) => {
                    const student = students.find((s) => s.id === rel.student_id);
                    return (
                      <div key={rel.guardian_id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate">{student ? `${student.first_name} ${student.last_name}` : "Unknown"}</span>
                          <span className="text-mist capitalize">({rel.relationship})</span>
                          <div className="flex gap-1">
                            {rel.is_primary && <span className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.primary}`}>Primary</span>}
                            {rel.is_billing && <span className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.billing}`}>Billing</span>}
                            {rel.is_emergency && <span className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.emergency}`}>Emergency</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveGuardian(rel.guardian_id)} className="text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium">Remove</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: Extended Contacts */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Extended Contacts ({extendedContacts.length})</h2>
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
              <div><label className={LABEL}>Relationship</label><input name="relationship" placeholder="e.g. Grandparent" className={INPUT} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_live_stream" value="true" className="rounded border-silver" />Live Stream</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_recordings" value="true" className="rounded border-silver" />Recordings</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_photos" value="true" className="rounded border-silver" />Photos</label>
            </div>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50">Add Contact</button>
          </form>
        )}

        {extendedContacts.length === 0 ? (
          <p className="text-sm text-mist">No extended contacts.</p>
        ) : (
          <div className="divide-y divide-silver/50">
            {extendedContacts.map((c) => (
              <div key={c.id} className="py-3 flex items-start justify-between">
                <div>
                  <p className="font-medium text-charcoal text-sm">{c.first_name} {c.last_name}{c.relationship && <span className="ml-2 text-xs text-mist">({c.relationship})</span>}</p>
                  <p className="text-xs text-mist">{c.email ?? ""}{c.phone ? ` \u00B7 ${c.phone}` : ""}</p>
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

      {/* Family Info (editable) */}
      <div className={CARD}>
        <h2 className="text-lg font-heading font-semibold text-charcoal">Family Information</h2>
        <form onSubmit={handleFamilySubmit} className="space-y-4">
          <input type="hidden" name="id" value={family.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={LABEL}>Family Name *</label><input name="family_name" required defaultValue={family.family_name} className={INPUT} /></div>
            <div><label className={LABEL}>Billing Email</label><input name="billing_email" type="email" defaultValue={family.billing_email ?? ""} className={INPUT} /></div>
            <div><label className={LABEL}>Billing Phone</label><input name="billing_phone" defaultValue={family.billing_phone ?? ""} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><textarea name="notes" rows={3} defaultValue={family.notes ?? ""} className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none" /></div>
          <button type="submit" disabled={saving} className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
        </form>
      </div>
    </div>
  );
}
