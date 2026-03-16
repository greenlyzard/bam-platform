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
  start_time?: string | null;
  end_time?: string | null;
  production_ids?: string[];
}

interface ScheduleInstance {
  id: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  class_id: string | null;
  class_name: string | null;
  production_id: string | null;
  notes: string | null;
}

interface Student {
  id: string;
  name: string;
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
  private: "Student Name(s)",
  rehearsal: "Rehearsal / Cast Group",
  admin: "Task Description",
  other: "Description",
};

// ── Multi-select checkbox dropdown ───────────────────────
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  const selectedNames = options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.name);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-charcoal mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-left text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none flex items-center justify-between"
      >
        <span className={selectedNames.length ? "text-charcoal" : "text-mist"}>
          {selectedNames.length
            ? selectedNames.length <= 2
              ? selectedNames.join(", ")
              : `${selectedNames.length} selected`
            : placeholder ?? "Select..."}
        </span>
        <span className="text-mist text-xs ml-2">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-silver bg-white shadow-lg">
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-mist">No options</div>
          )}
          {options.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-cloud/50 cursor-pointer text-sm text-charcoal"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
                className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
              />
              {o.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [selectedProductionIds, setSelectedProductionIds] = useState<string[]>(
    entry?.production_ids ?? (entry?.production_id ? [entry.production_id] : [])
  );
  const [currentDate, setCurrentDate] = useState(
    entry?.date ?? new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState(entry?.start_time ?? "");
  const [endTime, setEndTime] = useState(entry?.end_time ?? "");
  const [hours, setHours] = useState(entry?.total_hours?.toString() ?? "");
  const [scheduleInstances, setScheduleInstances] = useState<ScheduleInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const teacher = teachers.find((t) => t.id === selectedTeacher);

  // Auto-calculate hours when start/end times change
  useEffect(() => {
    if (startTime && endTime) {
      const computed = computeHours(startTime, endTime);
      if (computed) setHours(computed.toString());
    }
  }, [startTime, endTime]);

  // Fetch schedule instances when teacher AND date are both set
  useEffect(() => {
    if (selectedTeacher && currentDate) {
      fetch(`/api/admin/schedule-instances?teacherId=${selectedTeacher}&date=${currentDate}`)
        .then((r) => r.json())
        .then((d) => setScheduleInstances(d.instances ?? []))
        .catch(() => setScheduleInstances([]));
    } else {
      setScheduleInstances([]);
      setSelectedInstance("");
    }
  }, [selectedTeacher, currentDate]);

  // Fetch students when a schedule instance with a class is selected
  useEffect(() => {
    const inst = scheduleInstances.find((i) => i.id === selectedInstance);
    if (inst?.class_id) {
      fetch(`/api/teach/students?classId=${inst.class_id}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.students ?? []))
        .catch(() => setStudents([]));
    } else {
      setStudents([]);
      setSelectedStudentIds([]);
    }
  }, [selectedInstance, scheduleInstances]);

  const handleSubmitAction = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      setError("");

      // Set production IDs as JSON
      if (selectedProductionIds.length > 0) {
        formData.set("productionIds", JSON.stringify(selectedProductionIds));
        // Also set first production for backward compat
        const firstProd = productions.find((p) => p.id === selectedProductionIds[0]);
        if (firstProd) {
          formData.set("productionId", firstProd.id);
          formData.set("productionName", firstProd.name);
        }
      }

      // Set student IDs
      if (selectedStudentIds.length > 0) {
        formData.set("studentIds", JSON.stringify(selectedStudentIds));
        // Build student names for description if category is private
        if (category === "private") {
          const names = students
            .filter((s) => selectedStudentIds.includes(s.id))
            .map((s) => s.name);
          if (names.length > 0 && !formData.get("description")) {
            formData.set("description", names.join(", "));
          }
        }
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
        setStartTime("");
        setEndTime("");
        setHours("");
        setSelectedInstance("");
        setDescription("");
        setSelectedStudentIds([]);
        setSelectedProductionIds([]);
        if (formRef.current) {
          const notesInput = formRef.current.querySelector(
            'textarea[name="notes"]'
          ) as HTMLTextAreaElement | null;
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
      selectedProductionIds,
      selectedStudentIds,
      students,
      category,
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
              onChange={(e) => {
                setCategory(e.target.value);
                setSelectedInstance("");
                setSelectedStudentIds([]);
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

          {/* Schedule Instance Dropdown (when teacher + date selected) */}
          {selectedTeacher && scheduleInstances.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Schedule Session
              </label>
              <select
                value={selectedInstance}
                onChange={(e) => {
                  const inst = scheduleInstances.find((i) => i.id === e.target.value);
                  setSelectedInstance(e.target.value);
                  if (inst) {
                    if (inst.class_name) setDescription(inst.class_name);
                    if (inst.start_time) setStartTime(inst.start_time.slice(0, 5));
                    if (inst.end_time) setEndTime(inst.end_time.slice(0, 5));
                    if (inst.production_id) {
                      setSelectedProductionIds((prev) =>
                        prev.includes(inst.production_id!) ? prev : [...prev, inst.production_id!]
                      );
                    }
                  }
                }}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              >
                <option value="">Select a session...</option>
                {scheduleInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.class_name ?? inst.event_type}
                    {inst.start_time ? ` ${formatTime12h(inst.start_time)}` : ""}
                    {inst.end_time ? `\u2013${formatTime12h(inst.end_time)}` : ""}
                  </option>
                ))}
              </select>
              <input type="hidden" name="scheduleInstanceId" value={selectedInstance} />
              <input type="hidden" name="classId" value={scheduleInstances.find((i) => i.id === selectedInstance)?.class_id ?? ""} />
            </div>
          )}

          {/* Students multi-select (when a session with a class is selected) */}
          {selectedInstance && students.length > 0 && (
            <MultiSelectDropdown
              label="Students (optional)"
              options={students}
              selected={selectedStudentIds}
              onChange={setSelectedStudentIds}
              placeholder="Select students..."
            />
          )}

          {/* Start / End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
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
              <label className="block text-sm font-medium text-charcoal mb-1.5">
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
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Hours *
              {startTime && endTime && (
                <span className="ml-2 text-xs font-normal text-mist">(auto-calculated from times)</span>
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
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

          {/* Productions multi-select */}
          {productions.length > 0 && (
            <MultiSelectDropdown
              label="Tag to Productions (optional)"
              options={productions}
              selected={selectedProductionIds}
              onChange={setSelectedProductionIds}
              placeholder="Select productions..."
            />
          )}

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
