"use client";

import { useState, useEffect } from "react";
import {
  addTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
} from "./actions";

const CATEGORIES = [
  { value: "class", label: "Class" },
  { value: "private", label: "Private" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];

const ENTRY_TYPE_TO_CATEGORY: Record<string, string> = {
  class_lead: "class",
  class_assistant: "class",
  private: "private",
  rehearsal: "rehearsal",
  admin: "admin",
  performance_event: "other",
  competition: "other",
  training: "other",
  substitute: "class",
  bonus: "other",
};

const DESCRIPTION_LABELS: Record<string, string> = {
  class: "Class Name",
  private: "Student Name",
  rehearsal: "Rehearsal / Cast Group",
  admin: "Task Description",
  other: "Description",
};

interface Entry {
  id: string;
  date: string;
  entry_type: string;
  total_hours: number;
  description: string | null;
  sub_for?: string | null;
  production_id?: string | null;
  production_name?: string | null;
  event_tag?: string | null;
  notes?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface Production {
  id: string;
  name: string;
}

interface TeacherClass {
  id: string;
  name: string;
  day_of_week: number | null;
  day_name: string | null;
  start_time: string | null;
  end_time: string | null;
}

function computeHours(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round((diff / 60) * 100) / 100;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function AddEntryForm({
  locked,
  employmentType,
  productions,
}: {
  locked: boolean;
  employmentType?: string;
  productions?: Production[];
}) {
  const [open, setOpen] = useState(false);

  if (locked) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-cloud/30 p-5 text-center text-sm text-mist">
        Pay period locked after the 26th. Entries cannot be added.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-silver bg-white p-5 text-center hover:border-lavender hover:bg-lavender/5 transition-colors group"
      >
        <span className="text-2xl text-mist group-hover:text-lavender">+</span>
        <p className="mt-1 text-sm font-medium text-slate group-hover:text-lavender-dark">
          Add Entry
        </p>
      </button>
    );
  }

  return (
    <EntryFormCard
      employmentType={employmentType}
      productions={productions}
      onClose={() => setOpen(false)}
    />
  );
}

function EntryFormCard({
  entry,
  employmentType,
  productions,
  onClose,
}: {
  entry?: Entry;
  employmentType?: string;
  productions?: Production[];
  onClose: () => void;
}) {
  const isEdit = !!entry;
  const [category, setCategory] = useState(
    entry ? (ENTRY_TYPE_TO_CATEGORY[entry.entry_type] ?? "other") : "class"
  );
  const [selectedProduction, setSelectedProduction] = useState(
    entry?.production_id ?? ""
  );
  const [startTime, setStartTime] = useState(entry?.start_time ?? "");
  const [endTime, setEndTime] = useState(entry?.end_time ?? "");
  const [hours, setHours] = useState(entry?.total_hours?.toString() ?? "");
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-calculate hours when times change
  useEffect(() => {
    if (startTime && endTime) {
      const computed = computeHours(startTime, endTime);
      if (computed) setHours(computed.toString());
    }
  }, [startTime, endTime]);

  // Fetch teacher's classes when category = class
  useEffect(() => {
    if (category === "class") {
      fetch("/api/teach/classes")
        .then((r) => r.json())
        .then((d) => setTeacherClasses(d.classes ?? []))
        .catch(() => setTeacherClasses([]));
    } else {
      setTeacherClasses([]);
      setSelectedClass("");
    }
  }, [category]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    // Set production name
    if (selectedProduction && productions) {
      const prod = productions.find((p) => p.id === selectedProduction);
      if (prod) formData.set("productionName", prod.name);
    }

    const result = isEdit
      ? await updateTimesheetEntry(formData)
      : await addTimesheetEntry(formData);

    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
        {isEdit ? "Edit Entry" : "Add Entry"}
      </h3>
      {error && (
        <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      <form action={handleSubmit} className="space-y-4">
        {isEdit && <input type="hidden" name="entryId" value={entry.id} />}

        {/* Employment Type (read-only) */}
        {employmentType && (
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Employment Type
            </label>
            <div className="h-10 rounded-lg border border-silver bg-cloud/50 px-3 flex items-center text-sm text-slate">
              {employmentType === "1099"
                ? "1099 Contractor"
                : "W-2 Employee"}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Date *
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={
                entry?.date ?? new Date().toISOString().split("T")[0]
              }
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Category *
            </label>
            <select
              name="category"
              required
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSelectedClass("");
              }}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Class Dropdown (when category = class) */}
        {category === "class" && teacherClasses.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Select Class
            </label>
            <select
              name="classId"
              value={selectedClass}
              onChange={(e) => {
                const cls = teacherClasses.find((c) => c.id === e.target.value);
                setSelectedClass(e.target.value);
                if (cls) {
                  setDescription(cls.name);
                  if (cls.start_time) setStartTime(cls.start_time.slice(0, 5));
                  if (cls.end_time) setEndTime(cls.end_time.slice(0, 5));
                }
              }}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            >
              <option value="">Select a class...</option>
              {teacherClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.day_name ? ` (${c.day_name}` : ""}
                  {c.start_time ? ` ${formatTime12h(c.start_time)}` : ""}
                  {c.end_time ? `–${formatTime12h(c.end_time)}` : ""}
                  {c.day_name ? ")" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Start / End Time + Hours */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Start Time
            </label>
            <input
              name="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              End Time
            </label>
            <input
              name="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Hours *
              {startTime && endTime && (
                <span className="ml-1 text-[10px] font-normal text-mist">(auto)</span>
              )}
            </label>
            <input
              name="totalHours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="1.5"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            {DESCRIPTION_LABELS[category] ?? "Description"}
          </label>
          <input
            name="description"
            type="text"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              category === "class"
                ? "e.g. Intermediate Ballet"
                : category === "private"
                ? "e.g. Sophia Martin"
                : "Description"
            }
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        {/* Sub for */}
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Substitute for (optional)
          </label>
          <input
            name="subFor"
            type="text"
            maxLength={200}
            defaultValue={entry?.sub_for ?? ""}
            placeholder="e.g. Covering for Sarah Hampton"
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Production */}
          {(productions?.length ?? 0) > 0 && (
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">
                Tag to Production (optional)
              </label>
              <select
                name="productionId"
                value={selectedProduction}
                onChange={(e) => setSelectedProduction(e.target.value)}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              >
                <option value="">None</option>
                {productions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Event Tag */}
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Event / Note Tag (optional)
            </label>
            <input
              name="eventTag"
              type="text"
              maxLength={200}
              defaultValue={entry?.event_tag ?? ""}
              placeholder="e.g. Spring Showcase Audition"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            maxLength={2000}
            rows={2}
            defaultValue={entry?.notes ?? ""}
            placeholder="Additional notes..."
            className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : isEdit ? "Save" : "Add Entry"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditEntryRow({
  entry,
  locked,
  employmentType,
  productions,
}: {
  entry: Entry;
  locked: boolean;
  employmentType?: string;
  productions?: Production[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const categoryLabel =
    CATEGORIES.find(
      (c) => c.value === (ENTRY_TYPE_TO_CATEGORY[entry.entry_type] ?? "other")
    )?.label ?? entry.entry_type;

  if (editing) {
    return (
      <tr>
        <td colSpan={locked ? 5 : 6} className="px-4 py-3">
          <EntryFormCard
            entry={entry}
            employmentType={employmentType}
            productions={productions}
            onClose={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-cloud/30 transition-colors">
      <td className="px-4 py-3 text-charcoal">
        {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </td>
      <td className="px-4 py-3 text-charcoal">
        {entry.description ?? "—"}
        {entry.sub_for && (
          <span className="ml-1.5 text-xs text-mist">
            (Sub: {entry.sub_for})
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-slate">{categoryLabel}</td>
      <td className="px-4 py-3">
        {entry.production_name ? (
          <span className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-medium text-lavender-dark">
            {entry.production_name.length > 24
              ? entry.production_name.slice(0, 24) + "…"
              : entry.production_name}
          </span>
        ) : entry.event_tag ? (
          <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-[10px] font-medium text-slate">
            {entry.event_tag.length > 24
              ? entry.event_tag.slice(0, 24) + "…"
              : entry.event_tag}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right text-charcoal font-medium">
        {entry.total_hours?.toFixed(1)}
      </td>
      {!locked && (
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-lavender hover:text-lavender-dark font-medium"
            >
              Edit
            </button>
            <form
              action={async (fd: FormData) => {
                setDeleting(true);
                const result = await deleteTimesheetEntry(fd);
                setDeleting(false);
                if (result?.error) setError(result.error);
              }}
            >
              <input type="hidden" name="entryId" value={entry.id} />
              <button
                type="submit"
                disabled={deleting}
                className="text-xs text-error hover:text-error/80 font-medium ml-2 disabled:opacity-50"
              >
                {deleting ? "..." : "Delete"}
              </button>
            </form>
          </div>
          {error && <p className="text-xs text-error mt-1">{error}</p>}
        </td>
      )}
    </tr>
  );
}
