"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClassEditDrawer } from "./class-edit-drawer";

// ── Types ────────────────────────────────────────────────
export interface ClassRecord {
  id: string;
  name: string;
  style: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  max_students: number;
  is_active: boolean;
  teacher_id: string | null;
  age_min: number | null;
  age_max: number | null;
  description: string | null;
  discipline: string | null;
  fee_cents: number | null;
  season: string | null;
  notes: string | null;
  enrolled_count: number;
  status: string;
  short_description: string | null;
  medium_description: string | null;
  long_description: string | null;
  gender: string | null;
  levels: string[] | null;
  discipline_ids: string[] | null;
  curriculum_ids: string[] | null;
  days_of_week: number[] | null;
  start_date: string | null;
  end_date: string | null;
  season_id: string | null;
  max_enrollment: number | null;
  show_capacity_public: boolean;
  online_registration: boolean;
  is_hidden: boolean;
  is_new: boolean;
  new_expires_at: string | null;
  is_rehearsal: boolean;
  is_performance: boolean;
  enrolledCount: number;
  legacyTeacherName: string | null;
}

export interface ClassTeacher {
  id: string;
  class_id: string;
  teacher_id: string;
  role: string;
  is_primary: boolean;
  tenant_id: string;
}

export interface TeacherOption {
  id: string;
  name: string;
  email: string | null;
}

export interface DisciplineOption {
  id: string;
  name: string;
}

export interface CurriculumOption {
  id: string;
  name: string;
}

export interface SeasonOption {
  id: string;
  name: string;
}

export interface ProductionOption {
  id: string;
  name: string;
}

export interface ClosureRecord {
  id: string;
  closed_date: string;
  reason: string | null;
}

export interface PricingRule {
  id: string;
  class_id: string;
  tenant_id: string;
  label: string;
  deadline: string | null;
  amount: number;
  discount_type: string | null;
  discount_value: number | null;
  is_base_price: boolean;
  sort_order: number;
}

export interface ClassPhase {
  id: string;
  class_id: string;
  tenant_id: string;
  phase: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  production_id: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const LEVEL_OPTIONS = [
  "Petites",
  "Level 1",
  "Level 2A",
  "Level 2B",
  "Level 2C",
  "Level 3A",
  "Level 3B",
  "Level 3C",
  "Level 4A",
  "Level 4B",
  "Level 4C",
  "Adult/Teen",
];

// ── Column configuration ─────────────────────────────────
interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  fieldType?: string;
}

type FieldConfigRow = {
  field_key: string;
  label: string;
  field_type: string;
  admin_default_on: boolean;
  is_core: boolean;
  sort_order: number;
  group_name: string;
};

const COLUMNS_STORAGE_KEY = "bam-classes-columns";

function buildDefaultColumns(config: FieldConfigRow[]): ColumnConfig[] {
  return config.map((f) => ({
    key: f.field_key,
    label: f.label,
    visible: f.admin_default_on,
    fieldType: f.field_type,
  }));
}

function buildLockedColumns(config: FieldConfigRow[]): Set<string> {
  return new Set(config.filter((f) => f.is_core).map((f) => f.field_key));
}

function loadColumns(defaults: ColumnConfig[]): ColumnConfig[] {
  if (typeof window === "undefined") return defaults;
  try {
    const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as ColumnConfig[];
    // Build a map of saved visibility preferences
    const savedMap = new Map(parsed.map((c) => [c.key, c.visible]));
    // Merge: keep DB order, use saved visibility where available, default for new keys
    const defaultKeys = new Set(defaults.map((d) => d.key));
    const merged = [
      // Saved columns that still exist in DB config (preserve user order)
      ...parsed
        .filter((c) => defaultKeys.has(c.key))
        .map((c) => {
          const def = defaults.find((d) => d.key === c.key)!;
          return { ...def, visible: c.visible };
        }),
      // New DB keys not yet in localStorage — use admin_default_on
      ...defaults.filter((d) => !savedMap.has(d.key)),
    ];
    return merged;
  } catch {
    return defaults;
  }
}

function saveColumns(cols: ColumnConfig[]) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols));
  } catch {}
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

