"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminAddEntry, adminUpdateEntry, adminDeleteEntry } from "./actions";

interface Teacher {
  id: string;
  name: string;
  employmentType: string;
}

interface Production {
  id: string;
  name: string;
}

interface EntryData {
  id: string;
  date: string;
  entry_type: string;
  total_hours: number;
  description: string | null;
  sub_for: string | null;
  production_id: string | null;
  production_name: string | null;
  event_tag: string | null;
  notes: string | null;
  teacher_id?: string;
}

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

// ── Quick Entry Mode bar ──────────────────────────────────
export function QuickEntryBar({
  quickMode,
  setQuickMode,
  stickyTeacher,
  setStickyTeacher,
  sessionHours,
  teachers,
}: {
  quickMode: boolean;
  setQuickMode: (v: boolean) => void;
  stickyTeacher: string;
  setStickyTeacher: (v: string) => void;
  sessionHours: number;
  teachers: Teacher[];
}) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm font-medium text-charcoal cursor-pointer">
        <input
          type="checkbox"
          checked={quickMode}
          onChange={(e) => setQuickMode(e.target.checked)}
          className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
        />
        Quick Entry Mode
      </label>

      {quickMode && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-charcoal whitespace-nowrap">
              Entry for:
            </label>
            <select
              value={stickyTeacher}
              onChange={(e) => setStickyTeacher(e.target.value)}
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:outline-none min-w-[180px]"
            >
              <option value="">Select teacher...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-sm text-slate">
            Session:{" "}
            <span className="font-semibold text-charcoal">
              {sessionHours.toFixed(1)} hrs
            </span>{" "}
            entered
          </div>
        </>
      )}
    </div>
  );
}

