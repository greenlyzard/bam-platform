"use client";

import { useState, useEffect } from "react";

interface TeacherData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  employment_type: string | null;
  class_rate_cents: number | null;
  private_rate_cents: number | null;
  rehearsal_rate_cents: number | null;
  admin_rate_cents: number | null;
  is_mandated_reporter_certified: boolean;
  mandated_reporter_cert_date: string | null;
  background_check_complete: boolean;
  background_check_expires_at: string | null;
  w9_on_file: boolean;
  can_be_scheduled: boolean;
  internal_notes: string | null;
}

function centsToStr(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function strToCents(str: string): number | null {
  const n = parseFloat(str);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

export function TeacherEditDrawer({
  teacherId,
  onClose,
  onSaved,
}: {
  teacherId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [employmentType, setEmploymentType] = useState("employee");
  const [classRate, setClassRate] = useState("");
  const [privateRate, setPrivateRate] = useState("");
  const [rehearsalRate, setRehearsalRate] = useState("");
  const [adminRate, setAdminRate] = useState("");
  const [mandatedReporter, setMandatedReporter] = useState(false);
  const [mandatedDate, setMandatedDate] = useState("");
  const [backgroundCheck, setBackgroundCheck] = useState(false);
  const [backgroundExpires, setBackgroundExpires] = useState("");
  const [w9, setW9] = useState(false);
  const [schedulable, setSchedulable] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/teachers/${teacherId}`);
      if (res.ok) {
        const json = await res.json();
        const t: TeacherData = json.teacher;
        setData(t);
        setFirstName(t.first_name ?? "");
        setLastName(t.last_name ?? "");
        setPreferredName(t.preferred_name ?? "");
        setEmail(t.email ?? "");
        setPhone(t.phone ?? "");
        setAvatarUrl(t.avatar_url ?? "");
        setBio(t.bio ?? "");
        setEmploymentType(t.employment_type ?? "employee");
        setClassRate(centsToStr(t.class_rate_cents));
        setPrivateRate(centsToStr(t.private_rate_cents));
        setRehearsalRate(centsToStr(t.rehearsal_rate_cents));
        setAdminRate(centsToStr(t.admin_rate_cents));
        setMandatedReporter(t.is_mandated_reporter_certified);
        setMandatedDate(t.mandated_reporter_cert_date ?? "");
        setBackgroundCheck(t.background_check_complete);
        setBackgroundExpires(t.background_check_expires_at?.split("T")[0] ?? "");
        setW9(t.w9_on_file);
        setSchedulable(t.can_be_scheduled);
        setInternalNotes(t.internal_notes ?? "");
      }
      setLoading(false);
    }
    load();
  }, [teacherId]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/teachers/${teacherId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        preferred_name: preferredName,
        email,
        phone,
        bio,
        employment_type: employmentType,
        class_rate_cents: strToCents(classRate),
        private_rate_cents: strToCents(privateRate),
        rehearsal_rate_cents: strToCents(rehearsalRate),
        admin_rate_cents: strToCents(adminRate),
        is_mandated_reporter_certified: mandatedReporter,
        mandated_reporter_cert_date: mandatedDate || null,
        background_check_complete: backgroundCheck,
        background_check_expires_at: backgroundExpires || null,
        w9_on_file: w9,
        can_be_scheduled: schedulable,
        internal_notes: internalNotes,
      }),
    });
    setSaving(false);
    onSaved();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", teacherId);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      setAvatarUrl(json.url);
    }
    setUploading(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-mist">
            Loading teacher...
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-full text-sm text-error">
            Teacher not found.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-charcoal">
                Edit Teacher
              </h2>
              <button
                onClick={onClose}
                className="text-mist hover:text-charcoal transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-lavender-light flex items-center justify-center text-xl font-semibold text-lavender-dark">
                  {(preferredName || firstName)?.[0] ?? "?"}
                </div>
              )}
              <label className="text-sm text-lavender hover:text-lavender-dark font-medium cursor-pointer">
                {uploading ? "Uploading..." : "Change Photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {/* Names */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Identity
              </h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate">
                  Preferred Name / Nickname
                </label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="Shown everywhere in the platform"
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate">
                    Legal First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate">
                    Legal Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  />
                </div>
              </div>
              <p className="text-xs text-mist">
                Legal name is only shown on payroll and compliance documents.
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Contact
              </h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </div>
            </div>

            {/* Full Profile Link */}
            <div className="rounded-lg border border-lavender/20 bg-lavender/5 p-3">
              <p className="text-xs text-slate mb-2">Edit bio, disciplines, affiliations, and photos on the full profile page.</p>
              <a
                href={`/admin/teachers/${teacherId}/profile`}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-3 transition-colors"
              >
                View Full Profile →
              </a>
            </div>

            {/* Employment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Employment
              </h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEmploymentType("employee")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    employmentType === "employee"
                      ? "bg-lavender text-white"
                      : "bg-cloud text-slate hover:bg-silver"
                  }`}
                >
                  Employee (W-2)
                </button>
                <button
                  type="button"
                  onClick={() => setEmploymentType("contractor_1099")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    employmentType === "contractor_1099"
                      ? "bg-lavender text-white"
                      : "bg-cloud text-slate hover:bg-silver"
                  }`}
                >
                  Contractor (1099)
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedulable}
                  onChange={(e) => setSchedulable(e.target.checked)}
                  className="rounded border-silver text-lavender focus:ring-lavender"
                />
                Is Schedulable
              </label>
            </div>

            {/* Pay Rates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Pay Rates ($/hr)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Class", value: classRate, set: setClassRate },
                  { label: "Private", value: privateRate, set: setPrivateRate },
                  { label: "Rehearsal", value: rehearsalRate, set: setRehearsalRate },
                  { label: "Admin", value: adminRate, set: setAdminRate },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="mb-1 block text-xs font-medium text-slate">
                      {label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="w-full rounded-lg border border-silver pl-7 pr-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Compliance
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mandatedReporter}
                      onChange={(e) => setMandatedReporter(e.target.checked)}
                      className="rounded border-silver text-lavender focus:ring-lavender"
                    />
                    Mandated Reporter Certified
                  </label>
                  {mandatedReporter && (
                    <input
                      type="date"
                      value={mandatedDate}
                      onChange={(e) => setMandatedDate(e.target.value)}
                      className="rounded-lg border border-silver px-2 py-1 text-xs text-charcoal focus:border-lavender focus:outline-none"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backgroundCheck}
                      onChange={(e) => setBackgroundCheck(e.target.checked)}
                      className="rounded border-silver text-lavender focus:ring-lavender"
                    />
                    Background Check Complete
                  </label>
                  {backgroundCheck && (
                    <input
                      type="date"
                      value={backgroundExpires}
                      onChange={(e) => setBackgroundExpires(e.target.value)}
                      className="rounded-lg border border-silver px-2 py-1 text-xs text-charcoal focus:border-lavender focus:outline-none"
                    />
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={w9}
                    onChange={(e) => setW9(e.target.checked)}
                    className="rounded border-silver text-lavender focus:ring-lavender"
                  />
                  W-9 On File
                </label>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Internal Notes
              </h3>
              <p className="text-xs text-mist">
                Admin-only. Not visible to the teacher.
              </p>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-y"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-silver sticky bottom-0 bg-white pb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-lavender py-2.5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-silver px-6 py-2.5 text-sm font-medium text-slate hover:bg-cloud transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