// ── Main Component ───────────────────────────────────────
export function ClassManagement({
  classes: initialClasses,
  classTeachers: initialClassTeachers,
  teachers,
  disciplines,
  curriculum,
  seasons,
  productions,
  closures,
  pricingRules: initialPricingRules,
  classPhases: initialClassPhases,
  fieldConfig,
  roomMap = {},
  locationMap = {},
  tenantId,
}: {
  classes: ClassRecord[];
  classTeachers: ClassTeacher[];
  teachers: TeacherOption[];
  disciplines: DisciplineOption[];
  curriculum: CurriculumOption[];
  seasons: SeasonOption[];
  productions: ProductionOption[];
  closures: ClosureRecord[];
  pricingRules: PricingRule[];
  classPhases: ClassPhase[];
  fieldConfig: FieldConfigRow[];
  roomMap?: Record<string, string>;
  locationMap?: Record<string, string>;
  tenantId: string;
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [classTeachersData, setClassTeachersData] = useState(initialClassTeachers);
  const [pricingRulesData, setPricingRulesData] = useState(initialPricingRules);
  const [classPhasesData, setClassPhasesData] = useState(initialClassPhases);
  const [search, setSearch] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerClass, setDrawerClass] = useState<ClassRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNewClass, setIsNewClass] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const activeFilterCount = [filterSeason, filterTeacher, filterLevel, filterDiscipline, filterDay, filterType, filterStatus].filter(Boolean).length;

  // Column config driven by class_field_config table
  const DEFAULT_COLUMNS = buildDefaultColumns(fieldConfig);
  const LOCKED_COLUMNS = buildLockedColumns(fieldConfig);

  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const columnsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColumns(loadColumns(DEFAULT_COLUMNS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldConfig]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnsPopoverRef.current && !columnsPopoverRef.current.contains(e.target as Node)) {
        setColumnsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateColumns(newCols: ColumnConfig[]) {
    setColumns(newCols);
    saveColumns(newCols);
  }

  function toggleColumnVisible(key: string) {
    if (LOCKED_COLUMNS.has(key)) return;
    const newCols = columns.map((c) =>
      c.key === key ? { ...c, visible: !c.visible } : c
    );
    updateColumns(newCols);
  }

  function resetColumns() {
    updateColumns(DEFAULT_COLUMNS);
  }

  const colSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleColDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = columns.findIndex((c) => c.key === active.id);
    const newIdx = columns.findIndex((c) => c.key === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    updateColumns(arrayMove(columns, oldIdx, newIdx));
  }

  const supabase = createClient();

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Filtering ────────────────────────────────────────
  const filtered = classes.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filterSeason && c.season_id !== filterSeason && c.season !== filterSeason)
      return false;
    if (filterTeacher) {
      const hasTeacher =
        c.teacher_id === filterTeacher ||
        classTeachersData.some(
          (ct) => ct.class_id === c.id && ct.teacher_id === filterTeacher
        );
      if (!hasTeacher) return false;
    }
    if (filterLevel) {
      const hasLevel = c.levels?.includes(filterLevel);
      if (!hasLevel) return false;
    }
    if (filterDiscipline) {
      const hasDiscipline = c.discipline_ids?.includes(filterDiscipline);
      if (!hasDiscipline) return false;
    }
    if (filterDay !== "") {
      const dayNum = parseInt(filterDay);
      const hasDay =
        c.days_of_week?.includes(dayNum) || c.day_of_week === dayNum;
      if (!hasDay) return false;
    }
    if (filterType === "rehearsal" && !c.is_rehearsal) return false;
    if (filterType === "performance" && !c.is_performance) return false;
    if (filterType === "class" && (c.is_rehearsal || c.is_performance))
      return false;
    if (filterStatus === "active" && (!c.is_active || c.is_hidden))
      return false;
    if (filterStatus === "hidden" && !c.is_hidden) return false;
    if (filterStatus === "inactive" && c.is_active) return false;
    return true;
  });

  // ── Teacher name helper ──────────────────────────────
  function getTeacherNames(classId: string, legacyName: string | null): string {
    const assigned = classTeachersData.filter((ct) => ct.class_id === classId);
    if (assigned.length > 0) {
      return assigned
        .map((ct) => {
          const t = teachers.find((t) => t.id === ct.teacher_id);
          return t?.name ?? "Unknown";
        })
        .join(", ");
    }
    return legacyName ?? "—";
  }

  // ── Discipline names helper ──────────────────────────
  function getDisciplineNames(ids: string[] | null): string {
    if (!ids || ids.length === 0) return "—";
    return ids
      .map((id) => disciplines.find((d) => d.id === id)?.name ?? id)
      .join(", ");
  }

  // ── Day/Time helper ──────────────────────────────────
  function getDayTime(c: ClassRecord): string {
    const days =
      c.days_of_week && c.days_of_week.length > 0
        ? c.days_of_week.map((d) => DAY_NAMES[d]).join(", ")
        : c.day_of_week != null
          ? DAY_NAMES[c.day_of_week]
          : "—";
    const time =
      c.start_time && c.end_time
        ? `${formatTime(c.start_time)}–${formatTime(c.end_time)}`
        : "";
    return `${days} ${time}`.trim();
  }

  // ── Bulk Actions ─────────────────────────────────────
  const selectedCount = selected.size;
  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // ── Drawer handlers ──────────────────────────────────
  function openNew() {
    setDrawerClass(null);
    setIsNewClass(true);
    setDrawerOpen(true);
  }

  function openEdit(c: ClassRecord) {
    setDrawerClass(c);
    setIsNewClass(false);
    setDrawerOpen(true);
  }

  function handleSaved(updatedClass: ClassRecord) {
    setClasses((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedClass.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedClass;
        return next;
      }
      return [...prev, updatedClass];
    });
    setDrawerClass(updatedClass);
    setIsNewClass(false);
    flash("Class saved");
  }

  function handleTeachersUpdated(classId: string, newTeachers: ClassTeacher[]) {
    setClassTeachersData((prev) => [
      ...prev.filter((ct) => ct.class_id !== classId),
      ...newTeachers,
    ]);
  }

  function handlePricingUpdated(classId: string, newRules: PricingRule[]) {
    setPricingRulesData((prev) => [
      ...prev.filter((r) => r.class_id !== classId),
      ...newRules,
    ]);
  }

  function handlePhasesUpdated(classId: string, newPhases: ClassPhase[]) {
    setClassPhasesData((prev) => [
      ...prev.filter((p) => p.class_id !== classId),
      ...newPhases,
    ]);
  }

  // ── Bulk toggle online reg ───────────────────────────
  async function bulkToggleOnlineReg(value: boolean) {
    for (const id of selected) {
      await supabase
        .from("classes")
        .update({ online_registration: value })
        .eq("id", id);
    }
    setClasses((prev) =>
      prev.map((c) =>
        selected.has(c.id) ? { ...c, online_registration: value } : c
      )
    );
    setSelected(new Set());
    flash(`Online registration ${value ? "enabled" : "disabled"} for ${selectedCount} classes`);
  }

  async function bulkToggleHidden(value: boolean) {
    for (const id of selected) {
      await supabase.from("classes").update({ is_hidden: value }).eq("id", id);
    }
    setClasses((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, is_hidden: value } : c))
    );
    setSelected(new Set());
    flash(`${selectedCount} classes ${value ? "hidden" : "shown"}`);
  }

  async function bulkSetNew(value: boolean, expiryDate?: string) {
    for (const id of selected) {
      await supabase
        .from("classes")
        .update({
          is_new: value,
          new_expires_at: value && expiryDate ? expiryDate : null,
        })
        .eq("id", id);
    }
    setClasses((prev) =>
      prev.map((c) =>
        selected.has(c.id)
          ? {
              ...c,
              is_new: value,
              new_expires_at: value && expiryDate ? expiryDate : null,
            }
          : c
      )
    );
    setSelected(new Set());
    flash(`New flag ${value ? "set" : "removed"} for ${selectedCount} classes`);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedCount} classes? This cannot be undone.`))
      return;
    for (const id of selected) {
      await supabase.from("classes").delete().eq("id", id);
    }
    setClasses((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    flash(`${selectedCount} classes deleted`);
  }

  async function bulkAssignTeacher(teacherId: string) {
    for (const id of selected) {
      // Delete existing teachers for this class, insert new primary lead
      await supabase.from("class_teachers").delete().eq("class_id", id);
      await supabase.from("class_teachers").insert({
        class_id: id,
        teacher_id: teacherId,
        role: "lead",
        is_primary: true,
        tenant_id: tenantId,
      });
    }
    // Refresh class teachers
    const { data: refreshed } = await supabase
      .from("class_teachers")
      .select("*")
      .eq("tenant_id", tenantId);
    setClassTeachersData(refreshed ?? []);
    setSelected(new Set());
    flash(`Teacher assigned to ${selectedCount} classes`);
  }

  async function bulkChangeSeason(seasonId: string) {
    for (const id of selected) {
      await supabase.from("classes").update({ season_id: seasonId }).eq("id", id);
    }
    setClasses((prev) =>
      prev.map((c) =>
        selected.has(c.id) ? { ...c, season_id: seasonId } : c
      )
    );
    setSelected(new Set());
    flash(`Season updated for ${selectedCount} classes`);
  }

  // ── Inline toggle online reg ─────────────────────────
  async function toggleOnlineReg(classId: string, current: boolean) {
    await supabase
      .from("classes")
      .update({ online_registration: !current })
      .eq("id", classId);
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, online_registration: !current } : c
      )
    );
  }

  // ── Print ────────────────────────────────────────────
  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const byDay: Record<number, typeof filtered> = {};
    for (const c of filtered) {
      const days =
        c.days_of_week && c.days_of_week.length > 0
          ? c.days_of_week
          : c.day_of_week != null
            ? [c.day_of_week]
            : [];
      for (const d of days) {
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(c);
      }
    }

    const html = `<!DOCTYPE html><html><head><title>Weekly Schedule</title>
