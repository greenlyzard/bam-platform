"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateFamily,
  addStudentToFamily,
  addFamilyContact,
  removeFamilyContact,
  addGuardian,
  removeGuardian,
  updateGuardian,
  createProfileAndLinkGuardian,
} from "../actions";
import type { Family, FamilyContact } from "@/types/database";

// ── Types ────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_level: string | null;
  medical_notes: string | null;
  allergy_notes: string | null;
  gender: string | null;
  photo_consent: boolean;
  active: boolean;
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

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

interface FamilyDetailProps {
  family: Family & { profiles?: ProfileData | null };
  students: StudentRow[];
  contacts: FamilyContact[];
  enrollments: EnrollmentRow[];
  guardians: UniqueGuardian[];
}

// ── Styles ───────────────────────────────────────────────────

const INPUT =
  "w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const INPUT_SM =
  "h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const CARD = "rounded-xl border border-silver bg-white p-5 space-y-4";
const LABEL = "block text-xs font-medium text-slate mb-1";

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "stepparent", label: "Stepparent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "guardian", label: "Guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlist: "bg-[#D4A843]/10 text-[#D4A843]",
  dropped: "bg-[#C45B5B]/10 text-[#C45B5B]",
  pending_payment: "bg-[#D4A843]/10 text-[#D4A843]",
  completed: "bg-[#9E99A7]/10 text-[#9E99A7]",
};

const ROLE_BADGES: Record<string, string> = {
  primary: "bg-lavender/10 text-lavender-dark",
  billing: "bg-[#D4A843]/10 text-[#D4A843]",
  emergency: "bg-[#C45B5B]/10 text-[#C45B5B]",
};

// ── Component ────────────────────────────────────────────────

