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
  room_id: string | null;
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
  icon_id?: string | null;
  icon_url?: string | null;
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
  production_type?: string | null;
  performance_date?: string | null;
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

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  const d = new Date(dateStr + "T12:00:00");
  return d >= mon && d <= sun;
}

function isThisMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr + "T12:00:00");
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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
  activeRooms = [],
  privateSessionsRaw = [],
  studioClosures = [],
  classColorPalette = [],
  availableLevels = [],
  initialEditClassId = null,
  isTeacher = false,
  myClassIds = [],
  tenantId,
  canViewRevenue = false,
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
  activeRooms?: Array<{ id: string; name: string; color_hex: string | null }>;
  privateSessionsRaw?: Array<{ id: string; session_date: string; start_time: string; end_time: string; status: string; studio: string | null; primary_teacher_id: string | null; student_ids: string[]; notes: string | null; billing_status: string | null; session_rate: number | null }>;
  studioClosures?: Array<{ id: string; closed_date: string; reason: string | null }>;
  classColorPalette?: string[];
  availableLevels?: string[];
  initialEditClassId?: string | null;
  isTeacher?: boolean;
  myClassIds?: string[];
  tenantId: string;
  canViewRevenue?: boolean;
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
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterMyClasses, setFilterMyClasses] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerClass, setDrawerClass] = useState<ClassRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNewClass, setIsNewClass] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string>("day_of_week");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [calendarFields, setCalendarFields] = useState(() => {
    const defaults = [
      { key: "time", label: "Time", visible: true, locked: true },
      { key: "name", label: "Class Name", visible: true, locked: true },
      { key: "teacher", label: "Teacher", visible: true, locked: false },
      { key: "levels", label: "Levels", visible: true, locked: false },
      { key: "room", label: "Room", visible: true, locked: false },
      { key: "enrolled", label: "Enrolled", visible: false, locked: false },
    ];
    if (typeof window === "undefined") return defaults;
    try { const s = localStorage.getItem("bam-calendar-fields"); if (s) return JSON.parse(s); } catch {}
    return defaults;
  });
  const [showCalFieldPicker, setShowCalFieldPicker] = useState(false);
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0); return mon;
  });
  const [calRoomFilter, setCalRoomFilter] = useState("all");

  const [showPrivates, setShowPrivates] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bam-schedule-show-privates") === "true";
  });
  const [showRehearsals, setShowRehearsals] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bam-schedule-show-rehearsals") === "true";
  });
  const [showClosedClasses, setShowClosedClasses] = useState(false);
  const [showPerformances, setShowPerformances] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bam-schedule-show-performances") === "true";
  });
  const [showCompetitions, setShowCompetitions] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bam-schedule-show-competitions") === "true";
  });

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
    if (filterMyClasses && myClassIds.length > 0 && !myClassIds.includes(c.id))
      return false;
    return true;
  }).sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortKey];
    const bVal = (b as unknown as Record<string, unknown>)[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (sortKey === "day_of_week") {
      if (aVal !== bVal) return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      const aTime = a.start_time ?? "";
      const bTime = b.start_time ?? "";
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  // ── Teacher name helper ──────────────────────────────
  function getTeacherNames(classId: string, legacyName: string | null): string {
    const assigned = classTeachersData.filter((ct) => ct.class_id === classId);
    if (assigned.length === 0 && teachers.length > 0) {
      console.log("DEBUG no ct match", classId, "ctData count:", classTeachersData.length, "first2:", classTeachersData.slice(0, 2));
    }
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

  // Auto-open edit drawer if deep-linked via ?editClass=...
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (!initialEditClassId || didAutoOpen.current) return;
    const match = classes.find((c) => c.id === initialEditClassId);
    if (match) {
      openEdit(match);
      didAutoOpen.current = true;
    }
  }, [initialEditClassId, classes.length]);

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
    const SH = 48; // slot height px
    const TW = 72; // time col width px
    const RW = 140; // room col width px

    function t2m(t: string): number { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
    function fmtTime(t: string): string { if (!t) return ""; const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${(m || 0).toString().padStart(2, "0")} ${ap}`; }
    function lvlColor(levels: string[]): string {
      const l = (levels?.[0] ?? "").toLowerCase();
      if (l.includes("petite")) return "#F9D5E5";
      if (l === "level 1") return "#E8D5F9";
      if (l.startsWith("level 2")) return "#D5E8F9";
      if (l.startsWith("level 3")) return "#D5F9E8";
      if (l.startsWith("level 4")) return "#F9F0D5";
      if (l.includes("adult") || l.includes("teen")) return "#F9E8D5";
      return "#EDE9F4";
    }
    function isVis(key: string) { return calendarFields.find((f: { key: string; visible: boolean }) => f.key === key)?.visible ?? false; }

    // Build week days (Mon-Sat)
    const weekDays: Date[] = Array.from({ length: 6 }, (_, i) => { const d = new Date(calWeekStart); d.setDate(calWeekStart.getDate() + i); return d; });
    // Rooms to show
    const visibleRooms = calRoomFilter === "all" ? activeRooms : activeRooms.filter(r => r.id === calRoomFilter);
    const roomCount = visibleRooms.length || 1;
    // Time slots 8:00-21:00
    const slots: string[] = [];
    for (let h = 8; h <= 21; h++) { slots.push(`${h.toString().padStart(2, "0")}:00`); if (h < 21) slots.push(`${h.toString().padStart(2, "0")}:30`); }
    const totalW = TW + 6 * roomCount * RW;
    const today = new Date().toDateString();

    // Double booking detection (skip Pilates Room)
    const dbWarnings: string[] = [];
    weekDays.forEach(day => {
      visibleRooms.filter(r => !r.name.toLowerCase().includes("pilates")).forEach(room => {
        const dc = filtered.filter(c => { const cd = (c.days_of_week?.[0] ?? c.day_of_week); return cd === day.getDay() && (c as any).room_id === room.id; });
        for (let i = 0; i < dc.length; i++) for (let j = i + 1; j < dc.length; j++) {
          const as = t2m(dc[i].start_time ?? ""), ae = t2m(dc[i].end_time ?? ""), bs = t2m(dc[j].start_time ?? ""), be = t2m(dc[j].end_time ?? "");
          if (as < be && bs < ae) { dbWarnings.push(`${room.name} ${day.toLocaleDateString("en-US", { weekday: "short" })}`); break; }
        }
      });
    });

    return (
      <div className="space-y-3 print-calendar">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(calWeekStart); d.setDate(d.getDate() - 7); setCalWeekStart(d); }} className="px-2 py-1 text-sm border border-silver rounded hover:bg-cloud">←</button>
            <button onClick={() => { const n = new Date(); const day = n.getDay(); const diff = day === 0 ? -6 : 1 - day; const m = new Date(n); m.setDate(n.getDate() + diff); m.setHours(0,0,0,0); setCalWeekStart(m); }} className="px-3 py-1 text-sm border border-silver rounded hover:bg-cloud">Today</button>
            <span className="text-sm font-medium text-charcoal truncate">Week of {calWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <button onClick={() => { const d = new Date(calWeekStart); d.setDate(d.getDate() + 7); setCalWeekStart(d); }} className="px-2 py-1 text-sm border border-silver rounded hover:bg-cloud">→</button>
          </div>
          <div className="flex items-center gap-2">
            <select value={calRoomFilter} onChange={e => setCalRoomFilter(e.target.value)} className="text-sm border border-silver rounded px-2 py-1">
              <option value="all">All Rooms</option>
              {activeRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="relative">
              <button onClick={() => setShowCalFieldPicker(v => !v)} className="px-3 py-1 text-sm border border-silver rounded hover:bg-cloud">⚙ Fields</button>
              {showCalFieldPicker && (
                <div className="absolute right-0 top-8 z-50 bg-white border border-silver rounded-lg shadow-lg p-3 w-52">
                  <div className="text-xs font-semibold text-mist mb-2">Show on events</div>
                  {calendarFields.map((f: { key: string; label: string; visible: boolean; locked?: boolean }, i: number) => (
                    <label key={f.key} className="flex items-center gap-2 py-0.5 text-sm text-charcoal cursor-pointer">
                      <input type="checkbox" checked={f.visible} disabled={f.locked} onChange={e => { const u = calendarFields.map((x: any, j: number) => j === i ? { ...x, visible: e.target.checked } : x); setCalendarFields(u); localStorage.setItem("bam-calendar-fields", JSON.stringify(u)); }} className="h-3.5 w-3.5 rounded border-silver text-lavender" />
                      {f.label}{f.locked && <span className="text-[10px] text-mist ml-auto">required</span>}
                    </label>
                  ))}
                  <button onClick={() => { const d = [{ key: "time", label: "Time", visible: true, locked: true },{ key: "name", label: "Class Name", visible: true, locked: true },{ key: "teacher", label: "Teacher", visible: true, locked: false },{ key: "levels", label: "Levels", visible: true, locked: false },{ key: "room", label: "Room", visible: true, locked: false },{ key: "enrolled", label: "Enrolled", visible: false, locked: false }]; setCalendarFields(d); localStorage.removeItem("bam-calendar-fields"); }} className="mt-2 text-xs text-lavender hover:underline">Reset</button>
                </div>
              )}
            </div>
            <button onClick={() => window.print()} className="px-3 py-1 text-sm border border-silver rounded hover:bg-cloud">🖨</button>
          </div>
        </div>

        {/* Room legend */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 print:hidden">
          {activeRooms.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-xs text-charcoal px-2 py-1 rounded-full border border-silver/50">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color_hex ?? "#9C8BBF" }} />
              {r.name}
            </span>
          ))}
        </div>

        {/* Double booking warnings */}
        {dbWarnings.length > 0 && (
          <div className="bg-error/5 border border-error/20 rounded-lg px-4 py-2 text-sm text-error print:hidden">
            ⚠️ Double booking: {[...new Set(dbWarnings)].join(" · ")}
          </div>
        )}

        {/* Calendar grid */}
        <div className="rounded-lg border border-silver overflow-auto relative" style={{ maxHeight: "calc(100vh - 220px)" }}>
          <div style={{ minWidth: totalW, position: "relative" }}>
            {/* HEADER ROW 1: Day names spanning room sub-columns */}
            <div className="flex sticky top-0 z-20 bg-white border-b border-silver">
              <div className="shrink-0 sticky left-0 z-30 bg-white border-r border-silver" style={{ width: TW }} />
              {weekDays.map(day => {
                const isToday = day.toDateString() === today;
                const closure = studioClosures.find(c => c.closed_date === toLocalDateStr(day));
                return (
                  <div key={toLocalDateStr(day)} className={`text-center py-2 border-r border-silver ${isToday ? "bg-lavender/10" : ""}`} style={{ width: roomCount * RW }}>
                    <div className={`text-xs font-semibold ${isToday ? "text-lavender" : "text-charcoal"}`}>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className={`text-sm ${isToday ? "text-lavender font-bold" : "text-slate"}`}>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    {closure && <div className="text-[10px] bg-error/10 text-error rounded px-1 mt-0.5 truncate mx-1">{closure.reason ?? "Closed"}</div>}
                    {closure && (
                      <div className="flex items-center justify-center gap-2 mt-0.5">
                        <span className="text-[10px] text-error/60">Studio Closed</span>
                        <button
                          onClick={() => setShowClosedClasses(prev => !prev)}
                          className="text-[10px] text-error/60 underline underline-offset-2 hover:text-error transition-colors"
                        >
                          {showClosedClasses ? "Hide classes" : "Show classes"}
                        </button>
                      </div>
                    )}
                    {productions.filter(p => p.performance_date === toLocalDateStr(day) && (
                      (showPerformances && p.production_type !== "competition") ||
                      (showCompetitions && p.production_type === "competition")
                    )).map(prod => (
                      <div key={prod.id} className={`text-[10px] px-1 mt-0.5 rounded font-medium truncate mx-1 ${
                        prod.production_type === "competition"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-rose-100 text-rose-700"
                      }`}>
                        {prod.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* HEADER ROW 2: Room sub-headers */}
            <div className="flex sticky top-[52px] z-20 bg-white border-b border-silver">
              <div className="shrink-0 sticky left-0 z-30 bg-white border-r border-silver" style={{ width: TW }} />
              {weekDays.map(day => (
                <div key={`rh-${toLocalDateStr(day)}`} className="flex border-r border-silver">
                  {visibleRooms.map(room => (
                    <div key={`${toLocalDateStr(day)}-${room.id}`} className="text-center py-1 border-r border-silver/50 last:border-r-0" style={{ width: RW, borderBottom: `2px solid ${room.color_hex ?? "#9C8BBF"}`, backgroundColor: `${room.color_hex ?? "#9C8BBF"}15` }}>
                      <div className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: room.color_hex ?? "#9C8BBF" }} />
                        <span className="text-[10px] font-medium text-charcoal truncate">{room.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* GRID BODY: time slot rows (visual grid lines only) */}
            <div className="relative">
              {slots.map(slot => (
                <div key={slot} className="flex border-b border-silver/30" style={{ height: SH }}>
                  <div className="shrink-0 sticky left-0 z-10 bg-white border-r border-silver flex items-start justify-end pr-2 pt-1" style={{ width: TW }}>
                    {slot.endsWith(":00") && <span className="text-[10px] text-mist">{fmtTime(slot)}</span>}
                  </div>
                  {weekDays.map(day => (
                    <div key={`${slot}-${toLocalDateStr(day)}`} className="flex border-r border-silver/20">
                      {visibleRooms.map(room => (
                        <div key={`${slot}-${toLocalDateStr(day)}-${room.id}`} className="border-r border-silver/10 last:border-r-0" style={{ width: RW }} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {/* EVENT OVERLAYS — absolutely positioned per day×room column */}
              {weekDays.map((day, dayIdx) => {
                const dayOfWeek = day.getDay();
                const dateStr = toLocalDateStr(day);
                const closure = studioClosures.find(c => c.closed_date === dateStr);

                return visibleRooms.map((room, roomIdx) => {
                  const colLeft = TW + (dayIdx * roomCount + roomIdx) * RW;
                  const dayClasses = filtered.filter(c => {
                    const cd = c.days_of_week?.[0] ?? c.day_of_week;
                    return cd === dayOfWeek && (c as any).room_id === room.id;
                  });
                  const dayPrivates = (privateSessionsRaw ?? []).filter(p => p.session_date === dateStr && p.studio === room.name);

                  return (
                    <div key={`overlay-${toLocalDateStr(day)}-${room.id}`} className="absolute top-0" style={{ left: colLeft, width: RW, height: slots.length * SH }}>
                      {/* Closure overlay — tint only, text moved to day header */}
                      {closure && <div className="absolute inset-0 bg-error/5 z-[3]" />}

                      {/* Class events — hidden on closed days unless toggled */}
                      {dayClasses.map(c => {
                        if (closure && !showClosedClasses) return null;
                        const sm = t2m(c.start_time ?? "09:00"), em = t2m(c.end_time ?? "10:00");
                        const top = ((sm - 480) / 30) * SH;
                        const h = Math.max(((em - sm) / 30) * SH, SH);
                        const isCompact = h < 60;
                        const isMedium = h >= 60 && h < 90;
                        const bg = (c as any).color_hex || lvlColor(c.levels ?? []);
                        const rc = room.color_hex ?? "#9C8BBF";
                        const tn = getTeacherNames(c.id, c.legacyTeacherName);
                        const calDiscId = c.discipline_ids?.[0];
                        const calDisc = calDiscId ? disciplines.find((d) => d.id === calDiscId) : disciplines.find((d) => d.name === c.discipline);
                        return (
                          <div key={c.id} onClick={() => openEdit(c)} className={`absolute rounded overflow-hidden cursor-pointer hover:brightness-95 transition-all mx-0.5 ${closure && showClosedClasses ? "opacity-30" : !showRehearsals && c.is_rehearsal ? "opacity-30" : ""}`} style={{ top, height: h, left: 0, right: 0, backgroundColor: c.is_rehearsal ? "#FEF3C7" : bg, borderLeft: `3px solid ${c.is_rehearsal ? "#F59E0B" : rc}`, zIndex: 5 }}>
                            {c.is_rehearsal && !isCompact && (
                              <div className="absolute top-0.5 left-1 text-[8px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 rounded px-1">Rehearsal</div>
                            )}
                            {calDisc?.icon_url && !isCompact && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={calDisc.icon_url} alt={calDisc.name} className="absolute top-1 right-1 w-5 h-5 rounded-full object-cover opacity-80" />
                            )}
                            <div className="p-1 h-full overflow-hidden flex flex-col gap-0">
                              {isCompact ? (
                                <div className="text-[10px] font-medium text-gray-800 leading-tight truncate">
                                  {fmtTime(c.start_time ?? "")} {c.name}
                                </div>
                              ) : isMedium ? (
                                <>
                                  {isVis("time") && <div className="text-[10px] font-semibold text-gray-600 leading-tight">{fmtTime(c.start_time ?? "")}–{fmtTime(c.end_time ?? "")}</div>}
                                  {isVis("name") && <div className="text-[11px] font-medium text-gray-800 leading-tight truncate pr-5">{c.name}</div>}
                                  {isVis("teacher") && tn && tn !== "—" && <div className="text-[10px] text-gray-500 leading-tight truncate">{tn}</div>}
                                </>
                              ) : (
                                <>
                                  {isVis("time") && <div className="text-[10px] font-semibold text-gray-600 leading-tight">{fmtTime(c.start_time ?? "")}–{fmtTime(c.end_time ?? "")}</div>}
                                  {isVis("name") && <div className="text-[11px] font-medium text-gray-800 leading-tight line-clamp-2 pr-5">{c.name}</div>}
                                  {isVis("teacher") && tn && tn !== "—" && <div className="text-[10px] text-gray-500 leading-tight truncate">{tn}</div>}
                                  {isVis("levels") && (c.levels ?? []).length > 0 && <div className="text-[9px] text-gray-500 truncate">{(c.levels ?? []).join(", ")}</div>}
                                  {isVis("enrolled") && <div className="text-[9px] text-gray-500">{c.enrolledCount ?? 0}/{c.max_enrollment ?? "—"}</div>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Private sessions — purple, full opacity during closures */}
                      {dayPrivates.map(p => {
                        const sm = t2m(p.start_time ?? "09:00"), em = t2m(p.end_time ?? "10:00");
                        const top = ((sm - 480) / 30) * SH;
                        const h = Math.max(((em - sm) / 30) * SH, SH);
                        const tn = teachers.find(t => t.id === p.primary_teacher_id);
                        return (
                          <div key={p.id} className="absolute rounded overflow-hidden mx-0.5" style={{ top, height: h, left: 0, right: 0, backgroundColor: "#F3E8FF", borderLeft: "3px solid #A855F7", zIndex: 6 }}>
                            <div className="p-1 h-full overflow-hidden">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-600 rounded px-1">Private</span>
                              </div>
                              <div className="text-[10px] text-purple-700 leading-tight mt-0.5">{fmtTime(p.start_time)}–{fmtTime(p.end_time)}</div>
                              {tn && <div className="text-[10px] text-purple-500 truncate">{tn.name}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
        <style>{`@media print { nav, header, .print\\:hidden { display: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      </div>
    );
  }

  function renderCalendarOLD_DISABLED() {
    const SLOT_HEIGHT_OLD = 48;
    const TIME_COL_WIDTH_OLD = 72;

    function timeToMinutes(t: string): number {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    }
    function formatTimeShort(t: string): string {
      const [h, m] = t.split(":");
      const hr = parseInt(h, 10);
      const ampm = hr >= 12 ? "PM" : "AM";
      const dh = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
      return `${dh}:${m} ${ampm}`;
    }
    function getLevelColor(levels: string[]): string {
      const l = (levels[0] || "").toLowerCase();
      if (l.includes("petite")) return "#FDEBD0";
      if (l.includes("1")) return "#D5F5E3";
      if (l.includes("2")) return "#D6EAF8";
      if (l.includes("3")) return "#E8DAEF";
      if (l.includes("4")) return "#FADBD8";
      if (l.includes("adult") || l.includes("teen")) return "#FCF3CF";
      return "#EBF5FB";
    }
    function isFieldVisible(key: string) {
      return calendarFields.find((f: { key: string; visible: boolean }) => f.key === key)?.visible ?? false;
    }

    // Week days: Mon-Sat (6 days)
    const weekDays = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(calWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    const timeSlots = Array.from({ length: 27 }, (_, i) => 480 + i * 30); // 8:00-21:00
    const todayStr = toLocalDateStr(new Date());

    // Build closure set
    const closedDates = new Set(studioClosures.map((sc) => sc.closed_date));
    const closureReasonMap = new Map(studioClosures.map((sc) => [sc.closed_date, sc.reason]));

    // Room color map
    const roomColorMap = new Map(activeRooms.map((r) => [r.id, r.color_hex || "#9C8BBF"]));

    // Nav helpers
    const prevWeek = () => { const d = new Date(calWeekStart); d.setDate(d.getDate() - 7); setCalWeekStart(d); };
    const nextWeek = () => { const d = new Date(calWeekStart); d.setDate(d.getDate() + 7); setCalWeekStart(d); };
    const goToday = () => {
      const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0); setCalWeekStart(mon);
    };
    const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[5].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const gridH = timeSlots.length * SLOT_HEIGHT_OLD;

    // Print calendar
    const handleCalPrint = () => { window.print(); };

    // Save field prefs
    const toggleCalField = (key: string) => {
      const next = calendarFields.map((f: { key: string; visible: boolean; locked: boolean }) =>
        f.key === key && !f.locked ? { ...f, visible: !f.visible } : f
      );
      setCalendarFields(next);
      try { localStorage.setItem("bam-calendar-fields", JSON.stringify(next)); } catch {}
    };
    const resetCalFields = () => {
      const defaults = [
        { key: "time", label: "Time", visible: true, locked: true },
        { key: "name", label: "Class Name", visible: true, locked: true },
        { key: "teacher", label: "Teacher", visible: true, locked: false },
        { key: "levels", label: "Levels", visible: true, locked: false },
        { key: "room", label: "Room", visible: true, locked: false },
        { key: "enrolled", label: "Enrolled", visible: false, locked: false },
      ];
      setCalendarFields(defaults);
      try { localStorage.setItem("bam-calendar-fields", JSON.stringify(defaults)); } catch {}
    };

    return (
      <div className="space-y-3 print-calendar">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={prevWeek} className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud">&larr; Prev</button>
          <button onClick={goToday} className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud">Today</button>
          <span className="text-sm font-semibold text-charcoal">{weekLabel}</span>
          <button onClick={nextWeek} className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud">Next &rarr;</button>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={calRoomFilter}
              onChange={(e) => setCalRoomFilter(e.target.value)}
              className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 cursor-pointer"
            >
              <option value="all">All Rooms</option>
              {activeRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="relative">
              <button onClick={() => setShowCalFieldPicker(!showCalFieldPicker)} className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud">Fields</button>
              {showCalFieldPicker && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-silver bg-white shadow-lg z-30 py-1">
                  <div className="px-3 py-2 border-b border-silver"><p className="text-xs font-semibold text-charcoal">Calendar Fields</p></div>
                  <div className="py-1">
                    {calendarFields.map((f: { key: string; label: string; visible: boolean; locked: boolean }) => (
                      <label key={f.key} className="flex items-center gap-2 px-3 py-1 text-xs text-charcoal hover:bg-cloud cursor-pointer">
                        <input type="checkbox" checked={f.visible} disabled={f.locked} onChange={() => toggleCalField(f.key)} className="rounded" />
                        {f.label}{f.locked && <span className="text-mist ml-auto text-[10px]">required</span>}
                      </label>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-silver">
                    <button onClick={resetCalFields} className="text-xs text-lavender hover:text-lavender-dark font-medium">Reset</button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleCalPrint} className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud">Print</button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-xl border border-silver bg-white overflow-x-auto">
          <div style={{ display: "grid", gridTemplateColumns: `${TIME_COL_WIDTH_OLD}px repeat(6, 1fr)`, minWidth: 900 }}>
            {/* Day headers */}
            <div className="border-b border-silver p-2" />
            {weekDays.map((wd, i) => {
              const dateStr = toLocalDateStr(wd);
              const isToday = dateStr === todayStr;
              const isClosed = closedDates.has(dateStr);
              return (
                <div key={i} className={`border-b border-l border-silver p-2 text-center ${isToday ? "bg-lavender/10" : ""}`}>
                  <div className="text-xs font-semibold text-mist">{["Mon","Tue","Wed","Thu","Fri","Sat"][i]}</div>
                  <div className={`text-sm font-semibold ${isToday ? "text-lavender" : "text-charcoal"}`}>{wd.getDate()}</div>
                  {isClosed && <span className="inline-block mt-0.5 text-[10px] bg-red-100 text-red-600 rounded px-1">{closureReasonMap.get(dateStr) || "Closed"}</span>}
                  {productions.filter(p => p.performance_date === dateStr && (
                    (showPerformances && p.production_type !== "competition") ||
                    (showCompetitions && p.production_type === "competition")
                  )).map(prod => (
                    <span key={prod.id} className={`inline-block mt-0.5 text-[10px] rounded px-1 font-medium ${
                      prod.production_type === "competition"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {prod.name}
                    </span>
                  ))}
                </div>
              );
            })}

            {/* Time column + day columns with events */}
            <div className="relative" style={{ height: gridH }}>
              {timeSlots.map((mins, i) => {
                const isHour = mins % 60 === 0;
                const hr = Math.floor(mins / 60);
                const dh = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
                return isHour ? (
                  <div key={i} className="absolute right-2 text-xs text-mist" style={{ top: i * SLOT_HEIGHT_OLD - 6 }}>
                    {dh}{hr >= 12 ? "pm" : "am"}
                  </div>
                ) : null;
              })}
            </div>
            {weekDays.map((wd, dayIdx) => {
              const dateStr = toLocalDateStr(wd);
              const dow = wd.getDay();
              const isClosed = closedDates.has(dateStr);

              // Classes for this day
              const dayClasses = filtered.filter((c) => {
                const cDays = c.days_of_week?.length ? c.days_of_week : c.day_of_week != null ? [c.day_of_week] : [];
                return cDays.includes(dow) && c.start_time;
              });

              // Private sessions for this day
              const dayPrivates = privateSessionsRaw.filter((ps) => ps.session_date === dateStr && ps.status !== "cancelled");

              return (
                <div key={dayIdx} className="relative border-l border-silver" style={{ height: gridH }}>
                  {/* Grid lines */}
                  {timeSlots.map((_, si) => (
                    <div key={si} className="absolute w-full border-b border-silver/30" style={{ top: si * SLOT_HEIGHT_OLD, height: SLOT_HEIGHT_OLD }} />
                  ))}

                  {/* Studio closure overlay */}
                  {isClosed && <div className="absolute inset-0 bg-red-50/60 z-10 pointer-events-none" />}

                  {/* Class events */}
                  {dayClasses.map((c) => {
                    const startMins = timeToMinutes(c.start_time!);
                    const endMins = c.end_time ? timeToMinutes(c.end_time) : startMins + 60;
                    const duration = endMins - startMins;
                    const top = ((startMins - 480) / 30) * SLOT_HEIGHT_OLD;
                    const height = Math.max(SLOT_HEIGHT_OLD, (duration / 30) * SLOT_HEIGHT_OLD);
                    const bgColor = (c as any).color_hex || getLevelColor(c.levels || []);
                    const roomColor = c.room ? roomColorMap.get(c.room) || "#9C8BBF" : "#ccc";
                    const dimmed = calRoomFilter !== "all" && c.room !== calRoomFilter;

                    const rehearsalDimmed = !showRehearsals && c.is_rehearsal;
                    return (
                      <button
                        key={c.id}
                        onClick={() => openEdit(c)}
                        className="absolute left-1 right-1 rounded text-left overflow-hidden z-20 hover:ring-2 hover:ring-lavender/40 transition-shadow"
                        style={{
                          top, height,
                          backgroundColor: c.is_rehearsal ? "#FEF3C7" : bgColor,
                          borderLeft: `3px solid ${c.is_rehearsal ? "#F59E0B" : roomColor}`,
                          opacity: dimmed || rehearsalDimmed ? 0.3 : 1, padding: "2px 4px",
                        }}
                      >
                        <div className="text-[10px] leading-tight text-charcoal space-y-px">
                          {c.is_rehearsal && <div className="text-[8px] font-bold uppercase tracking-wide text-amber-600">Rehearsal</div>}
                          {isFieldVisible("time") && <div className="font-semibold">{formatTimeShort(c.start_time!)}{c.end_time ? `–${formatTimeShort(c.end_time)}` : ""}</div>}
                          {isFieldVisible("name") && <div className="font-semibold truncate">{c.name}</div>}
                          {isFieldVisible("teacher") && <div className="truncate text-slate">{getTeacherNames(c.id, c.legacyTeacherName)}</div>}
                          {isFieldVisible("levels") && c.levels?.length ? <div className="truncate text-slate">{c.levels.join(", ")}</div> : null}
                          {isFieldVisible("room") && c.room && <div className="truncate text-slate">{roomMap[c.room] || c.room}</div>}
                          {isFieldVisible("enrolled") && <div className="text-slate">{c.enrolledCount}/{c.max_enrollment ?? c.max_students}</div>}
                        </div>
                      </button>
                    );
                  })}

                  {/* Private sessions */}
                  {dayPrivates.map((ps) => {
                    const startMins = timeToMinutes(ps.start_time);
                    const endMins = timeToMinutes(ps.end_time);
                    const duration = endMins - startMins;
                    const top = ((startMins - 480) / 30) * SLOT_HEIGHT_OLD;
                    const height = Math.max(SLOT_HEIGHT_OLD, (duration / 30) * SLOT_HEIGHT_OLD);
                    const teacherName = ps.primary_teacher_id ? (teachers.find((t) => t.id === ps.primary_teacher_id)?.name ?? "—") : "—";
                    return (
                      <div
                        key={ps.id}
                        className="absolute left-1 right-1 rounded z-20 overflow-hidden"
                        style={{ top, height, backgroundColor: "#f3f4f6", border: "1.5px dashed #9ca3af", padding: "2px 4px" }}
                      >
                        <div className="text-[10px] leading-tight text-gray-600 space-y-px">
                          <div className="font-semibold">Private</div>
                          <div>{formatTimeShort(ps.start_time)}–{formatTimeShort(ps.end_time)}</div>
                          <div className="truncate">{teacherName}</div>
                          {ps.notes && <div className="truncate italic">{ps.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {/* Print styles */}
        <style>{`@media print { .print-calendar { break-inside: avoid; } .print-calendar button { pointer-events: none; } }`}</style>
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
            Schedule
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

      {/* Privates KPIs */}
      {showPrivates && (
        <div className={`grid grid-cols-2 ${canViewRevenue ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100`}>
          <div className="text-center">
            <p className="text-2xl font-heading font-semibold text-purple-600">
              {privateSessionsRaw.filter((p) => isThisWeek(p.session_date)).length}
            </p>
            <p className="mt-1 text-xs text-slate">Privates This Week</p>
          </div>
          {canViewRevenue && (
            <div className="text-center">
              <p className="text-2xl font-heading font-semibold text-purple-600">
                {privateSessionsRaw.filter((p) => p.billing_status === "pending").length}
              </p>
              <p className="mt-1 text-xs text-slate">Pending Billing</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-2xl font-heading font-semibold text-purple-600">
              {privateSessionsRaw.filter((p) => isThisMonth(p.session_date)).length}
            </p>
            <p className="mt-1 text-xs text-slate">This Month</p>
          </div>
          {canViewRevenue && (
            <div className="text-center hidden sm:block">
              <p className="text-2xl font-heading font-semibold text-purple-600">
                {(() => {
                  const withRate = privateSessionsRaw.filter((p) => p.session_rate != null);
                  if (withRate.length === 0) return "$0";
                  const avg = withRate.reduce((s, p) => s + (p.session_rate ?? 0), 0) / withRate.length;
                  return `$${Math.round(avg)}`;
                })()}
              </p>
              <p className="mt-1 text-xs text-slate">Avg Revenue/Session</p>
            </div>
          )}
        </div>
      )}

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
            seasons={seasons} teachers={teachers} disciplines={disciplines} availableLevels={availableLevels}
          />
          {isTeacher && myClassIds.length > 0 && (
            <button
              onClick={() => setFilterMyClasses(!filterMyClasses)}
              className={`h-9 rounded-lg px-3 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                filterMyClasses
                  ? "bg-lavender text-white"
                  : "border border-silver bg-white text-slate hover:border-lavender"
              }`}
            >
              My Classes
            </button>
          )}
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
        {/* Event type toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-mist">Show:</span>
          <button
            onClick={() => {
              const next = !showPrivates;
              setShowPrivates(next);
              localStorage.setItem("bam-schedule-show-privates", String(next));
            }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              showPrivates
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : "border-gray-200 text-mist hover:border-gray-300"
            }`}
          >
            Privates
          </button>
          <button
            onClick={() => {
              const next = !showRehearsals;
              setShowRehearsals(next);
              localStorage.setItem("bam-schedule-show-rehearsals", String(next));
            }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              showRehearsals
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "border-gray-200 text-mist hover:border-gray-300"
            }`}
          >
            Rehearsals
          </button>
          <button
            onClick={() => setShowClosedClasses(!showClosedClasses)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              showClosedClasses
                ? "bg-red-100 border-red-300 text-red-700"
                : "border-gray-200 text-mist hover:border-gray-300"
            }`}
          >
            Closed Days
          </button>
          <button
            onClick={() => {
              const next = !showPerformances;
              setShowPerformances(next);
              localStorage.setItem("bam-schedule-show-performances", String(next));
            }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              showPerformances
                ? "bg-rose-100 border-rose-300 text-rose-700"
                : "border-gray-200 text-mist hover:border-gray-300"
            }`}
          >
            Performances
          </button>
          <button
            onClick={() => {
              const next = !showCompetitions;
              setShowCompetitions(next);
              localStorage.setItem("bam-schedule-show-competitions", String(next));
            }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              showCompetitions
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "border-gray-200 text-mist hover:border-gray-300"
            }`}
          >
            Competitions
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-mist hidden sm:block">{filtered.length} classes shown</p>
          {/* Columns popover */}
          <div ref={columnsPopoverRef} className="relative hidden sm:block">
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
                    onClick={() => {
                      if (sortKey === col.key) {
                        setSortDir((d) => d === "asc" ? "desc" : "asc");
                      } else {
                        setSortKey(col.key);
                        setSortDir("asc");
                      }
                    }}
                    className={`px-3 py-2 text-xs font-semibold text-mist cursor-pointer select-none hover:text-charcoal ${
                      col.fieldType === "integer" || col.fieldType === "currency" || col.key === "enrolled_count" || col.key === "status" || col.key === "online_registration" ? "text-center" : "text-left"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </span>
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
                    case "teacher_id":
                      return <td key={col.key} className="px-3 py-2 text-slate text-xs">{getTeacherNames(c.id, c.legacyTeacherName)}</td>;
                    case "disciplines":
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate">{getDisciplineNames(c.discipline_ids)}</td>;
                    case "daytime":
                    case "day_of_week": {
                      // Day only (no time)
                      const dayStr = c.days_of_week && c.days_of_week.length > 0
                        ? c.days_of_week.map((d) => DAY_NAMES[d]).join(", ")
                        : c.day_of_week != null ? DAY_NAMES[c.day_of_week] : "—";
                      return <td key={col.key} className="px-3 py-2 text-xs text-slate whitespace-nowrap">{dayStr}</td>;
                    }
                    case "start_time":
                      return (
                        <td key={col.key} className="px-3 py-2 text-xs text-slate whitespace-nowrap">
                          {c.start_time && c.end_time ? `${formatTime(c.start_time)}–${formatTime(c.end_time)}` : "—"}
                        </td>
                      );
                    case "discipline_icon": {
                      const discId = c.discipline_ids?.[0];
                      const disc = discId
                        ? disciplines.find((d) => d.id === discId)
                        : disciplines.find((d) => d.name === c.discipline);
                      if (disc?.icon_url) {
                        return (
                          <td key={col.key} className="px-3 py-2 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={disc.icon_url} alt={disc.name} className="w-8 h-8 rounded-full object-cover mx-auto" />
                          </td>
                        );
                      }
                      const dname = disc?.name ?? c.discipline ?? "";
                      return (
                        <td key={col.key} className="px-3 py-2 text-center">
                          <div className="w-8 h-8 rounded-full bg-lavender/20 flex items-center justify-center mx-auto text-xs font-medium text-lavender">
                            {dname.charAt(0)}
                          </div>
                        </td>
                      );
                    }
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
                            {c.status === "active" && <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Active</span>}
                            {c.status === "archived" && <span className="inline-flex items-center rounded-full bg-cloud px-1.5 py-0.5 text-[10px] font-medium text-slate">Archived</span>}
                            {c.status === "draft" && <span className="inline-flex items-center rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold-dark">Draft</span>}
                            {c.status === "full" && <span className="inline-flex items-center rounded-full bg-error/10 px-1.5 py-0.5 text-[10px] font-medium text-error">Full</span>}
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
          rooms={activeRooms}
          classColorPalette={classColorPalette}
          availableLevels={availableLevels}
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
  availableLevels,
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
  availableLevels?: string[];
  stacked?: boolean;
}) {
  const cls = stacked ? "w-full" : "w-[140px]";
  return (
    <>
      <SimpleSelect value={filterSeason || "__all__"} onValueChange={(val) => setFilterSeason(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Seasons" }, ...seasons.map((s) => ({ value: s.id, label: s.name }))]} placeholder="All Seasons" className={cls} />
      <SimpleSelect value={filterTeacher || "__all__"} onValueChange={(val) => setFilterTeacher(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Teachers" }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]} placeholder="All Teachers" className={cls} />
      <SimpleSelect value={filterLevel || "__all__"} onValueChange={(val) => setFilterLevel(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Levels" }, ...((availableLevels ?? []).length > 0 ? (availableLevels ?? []) : LEVEL_OPTIONS).map((l) => ({ value: l, label: l }))]} placeholder="All Levels" className={cls} />
      <SimpleSelect value={filterDiscipline || "__all__"} onValueChange={(val) => setFilterDiscipline(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Disciplines" }, ...disciplines.map((d) => ({ value: d.id, label: d.name }))]} placeholder="All Disciplines" className={cls} />
      <SimpleSelect value={filterDay || "__all__"} onValueChange={(val) => setFilterDay(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Days" }, ...[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_NAMES_FULL[d] }))]} placeholder="All Days" className={cls} />
      <SimpleSelect value={filterType || "__all__"} onValueChange={(val) => setFilterType(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Types" }, { value: "class", label: "Class" }, { value: "rehearsal", label: "Rehearsal" }, { value: "performance", label: "Performance" }]} placeholder="All Types" className={cls} />
      <SimpleSelect value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)} options={[{ value: "__all__", label: "All Status" }, { value: "active", label: "Active" }, { value: "hidden", label: "Hidden" }, { value: "inactive", label: "Inactive" }]} placeholder="All Status" className={cls} />
    </>
  );
}