<style>body{font-family:sans-serif;font-size:12px;margin:20px}
h1{font-size:18px}h2{font-size:14px;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #eee;font-size:11px}
th{font-weight:600;background:#f5f5f5}
@media print{body{margin:10px}}</style></head><body>
<h1>Weekly Class Schedule</h1>
${[1, 2, 3, 4, 5, 6, 0]
  .filter((d) => byDay[d])
  .map(
    (d) =>
      `<h2>${DAY_NAMES_FULL[d]}</h2>
<table><tr><th>Class</th><th>Teacher</th><th>Time</th><th>Room</th><th>Enrolled</th></tr>
${(byDay[d] ?? [])
  .map(
    (c) =>
      `<tr><td>${c.name}</td><td>${getTeacherNames(c.id, c.legacyTeacherName)}</td>
<td>${c.start_time ? formatTime(c.start_time) : ""}–${c.end_time ? formatTime(c.end_time) : ""}</td>
<td>${c.room ?? ""}</td><td>${c.enrolledCount}/${c.max_enrollment ?? c.max_students}</td></tr>`
  )
  .join("")}
</table>`
  )
  .join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  // ── Calendar View ────────────────────────────────────
  function renderCalendar() {
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm
    const days = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sat, Sun

    function getClassColor(c: ClassRecord) {
      if (c.is_rehearsal) return "bg-amber-100 border-amber-300 text-amber-800";
      if (c.is_performance) return "bg-rose-100 border-rose-300 text-rose-800";
      return "bg-lavender/10 border-lavender/30 text-lavender-dark";
    }

    return (
      <div className="rounded-xl border border-silver bg-white overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-silver">
            <div className="p-2" />
            {days.map((d) => (
              <div
                key={d}
                className="p-2 text-center text-xs font-semibold text-mist border-l border-silver"
              >
                {DAY_NAMES_FULL[d]}
              </div>
            ))}
          </div>
          {/* Time grid */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-silver/50 min-h-[48px]"
            >
              <div className="p-1 text-xs text-mist text-right pr-2">
                {hour > 12 ? hour - 12 : hour}
                {hour >= 12 ? "pm" : "am"}
              </div>
              {days.map((d) => {
                const dayClasses = filtered.filter((c) => {
                  const classDays =
                    c.days_of_week && c.days_of_week.length > 0
                      ? c.days_of_week
                      : c.day_of_week != null
                        ? [c.day_of_week]
                        : [];
                  if (!classDays.includes(d)) return false;
                  if (!c.start_time) return false;
                  const startHour = parseInt(c.start_time.split(":")[0]);
                  return startHour === hour;
                });
                return (
                  <div key={d} className="border-l border-silver/50 p-0.5 relative">
                    {dayClasses.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openEdit(c)}
                        className={`w-full text-left rounded px-1.5 py-0.5 text-xs border mb-0.5 truncate ${getClassColor(c)}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Classes
          </h1>
          <p className="mt-1 text-sm text-slate">
            {classes.filter((c) => c.is_active).length} active ·{" "}
            {classes.filter((c) => !c.is_active).length} inactive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="rounded-lg border border-silver px-3 py-2 text-sm text-slate hover:bg-cloud"
          >
            Print
          </button>
          <button
            onClick={openNew}
            className="rounded-lg bg-lavender px-4 py-2 text-sm text-white hover:bg-lavender-dark"
          >
            + New Class
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active Classes"
          value={classes.filter((c) => c.is_active && !c.is_hidden).length}
        />
        <StatCard
          label="Total Enrolled"
          value={classes.reduce((s, c) => s + c.enrolledCount, 0)}
        />
        <StatCard
          label="At Capacity"
          value={
            classes.filter(
              (c) =>
                c.is_active &&
                c.enrolledCount >= (c.max_enrollment ?? c.max_students)
            ).length
          }
        />
        <StatCard
          label="Open Spots"
          value={classes
            .filter((c) => c.is_active)
            .reduce(
              (s, c) =>
                s +
                Math.max(
                  0,
                  (c.max_enrollment ?? c.max_students) - c.enrolledCount
                ),
              0
            )}
        />
      </div>

      {/* Search + Filters */}
      <div className="rounded-xl border border-silver bg-white p-4 space-y-3">
        {/* Search row + mobile filter button */}
        <div className="flex gap-3 items-center">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>
          {/* Mobile filter button — visible below md */}
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="md:hidden h-9 rounded-lg border border-silver bg-white hover:bg-cloud px-3 text-xs font-medium text-slate transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-mist">
              <path d="M1.75 3.5h10.5M3.5 7h7M5.25 10.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-lavender text-white text-[10px] font-semibold px-1">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop filters — hidden below md */}
        <div className="hidden md:flex flex-wrap gap-2 items-center">
          <FilterSelects
            filterSeason={filterSeason} setFilterSeason={setFilterSeason}
            filterTeacher={filterTeacher} setFilterTeacher={setFilterTeacher}
            filterLevel={filterLevel} setFilterLevel={setFilterLevel}
            filterDiscipline={filterDiscipline} setFilterDiscipline={setFilterDiscipline}
            filterDay={filterDay} setFilterDay={setFilterDay}
            filterType={filterType} setFilterType={setFilterType}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            seasons={seasons} teachers={teachers} disciplines={disciplines}
          />
        </div>

        {/* Mobile filter drawer */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFilterOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-silver px-4 py-3 flex items-center justify-between z-10 rounded-t-2xl">
                <h3 className="text-sm font-semibold text-charcoal">Filters</h3>
                <button onClick={() => setMobileFilterOpen(false)} className="text-slate hover:text-charcoal text-lg">✕</button>
              </div>
              <div className="p-4 space-y-4">
                <FilterSelects
                  filterSeason={filterSeason} setFilterSeason={setFilterSeason}
                  filterTeacher={filterTeacher} setFilterTeacher={setFilterTeacher}
                  filterLevel={filterLevel} setFilterLevel={setFilterLevel}
                  filterDiscipline={filterDiscipline} setFilterDiscipline={setFilterDiscipline}
                  filterDay={filterDay} setFilterDay={setFilterDay}
                  filterType={filterType} setFilterType={setFilterType}
                  filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                  seasons={seasons} teachers={teachers} disciplines={disciplines}
                  stacked
                />
              </div>
              <div className="sticky bottom-0 bg-white border-t border-silver px-4 py-3">
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-full h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-mist">{filtered.length} classes shown</p>
          {/* Columns popover */}
          <div ref={columnsPopoverRef} className="relative">
            <button
              onClick={() => setColumnsPopoverOpen(!columnsPopoverOpen)}
              className="h-8 rounded-lg border border-silver bg-white hover:bg-cloud text-xs font-medium text-slate px-3 transition-colors inline-flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-mist">
                <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Columns
            </button>
            {columnsPopoverOpen && (
              <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-silver bg-white shadow-lg z-30 py-1">
                <div className="px-3 py-2 border-b border-silver">
                  <p className="text-xs font-semibold text-charcoal">Show / reorder columns</p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  <DndContext sensors={colSensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
                    <SortableContext items={columns.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                      {columns.map((col) => (
                        <SortableColumnRow
                          key={col.key}
                          col={col}
                          locked={LOCKED_COLUMNS.has(col.key)}
                          onToggle={() => toggleColumnVisible(col.key)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
                <div className="px-3 py-2 border-t border-silver">
                  <button
                    onClick={resetColumns}
                    className="text-xs text-lavender hover:text-lavender-dark font-medium"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-silver overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium ${
                viewMode === "list"
                  ? "bg-lavender text-white"
                  : "text-slate hover:bg-cloud"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-xs font-medium ${
                viewMode === "calendar"
                  ? "bg-lavender text-white"
                  : "text-slate hover:bg-cloud"
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <BulkActionPanel
          count={selectedCount}
          teachers={teachers}
          seasons={seasons}
          onAssignTeacher={bulkAssignTeacher}
          onChangeSeason={bulkChangeSeason}
          onToggleOnlineReg={bulkToggleOnlineReg}
          onToggleHidden={bulkToggleHidden}
          onSetNew={bulkSetNew}
          onDelete={bulkDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Content */}
      {viewMode === "calendar" ? (
        renderCalendar()
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/30">
                <th className="px-3 py-2 text-left w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20" />
                </th>
                {columns.filter((col) => col.visible).map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-xs font-semibold text-mist ${
                      col.fieldType === "integer" || col.fieldType === "currency" || col.key === "enrolled" || col.key === "status" || col.key === "onlinereg" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/40">
              {filtered.map((c) => {
                function renderCell(col: ColumnConfig, c: ClassRecord) {
                  const maxEnroll = c.max_enrollment ?? c.max_students;
                  const isFull = c.enrolledCount >= maxEnroll;
                  const seasonName = seasons.find((s) => s.id === c.season_id)?.name ?? c.season ?? "—";

                  // Special-case columns that need joins or custom rendering
                  switch (col.key) {
                    case "name":
                      return <td key={col.key} className="px-3 py-2"><span className="font-medium text-charcoal">{c.name}</span></td>;
                    case "teachers":
                      return <td key={col.key} className="px-3 py-2 text-slate text-xs">{getTeacherNames(c.id, c.legacyTeacherName)}</td>;
                    case "disciplines":
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{getDisciplineNames(c.discipline_ids)}</td>;
                    case "daytime":
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate whitespace-nowrap">{getDayTime(c)}</td>;
                    case "season":
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{seasonName}</td>;
                    case "enrolled":
                      return (
                        <td key={col.key} className="px-3 py-2 text-center">
                          <span className={`text-xs font-medium ${isFull ? "text-error" : "text-charcoal"}`}>
                            {c.enrolledCount}/{maxEnroll}
                          </span>
                        </td>
                      );
                    case "status":
                      return (
                        <td key={col.key} className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {c.is_new && <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">NEW</span>}
                            {c.is_hidden && <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">HIDDEN</span>}
                            {c.is_rehearsal && <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">REHEARSAL</span>}
                            {c.is_performance && <span className="inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">PERFORMANCE</span>}
                            {!c.is_new && !c.is_hidden && !c.is_rehearsal && !c.is_performance && <span className="text-xs text-mist">—</span>}
                          </div>
                        </td>
                      );
                    case "onlinereg":
                      return (
                        <td key={col.key} className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleOnlineReg(c.id, c.online_registration)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.online_registration ? "bg-lavender" : "bg-silver"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${c.online_registration ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                      );
                    case "type": {
                      const types: string[] = [];
                      if (c.is_rehearsal) types.push("Rehearsal");
                      if (c.is_performance) types.push("Performance");
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{types.length > 0 ? types.join(", ") : "—"}</td>;
                    }
                  }

                  // Generic rendering based on field_type from class_field_config
                  const value = (c as unknown as Record<string, unknown>)[col.key];
                  const ft = col.fieldType;

                  // Resolve room_id and location_id to names
                  if (col.key === "room_id" && value) {
                    return <td key={col.key} className="px-3 py-2 text-xs text-slate">{roomMap[String(value)] ?? "—"}</td>;
                  }
                  if (col.key === "location_id" && value) {
                    return <td key={col.key} className="px-3 py-2 text-xs text-slate">{locationMap[String(value)] ?? "—"}</td>;
                  }

                  switch (ft) {
                    case "boolean":
                      return (
                        <td key={col.key} className="px-3 py-2 text-center">
                          {value ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Yes</span>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                      );
                    case "integer":
                      return <td key={col.key} className="px-3 py-2 text-center text-xs text-slate">{value != null ? String(value) : "—"}</td>;
                    case "currency":
                      return (
                        <td key={col.key} className="px-3 py-2 text-center text-xs text-slate">
                          {value != null ? `$${(Number(value) / 100).toFixed(2)}` : "—"}
                        </td>
                      );
                    case "date": {
                      let formatted = "—";
                      if (value) {
                        const d = new Date(String(value));
                        if (!isNaN(d.getTime())) {
                          formatted = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
                        }
                      }
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate whitespace-nowrap">{formatted}</td>;
                    }
                    case "time": {
                      let formatted = "—";
                      if (value) {
                        formatted = formatTime(String(value));
                      }
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate whitespace-nowrap">{formatted}</td>;
                    }
                    case "array": {
                      const arr = Array.isArray(value) ? value as string[] : [];
                      let display = "—";
                      if (arr.length > 0) {
                        display = arr.length <= 2 ? arr.join(", ") : `${arr.slice(0, 2).join(", ")} and ${arr.length - 2} more`;
                      }
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{display}</td>;
                    }
                    case "textarea": {
                      const str = value != null ? String(value) : "";
                      const display = str.length > 45 ? `${str.slice(0, 45)}…` : str || "—";
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{display}</td>;
                    }
                    case "text":
                    default:
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{value != null ? String(value) : "—"}</td>;
                  }
                }

                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-cloud/30 transition-colors cursor-pointer ${
                      !c.is_active ? "opacity-50" : ""
                    }`}
                    onClick={() => openEdit(c)}
                  >
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
                      />
                    </td>
                    {columns.filter((col) => col.visible).map((col) => renderCell(col, c))}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="text-xs text-lavender hover:text-lavender-dark"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.filter((col) => col.visible).length + 2}
                    className="px-4 py-8 text-center text-sm text-mist"
                  >
                    No classes match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Drawer */}
      {drawerOpen && (
        <ClassEditDrawer
          classData={drawerClass}
          isNew={isNewClass}
          teachers={teachers}
          disciplines={disciplines}
          curriculum={curriculum}
          seasons={seasons}
          productions={productions}
          closures={closures}
          classTeachers={
            drawerClass
              ? classTeachersData.filter(
                  (ct) => ct.class_id === drawerClass.id
                )
              : []
          }
          pricingRules={
            drawerClass
              ? pricingRulesData.filter(
                  (r) => r.class_id === drawerClass.id
                )
              : []
          }
          classPhases={
            drawerClass
              ? classPhasesData.filter(
                  (p) => p.class_id === drawerClass.id
                )
              : []
          }
          tenantId={tenantId}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
          onTeachersUpdated={handleTeachersUpdated}
          onPricingUpdated={handlePricingUpdated}
          onPhasesUpdated={handlePhasesUpdated}
        />
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className="text-2xl font-heading font-semibold text-charcoal">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}

// ── Bulk Action Panel ────────────────────────────────────
function BulkActionPanel({
  count,
  teachers,
  seasons,
  onAssignTeacher,
  onChangeSeason,
  onToggleOnlineReg,
  onToggleHidden,
  onSetNew,
  onDelete,
  onClear,
}: {
  count: number;
  teachers: TeacherOption[];
  seasons: SeasonOption[];
  onAssignTeacher: (id: string) => void;
  onChangeSeason: (id: string) => void;
  onToggleOnlineReg: (v: boolean) => void;
  onToggleHidden: (v: boolean) => void;
  onSetNew: (v: boolean, date?: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [newExpiry, setNewExpiry] = useState("");

  return (
    <div className="rounded-xl border border-lavender bg-lavender/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-lavender-dark">
          {count} class{count !== 1 ? "es" : ""} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs text-mist hover:text-charcoal"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <SimpleSelect
          value=""
          onValueChange={(val) => {
            if (val) onAssignTeacher(val);
          }}
          options={teachers.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Assign Teacher..."
        />
        <SimpleSelect
          value=""
          onValueChange={(val) => {
            if (val) onChangeSeason(val);
          }}
          options={seasons.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Change Season..."
        />
        <button
          onClick={() => onToggleOnlineReg(true)}
          className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
        >
          Enable Reg
        </button>
        <button
          onClick={() => onToggleOnlineReg(false)}
          className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
        >
          Disable Reg
        </button>
        <button
          onClick={() => onToggleHidden(true)}
          className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
        >
          Hide
        </button>
        <button
          onClick={() => onToggleHidden(false)}
          className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
        >
          Show
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetNew(true, newExpiry || undefined)}
            className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
          >
            Set NEW
          </button>
          <input
            type="date"
            value={newExpiry}
            onChange={(e) => setNewExpiry(e.target.value)}
            className="h-8 rounded-lg border border-silver px-2 text-xs text-charcoal"
            placeholder="Expiry"
          />
          <button
            onClick={() => onSetNew(false)}
            className="h-8 rounded-lg border border-silver px-3 text-xs text-charcoal hover:bg-cloud"
          >
            Remove NEW
          </button>
        </div>
        <button
          onClick={onDelete}
          className="h-8 rounded-lg border border-red-300 px-3 text-xs text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Sortable column row for the column picker ────────────
function SortableColumnRow({
  col,
  locked,
  onToggle,
}: {
  col: { key: string; label: string; visible: boolean };
  locked: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-cloud/50"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-mist hover:text-slate cursor-grab active:cursor-grabbing text-sm select-none"
      >
        ⠿
      </span>
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={col.visible}
          disabled={locked}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-silver text-lavender focus:ring-lavender/20 disabled:opacity-50"
        />
        <span className="text-xs text-charcoal">{col.label}</span>
        {locked && <span className="text-[10px] text-mist">(always shown)</span>}
      </label>
    </div>
  );
}

// ── Filter selects — shared between desktop inline and mobile drawer ──
function FilterSelects({
  filterSeason, setFilterSeason,
  filterTeacher, setFilterTeacher,
  filterLevel, setFilterLevel,
  filterDiscipline, setFilterDiscipline,
  filterDay, setFilterDay,
  filterType, setFilterType,
  filterStatus, setFilterStatus,
  seasons, teachers, disciplines,
  stacked,
}: {
  filterSeason: string; setFilterSeason: (v: string) => void;
  filterTeacher: string; setFilterTeacher: (v: string) => void;
  filterLevel: string; setFilterLevel: (v: string) => void;
  filterDiscipline: string; setFilterDiscipline: (v: string) => void;
  filterDay: string; setFilterDay: (v: string) => void;
  filterType: string; setFilterType: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  seasons: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  disciplines: { id: string; name: string }[];
  stacked?: boolean;
}) {
  const cls = stacked ? "w-full" : "w-[140px]";
  return (
    <>
      <SimpleSelect value={filterSeason || "__all__"} onValueChange={(val) => setFilterSeason(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Seasons" }, ...seasons.map((s) => ({ value: s.id, label: s.name }))]} placeholder="All Seasons" className={cls} />
      <SimpleSelect value={filterTeacher || "__all__"} onValueChange={(val) => setFilterTeacher(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Teachers" }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]} placeholder="All Teachers" className={cls} />
      <SimpleSelect value={filterLevel || "__all__"} onValueChange={(val) => setFilterLevel(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Levels" }, ...LEVEL_OPTIONS.map((l) => ({ value: l, label: l }))]} placeholder="All Levels" className={cls} />
      <SimpleSelect value={filterDiscipline || "__all__"} onValueChange={(val) => setFilterDiscipline(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Disciplines" }, ...disciplines.map((d) => ({ value: d.id, label: d.name }))]} placeholder="All Disciplines" className={cls} />
      <SimpleSelect value={filterDay || "__all__"} onValueChange={(val) => setFilterDay(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Days" }, ...[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_NAMES_FULL[d] }))]} placeholder="All Days" className={cls} />
      <SimpleSelect value={filterType || "__all__"} onValueChange={(val) => setFilterType(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Types" }, { value: "class", label: "Class" }, { value: "rehearsal", label: "Rehearsal" }, { value: "performance", label: "Performance" }]} placeholder="All Types" className={cls} />
      <SimpleSelect value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Status" }, { value: "active", label: "Active" }, { value: "hidden", label: "Hidden" }, { value: "inactive", label: "Inactive" }]} placeholder="All Status" className={cls} />
    </>
  );
}