export function FamilyDetail({
  family,
  students,
  contacts,
  enrollments,
  guardians,
}: FamilyDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactType, setContactType] = useState<
    "emergency" | "stream" | "both"
  >("emergency");

  // Guardian add form state
  const [guardianSearch, setGuardianSearch] = useState("");
  const [guardianSearchResults, setGuardianSearchResults] = useState<SearchResult[]>([]);
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

  const emergencyContacts = contacts.filter(
    (c) => c.contact_type === "emergency" || c.contact_type === "both"
  );
  const streamContacts = contacts.filter(
    (c) => c.contact_type === "stream" || c.contact_type === "both"
  );

  // ── Handlers ───────────────────────────────────────────────

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

  async function handleAddContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await addFamilyContact(fd);
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setShowAddContact(false);
      router.refresh();
    }
  }

  async function handleRemoveContact(contactId: string) {
    const fd = new FormData();
    fd.set("id", contactId);
    fd.set("family_id", family.id);
    await removeFamilyContact(fd);
    router.refresh();
  }

  async function searchGuardianProfiles(q: string) {
    if (q.length < 2) return;
    try {
      const res = await fetch(
        `/api/admin/profiles/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setGuardianSearchResults(data.profiles ?? []);
      setGuardianSearched(true);
    } catch {
      setGuardianSearchResults([]);
    }
  }

  function selectGuardianProfile(profile: SearchResult) {
    setNewGuardian((g) => ({
      ...g,
      profileId: profile.id,
      firstName: profile.name.split(" ")[0] ?? "",
      lastName: profile.name.split(" ").slice(1).join(" ") ?? "",
      email: profile.email ?? "",
    }));
    setNewGuardianMode("form");
    setGuardianSearchResults([]);
  }

  async function handleAddGuardian() {
    if (newGuardian.selectedStudentIds.length === 0) {
      setError("Select at least one student to link this guardian to");
      return;
    }
    setSaving(true);
    setError(null);

    for (const studentId of newGuardian.selectedStudentIds) {
      if (newGuardian.profileId) {
        // Link existing profile
        const fd = new FormData();
        fd.set("student_id", studentId);
        fd.set("profile_id", newGuardian.profileId);
        fd.set("relationship", newGuardian.relationship);
        fd.set("is_primary", String(newGuardian.isPrimary));
        fd.set("is_billing", String(newGuardian.isBilling));
        fd.set("is_emergency", String(newGuardian.isEmergency));
        fd.set("portal_access", "true");
        const result = await addGuardian(fd);
        if ("error" in result && result.error) {
          setError(result.error);
          break;
        }
      } else {
        // Create new profile and link
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
        const result = await createProfileAndLinkGuardian(fd);
        if ("error" in result && result.error) {
          setError(result.error);
          break;
        }
      }
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
      relationship: "father",
      isPrimary: false,
      isBilling: false,
      isEmergency: true,
      selectedStudentIds: [],
    });
    router.refresh();
  }

  async function handleRemoveGuardian(guardianId: string) {
    const fd = new FormData();
    fd.set("id", guardianId);
    await removeGuardian(fd);
    router.refresh();
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
          {error}
        </div>
      )}

      {/* ── Guardians Section ── */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Guardians
          </h2>
          <button
            onClick={() => {
              setShowAddGuardian(!showAddGuardian);
              setNewGuardianMode("search");
              setGuardianSearched(false);
              setGuardianSearchResults([]);
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
                    value={guardianSearch}
                    onChange={(e) => setGuardianSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchGuardianProfiles(guardianSearch);
                      }
                    }}
                    placeholder="Search existing profiles by name or email..."
                    className={`flex-1 ${INPUT_SM}`}
                  />
                  <button
                    type="button"
                    onClick={() => searchGuardianProfiles(guardianSearch)}
                    className="h-9 rounded-lg border border-silver bg-white hover:bg-cloud text-charcoal text-sm font-medium px-4"
                  >
                    Search
                  </button>
                </div>

                {guardianSearchResults.length > 0 && (
                  <div className="rounded-lg border border-silver bg-white divide-y divide-silver/50 max-h-32 overflow-y-auto">
                    {guardianSearchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectGuardianProfile(p)}
                        className="w-full text-left px-3 py-2 hover:bg-lavender/5 text-sm"
                      >
                        <span className="font-medium text-charcoal">
                          {p.name}
                        </span>
                        {p.email && (
                          <span className="text-mist ml-2">{p.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {guardianSearched && guardianSearchResults.length === 0 && (
                  <p className="text-xs text-mist">No existing profiles found.</p>
                )}

                <button
                  type="button"
                  onClick={() => setNewGuardianMode("form")}
                  className="text-sm text-lavender hover:text-lavender-dark font-medium"
                >
                  Create new profile instead
                </button>
              </>
            )}

            {newGuardianMode === "form" && (
              <>
                {newGuardian.profileId && (
                  <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-3 py-2 flex items-center justify-between text-sm">
                    <span>
                      Linking:{" "}
                      <strong>
                        {newGuardian.firstName} {newGuardian.lastName}
                      </strong>{" "}
                      ({newGuardian.email})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewGuardian((g) => ({ ...g, profileId: "" }));
                        setNewGuardianMode("search");
                      }}
                      className="text-xs text-[#C45B5B]"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {!newGuardian.profileId && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL}>First Name *</label>
                      <input
                        type="text"
                        value={newGuardian.firstName}
                        onChange={(e) =>
                          setNewGuardian((g) => ({
                            ...g,
                            firstName: e.target.value,
                          }))
                        }
                        className={INPUT_SM}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Last Name *</label>
                      <input
                        type="text"
                        value={newGuardian.lastName}
                        onChange={(e) =>
                          setNewGuardian((g) => ({
                            ...g,
                            lastName: e.target.value,
                          }))
                        }
                        className={INPUT_SM}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Email</label>
                      <input
                        type="email"
                        value={newGuardian.email}
                        onChange={(e) =>
                          setNewGuardian((g) => ({
                            ...g,
                            email: e.target.value,
                          }))
                        }
                        className={INPUT_SM}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Phone</label>
                      <input
                        type="tel"
                        value={newGuardian.phone}
                        onChange={(e) =>
                          setNewGuardian((g) => ({
                            ...g,
                            phone: e.target.value,
                          }))
                        }
                        className={INPUT_SM}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={LABEL}>Relationship</label>
                  <select
                    value={newGuardian.relationship}
                    onChange={(e) =>
                      setNewGuardian((g) => ({
                        ...g,
                        relationship: e.target.value,
                      }))
                    }
                    className={INPUT_SM}
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student selection */}
                <div>
                  <label className={LABEL}>Link to students *</label>
                  <div className="space-y-1">
                    {students.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-sm text-slate"
                      >
                        <input
                          type="checkbox"
                          checked={newGuardian.selectedStudentIds.includes(s.id)}
                          onChange={(e) => {
                            setNewGuardian((g) => ({
                              ...g,
                              selectedStudentIds: e.target.checked
                                ? [...g.selectedStudentIds, s.id]
                                : g.selectedStudentIds.filter(
                                    (id) => id !== s.id
                                  ),
                            }));
                          }}
                          className="rounded border-silver"
                        />
                        {s.first_name} {s.last_name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={newGuardian.isPrimary}
                      onChange={(e) =>
                        setNewGuardian((g) => ({
                          ...g,
                          isPrimary: e.target.checked,
                        }))
                      }
                      className="rounded border-silver"
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={newGuardian.isBilling}
                      onChange={(e) =>
                        setNewGuardian((g) => ({
                          ...g,
                          isBilling: e.target.checked,
                        }))
                      }
                      className="rounded border-silver"
                    />
                    Billing
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={newGuardian.isEmergency}
                      onChange={(e) =>
                        setNewGuardian((g) => ({
                          ...g,
                          isEmergency: e.target.checked,
                        }))
                      }
                      className="rounded border-silver"
                    />
                    Emergency
                  </label>
                </div>

                <button
                  type="button"
                  disabled={
                    saving ||
                    (!newGuardian.profileId &&
                      (!newGuardian.firstName || !newGuardian.lastName)) ||
                    newGuardian.selectedStudentIds.length === 0
                  }
                  onClick={handleAddGuardian}
                  className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Guardian"}
                </button>
              </>
            )}
          </div>
        )}

        {guardians.length === 0 ? (
          <p className="text-sm text-mist">
            No guardians linked yet. Add a guardian above.
          </p>
        ) : (
          <div className="divide-y divide-silver/50">
            {guardians.map((g) => (
              <div key={g.profile_id} className="py-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-charcoal text-sm">
                      {[g.first_name, g.last_name].filter(Boolean).join(" ") ||
                        "Unknown"}
                    </p>
                    <p className="text-xs text-mist">
                      {g.email ?? ""}
                      {g.phone ? ` \u00B7 ${g.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {g.email_opt_in && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A9E6F]/10 text-[#5A9E6F]">
                          Email
                        </span>
                      )}
                      {g.sms_opt_in && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A9E6F]/10 text-[#5A9E6F]">
                          SMS
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-student relationship details */}
                <div className="pl-4 space-y-1">
                  {g.relationships.map((rel) => {
                    const student = students.find(
                      (s) => s.id === rel.student_id
                    );
                    return (
                      <div
                        key={rel.guardian_id}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate">
                            {student
                              ? `${student.first_name} ${student.last_name}`
                              : "Unknown student"}
                          </span>
                          <span className="text-mist capitalize">
                            ({rel.relationship})
                          </span>
                          <div className="flex gap-1">
                            {rel.is_primary && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.primary}`}
                              >
                                Primary
                              </span>
                            )}
                            {rel.is_billing && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.billing}`}
                              >
                                Billing
                              </span>
                            )}
                            {rel.is_emergency && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${ROLE_BADGES.emergency}`}
                              >
                                Emergency
                              </span>
                            )}
                          </div>
                          {!rel.portal_access && (
                            <span className="text-mist">(No portal)</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuardian(rel.guardian_id)}
                          className="text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Family Info ── */}
      <div className={CARD}>
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Family Information
        </h2>
        <form onSubmit={handleFamilySubmit} className="space-y-4">
          <input type="hidden" name="id" value={family.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Family Name *</label>
              <input
                name="family_name"
                required
                defaultValue={family.family_name}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Billing Email</label>
              <input
                name="billing_email"
                type="email"
                defaultValue={family.billing_email ?? ""}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Billing Phone</label>
              <input
                name="billing_phone"
                defaultValue={family.billing_phone ?? ""}
                className={INPUT}
              />
            </div>
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={family.notes ?? ""}
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* ── Students ── */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Students
          </h2>
          <button
            onClick={() => setShowAddStudent(!showAddStudent)}
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            {showAddStudent ? "Cancel" : "+ Add Student"}
          </button>
        </div>

        {showAddStudent && (
          <form
            onSubmit={handleAddStudent}
            className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3"
          >
            <input type="hidden" name="family_id" value={family.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="first_name"
                required
                placeholder="First name *"
                className={INPUT_SM}
              />
              <input
                name="last_name"
                required
                placeholder="Last name *"
                className={INPUT_SM}
              />
              <input
                name="date_of_birth"
                type="date"
                required
                className={INPUT_SM}
              />
              <select name="gender" className={INPUT_SM}>
                <option value="">Gender (optional)</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <textarea
              name="medical_notes"
              placeholder="Medical notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm resize-none"
            />
            <textarea
              name="allergy_notes"
              placeholder="Allergy notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm resize-none"
            />
            <label className="flex items-center gap-2 text-sm text-slate">
              <input
                type="checkbox"
                name="photo_consent"
                value="true"
                className="rounded border-silver"
              />
              Photo / media consent
            </label>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors disabled:opacity-50"
            >
              Add Student
            </button>
          </form>
        )}

        {students.length === 0 ? (
          <p className="text-sm text-mist">No students in this family yet.</p>
        ) : (
          <div className="divide-y divide-silver/50">
            {students.map((s) => (
              <div
                key={s.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-charcoal text-sm">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs text-mist">
                    DOB: {s.date_of_birth}
                    {s.current_level ? ` \u00B7 ${s.current_level}` : ""}
                    {s.gender ? ` \u00B7 ${s.gender}` : ""}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    s.active
                      ? "bg-[#5A9E6F]/10 text-[#5A9E6F]"
                      : "bg-[#9E99A7]/10 text-[#9E99A7]"
                  }`}
                >
                  {s.active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Emergency Contacts (legacy family_contacts) ── */}
      <ContactSection
        title="Emergency Contacts"
        contacts={emergencyContacts}
        familyId={family.id}
        defaultType="emergency"
        showAdd={showAddContact && contactType === "emergency"}
        onToggleAdd={() => {
          setContactType("emergency");
          setShowAddContact(!showAddContact || contactType !== "emergency");
        }}
        onAdd={handleAddContact}
        onRemove={handleRemoveContact}
        saving={saving}
      />

      {/* ── Stream Contacts ── */}
      <ContactSection
        title="Approved Stream Contacts"
        contacts={streamContacts}
        familyId={family.id}
        defaultType="stream"
        showAdd={showAddContact && contactType === "stream"}
        onToggleAdd={() => {
          setContactType("stream");
          setShowAddContact(!showAddContact || contactType !== "stream");
        }}
        onAdd={handleAddContact}
        onRemove={handleRemoveContact}
        saving={saving}
      />

      {/* ── Enrollments ── */}
      <div className={CARD}>
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Enrollments
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-mist">No enrollments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver">
                  <th className="text-left py-2 font-medium text-slate">
                    Student
                  </th>
                  <th className="text-left py-2 font-medium text-slate">
                    Class
                  </th>
                  <th className="text-left py-2 font-medium text-slate">
                    Schedule
                  </th>
                  <th className="text-left py-2 font-medium text-slate">
                    Type
                  </th>
                  <th className="text-left py-2 font-medium text-slate">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver/50">
                {enrollments.map((e) => {
                  const studentData = (
                    Array.isArray(e.students) ? e.students[0] : e.students
                  ) as { first_name: string; last_name: string } | null;
                  const classData = (
                    Array.isArray(e.classes) ? e.classes[0] : e.classes
                  ) as {
                    name: string;
                    simple_name: string | null;
                    day_of_week: number | null;
                    start_time: string | null;
                    end_time: string | null;
                  } | null;

                  return (
                    <tr key={e.id}>
                      <td className="py-2 text-charcoal">
                        {studentData
                          ? `${studentData.first_name} ${studentData.last_name}`
                          : "-"}
                      </td>
                      <td className="py-2 text-charcoal">
                        {classData?.simple_name || classData?.name || "-"}
                      </td>
                      <td className="py-2 text-slate">
                        {classData?.day_of_week != null
                          ? `${DAY_NAMES[classData.day_of_week]} ${formatTime(classData.start_time)}`
                          : "-"}
                      </td>
                      <td className="py-2 text-slate capitalize">
                        {e.enrollment_type}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            STATUS_COLORS[e.status] ?? "bg-cloud text-slate"
                          }`}
                        >
                          {e.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Account ── */}
      <div className={CARD}>
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Account
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-mist text-xs">Account Credit</dt>
            <dd className="text-charcoal font-medium">
              ${Number(family.account_credit).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-mist text-xs">Stripe Customer</dt>
            <dd className="text-charcoal">
              {family.stripe_customer_id || "Not linked"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ── Contact Section Sub-Component ────────────────────────────

function ContactSection({
  title,
  contacts,
  familyId,
  defaultType,
  showAdd,
  onToggleAdd,
  onAdd,
  onRemove,
  saving,
}: {
  title: string;
  contacts: FamilyContact[];
  familyId: string;
  defaultType: "emergency" | "stream" | "both";
  showAdd: boolean;
  onToggleAdd: () => void;
  onAdd: (e: React.FormEvent<HTMLFormElement>) => void;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          {title}
        </h2>
        <button
          onClick={onToggleAdd}
          className="text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          {showAdd ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={onAdd}
          className="rounded-lg border border-silver/50 bg-cloud/30 p-4 space-y-3"
        >
          <input type="hidden" name="family_id" value={familyId} />
          <input type="hidden" name="contact_type" value={defaultType} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="first_name"
              required
              placeholder="First name *"
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
            />
            <input
              name="last_name"
              required
              placeholder="Last name *"
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
            />
            <input
              name="relationship"
              placeholder="Relationship (e.g., Grandmother)"
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
            />
            <input
              name="phone"
              placeholder="Phone"
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors disabled:opacity-50"
          >
            Add Contact
          </button>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-mist">No contacts added yet.</p>
      ) : (
        <div className="divide-y divide-silver/50">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-charcoal text-sm">
                  {c.first_name} {c.last_name}
                  {c.is_primary && (
                    <span className="ml-2 text-xs text-lavender font-normal">
                      Primary
                    </span>
                  )}
                </p>
                <p className="text-xs text-mist">
                  {c.relationship ?? ""}
                  {c.phone ? ` \u00B7 ${c.phone}` : ""}
                  {c.email ? ` \u00B7 ${c.email}` : ""}
                </p>
              </div>
              <button
                onClick={() => onRemove(c.id)}
                className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
