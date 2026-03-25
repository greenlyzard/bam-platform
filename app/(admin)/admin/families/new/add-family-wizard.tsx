"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";
import {
  createFamily,
  addStudentToFamily,
  addGuardian,
  createProfileAndLinkGuardian,
} from "../actions";

// ── Types ────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface GuardianDraft {
  mode: "existing" | "new";
  profileId?: string;
  profileName?: string;
  profileEmail?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  isBilling: boolean;
  isEmergency: boolean;
}

interface StudentDraft {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  medicalNotes: string;
  allergyNotes: string;
  photoConsent: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

// ── Styles ───────────────────────────────────────────────────

const INPUT =
  "w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const INPUT_SM =
  "h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
const BTN_PRIMARY =
  "h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50";
const BTN_SECONDARY =
  "h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-charcoal text-sm font-medium px-5 transition-colors";
const LABEL = "block text-xs font-medium text-slate mb-1";
const CARD = "rounded-xl border border-silver bg-white p-5 space-y-4";

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "stepparent", label: "Stepparent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "guardian", label: "Guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

// ── Component ────────────────────────────────────────────────

export function AddFamilyWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Guardian
  const [guardian, setGuardian] = useState<GuardianDraft>({
    mode: "new",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    relationship: "mother",
    isPrimary: true,
    isBilling: true,
    isEmergency: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Step 2: Students
  const [students, setStudents] = useState<StudentDraft[]>([
    {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      medicalNotes: "",
      allergyNotes: "",
      photoConsent: false,
    },
  ]);

  // Step 3: Additional guardians
  const [additionalGuardians, setAdditionalGuardians] = useState<
    GuardianDraft[]
  >([]);

  // ── Profile search for dedup ──────────────────────────────

  const searchProfiles = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/profiles/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSearchResults(data.profiles ?? []);
      setSearched(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function selectExistingProfile(profile: SearchResult) {
    setGuardian((g) => ({
      ...g,
      mode: "existing",
      profileId: profile.id,
      profileName: profile.name,
      profileEmail: profile.email ?? "",
      firstName: profile.name.split(" ")[0] ?? "",
      lastName: profile.name.split(" ").slice(1).join(" ") ?? "",
      email: profile.email ?? "",
    }));
    setSearchResults([]);
    setSearchQuery("");
  }

  function clearSelectedProfile() {
    setGuardian((g) => ({
      ...g,
      mode: "new",
      profileId: undefined,
      profileName: undefined,
      profileEmail: undefined,
    }));
  }

  // ── Student helpers ──────────────────────────────────────

  function updateStudent(index: number, field: keyof StudentDraft, value: string | boolean) {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addStudent() {
    setStudents((prev) => [
      ...prev,
      {
        firstName: "",
        lastName: guardian.lastName,
        dateOfBirth: "",
        gender: "",
        medicalNotes: "",
        allergyNotes: "",
        photoConsent: false,
      },
    ]);
  }

  function removeStudent(index: number) {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Additional guardian helpers ──────────────────────────

  function addAdditionalGuardian() {
    setAdditionalGuardians((prev) => [
      ...prev,
      {
        mode: "new",
        firstName: "",
        lastName: guardian.lastName,
        email: "",
        phone: "",
        relationship: "father",
        isPrimary: false,
        isBilling: false,
        isEmergency: true,
      },
    ]);
  }

  function updateAdditionalGuardian(
    index: number,
    field: keyof GuardianDraft,
    value: string | boolean
  ) {
    setAdditionalGuardians((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  function removeAdditionalGuardian(index: number) {
    setAdditionalGuardians((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Step validation ──────────────────────────────────────

  function canAdvanceStep1() {
    if (guardian.mode === "existing" && guardian.profileId) return true;
    return guardian.firstName.trim() && guardian.lastName.trim();
  }

  function canAdvanceStep2() {
    return students.every(
      (s) => s.firstName.trim() && s.lastName.trim() && s.dateOfBirth
    );
  }

  // ── Submit ──────────────────────────────────────────────

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      // 1. Create family
      const familyName =
        guardian.lastName.trim() || guardian.firstName.trim() || "New Family";
      const fd = new FormData();
      fd.set("family_name", familyName);
      fd.set("billing_email", guardian.email);
      fd.set("billing_phone", guardian.phone);
      fd.set("primary_contact_id", "");
      fd.set("notes", "");

      const familyResult = await createFamily(fd);
      if ("error" in familyResult && familyResult.error) {
        setError(familyResult.error);
        setSaving(false);
        return;
      }

      const familyId = (familyResult as { id: string }).id;

      // 2. Create students
      const studentIds: string[] = [];
      for (const s of students) {
        const sfd = new FormData();
        sfd.set("family_id", familyId);
        sfd.set("first_name", s.firstName.trim());
        sfd.set("last_name", s.lastName.trim());
        sfd.set("date_of_birth", s.dateOfBirth);
        sfd.set("gender", s.gender);
        sfd.set("medical_notes", s.medicalNotes);
        sfd.set("allergy_notes", s.allergyNotes);
        if (s.photoConsent) sfd.set("photo_consent", "true");

        const studentResult = await addStudentToFamily(sfd);
        if ("error" in studentResult && studentResult.error) {
          setError(`Failed adding student ${s.firstName}: ${studentResult.error}`);
          // Continue — family is created, redirect to it
          break;
        }
      }

      // We need student IDs for guardian linking — fetch them
      const studentsRes = await fetch(
        `/api/admin/families/${familyId}/students`
      ).catch(() => null);
      if (studentsRes?.ok) {
        const data = await studentsRes.json();
        studentIds.push(...(data.students ?? []).map((s: { id: string }) => s.id));
      }

      // 3. Link primary guardian to all students
      if (studentIds.length > 0) {
        for (const studentId of studentIds) {
          if (guardian.mode === "existing" && guardian.profileId) {
            const gfd = new FormData();
            gfd.set("student_id", studentId);
            gfd.set("profile_id", guardian.profileId);
            gfd.set("relationship", guardian.relationship);
            gfd.set("is_primary", "true");
            gfd.set("is_billing", "true");
            gfd.set("is_emergency", "true");
            gfd.set("portal_access", "true");
            await addGuardian(gfd);
          } else {
            const gfd = new FormData();
            gfd.set("student_id", studentId);
            gfd.set("first_name", guardian.firstName.trim());
            gfd.set("last_name", guardian.lastName.trim());
            gfd.set("email", guardian.email);
            gfd.set("phone", guardian.phone);
            gfd.set("relationship", guardian.relationship);
            gfd.set("is_primary", "true");
            gfd.set("is_billing", "true");
            gfd.set("is_emergency", "true");
            await createProfileAndLinkGuardian(gfd);
          }
        }

        // 4. Link additional guardians to all students
        for (const ag of additionalGuardians) {
          for (const studentId of studentIds) {
            const gfd = new FormData();
            gfd.set("student_id", studentId);
            gfd.set("first_name", ag.firstName.trim());
            gfd.set("last_name", ag.lastName.trim());
            gfd.set("email", ag.email);
            gfd.set("phone", ag.phone);
            gfd.set("relationship", ag.relationship);
            gfd.set("is_primary", String(ag.isPrimary));
            gfd.set("is_billing", String(ag.isBilling));
            gfd.set("is_emergency", String(ag.isEmergency));
            await createProfileAndLinkGuardian(gfd);
          }
        }
      }

      router.push(`/admin/families/${familyId}`);
    } catch (e) {
      console.error("[AddFamilyWizard:submit]", e);
      setError("An unexpected error occurred");
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-lavender text-white"
                  : s < step
                    ? "bg-lavender/20 text-lavender-dark"
                    : "bg-cloud text-mist"
              }`}
            >
              {s < step ? "\u2713" : s}
            </div>
            {s < 4 && (
              <div
                className={`w-8 h-0.5 ${
                  s < step ? "bg-lavender/40" : "bg-silver"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-3 text-xs text-mist">
          {step === 1 && "Primary Guardian"}
          {step === 2 && "Students"}
          {step === 3 && "Additional Guardians"}
          {step === 4 && "Review & Create"}
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
          {error}
        </div>
      )}

      {/* ── Step 1: Primary Guardian ── */}
      {step === 1 && (
        <div className={CARD}>
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Primary Guardian
          </h2>

          {/* Email search for dedup */}
          <div>
            <label className={LABEL}>
              Search existing profiles (by name or email)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchProfiles(searchQuery);
                  }
                }}
                placeholder="Type email or name to search..."
                className={`flex-1 ${INPUT}`}
              />
              <button
                type="button"
                onClick={() => searchProfiles(searchQuery)}
                disabled={searching || searchQuery.length < 2}
                className={BTN_SECONDARY}
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-silver bg-cloud/30 divide-y divide-silver/50 max-h-40 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectExistingProfile(p)}
                    className="w-full text-left px-3 py-2 hover:bg-lavender/5 text-sm"
                  >
                    <span className="font-medium text-charcoal">{p.name}</span>
                    {p.email && (
                      <span className="text-mist ml-2">{p.email}</span>
                    )}
                    <span className="text-xs text-mist ml-2 capitalize">
                      ({p.role})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searched && searchResults.length === 0 && (
              <p className="mt-2 text-xs text-mist">
                No existing profiles found. Fill in the details below to create
                a new one.
              </p>
            )}
          </div>

          {/* Selected existing profile */}
          {guardian.mode === "existing" && guardian.profileId && (
            <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">
                  {guardian.profileName}
                </p>
                <p className="text-xs text-mist">{guardian.profileEmail}</p>
              </div>
              <button
                type="button"
                onClick={clearSelectedProfile}
                className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* New profile form */}
          {guardian.mode === "new" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>First Name *</label>
                <input
                  type="text"
                  value={guardian.firstName}
                  onChange={(e) =>
                    setGuardian((g) => ({ ...g, firstName: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Last Name *</label>
                <input
                  type="text"
                  value={guardian.lastName}
                  onChange={(e) =>
                    setGuardian((g) => ({ ...g, lastName: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input
                  type="email"
                  value={guardian.email}
                  onChange={(e) =>
                    setGuardian((g) => ({ ...g, email: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input
                  type="tel"
                  value={guardian.phone}
                  onChange={(e) =>
                    setGuardian((g) => ({ ...g, phone: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
            </div>
          )}

          <div>
            <label className={LABEL}>Relationship *</label>
            <SimpleSelect
              value={guardian.relationship}
              onValueChange={(val) =>
                setGuardian((g) => ({ ...g, relationship: val }))
              }
              options={RELATIONSHIPS}
              className="w-full"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canAdvanceStep1()}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
              className={BTN_PRIMARY}
            >
              Next: Add Students
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Students ── */}
      {step === 2 && (
        <div className={CARD}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Students
            </h2>
            <button
              type="button"
              onClick={addStudent}
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              + Add Another Student
            </button>
          </div>

          <div className="space-y-4">
            {students.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-silver/50 bg-cloud/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-charcoal">
                    Student {i + 1}
                  </span>
                  {students.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStudent(i)}
                      className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>First Name *</label>
                    <input
                      type="text"
                      value={s.firstName}
                      onChange={(e) =>
                        updateStudent(i, "firstName", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Last Name *</label>
                    <input
                      type="text"
                      value={s.lastName}
                      onChange={(e) =>
                        updateStudent(i, "lastName", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Date of Birth *</label>
                    <input
                      type="date"
                      value={s.dateOfBirth}
                      onChange={(e) =>
                        updateStudent(i, "dateOfBirth", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Gender</label>
                    <SimpleSelect
                      value={s.gender}
                      onValueChange={(val) =>
                        updateStudent(i, "gender", val)
                      }
                      options={[
                        { value: "female", label: "Female" },
                        { value: "male", label: "Male" },
                        { value: "other", label: "Other" },
                      ]}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Medical Notes</label>
                  <input
                    type="text"
                    value={s.medicalNotes}
                    onChange={(e) =>
                      updateStudent(i, "medicalNotes", e.target.value)
                    }
                    placeholder="Optional"
                    className={`w-full ${INPUT_SM}`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Allergy Notes</label>
                  <input
                    type="text"
                    value={s.allergyNotes}
                    onChange={(e) =>
                      updateStudent(i, "allergyNotes", e.target.value)
                    }
                    placeholder="Optional"
                    className={`w-full ${INPUT_SM}`}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate">
                  <input
                    type="checkbox"
                    checked={s.photoConsent}
                    onChange={(e) =>
                      updateStudent(i, "photoConsent", e.target.checked)
                    }
                    className="rounded border-silver"
                  />
                  Photo / media consent
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={BTN_SECONDARY}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canAdvanceStep2()}
              onClick={() => {
                setError(null);
                setStep(3);
              }}
              className={BTN_PRIMARY}
            >
              Next: Additional Guardians
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Additional Guardians ── */}
      {step === 3 && (
        <div className={CARD}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Additional Guardians
            </h2>
            <button
              type="button"
              onClick={addAdditionalGuardian}
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              + Add Guardian
            </button>
          </div>

          {additionalGuardians.length === 0 && (
            <p className="text-sm text-mist">
              No additional guardians. You can skip this step or add another
              parent/guardian.
            </p>
          )}

          <div className="space-y-4">
            {additionalGuardians.map((ag, i) => (
              <div
                key={i}
                className="rounded-lg border border-silver/50 bg-cloud/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-charcoal">
                    Guardian {i + 2}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAdditionalGuardian(i)}
                    className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>First Name *</label>
                    <input
                      type="text"
                      value={ag.firstName}
                      onChange={(e) =>
                        updateAdditionalGuardian(i, "firstName", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Last Name *</label>
                    <input
                      type="text"
                      value={ag.lastName}
                      onChange={(e) =>
                        updateAdditionalGuardian(i, "lastName", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Email</label>
                    <input
                      type="email"
                      value={ag.email}
                      onChange={(e) =>
                        updateAdditionalGuardian(i, "email", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Phone</label>
                    <input
                      type="tel"
                      value={ag.phone}
                      onChange={(e) =>
                        updateAdditionalGuardian(i, "phone", e.target.value)
                      }
                      className={INPUT_SM}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Relationship</label>
                    <SimpleSelect
                      value={ag.relationship}
                      onValueChange={(val) =>
                        updateAdditionalGuardian(
                          i,
                          "relationship",
                          val
                        )
                      }
                      options={RELATIONSHIPS}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={ag.isBilling}
                      onChange={(e) =>
                        updateAdditionalGuardian(
                          i,
                          "isBilling",
                          e.target.checked
                        )
                      }
                      className="rounded border-silver"
                    />
                    Billing contact
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={ag.isEmergency}
                      onChange={(e) =>
                        updateAdditionalGuardian(
                          i,
                          "isEmergency",
                          e.target.checked
                        )
                      }
                      className="rounded border-silver"
                    />
                    Emergency contact
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className={BTN_SECONDARY}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(4);
              }}
              className={BTN_PRIMARY}
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className={CARD}>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Review
            </h2>

            {/* Guardian summary */}
            <div>
              <h3 className="text-sm font-medium text-slate mb-2">
                Primary Guardian
              </h3>
              <div className="rounded-lg bg-cloud/30 px-4 py-3 text-sm">
                <p className="font-medium text-charcoal">
                  {guardian.mode === "existing"
                    ? guardian.profileName
                    : `${guardian.firstName} ${guardian.lastName}`}
                  {guardian.mode === "existing" && (
                    <span className="ml-2 text-xs text-lavender">
                      (existing profile)
                    </span>
                  )}
                </p>
                <p className="text-mist">
                  {guardian.relationship}
                  {guardian.email ? ` \u00B7 ${guardian.email}` : ""}
                  {guardian.phone ? ` \u00B7 ${guardian.phone}` : ""}
                </p>
              </div>
            </div>

            {/* Students summary */}
            <div>
              <h3 className="text-sm font-medium text-slate mb-2">
                Students ({students.length})
              </h3>
              <div className="space-y-2">
                {students.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-cloud/30 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-charcoal">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-mist">
                      DOB: {s.dateOfBirth}
                      {s.gender ? ` \u00B7 ${s.gender}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional guardians summary */}
            {additionalGuardians.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate mb-2">
                  Additional Guardians ({additionalGuardians.length})
                </h3>
                <div className="space-y-2">
                  {additionalGuardians.map((ag, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-cloud/30 px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-charcoal">
                        {ag.firstName} {ag.lastName}
                      </p>
                      <p className="text-mist">
                        {ag.relationship}
                        {ag.email ? ` \u00B7 ${ag.email}` : ""}
                        {ag.isBilling ? " \u00B7 Billing" : ""}
                        {ag.isEmergency ? " \u00B7 Emergency" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(3)}
              className={BTN_SECONDARY}
            >
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className={BTN_PRIMARY}
            >
              {saving ? "Creating Family..." : "Create Family"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
