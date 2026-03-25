"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { adminAddEntry, adminUpdateEntry, adminDeleteEntry, submitTimesheetEntry, approveTimesheetEntry } from "./actions";

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
  class_id?: string | null;
  schedule_instance_id?: string | null;
  status?: string;
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

interface ActiveClass {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
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
  { value: "class_assistant", label: "Class Assistant" },
  { value: "private", label: "Private" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "substitute", label: "Substitute" },
  { value: "admin", label: "Admin" },
  { value: "training", label: "Training" },
  { value: "performance", label: "Performance" },
  { value: "competition", label: "Competition" },
  { value: "bonus", label: "Bonus" },
  { value: "other", label: "Other" },
];

const ENTRY_TYPE_TO_CATEGORY: Record<string, string> = {
  class_lead: "class",
  class_assistant: "class_assistant",
  private: "private",
  rehearsal: "rehearsal",
  admin: "admin",
  performance_event: "performance",
  competition: "competition",
  training: "training",
  substitute: "substitute",
  bonus: "bonus",
};

const DESCRIPTION_LABELS: Record<string, string> = {
  private: "Student Name(s)",
  rehearsal: "Rehearsal / Cast Group",
  substitute: "Class / Session Name",
  admin: "Task Description",
  training: "Training Description",
  performance: "Performance Description",
  competition: "Competition Description",
  bonus: "Description",
  other: "Description",
};

