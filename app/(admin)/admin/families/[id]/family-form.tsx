"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFamily,
  updateFamily,
  addStudentToFamily,
  addFamilyContact,
  updateFamilyContact,
  removeFamilyContact,
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

interface FamilyFormProps {
  family?: Family & { profiles?: ProfileData | null };
  students?: StudentRow[];
  contacts?: FamilyContact[];
  enrollments?: EnrollmentRow[];
  isNew?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────

export function FamilyForm({
  family,
  students = [],
  contacts = [],
  enrollments = [],
  isNew = false,
}: FamilyFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactType, setContactType] = useState<"emergency" | "stream" | "both">("emergency");

  const emergencyContacts = contacts.filter(
    (c) => c.contact_type === "emergency" || c.contact_type === "both"
  );
  const streamContacts = contacts.filter(
    (c) => c.contact_type === "stream" || c.contact_type === "both"
  );

  async function handleFamilySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = isNew
      ? await createFamily(fd)
      : await updateFamily(fd);

    setSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
    } else if (isNew && "id" in result && result.id) {
      router.push(`/admin/families/${result.id}`);
    }
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
    if (!family) return;
    const fd = new FormData();
    fd.set("id", contactId);
    fd.set("family_id", family.id);
    await removeFamilyContact(fd);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
          {error}
        </div>
      )}

      {/* ── Section 1: Family Info ── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Family Information
        </h2>
        <form onSubmit={handleFamilySubmit} className="space-y-4">
          {!isNew && <input type="hidden" name="id" value={family?.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Family Name *
              </label>
              <input
                name="family_name"
                required
                defaultValue={family?.family_name ?? ""}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Billing Email
              </label>
              <input
                name="billing_email"
                type="email"
                defaultValue={family?.billing_email ?? ""}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Billing Phone
              </label>
              <input
                name="billing_phone"
                defaultValue={family?.billing_phone ?? ""}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={family?.notes ?? ""}
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : isNew ? "Create Family" : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Only show remaining sections for existing families */}
      {!isNew && family && (
        <>
          {/* ── Section 2: Primary Contact ── */}
          <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Primary Contact
            </h2>
            {family.profiles ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-mist text-xs">Name</dt>
                  <dd className="text-charcoal">
                    {[
                      (family.profiles as ProfileData).first_name,
                      (family.profiles as ProfileData).last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Email</dt>
                  <dd className="text-charcoal">
                    {(family.profiles as ProfileData).email || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Phone</dt>
                  <dd className="text-charcoal">
                    {(family.profiles as ProfileData).phone || "-"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-mist">
                No primary contact linked to this family.
              </p>
            )}
          </div>

          {/* ── Section 3: Students ── */}
          <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
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
                    className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
                  />
                  <input
                    name="last_name"
                    required
                    placeholder="Last name *"
                    className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
                  />
                  <input
                    name="date_of_birth"
                    type="date"
                    required
                    className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
                  />
                  <select
                    name="gender"
                    className="h-9 rounded-lg border border-silver bg-white px-3 text-sm"
                  >
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
              <p className="text-sm text-mist">
                No students in this family yet.
              </p>
            ) : (
              <div className="divide-y divide-silver/50">
                {students.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-charcoal text-sm">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-mist">
                        DOB: {s.date_of_birth}
                        {s.current_level ? ` · ${s.current_level}` : ""}
                        {s.gender ? ` · ${s.gender}` : ""}
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

          {/* ── Section 4: Emergency Contacts ── */}
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

          {/* ── Section 5: Stream Contacts ── */}
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

          {/* ── Section 6: Enrollments (read-only) ── */}
          <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
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

          {/* ── Section 7: Account ── */}
          <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
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
        </>
      )}
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
            <div key={c.id} className="py-3 flex items-center justify-between">
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
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
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
