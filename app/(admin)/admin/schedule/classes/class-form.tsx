"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";
import { upsertClass } from "@/lib/schedule/actions";

const CLASS_TYPES = [
  { value: "regular", label: "Regular Class" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "performance", label: "Performance" },
  { value: "competition", label: "Competition" },
  { value: "private", label: "Private Lesson" },
  { value: "workshop", label: "Workshop" },
  { value: "intensive", label: "Intensive / Camp" },
];

const PROGRAM_DIVISIONS = [
  { value: "", label: "Select program..." },
  { value: "petites", label: "Petites" },
  { value: "company", label: "Company" },
  { value: "advanced", label: "Advanced" },
  { value: "adult", label: "Adult" },
  { value: "competitive", label: "Competitive" },
  { value: "other", label: "Other" },
];

const LEVEL_OPTIONS = [
  "Pre-Ballet",
  "Ballet I",
  "Ballet II",
  "Ballet III",
  "Pointe",
  "Contemporary",
  "Jazz",
  "Pilates",
  "Gyrotonic",
  "Other",
];

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

interface FormData {
  id?: string;
  full_name: string;
  short_name: string;
  simple_name: string;
  display_name: string;
  short_description: string;
  long_description: string;
  class_type: string;
  program_division: string;
  levels: string[];
  min_age: number | null;
  max_age: number | null;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  room: string;
  lead_teacher_id: string;
  assistant_teacher_ids: string[];
  max_enrollment: number | null;
  min_enrollment: number | null;
  is_open_enrollment: boolean;
  trial_eligible: boolean;
  trial_requires_approval: boolean;
  trial_max_per_class: number;
  production_id: string;
  status: string;
  is_published: boolean;
}

const DEFAULT_FORM: FormData = {
  full_name: "",
  short_name: "",
  simple_name: "",
  display_name: "",
  short_description: "",
  long_description: "",
  class_type: "regular",
  program_division: "",
  levels: [],
  min_age: null,
  max_age: null,
  start_date: "",
  end_date: "",
  days_of_week: [],
  start_time: "",
  end_time: "",
  room: "",
  lead_teacher_id: "",
  assistant_teacher_ids: [],
  max_enrollment: null,
  min_enrollment: null,
  is_open_enrollment: true,
  trial_eligible: false,
  trial_requires_approval: false,
  trial_max_per_class: 2,
  production_id: "",
  status: "draft",
  is_published: false,
};