const SHOW_SCHEDULE_CLASSES = new Set(["class", "class_assistant"]);
const SHOW_ALL_CLASSES = new Set(["rehearsal", "substitute"]);

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
            <SimpleSelect
              value={stickyTeacher}
              onValueChange={(val) => setStickyTeacher(val)}
              options={teachers.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select teacher..."
              className="min-w-[180px]"
            />
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
  defaultTeacherId,
  onEntryAdded,
}: {
  teachers: Teacher[];
  productions: Production[];
  quickMode?: boolean;
  stickyTeacher?: string;
  defaultTeacherId?: string;
  onEntryAdded?: (hours: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const resolvedTeacher = defaultTeacherId || stickyTeacher;

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
          defaultTeacher={resolvedTeacher}
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
  isAdmin,
}: {
  entry: EntryData;
  teachers: Teacher[];
  productions: Production[];
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-base text-lavender hover:text-lavender-dark font-medium p-1"
        title="Edit"
      >
        ✎
      </button>
      {open && (
        <EntryDrawer
          entry={entry}
          teachers={teachers}
          productions={productions}
          isAdmin={isAdmin}
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
        className="text-base text-error hover:text-error/80 font-medium ml-1 p-1"
        title="Delete"
      >
        ✕
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-slate">Delete?</span>
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
          className="text-xs text-error font-semibold disabled:opacity-50"
        >
          Yes
        </button>
      </form>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs text-slate"
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
  isAdmin,
  onClose,
  onSaved,
}: {
  entry?: EntryData;
  teachers: Teacher[];
  productions: Production[];
  quickMode?: boolean;
  defaultTeacher?: string;
  isAdmin?: boolean;
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
  const [selectedInstance, setSelectedInstance] = useState(entry?.schedule_instance_id ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [allClasses, setAllClasses] = useState<ActiveClass[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(entry?.class_id ?? "");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [subForTeacher, setSubForTeacher] = useState(entry?.sub_for ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
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

  // Fetch all active classes (once on mount, for fallback dropdown)
  useEffect(() => {
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((d) => setAllClasses(d.classes ?? []))
      .catch(() => setAllClasses([]));
  }, []);

  // Fetch ALL students when category is "private" (no class needed)
  useEffect(() => {
    if (category === "private") {
      fetch("/api/teach/students")
        .then((r) => r.json())
        .then((d) => setAllStudents(d.students ?? []))
        .catch(() => setAllStudents([]));
    } else {
      setAllStudents([]);
    }
  }, [category]);

  // Fetch students when a class is selected (via schedule instance or fallback)
  useEffect(() => {
    const inst = scheduleInstances.find((i) => i.id === selectedInstance);
    const classId = inst?.class_id ?? (selectedClassId || null);
    if (classId && !customMode) {
      fetch(`/api/teach/students?classId=${classId}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.students ?? []))
        .catch(() => setStudents([]));
    } else {
      setStudents([]);
      setSelectedStudentIds([]);
    }
  }, [selectedInstance, scheduleInstances, selectedClassId, customMode]);

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
        setSelectedClassId("");
        setCustomMode(false);
        setDescription("");
        setSubForTeacher("");
        setNotes("");
        setSelectedStudentIds([]);
        setSelectedProductionIds([]);
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
              <input type="hidden" name="teacherProfileId" value={selectedTeacher} />
              <SimpleSelect
                value={selectedTeacher}
                onValueChange={(val) => setSelectedTeacher(val)}
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select teacher..."
                className="w-full"
              />
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

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Category *
            </label>
            <input type="hidden" name="category" value={category} />
            <SimpleSelect
              value={category}
              onValueChange={(val) => {
                setCategory(val);
                setSelectedInstance("");
                setSelectedClassId("");
                setCustomMode(false);
                setSubForTeacher("");
                setSelectedStudentIds([]);
              }}
              options={CATEGORIES}
              placeholder="Select category..."
              className="w-full"
            />
          </div>

          {/* Class / Session Selector — three-tier: schedule instances → all classes → custom */}
          {selectedTeacher && (SHOW_SCHEDULE_CLASSES.has(category) || SHOW_ALL_CLASSES.has(category)) && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                {SHOW_SCHEDULE_CLASSES.has(category) && scheduleInstances.length > 0 ? "Schedule Session" : "Class"}
              </label>

              {customMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setDescription("");
                    }}
                    className="text-xs text-lavender hover:text-lavender-dark font-medium mb-1.5"
                  >
                    &larr; Back to list
                  </button>
                  <input
                    name="customClassName"
                    type="text"
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter class or session name..."
                    className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                  />
                </>
              ) : SHOW_SCHEDULE_CLASSES.has(category) && scheduleInstances.length > 0 ? (
                <SimpleSelect
                  value={selectedInstance}
                  onValueChange={(val) => {
                    if (val === "__custom__") {
                      setCustomMode(true);
                      setSelectedInstance("");
                      setSelectedClassId("");
                      setDescription("");
                      return;
                    }
                    const inst = scheduleInstances.find((i) => i.id === val);
                    setSelectedInstance(val);
                    setSelectedClassId("");
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
                  options={[
                    ...scheduleInstances.map((inst) => ({
                      value: inst.id,
                      label: `${inst.class_name ?? inst.event_type}${inst.start_time ? ` ${formatTime12h(inst.start_time)}` : ""}${inst.end_time ? `\u2013${formatTime12h(inst.end_time)}` : ""}`,
                    })),
                    { value: "__custom__", label: "+ Other / Custom" },
                  ]}
                  placeholder="Select a session..."
                  className="w-full"
                />
              ) : allClasses.length > 0 ? (
                <SimpleSelect
                  value={selectedClassId}
                  onValueChange={(val) => {
                    if (val === "__custom__") {
                      setCustomMode(true);
                      setSelectedClassId("");
                      setDescription("");
                      return;
                    }
                    setSelectedClassId(val);
                    setSelectedInstance("");
                    const cls = allClasses.find((c) => c.id === val);
                    if (cls) {
                      setDescription(cls.name);
                      if (cls.start_time) setStartTime(cls.start_time.slice(0, 5));
                      if (cls.end_time) setEndTime(cls.end_time.slice(0, 5));
                    }
                  }}
                  options={[
                    ...allClasses.map((cls) => ({
                      value: cls.id,
                      label: `${cls.name}${cls.start_time ? ` ${formatTime12h(cls.start_time)}` : ""}${cls.end_time ? `\u2013${formatTime12h(cls.end_time)}` : ""}`,
                    })),
                    { value: "__custom__", label: "+ Other / Custom" },
                  ]}
                  placeholder="Select a class..."
                  className="w-full"
                />
              ) : null}

              <input type="hidden" name="scheduleInstanceId" value={selectedInstance} />
              <input type="hidden" name="classId" value={
                scheduleInstances.find((i) => i.id === selectedInstance)?.class_id
                ?? selectedClassId
                ?? ""
              } />
            </div>
          )}

          {/* Description (hidden for class/class_assistant — dropdown covers it) */}
          <input type="hidden" name="description" value={description} />
          {!SHOW_SCHEDULE_CLASSES.has(category) && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                {DESCRIPTION_LABELS[category] ?? "Description"}
              </label>
              <input
                type="text"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  category === "private"
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
          )}

          {/* Students multi-select for private lessons (all active students) */}
          {category === "private" && allStudents.length > 0 && (
            <MultiSelectDropdown
              label="Students"
              options={allStudents}
              selected={selectedStudentIds}
              onChange={setSelectedStudentIds}
              placeholder="Select students..."
            />
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

          {/* Students multi-select (when a class is selected via instance or fallback) */}
          {(selectedInstance || selectedClassId) && !customMode && students.length > 0 && (
            <MultiSelectDropdown
              label="Students (optional)"
              options={students}
              selected={selectedStudentIds}
              onChange={setSelectedStudentIds}
              placeholder="Select students..."
            />
          )}

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

          {/* Substitute for — teacher dropdown, only for substitute category */}
          {category === "substitute" && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Substitute for
              </label>
              <input type="hidden" name="subFor" value={subForTeacher} />
              <SimpleSelect
                value={subForTeacher}
                onValueChange={(val) => setSubForTeacher(val)}
                options={teachers
                  .filter((t) => t.id !== selectedTeacher)
                  .map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select teacher..."
                className="w-full"
              />
            </div>
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
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

            {/* Submit / Approve buttons for admin in edit mode */}
            {isEdit && isAdmin && entry?.status === "draft" && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  const fd = new FormData();
                  fd.set("entryId", entry.id);
                  const result = await submitTimesheetEntry(fd);
                  setLoading(false);
                  if (result?.error) setError(result.error);
                  else onClose();
                }}
                className="h-11 rounded-lg bg-gold hover:bg-gold-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
              >
                Submit
              </button>
            )}
            {isEdit && isAdmin && (entry?.status === "submitted" || entry?.status === "flagged") && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  const fd = new FormData();
                  fd.set("entryId", entry.id);
                  const result = await approveTimesheetEntry(fd);
                  setLoading(false);
                  if (result?.error) setError(result.error);
                  else onClose();
                }}
                className="h-11 rounded-lg bg-success hover:bg-success/90 text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
            )}
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