// ── Add Entry Button ──────────────────────────────────────
export function AdminAddEntryButton({
  teachers,
  productions,
  quickMode,
  stickyTeacher,
  onEntryAdded,
}: {
  teachers: Teacher[];
  productions: Production[];
  quickMode?: boolean;
  stickyTeacher?: string;
  onEntryAdded?: (hours: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 transition-colors"
      >
        + Add Entry
      </button>
      {open && (
        <EntryDrawer
          teachers={teachers}
          productions={productions}
          quickMode={quickMode}
          defaultTeacher={stickyTeacher}
          onClose={() => setOpen(false)}
          onSaved={(hours) => {
            onEntryAdded?.(hours);
            if (!quickMode) setOpen(false);
          }}
        />
      )}
    </>
  );
}

// ── Edit Entry Button ─────────────────────────────────────
export function AdminEditEntryButton({
  entry,
  teachers,
  productions,
}: {
  entry: EntryData;
  teachers: Teacher[];
  productions: Production[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-lavender hover:text-lavender-dark font-medium"
        title="Edit"
      >
        ✎
      </button>
      {open && (
        <EntryDrawer
          entry={entry}
          teachers={teachers}
          productions={productions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Delete Entry Button ───────────────────────────────────
export function AdminDeleteEntryButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-error hover:text-error/80 font-medium ml-1"
        title="Delete"
      >
        ✕
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] text-slate">Delete?</span>
      <form
        action={async (fd: FormData) => {
          setLoading(true);
          await adminDeleteEntry(fd);
          setLoading(false);
          setConfirming(false);
        }}
      >
        <input type="hidden" name="entryId" value={entryId} />
        <button
          type="submit"
          disabled={loading}
          className="text-[10px] text-error font-semibold disabled:opacity-50"
        >
          Yes
        </button>
      </form>
      <button
        onClick={() => setConfirming(false)}
        className="text-[10px] text-slate"
      >
        No
      </button>
    </span>
  );
}

// ── Entry Drawer ──────────────────────────────────────────
function EntryDrawer({
  entry,
  teachers,
  productions,
  quickMode,
  defaultTeacher,
  onClose,
  onSaved,
}: {
  entry?: EntryData;
  teachers: Teacher[];
  productions: Production[];
  quickMode?: boolean;
  defaultTeacher?: string;
  onClose: () => void;
  onSaved?: (hours: number) => void;
}) {
  const isEdit = !!entry;
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState(
    entry ? (ENTRY_TYPE_TO_CATEGORY[entry.entry_type] ?? "other") : "class"
  );
  const [selectedTeacher, setSelectedTeacher] = useState(
    entry?.teacher_id ?? defaultTeacher ?? ""
  );
  const [selectedProduction, setSelectedProduction] = useState(
    entry?.production_id ?? ""
  );
  const [currentDate, setCurrentDate] = useState(
    entry?.date ?? new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const teacher = teachers.find((t) => t.id === selectedTeacher);

  const handleSubmitAction = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      setError("");

      if (selectedProduction) {
        const prod = productions.find((p) => p.id === selectedProduction);
        if (prod) formData.set("productionName", prod.name);
      }

      const hours = parseFloat(formData.get("totalHours") as string) || 0;
      const result = isEdit
        ? await adminUpdateEntry(formData)
        : await adminAddEntry(formData);

      setLoading(false);

      if (result?.error) {
        setError(result.error);
      } else if (quickMode && !isEdit) {
        // Quick mode: reset form, advance date by 1 day
        onSaved?.(hours);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);

        const nextDate = new Date(currentDate + "T12:00:00");
        nextDate.setDate(nextDate.getDate() + 1);
        setCurrentDate(nextDate.toISOString().split("T")[0]);

        // Reset form fields but keep teacher and category
        if (formRef.current) {
          const descInput = formRef.current.querySelector(
            'input[name="description"]'
          ) as HTMLInputElement | null;
          const hoursInput = formRef.current.querySelector(
            'input[name="totalHours"]'
          ) as HTMLInputElement | null;
          const notesInput = formRef.current.querySelector(
            'textarea[name="notes"]'
          ) as HTMLTextAreaElement | null;
          if (descInput) descInput.value = "";
          if (hoursInput) hoursInput.value = "";
          if (notesInput) notesInput.value = "";
        }
      } else {
        onSaved?.(hours);
        onClose();
      }
    },
    [
      isEdit,
      quickMode,
      selectedProduction,
      productions,
      currentDate,
      onClose,
      onSaved,
    ]
  );

  // Cmd+Enter to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              {isEdit ? "Edit Entry" : "Add Entry"}
            </h2>
            {quickMode && !isEdit && (
              <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full font-medium">
                Quick Mode
              </span>
            )}
            {saved && (
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium animate-pulse">
                Saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate hover:text-charcoal text-lg"
          >
            ✕
          </button>
        </div>

        <form ref={formRef} action={handleSubmitAction} className="p-6 space-y-5">
          {isEdit && <input type="hidden" name="entryId" value={entry.id} />}

          {/* Teacher (add only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Teacher *
              </label>
              <select
                name="teacherProfileId"
                required
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              >
                <option value="">Select teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Employment Type (read-only) */}
          {teacher && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Employment Type
              </label>
              <div className="h-10 rounded-lg border border-silver bg-cloud/50 px-3 flex items-center text-sm text-slate">
                {teacher.employmentType === "1099"
                  ? "1099 Contractor"
                  : "W-2 Employee"}
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Date *
            </label>
            <input
              name="date"
              type="date"
              required
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Category *
            </label>
            <select
              name="category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Hours *
            </label>
            <input
              name="totalHours"
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              required
              defaultValue={entry?.total_hours?.toString() ?? ""}
              placeholder="1.5"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              {DESCRIPTION_LABELS[category] ?? "Description"}
            </label>
            <input
              name="description"
              type="text"
              maxLength={500}
              defaultValue={entry?.description ?? ""}
              placeholder={
                category === "class"
                  ? "e.g. Intermediate Ballet"
                  : category === "private"
                    ? "e.g. Sophia Martin"
                    : category === "rehearsal"
                      ? "e.g. Nutcracker Act II Corps"
                      : category === "admin"
                        ? "e.g. Schedule coordination"
                        : "Description"
              }
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>

          {/* Sub for */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
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

          {/* Production */}
          {productions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Tag to Production (optional)
              </label>
              <select
                name="productionId"
                value={selectedProduction}
                onChange={(e) => setSelectedProduction(e.target.value)}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              >
                <option value="">None</option>
                {productions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Event Tag */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              defaultValue={entry?.notes ?? ""}
              placeholder="Additional notes..."
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : quickMode && !isEdit
                  ? "Save & Next"
                  : "Save Entry"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors"
            >
              {quickMode ? "Done" : "Cancel"}
            </button>
          </div>

          {quickMode && !isEdit && (
            <p className="text-xs text-mist text-center">
              Tip: Press Cmd+Enter to save and stay open
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
