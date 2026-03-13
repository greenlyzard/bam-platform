"use client";

import { useState } from "react";
import { addTimesheetEntry, updateTimesheetEntry, deleteTimesheetEntry } from "./actions";

const ENTRY_TYPE_OPTIONS = [
  { value: "class_lead", label: "Class (Lead)" },
  { value: "class_assistant", label: "Class (Assistant)" },
  { value: "private", label: "Private Lesson" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "performance_event", label: "Performance Event" },
  { value: "competition", label: "Competition" },
  { value: "training", label: "Training" },
  { value: "admin", label: "Administrative" },
  { value: "substitute", label: "Substitute" },
  { value: "bonus", label: "Bonus" },
];

interface Entry {
  id: string;
  date: string;
  entry_type: string;
  total_hours: number;
  description: string | null;
}

export function AddEntryForm({ locked }: { locked: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await addTimesheetEntry(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
        Add Entry
      </h3>
      {error && (
        <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      <form action={handleSubmit} className="space-y-4">
        <EntryFields />
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Entry"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
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
}: {
  entry: Entry;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const typeLabel =
    ENTRY_TYPE_OPTIONS.find((o) => o.value === entry.entry_type)?.label ??
    entry.entry_type;

  if (!editing) {
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
        </td>
        <td className="px-4 py-3 text-slate">{typeLabel}</td>
        <td className="px-4 py-3 text-right text-charcoal font-medium">
          {entry.total_hours?.toFixed(1)}
        </td>
        <td className="px-4 py-3 text-right">
          {!locked && (
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
          )}
          {error && (
            <p className="text-xs text-error mt-1">{error}</p>
          )}
        </td>
      </tr>
    );
  }

  async function handleUpdate(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await updateTimesheetEntry(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

  return (
    <tr>
      <td colSpan={5} className="px-4 py-3">
        {error && (
          <div className="mb-3 rounded-lg bg-error/10 border border-error/20 px-4 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <form action={handleUpdate} className="space-y-3">
          <input type="hidden" name="entryId" value={entry.id} />
          <EntryFields
            defaultDate={entry.date}
            defaultType={entry.entry_type}
            defaultHours={entry.total_hours.toString()}
            defaultDescription={entry.description ?? ""}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-4 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-9 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-4 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EntryFields({
  defaultDate,
  defaultType,
  defaultHours,
  defaultDescription,
}: {
  defaultDate?: string;
  defaultType?: string;
  defaultHours?: string;
  defaultDescription?: string;
} = {}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Date *
          </label>
          <input
            name="date"
            type="date"
            required
            defaultValue={defaultDate ?? new Date().toISOString().split("T")[0]}
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Type *
          </label>
          <select
            name="entryType"
            required
            defaultValue={defaultType ?? "class_lead"}
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          >
            {ENTRY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Hours *
          </label>
          <input
            name="totalHours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            required
            defaultValue={defaultHours ?? ""}
            placeholder="1.5"
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">
            Description
          </label>
          <input
            name="description"
            type="text"
            maxLength={500}
            defaultValue={defaultDescription ?? ""}
            placeholder="What did you do?"
            className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
      </div>
    </>
  );
}