export function ClassForm({
  initialData,
  teachers,
  productions,
}: {
  initialData?: FormData;
  teachers: Array<{ id: string; name: string }>;
  productions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM, ...initialData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLevel(level: string) {
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter((l) => l !== level)
        : [...prev.levels, level],
    }));
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  }

  function toggleAssistant(id: string) {
    setForm((prev) => ({
      ...prev,
      assistant_teacher_ids: prev.assistant_teacher_ids.includes(id)
        ? prev.assistant_teacher_ids.filter((t) => t !== id)
        : [...prev.assistant_teacher_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("Start date and end date are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await upsertClass({
      id: initialData?.id,
      full_name: form.full_name,
      short_name: form.short_name || undefined,
      simple_name: form.simple_name || undefined,
      display_name: form.display_name || undefined,
      short_description: form.short_description || undefined,
      long_description: form.long_description || undefined,
      class_type: form.class_type,
      program_division: form.program_division || undefined,
      levels: form.levels.length > 0 ? form.levels : undefined,
      min_age: form.min_age,
      max_age: form.max_age,
      start_date: form.start_date,
      end_date: form.end_date,
      days_of_week:
        form.days_of_week.length > 0 ? form.days_of_week : undefined,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      room: form.room || undefined,
      lead_teacher_id: form.lead_teacher_id || null,
      assistant_teacher_ids:
        form.assistant_teacher_ids.length > 0
          ? form.assistant_teacher_ids
          : undefined,
      max_enrollment: form.max_enrollment,
      min_enrollment: form.min_enrollment,
      is_open_enrollment: form.is_open_enrollment,
      trial_eligible: form.trial_eligible,
      trial_requires_approval: form.trial_requires_approval,
      trial_max_per_class: form.trial_max_per_class,
      production_id: form.production_id || null,
      status: form.status,
      is_published: form.is_published,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (result.classId) {
      router.push(`/admin/schedule/classes/${result.classId}`);
    } else {
      router.push("/admin/schedule/classes");
    }
  }

  const inputClass =
    "w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none";
  const labelClass = "block text-sm font-medium text-charcoal mb-1.5";
  const selectClass =
    "appearance-none w-full h-11 bg-white border border-silver rounded-md px-3 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 cursor-pointer";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section 1 — Identity */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Identity
        </h3>

        <div>
          <label className={labelClass}>Full Name *</label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder="Ballet II — Tuesday/Thursday"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Short Name</label>
            <input
              type="text"
              value={form.short_name}
              onChange={(e) => update("short_name", e.target.value)}
              placeholder="Ballet II T/Th"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Parent-Facing Name</label>
            <input
              type="text"
              value={form.simple_name}
              onChange={(e) => update("simple_name", e.target.value)}
              placeholder="Ballet II"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Display Name</label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Ballet Level II"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Section 2 — Details */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Details
        </h3>

        <div>
          <label className={labelClass}>
            Short Description
            <span className="ml-2 text-xs text-mist font-normal">
              {form.short_description.length}/160
            </span>
          </label>
          <textarea
            value={form.short_description}
            onChange={(e) => {
              if (e.target.value.length <= 160)
                update("short_description", e.target.value);
            }}
            rows={2}
            maxLength={160}
            placeholder="Brief summary shown on schedule widgets"
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none"
          />
        </div>

        <div>
          <label className={labelClass}>Long Description</label>
          <textarea
            value={form.long_description}
            onChange={(e) => update("long_description", e.target.value)}
            rows={4}
            placeholder="Full class description for enrollment pages"
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Class Type</label>
            <SimpleSelect
              value={form.class_type}
              onValueChange={(val) => update("class_type", val)}
              options={CLASS_TYPES}
              placeholder="Select type..."
              className="w-full"
            />
          </div>

          <div>
            <label className={labelClass}>Program Division</label>
            <SimpleSelect
              value={form.program_division}
              onValueChange={(val) => update("program_division", val)}
              options={PROGRAM_DIVISIONS.filter((p) => p.value !== "")}
              placeholder="Select program..."
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Levels</label>
          <div className="flex flex-wrap gap-2">
            {LEVEL_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.levels.includes(level)
                    ? "border-lavender bg-lavender/10 text-lavender-dark"
                    : "border-silver bg-white text-slate hover:bg-cloud"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Min Age</label>
            <input
              type="number"
              min={0}
              max={99}
              value={form.min_age ?? ""}
              onChange={(e) =>
                update(
                  "min_age",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="e.g. 7"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Max Age</label>
            <input
              type="number"
              min={0}
              max={99}
              value={form.max_age ?? ""}
              onChange={(e) =>
                update(
                  "max_age",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="e.g. 12"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Linked Production</label>
          <SimpleSelect
            value={form.production_id}
            onValueChange={(val) => update("production_id", val === "__none__" ? "" : val)}
            options={[
              { value: "__none__", label: "None" },
              ...productions.map((p) => ({ value: p.id, label: p.name })),
            ]}
            placeholder="None"
            className="w-full"
          />
        </div>
      </div>

      {/* Section 3 — Schedule */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Schedule
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End Date *</label>
            <input
              type="date"
              required
              value={form.end_date}
              onChange={(e) => update("end_date", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Recurrence Days</label>
          <div className="flex gap-2">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`h-10 w-12 rounded-lg border text-xs font-semibold transition-colors ${
                  form.days_of_week.includes(d.value)
                    ? "border-lavender bg-lavender text-white"
                    : "border-silver bg-white text-slate hover:bg-cloud"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Start Time</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => update("start_time", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => update("end_time", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Room</label>
          <input
            type="text"
            value={form.room}
            onChange={(e) => update("room", e.target.value)}
            placeholder="Studio A"
            className={inputClass}
          />
        </div>
      </div>

      {/* Section 4 — Staff */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Staff
        </h3>

        <div>
          <label className={labelClass}>Lead Teacher</label>
          <SimpleSelect
            value={form.lead_teacher_id}
            onValueChange={(val) => update("lead_teacher_id", val)}
            options={teachers.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Select teacher..."
            className="w-full"
          />
        </div>

        <div>
          <label className={labelClass}>Assistant Teachers</label>
          <div className="flex flex-wrap gap-2">
            {teachers
              .filter((t) => t.id !== form.lead_teacher_id)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleAssistant(t.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.assistant_teacher_ids.includes(t.id)
                      ? "border-lavender bg-lavender/10 text-lavender-dark"
                      : "border-silver bg-white text-slate hover:bg-cloud"
                  }`}
                >
                  {t.name}
                </button>
              ))}
          </div>
          {teachers.length === 0 && (
            <p className="text-xs text-mist mt-1">
              No approved teachers found.
            </p>
          )}
        </div>
      </div>

      {/* Section 5 — Enrollment */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Enrollment
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Max Enrollment</label>
            <input
              type="number"
              min={0}
              value={form.max_enrollment ?? ""}
              onChange={(e) =>
                update(
                  "max_enrollment",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="e.g. 10"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Min Enrollment</label>
            <input
              type="number"
              min={0}
              value={form.min_enrollment ?? ""}
              onChange={(e) =>
                update(
                  "min_enrollment",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="e.g. 3"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              update("is_open_enrollment", !form.is_open_enrollment)
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              form.is_open_enrollment ? "bg-lavender" : "bg-silver"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.is_open_enrollment ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span className="text-sm text-charcoal">Open Enrollment</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update("trial_eligible", !form.trial_eligible)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                form.trial_eligible ? "bg-lavender" : "bg-silver"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.trial_eligible ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm text-charcoal">Trial Eligible</span>
          </div>

          {form.trial_eligible && (
            <div className="ml-14 space-y-3 border-l-2 border-silver pl-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "trial_requires_approval",
                      !form.trial_requires_approval
                    )
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.trial_requires_approval ? "bg-lavender" : "bg-silver"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.trial_requires_approval ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span className="text-sm text-charcoal">
                  Trial Requires Approval
                </span>
              </div>

              <div className="max-w-[200px]">
                <label className={labelClass}>Max Trials Per Session</label>
                <input
                  type="number"
                  min={0}
                  value={form.trial_max_per_class}
                  onChange={(e) =>
                    update(
                      "trial_max_per_class",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 6 — Status */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Status
        </h3>

        <div>
          <label className={labelClass}>Status</label>
          <SimpleSelect
            value={form.status}
            onValueChange={(val) => update("status", val)}
            options={STATUS_OPTIONS}
            placeholder="Select status..."
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => update("is_published", !form.is_published)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              form.is_published ? "bg-lavender" : "bg-silver"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.is_published ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span className="text-sm text-charcoal">
            Published to parent portal
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/admin/schedule/classes"
          className="h-11 rounded-lg border border-silver text-sm font-medium px-5 flex items-center hover:bg-cloud transition-colors text-slate"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-8 flex items-center transition-colors disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : isEdit
              ? "Save Changes"
              : "Create Class"}
        </button>
      </div>
    </form>
  );
}
