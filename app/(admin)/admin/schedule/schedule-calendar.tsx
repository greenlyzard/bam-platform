"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleInstance } from "@/lib/schedule/types";
import { getLevelColor } from "@/lib/schedule/types";
import { SimpleSelect } from "@/components/ui/select";
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
import { toLocalDateStr } from "@/lib/dates";
import { formatRoomLabel, type LocationLabelRef } from "@/lib/locations/resolve";

// ── Helpers ───────────────────────────────────────────────────

/**
 * This page has no location filter — every studio is in view at once — so a
 * room label always names its location (LOCATIONS_AND_FACILITIES.md §4.1).
 *
 * The Room filter below is not a location filter: it narrows to one room, and
 * its own options have to name locations to be usable at all. Holding the
 * suffix constant keeps a room reading the same whether or not that filter is
 * set, which is the point of the rule.
 */
const UNFILTERED = { locationFilterActive: false } as const;

/** The room label for one occurrence, or null when no room is assigned. */
function roomLabelOf(instance: ScheduleInstance): string | null {
  if (!instance.roomName) return null;
  return formatRoomLabel(instance.roomName, instance.roomLocation, UNFILTERED);
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

/** "16:30" / "16:30:00" → minutes past midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":");
  return parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
}

/** Minutes past midnight → the "HH:MM" shape both the DB and `<input type="time">` use. */
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getFullDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function getWeekDates(weekStart: string): string[] {
  const monday = new Date(weekStart + "T00:00:00");
  const dates: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(
      toLocalDateStr(d)
    );
  }
  return dates;
}

function shiftWeek(weekStart: string, direction: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + direction * 7);
  return toLocalDateStr(d);
}

function getThisWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return toLocalDateStr(monday);
}

function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} \u2013 ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} \u2013 ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function getTodayStr(): string {
  const n = new Date();
  return toLocalDateStr(n);
}

const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

// ── Field Picker Config ──────────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  visible: boolean;
}

const DEFAULT_FIELDS: FieldConfig[] = [
  { key: "teacher", label: "Teacher", visible: true },
  { key: "room", label: "Room", visible: true },
  { key: "enrollment", label: "Enrollment", visible: true },
  { key: "level", label: "Level", visible: false },
  { key: "classType", label: "Class Type", visible: false },
];

const FIELDS_STORAGE_KEY = "bam-schedule-fields";

function loadFields(): FieldConfig[] {
  if (typeof window === "undefined") return DEFAULT_FIELDS;
  try {
    const saved = localStorage.getItem(FIELDS_STORAGE_KEY);
    if (!saved) return DEFAULT_FIELDS;
    const parsed = JSON.parse(saved) as FieldConfig[];
    const savedKeys = new Set(parsed.map((c) => c.key));
    const merged = [
      ...parsed.filter((c) => DEFAULT_FIELDS.some((d) => d.key === c.key)),
      ...DEFAULT_FIELDS.filter((d) => !savedKeys.has(d.key)),
    ];
    return merged;
  } catch {
    return DEFAULT_FIELDS;
  }
}

function saveFields(fields: FieldConfig[]) {
  try {
    localStorage.setItem(FIELDS_STORAGE_KEY, JSON.stringify(fields));
  } catch {}
}

// ── Sortable Field Row ───────────────────────────────────────

function SortableFieldRow({
  field,
  onToggle,
}: {
  field: FieldConfig;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.key });

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
          checked={field.visible}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-silver text-lavender focus:ring-lavender/30"
        />
        <span className="text-sm text-charcoal">{field.label}</span>
      </label>
    </div>
  );
}

// ── View toggle ───────────────────────────────────────────────
// "week" is the internal value; the label reads "Calendar" to match the nav item.
const VIEW_OPTIONS = [
  { value: "week", label: "Calendar" },
  { value: "list", label: "List" },
  { value: "room", label: "Room" },
  { value: "day", label: "Day" },
] as const;

// ── Day view (rooms × time) ───────────────────────────────────
// The only view with a real room/time cell, which is what
// PRIVATE_ADD_FROM_CALENDAR.md §4 needs: clicking an empty one knows its date
// (the selected day), its start time (the slot), and its room — including that
// room's `location_id`, without which "Studio 1" cannot be told from the other
// "Studio 1" (§3.1). The Calendar/List/Room views are untouched: their columns
// are days or rooms, never both, so no click there can carry all four.

const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 34;
/** Default visible span, widened (never narrowed) to fit the day's sessions. */
const DEFAULT_DAY_START_MIN = 8 * 60;
const DEFAULT_DAY_END_MIN = 21 * 60;

interface DayColumn {
  key: string;
  label: string;
  roomId: string | null;
  /** The bare room name — what `private_sessions.studio` stores. */
  studioName: string | null;
  locationId: string | null;
}

interface PlacedInstance {
  instance: ScheduleInstance;
  startMin: number;
  endMin: number;
  lane: number;
}

/**
 * Stack a column's sessions into lanes so two bookings in the same room at the
 * same time sit side by side instead of hiding each other. Greedy: an event
 * takes the first lane whose previous event has already ended.
 */
function layoutColumn(items: ScheduleInstance[]): { placed: PlacedInstance[]; lanes: number } {
  const laneEnds: number[] = [];
  const placed = [...items]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((instance) => {
      const startMin = toMinutes(instance.start_time);
      // A zero- or sub-slot-length booking still needs a clickable-sized box.
      const endMin = Math.max(toMinutes(instance.end_time), startMin + SLOT_MINUTES);
      let lane = laneEnds.findIndex((end) => end <= startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endMin);
      } else {
        laneEnds[lane] = endMin;
      }
      return { instance, startMin, endMin, lane };
    });
  return { placed, lanes: Math.max(laneEnds.length, 1) };
}

/** The day the Day view opens on: today when it is in the viewed week, else its Monday. */
function pickDefaultDay(weekStart: string, today: string): string {
  const dates = getWeekDates(weekStart);
  return dates.includes(today) ? today : dates[0];
}

// ── Types ─────────────────────────────────────────────────────

interface ScheduleCalendarProps {
  instances: ScheduleInstance[];
  teachers: Array<{ id: string; name: string }>;
  rooms: Array<{
    id: string;
    name: string;
    is_active: boolean;
    /** Needed by the Day view's add-a-private click — the label alone cannot identify the studio. */
    location_id: string | null;
    location: LocationLabelRef | null;
  }>;
  levels: string[];
  weekStart: string;
  /**
   * Today's date in the **tenant's** timezone, computed server-side
   * (TENANT_TIMEZONE_SPEC.md §4.2). Falls back to the browser's date, which is
   * what this component used before and is wrong for a tenant in another zone.
   */
  today?: string;
  /** True when no schedule_instances rows exist for the viewed range. */
  noOccurrences?: boolean;
  /** The range that actually has generated occurrences, for the empty state. */
  generatedRange?: { start: string; end: string } | null;
  closures?: Array<{ closed_date: string; closed_through: string; is_total: boolean; reason: string }>;
  initialFilters: {
    teacher: string;
    level: string;
    room: string;
    day: string;
  };
}

// ── Session Card ──────────────────────────────────────────────

function SessionCard({
  instance,
  compact = false,
  onClick,
  visibleFields,
  fieldOrder,
}: {
  instance: ScheduleInstance;
  compact?: boolean;
  onClick?: () => void;
  visibleFields?: Set<string>;
  fieldOrder?: string[];
}) {
  const isCancelled = instance.status === "cancelled";
  const isPrivate = instance.event_type === "private_lesson";
  const levelColor = isCancelled ? "#B0ADB5" : isPrivate ? "#A855F7" : getLevelColor(instance.classLevel);
  const showField = (key: string) => !visibleFields || visibleFields.has(key);

  const orderedKeys = fieldOrder ?? DEFAULT_FIELDS.map((f) => f.key);

  function renderField(key: string) {
    switch (key) {
      case "teacher":
        return showField("teacher") && instance.teacherName ? (
          <div key="teacher" className="mt-0.5 text-mist">{instance.teacherName}</div>
        ) : null;
      case "room":
        return showField("room") && instance.roomName ? (
          <span key="room" className="text-mist">{roomLabelOf(instance)}</span>
        ) : null;
      case "enrollment":
        return showField("enrollment") && instance.maxStudents != null ? (
          <span key="enrollment" className="text-mist print:hidden">
            {instance.enrolledCount ?? 0}/{instance.maxStudents}
          </span>
        ) : null;
      case "level":
        return showField("level") && instance.classLevel ? (
          <span
            key="level"
            className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${levelColor}30`, color: levelColor }}
          >
            {instance.classLevel}
          </span>
        ) : null;
      case "classType":
        return showField("classType") && instance.classStyle ? (
          <span key="classType" className="mt-1 ml-1 inline-block rounded-full bg-cloud px-1.5 py-0.5 text-[10px] font-medium text-slate">
            {instance.classStyle}
          </span>
        ) : null;
      default:
        return null;
    }
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border-l-4 p-2 text-xs hover:shadow-sm cursor-pointer transition-shadow ${
        isCancelled ? "bg-cloud/60 opacity-60" : isPrivate ? "bg-purple-50" : "bg-white"
      } print:bg-white print:border print:border-charcoal`}
      style={{ borderLeftColor: levelColor }}
    >
      <div className="flex items-start justify-between gap-1">
        <div
          className={`font-semibold text-charcoal leading-tight ${
            isCancelled ? "line-through" : ""
          }`}
        >
          {instance.className ?? "Untitled"}
        </div>
        {isPrivate && (
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-600 rounded px-1 py-0.5">
            Private
          </span>
        )}
      </div>
      <div className="mt-0.5 text-slate">
        {formatTime(instance.start_time)} – {formatTime(instance.end_time)}
      </div>
      {!compact && (
        <>{orderedKeys.map((key) => renderField(key))}</>
      )}
    </button>
  );
}

// ── Detail Panel ──────────────────────────────────────────────

function DetailPanel({
  instance,
  onClose,
}: {
  instance: ScheduleInstance;
  onClose: () => void;
}) {
  const levelColor = getLevelColor(instance.classLevel);
  const isCancelled = instance.status === "cancelled";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-start justify-between border-b border-silver p-5">
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-xl font-semibold text-charcoal leading-tight">
              {instance.className ?? "Untitled"}
            </h2>
            <p className="mt-1 text-sm text-slate">
              {getFullDayName(instance.event_date)},{" "}
              {new Date(instance.event_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mist hover:bg-cloud hover:text-charcoal"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl border border-silver bg-white p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Time</div>
              <div className="mt-1 text-sm font-medium text-charcoal">
                {formatTime(instance.start_time)} – {formatTime(instance.end_time)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Room</div>
              <div className="mt-1 text-sm font-medium text-charcoal">
                {roomLabelOf(instance) ?? "Not assigned"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-silver bg-white p-4">
            <div className="text-xs font-medium text-mist uppercase tracking-wide">Teacher</div>
            <div className="mt-1 text-sm font-medium text-charcoal">
              {instance.teacherName ?? "Not assigned"}
            </div>
            {instance.subTeacherName && (
              <div className="mt-2">
                <div className="text-xs font-medium text-mist uppercase tracking-wide">Substitute</div>
                <div className="mt-1 text-sm font-medium text-gold-dark">{instance.subTeacherName}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Enrolled</div>
              <div className="mt-1 text-2xl font-semibold text-charcoal">{instance.enrolledCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Max</div>
              <div className="mt-1 text-2xl font-semibold text-charcoal">{instance.maxStudents ?? "\u2013"}</div>
            </div>
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Status</div>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    isCancelled
                      ? "bg-error/10 text-error"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {instance.classLevel && (
            <div className="rounded-xl border border-silver bg-white p-4">
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Level</div>
              <div className="mt-2">
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${levelColor}30`, color: levelColor }}
                >
                  {instance.classLevel}
                </span>
              </div>
            </div>
          )}

          {isCancelled && instance.cancellation_reason && (
            <div className="rounded-xl border border-error/30 bg-error/5 p-4">
              <div className="text-xs font-medium text-error uppercase tracking-wide">Cancellation Reason</div>
              <p className="mt-1 text-sm text-slate">{instance.cancellation_reason}</p>
            </div>
          )}

          {instance.notes && (
            <div className="rounded-xl border border-silver bg-white p-4">
              <div className="text-xs font-medium text-mist uppercase tracking-wide">Notes</div>
              <p className="mt-1 text-sm text-slate whitespace-pre-wrap">{instance.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────

export function ScheduleCalendar({
  instances,
  teachers,
  rooms,
  levels,
  weekStart,
  today: todayProp,
  noOccurrences,
  generatedRange,
  closures = [],
  initialFilters,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const today = todayProp ?? getTodayStr();
  const [view, setView] = useState<"week" | "list" | "room" | "day">("week");
  const [showClosedClasses, setShowClosedClasses] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ScheduleInstance | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => pickDefaultDay(weekStart, today));

  // Moving to another week re-anchors the Day view, otherwise it would keep
  // showing a date that is no longer on screen.
  useEffect(() => {
    setSelectedDate(pickDefaultDay(weekStart, today));
  }, [weekStart, today]);

  const [teacherFilter, setTeacherFilter] = useState(initialFilters.teacher);
  const [levelFilter, setLevelFilter] = useState(initialFilters.level);
  const [roomFilter, setRoomFilter] = useState(initialFilters.room);
  const [dayFilter, setDayFilter] = useState(initialFilters.day);

  // Mobile state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([today]));

  // Field picker state
  const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_FIELDS);
  const [fieldsPopoverOpen, setFieldsPopoverOpen] = useState(false);
  const fieldsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFields(loadFields());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fieldsPopoverRef.current && !fieldsPopoverRef.current.contains(e.target as Node)) {
        setFieldsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateFields(newFields: FieldConfig[]) {
    setFields(newFields);
    saveFields(newFields);
  }

  function toggleFieldVisible(key: string) {
    const newFields = fields.map((f) =>
      f.key === key ? { ...f, visible: !f.visible } : f
    );
    updateFields(newFields);
  }

  function resetFields() {
    updateFields(DEFAULT_FIELDS);
  }

  const fieldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.key === active.id);
    const newIdx = fields.findIndex((f) => f.key === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    updateFields(arrayMove(fields, oldIdx, newIdx));
  }

  const visibleFields = useMemo(
    () => new Set(fields.filter((f) => f.visible).map((f) => f.key)),
    [fields]
  );

  const fieldOrder = useMemo(
    () => fields.map((f) => f.key),
    [fields]
  );

  const activeFilterCount = [teacherFilter, levelFilter, roomFilter, dayFilter].filter(Boolean).length;

  // Radix Select requires non-empty values, so we use "__all__" as sentinel
  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value === "__all__" ? "" : value);
  };

  const buildUrl = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p: Record<string, string> = {
        week: weekStart,
        teacher: teacherFilter,
        level: levelFilter,
        room: roomFilter,
        day: dayFilter,
        ...overrides,
      };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) {
        if (v) params.set(k, v);
      }
      return `/admin/schedule?${params.toString()}`;
    },
    [weekStart, teacherFilter, levelFilter, roomFilter, dayFilter]
  );

  const navigate = useCallback(
    (newWeek: string) => router.push(buildUrl({ week: newWeek })),
    [router, buildUrl]
  );

  const applyFilters = useCallback(() => {
    router.push(buildUrl());
  }, [router, buildUrl]);

  const clearFilters = useCallback(() => {
    setTeacherFilter("");
    setLevelFilter("");
    setRoomFilter("");
    setDayFilter("");
    router.push(`/admin/schedule?week=${weekStart}`);
  }, [router, weekStart]);

  const hasActiveFilters = teacherFilter || levelFilter || roomFilter || dayFilter;

  /**
   * Open the existing New Private form, prefilled from a clicked Day-view cell
   * (PRIVATE_ADD_FROM_CALENDAR.md §4). Prefill rides as query params on the
   * existing route — no new form, no modal, no second create path.
   *
   * **No clock is read here, deliberately.** `date` is the selected column's own
   * date string and `startMin` is the slot's own label; neither is derived from
   * `new Date()`, so neither can be shifted into the previous or next day by the
   * browser's timezone. The one clock read in this component is the `today` prop,
   * which the server computes in the tenant's zone (TENANT_TIMEZONE_SPEC.md).
   */
  const openNewPrivate = useCallback(
    (column: DayColumn, startMin: number) => {
      const params = new URLSearchParams({
        date: selectedDate,
        start: fromMinutes(startMin),
      });
      if (column.studioName) params.set("studio", column.studioName);
      if (column.locationId) params.set("location_id", column.locationId);
      router.push(`/admin/privates/new?${params.toString()}`);
    },
    [router, selectedDate]
  );

  // Group instances by date, sorted by start_time
  const byDate: Record<string, ScheduleInstance[]> = {};
  for (const i of instances) {
    if (!byDate[i.event_date]) byDate[i.event_date] = [];
    byDate[i.event_date].push(i);
  }
  for (const date of Object.keys(byDate)) {
    byDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  // Group instances by room, keyed on room_id — never on the room NAME.
  // Keying on the name merged the two "Studio 1" rooms (San Clemente's and
  // RSM's) into a single column with a summed session count: not ambiguous,
  // wrong. Private sessions carry free-text `roomName` and no room_id, so they
  // key under a separate `name:` namespace that cannot collide with an id.
  const byRoom = new Map<string, { label: string; instances: ScheduleInstance[] }>();
  for (const i of instances) {
    const key = i.room_id
      ? `id:${i.room_id}`
      : i.roomName
        ? `name:${i.roomName}`
        : "unassigned";
    let group = byRoom.get(key);
    if (!group) {
      group = { label: roomLabelOf(i) ?? "Unassigned", instances: [] };
      byRoom.set(key, group);
    }
    group.instances.push(i);
  }
  const roomGroups = [...byRoom.entries()]
    .map(([key, group]) => ({ key, ...group }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const weekDates = getWeekDates(weekStart);

  // SimpleSelect option arrays
  const teacherOptions = [
    { value: "__all__", label: "All Teachers" },
    ...teachers.map((t) => ({ value: t.id, label: t.name })),
  ];
  const levelOptions = [
    { value: "__all__", label: "All Levels" },
    ...levels.map((l) => ({ value: l, label: l })),
  ];
  // Archived rooms (§6.1 — `is_active = false`) are not selectable: the three
  // retired orphans are the only ones, and offering them invites filtering the
  // schedule to a room nothing is scheduled into. The one exception is a room
  // already named in the URL — dropping it would show "All Rooms" while the
  // schedule was in fact still filtered, which is worse than listing it.
  const roomOptions = [
    { value: "__all__", label: "All Rooms" },
    ...rooms
      .filter((r) => r.is_active || r.id === roomFilter)
      .map((r) => ({ value: r.id, label: formatRoomLabel(r.name, r.location, UNFILTERED) })),
  ];
  const dayOptions = [
    { value: "__all__", label: "All Days" },
    ...DAY_OPTIONS,
  ];

  // ── Print ───────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  // ── Mobile day toggle ──────────────────────────────────────

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // ── Mobile Day List View ───────────────────────────────────

  const renderMobileDayList = () => (
    <div className="space-y-2 md:hidden">
      {weekDates.map((date) => {
        const daySessions = byDate[date] ?? [];
        const isToday = date === today;
        const isExpanded = expandedDays.has(date);
        return (
          <div key={date} className="rounded-xl border border-silver bg-white overflow-hidden">
            <button
              onClick={() => toggleDay(date)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                isToday ? "bg-lavender/10" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm font-semibold text-charcoal">
                    {getFullDayName(date)}
                  </span>
                  <span className="ml-2 text-sm text-slate">
                    {formatDateLabel(date)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-mist">
                  {daySessions.length} class{daySessions.length !== 1 ? "es" : ""}
                </span>
                <svg
                  className={`h-4 w-4 text-mist transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isExpanded && daySessions.length > 0 && (
              <div className="border-t border-silver divide-y divide-silver">
                {daySessions.map((inst) => {
                  const isCancelled = inst.status === "cancelled";
                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstance(inst)}
                      className={`w-full text-left px-4 py-3 hover:bg-cloud/30 ${isCancelled ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-sm font-medium text-charcoal ${isCancelled ? "line-through" : ""}`}>
                            {formatTime(inst.start_time)} – {formatTime(inst.end_time)}
                          </span>
                          <div className={`text-sm text-charcoal ${isCancelled ? "line-through" : ""}`}>
                            {inst.className ?? "Untitled"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-mist">
                        {inst.roomName && <span>{roomLabelOf(inst)}</span>}
                        {inst.teacherName && <span>{inst.teacherName}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {isExpanded && daySessions.length === 0 && (
              <div className="border-t border-silver px-4 py-4 text-center text-xs text-mist">
                No classes scheduled
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Week View ───────────────────────────────────────────────

  // Expand each closure across its full [closed_date, closed_through] span so a
  // multi-day closure marks every day it covers, not only its first. Intersecting
  // with weekDates clips the span to the days actually on screen.
  const closureByDate = new Map<string, { reason: string; is_total: boolean }>();
  const closuresInView = closures
    .map((c) => ({
      ...c,
      datesInView: weekDates.filter((d) => d >= c.closed_date && d <= c.closed_through),
    }))
    .filter((c) => c.datesInView.length > 0);

  for (const c of closuresInView) {
    for (const d of c.datesInView) {
      closureByDate.set(d, { reason: c.reason, is_total: c.is_total });
    }
  }

  const closedDateSet = new Set(closureByDate.keys());
  const closureLabel = (isTotal: boolean) =>
    isTotal ? "Studio closed" : "Studio closed, privates running";

  // Shared by the Calendar and Day views so a closed day reads identically in
  // both, including the "Show classes" toggle (one piece of state, one banner).
  const renderClosureBanner = () =>
    closuresInView.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-2 print:hidden">
          <div className="flex items-start gap-2">
            <span className="text-red-500 leading-5">&#128683;</span>
            <div className="space-y-0.5">
              {closuresInView.map((c) => (
                <div key={`${c.closed_date}-${c.closed_through}`}>
                  <span className="text-sm font-medium text-red-700">
                    {closureLabel(c.is_total)}: {c.reason}
                  </span>
                  <span className="text-xs text-red-500 ml-2">
                    {c.datesInView
                      .map((d) =>
                        new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      )
                      .join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowClosedClasses((v) => !v)}
            className="text-xs px-3 py-1 border border-red-200 rounded-full text-red-500 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            {showClosedClasses ? "Hide classes" : "Show classes"}
          </button>
        </div>
    );

  const renderWeekView = () => (
    <>
      {renderClosureBanner()}

      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-6 gap-3 print:grid print:grid-cols-3 print:gap-2">
        {weekDates.map((date) => {
          const daySessions = byDate[date] ?? [];
          const isToday = date === today;
          const isClosed = closedDateSet.has(date);
          return (
            <div key={date} className="min-h-[200px] print:min-h-0 print:break-inside-avoid">
              <div
                className={`mb-2 rounded-lg px-3 py-2 text-center ${
                  isClosed ? "bg-red-50 border border-red-200" :
                  isToday ? "bg-lavender text-white" : "bg-white border border-silver"
                } print:bg-white print:border print:border-charcoal print:text-charcoal`}
              >
                <div className={`text-xs font-medium ${isClosed ? "text-red-400" : isToday ? "text-white/80" : "text-mist"} print:text-charcoal`}>
                  {getDayName(date)}
                </div>
                <div className={`text-sm font-semibold ${isClosed ? "text-red-600" : isToday ? "text-white" : "text-charcoal"} print:text-charcoal`}>
                  {formatDateLabel(date)}
                </div>
              </div>
              {isClosed && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 text-center font-medium">
                  &#128683; {closureByDate.get(date)?.reason ?? "Closed"}
                  <div className="text-[10px] font-normal text-red-400">
                    {closureByDate.get(date)?.is_total ? "Fully closed" : "Privates running"}
                  </div>
                </div>
              )}
              {(() => {
                const privateSessions = daySessions.filter((s) => s.event_type === "private_lesson");
                const sessionsToShow = isClosed && !showClosedClasses
                  ? privateSessions
                  : daySessions;

                return (
                  <div className="space-y-1.5">
                    {isClosed && !showClosedClasses && privateSessions.length === 0 ? (
                      <div className="text-center text-xs text-red-400 py-4">
                        {closureLabel(closureByDate.get(date)?.is_total ?? true)}
                      </div>
                    ) : sessionsToShow.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-silver p-3 text-center text-xs text-mist print:hidden">
                        No sessions
                      </div>
                    ) : (
                      <>
                        {isClosed && !showClosedClasses && (
                          <div className="text-center text-xs text-red-400 py-1">
                            {closureLabel(closureByDate.get(date)?.is_total ?? true)}
                          </div>
                        )}
                        {sessionsToShow.map((inst) => (
                          <div
                            key={inst.id}
                            className={isClosed && inst.event_type !== "private_lesson" ? "opacity-40 pointer-events-none" : ""}
                          >
                            <SessionCard
                              instance={inst}
                              onClick={isClosed && inst.event_type !== "private_lesson" ? undefined : () => setSelectedInstance(inst)}
                              visibleFields={visibleFields}
                              fieldOrder={fieldOrder}
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      {/* Mobile day list */}
      {renderMobileDayList()}
    </>
  );

  // ── List View ───────────────────────────────────────────────

  const renderListView = () => {
    const sortedDates = Object.keys(byDate).sort();
    return (
      <div className="space-y-4">
        {sortedDates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
            No classes scheduled this week.
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="print:break-inside-avoid">
              <h3 className="text-sm font-semibold text-charcoal mb-2">
                {getFullDayName(date)}, {formatDateLabel(date)}
              </h3>
              {/* Desktop table */}
              <div className="hidden md:block rounded-xl border border-silver bg-white overflow-hidden print:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver bg-cloud/50">
                      <th className="px-4 py-2 text-left font-medium text-slate">Time</th>
                      <th className="px-4 py-2 text-left font-medium text-slate">Class</th>
                      {fieldOrder.map((key) => {
                        if (!visibleFields.has(key)) return null;
                        const align = key === "enrollment" ? "text-right" : "text-left";
                        const label = fields.find((f) => f.key === key)?.label ?? key;
                        return (
                          <th key={key} className={`px-4 py-2 ${align} font-medium text-slate`}>
                            {label === "Enrollment" ? "Enrolled" : label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver">
                    {byDate[date].map((inst) => {
                      const levelColor = getLevelColor(inst.classLevel);
                      const isCancelled = inst.status === "cancelled";
                      return (
                        <tr
                          key={inst.id}
                          className={`cursor-pointer hover:bg-cloud/30 ${isCancelled ? "opacity-50" : ""}`}
                          onClick={() => setSelectedInstance(inst)}
                        >
                          <td className="px-4 py-2.5 text-charcoal whitespace-nowrap">
                            {formatTime(inst.start_time)} – {formatTime(inst.end_time)}
                          </td>
                          <td className={`px-4 py-2.5 font-medium text-charcoal ${isCancelled ? "line-through" : ""}`}>
                            {inst.className ?? "Untitled"}
                          </td>
                          {fieldOrder.map((key) => {
                            if (!visibleFields.has(key)) return null;
                            switch (key) {
                              case "level":
                                return (
                                  <td key="level" className="px-4 py-2.5">
                                    {inst.classLevel && (
                                      <span
                                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: `${levelColor}30`, color: levelColor }}
                                      >
                                        {inst.classLevel}
                                      </span>
                                    )}
                                  </td>
                                );
                              case "teacher":
                                return <td key="teacher" className="px-4 py-2.5 text-slate">{inst.teacherName ?? "\u2013"}</td>;
                              case "room":
                                return <td key="room" className="px-4 py-2.5 text-slate">{roomLabelOf(inst) ?? "\u2013"}</td>;
                              case "enrollment":
                                return (
                                  <td key="enrollment" className="px-4 py-2.5 text-right text-slate">
                                    {inst.enrolledCount ?? 0}
                                    {inst.maxStudents != null && `/${inst.maxStudents}`}
                                  </td>
                                );
                              case "classType":
                                return (
                                  <td key="classType" className="px-4 py-2.5 text-slate">
                                    {inst.classStyle ?? "\u2013"}
                                  </td>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile list */}
              <div className="md:hidden space-y-1.5">
                {byDate[date].map((inst) => {
                  const isCancelled = inst.status === "cancelled";
                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstance(inst)}
                      className={`w-full text-left rounded-xl border border-silver bg-white px-4 py-3 hover:bg-cloud/30 ${isCancelled ? "opacity-50" : ""}`}
                    >
                      <div className={`text-sm font-medium text-charcoal ${isCancelled ? "line-through" : ""}`}>
                        {inst.className ?? "Untitled"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate">
                        {formatTime(inst.start_time)} – {formatTime(inst.end_time)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-mist">
                        {inst.roomName && <span>{roomLabelOf(inst)}</span>}
                        {inst.teacherName && <span>{inst.teacherName}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // ── Room View ───────────────────────────────────────────────

  const renderRoomView = () => {
    return (
      <div className={`grid gap-4 ${roomGroups.length <= 3 ? `grid-cols-${roomGroups.length}` : "grid-cols-3"}`}
        style={{ gridTemplateColumns: `repeat(${Math.min(roomGroups.length, 4)}, minmax(0, 1fr))` }}
      >
        {roomGroups.map((group) => (
          <div key={group.key} className="min-h-[200px] print:break-inside-avoid">
            <div className="mb-2 rounded-lg bg-lavender/10 border border-lavender/20 px-3 py-2 text-center">
              <div className="text-sm font-semibold text-lavender-dark">{group.label}</div>
              <div className="text-xs text-mist">{group.instances.length} sessions</div>
            </div>
            <div className="space-y-1.5">
              {group.instances
                .sort((a, b) => {
                  const dateComp = a.event_date.localeCompare(b.event_date);
                  if (dateComp !== 0) return dateComp;
                  return a.start_time.localeCompare(b.start_time);
                })
                .map((inst) => (
                  <div key={inst.id} className="relative">
                    <div className="text-[10px] text-mist px-1 mb-0.5">
                      {getDayName(inst.event_date)} {formatDateLabel(inst.event_date)}
                    </div>
                    <SessionCard
                      instance={inst}
                      onClick={() => setSelectedInstance(inst)}
                      visibleFields={visibleFields}
                      fieldOrder={fieldOrder}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
        {roomGroups.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
            No classes scheduled this week.
          </div>
        )}
      </div>
    );
  };

  // ── Day View (rooms × time) ─────────────────────────────────

  const renderDayView = () => {
    const daySessions = byDate[selectedDate] ?? [];
    const isClosed = closedDateSet.has(selectedDate);
    // Same rule as the Calendar view: on a closed day only privates show until
    // "Show classes" is pressed — a closed day's classes are not running.
    const sessions =
      isClosed && !showClosedClasses
        ? daySessions.filter((s) => s.event_type === "private_lesson")
        : daySessions;

    // Columns are rooms. Archived rooms are excluded for the same reason the
    // Room filter excludes them: nothing is scheduled into one, and offering a
    // click that books a private into a retired room is worse than not offering
    // it. When the Room filter is set, the grid narrows to that one room — the
    // URL filter, not the pending select, because the sessions reflect the URL.
    const columns: DayColumn[] = rooms
      .filter((r) => (initialFilters.room ? r.id === initialFilters.room : r.is_active))
      .map((r) => ({
        key: `id:${r.id}`,
        label: formatRoomLabel(r.name, r.location, UNFILTERED),
        roomId: r.id,
        studioName: r.name,
        locationId: r.location_id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Anything that did not resolve to one of those rooms still has to be
    // visible — an unroomed class, or a private whose free-text `studio` did not
    // match a room at its location (§3.1). It gets a trailing column whose cells
    // are NOT clickable: there is no room to prefill, and a click that silently
    // dropped the studio would be a worse answer than no click.
    const columnRoomIds = new Set(columns.map((c) => c.roomId));
    const unplaced = sessions.filter((s) => !s.room_id || !columnRoomIds.has(s.room_id));

    let startMin = DEFAULT_DAY_START_MIN;
    let endMin = DEFAULT_DAY_END_MIN;
    for (const s of sessions) {
      startMin = Math.min(startMin, Math.floor(toMinutes(s.start_time) / SLOT_MINUTES) * SLOT_MINUTES);
      endMin = Math.max(endMin, Math.ceil(toMinutes(s.end_time) / SLOT_MINUTES) * SLOT_MINUTES);
    }
    const slots: number[] = [];
    for (let m = startMin; m < endMin; m += SLOT_MINUTES) slots.push(m);
    const gridHeight = slots.length * SLOT_HEIGHT_PX;

    const topFor = (min: number) => ((min - startMin) / SLOT_MINUTES) * SLOT_HEIGHT_PX;

    const renderColumnBody = (column: DayColumn | null, items: ScheduleInstance[]) => {
      const { placed, lanes } = layoutColumn(items);
      return (
        <div className="relative border-l border-silver" style={{ height: gridHeight }}>
          {/* Empty cells. Rendered under the cards, so a click only lands where
              nothing is booked. */}
          {slots.map((min) => {
            const isHour = min % 60 === 0;
            const cellCls = `absolute inset-x-0 border-t ${isHour ? "border-silver" : "border-silver/40"}`;
            if (!column) {
              return <div key={min} className={cellCls} style={{ top: topFor(min), height: SLOT_HEIGHT_PX }} />;
            }
            return (
              <button
                key={min}
                type="button"
                onClick={() => openNewPrivate(column, min)}
                title={`Add a private — ${column.label}, ${formatTime(fromMinutes(min))}`}
                className={`${cellCls} group hover:bg-lavender/10 transition-colors`}
                style={{ top: topFor(min), height: SLOT_HEIGHT_PX }}
              >
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 text-[10px] font-medium text-lavender-dark">
                  + Private
                </span>
              </button>
            );
          })}

          {/* Booked sessions */}
          {placed.map(({ instance, startMin: s, endMin: e, lane }) => {
            const dimmed = isClosed && instance.event_type !== "private_lesson";
            return (
              <div
                key={instance.id}
                className={`absolute overflow-hidden px-0.5 ${dimmed ? "opacity-40" : ""}`}
                style={{
                  top: topFor(s),
                  height: ((e - s) / SLOT_MINUTES) * SLOT_HEIGHT_PX,
                  left: `${(lane * 100) / lanes}%`,
                  width: `${100 / lanes}%`,
                }}
              >
                <SessionCard
                  instance={instance}
                  compact
                  onClick={dimmed ? undefined : () => setSelectedInstance(instance)}
                  visibleFields={visibleFields}
                  fieldOrder={fieldOrder}
                />
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <>
        {renderClosureBanner()}

        {/* Day picker — the days of the week already in view */}
        <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
          {weekDates.map((date) => {
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-lavender bg-lavender text-white"
                    : closedDateSet.has(date)
                      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      : "border-silver bg-white text-slate hover:bg-cloud"
                }`}
              >
                {getDayName(date)} {formatDateLabel(date)}
                {date === today && <span className={`ml-1 text-xs ${isSelected ? "text-white/70" : "text-mist"}`}>today</span>}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs text-mist print:hidden">
          Click an empty slot to schedule a private in that room and time.
        </p>

        {columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
            No rooms to show.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-silver bg-white">
            <div className="min-w-max">
              {/* Header */}
              <div className="flex border-b border-silver bg-cloud/50">
                <div className="w-16 shrink-0" />
                {columns.map((c) => (
                  <div
                    key={c.key}
                    className="w-[150px] shrink-0 border-l border-silver px-2 py-2 text-center text-sm font-semibold text-charcoal"
                  >
                    {c.label}
                  </div>
                ))}
                {unplaced.length > 0 && (
                  <div className="w-[150px] shrink-0 border-l border-silver px-2 py-2 text-center text-sm font-semibold text-mist">
                    No room
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex">
                {/* Time gutter */}
                <div className="relative w-16 shrink-0" style={{ height: gridHeight }}>
                  {slots.map((min) =>
                    min % 60 === 0 ? (
                      <div
                        key={min}
                        className="absolute right-2 -translate-y-1/2 text-[11px] text-mist"
                        style={{ top: topFor(min) }}
                      >
                        {formatTime(fromMinutes(min))}
                      </div>
                    ) : null
                  )}
                </div>

                {columns.map((c) => (
                  <div key={c.key} className="w-[150px] shrink-0">
                    {renderColumnBody(
                      c,
                      sessions.filter((s) => s.room_id === c.roomId)
                    )}
                  </div>
                ))}

                {unplaced.length > 0 && (
                  <div className="w-[150px] shrink-0 bg-cloud/20">
                    {renderColumnBody(null, unplaced)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Main Render ─────────────────────────────────────────────

  return (
    <div>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 0.5in; }
          body { background: white !important; }
          nav, header, footer, .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:grid { display: grid !important; }
        }
      `}</style>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-heading font-bold text-charcoal text-center">
          Ballet Academy and Movement
        </h1>
        <p className="text-center text-sm text-slate mt-1">
          Weekly Schedule — {getWeekLabel(weekStart)}
        </p>
        <p className="text-center text-xs text-mist mt-0.5">
          Generated: {new Date().toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Schedule</h1>
          <p className="mt-1 text-sm text-slate">
            {getWeekLabel(weekStart)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-silver bg-white">
            {VIEW_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  view === value
                    ? "bg-lavender text-white"
                    : "text-slate hover:bg-cloud"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mobile Filter Button */}
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="md:hidden rounded-lg border border-silver bg-white px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-lavender text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Week Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(shiftWeek(weekStart, -1))}
              className="rounded-lg border border-silver bg-white px-2.5 py-1.5 text-slate hover:bg-cloud transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => navigate(getThisWeekMonday())}
              className="rounded-lg border border-silver bg-white px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigate(shiftWeek(weekStart, 1))}
              className="rounded-lg border border-silver bg-white px-2.5 py-1.5 text-slate hover:bg-cloud transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Print — desktop only */}
          <button
            onClick={handlePrint}
            className="hidden md:flex rounded-lg border border-silver bg-white px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>

          {/* Fields — desktop only */}
          <div ref={fieldsPopoverRef} className="relative hidden md:inline-flex">
            <button
              onClick={() => setFieldsPopoverOpen(!fieldsPopoverOpen)}
              className="rounded-lg border border-silver bg-white px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud transition-colors flex items-center gap-1.5"
            >
              <svg className="h-4 w-4 text-mist" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Fields
            </button>
            {fieldsPopoverOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-silver bg-white shadow-lg z-30 py-1">
                <div className="px-3 py-2 border-b border-silver">
                  <p className="text-xs font-semibold text-charcoal">Show / reorder fields</p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
                    <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                      {fields.map((field) => (
                        <SortableFieldRow
                          key={field.key}
                          field={field}
                          onToggle={() => toggleFieldVisible(field.key)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
                <div className="px-3 py-2 border-t border-silver">
                  <button
                    onClick={resetFields}
                    className="text-xs text-lavender hover:text-lavender-dark font-medium"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Filters */}
      <div className="mb-5 rounded-xl border border-silver bg-white p-4 print:hidden hidden md:block">
        <div className="flex flex-wrap items-end gap-3">
          {/* Teacher */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Teacher</label>
            <SimpleSelect
              value={teacherFilter || "__all__"}
              onValueChange={handleFilterChange(setTeacherFilter)}
              options={teacherOptions}
              placeholder="All Teachers"
            />
          </div>

          {/* Level */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Level</label>
            <SimpleSelect
              value={levelFilter || "__all__"}
              onValueChange={handleFilterChange(setLevelFilter)}
              options={levelOptions}
              placeholder="All Levels"
            />
          </div>

          {/* Room */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Room</label>
            <SimpleSelect
              value={roomFilter || "__all__"}
              onValueChange={handleFilterChange(setRoomFilter)}
              options={roomOptions}
              placeholder="All Rooms"
            />
          </div>

          {/* Day of Week */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Day</label>
            <SimpleSelect
              value={dayFilter || "__all__"}
              onValueChange={handleFilterChange(setDayFilter)}
              options={dayOptions}
              placeholder="All Days"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={applyFilters}
              className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
            >
              Apply
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-lg px-3 py-2 text-sm font-medium text-mist hover:text-slate hover:bg-cloud transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-silver px-4 py-3 flex items-center justify-between z-10 rounded-t-2xl">
              <h3 className="text-sm font-semibold text-charcoal">Filters</h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate hover:text-charcoal hover:bg-cloud"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Teacher</label>
                <SimpleSelect
                  value={teacherFilter || "__all__"}
                  onValueChange={handleFilterChange(setTeacherFilter)}
                  options={teacherOptions}
                  placeholder="All Teachers"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Level</label>
                <SimpleSelect
                  value={levelFilter || "__all__"}
                  onValueChange={handleFilterChange(setLevelFilter)}
                  options={levelOptions}
                  placeholder="All Levels"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Room</label>
                <SimpleSelect
                  value={roomFilter || "__all__"}
                  onValueChange={handleFilterChange(setRoomFilter)}
                  options={roomOptions}
                  placeholder="All Rooms"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mist uppercase tracking-wide mb-1">Day</label>
                <SimpleSelect
                  value={dayFilter || "__all__"}
                  onValueChange={handleFilterChange(setDayFilter)}
                  options={dayOptions}
                  placeholder="All Days"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-silver px-4 py-3">
              <button
                onClick={() => {
                  applyFilters();
                  setMobileFilterOpen(false);
                }}
                className="w-full h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate">
          {instances.length} session{instances.length !== 1 ? "s" : ""} this week
        </p>
        {hasActiveFilters && (
          <span className="inline-block rounded-full bg-lavender/15 px-2.5 py-0.5 text-xs font-medium text-lavender-dark">
            Filtered
          </span>
        )}
      </div>

      {/* No generated occurrences for this range. We say so rather than
          synthesising a week from the recurring class rows. */}
      {noOccurrences && (
        <div className="mb-4 rounded-lg border border-silver bg-white p-4 print:hidden">
          <p className="text-sm font-medium text-charcoal">
            No class occurrences generated for this range
          </p>
          <p className="mt-1 text-sm text-slate">
            {generatedRange ? (
              <>
                Occurrences currently exist for{" "}
                <span className="font-medium text-charcoal">
                  {formatFullDate(generatedRange.start)}
                </span>{" "}
                &ndash;{" "}
                <span className="font-medium text-charcoal">
                  {formatFullDate(generatedRange.end)}
                </span>
                . Navigate to a week inside that range to see the schedule.
              </>
            ) : (
              <>No occurrences have been generated yet.</>
            )}
          </p>
          <p className="mt-1 text-xs text-mist">
            Private sessions are unaffected and still shown.
          </p>
        </div>
      )}

      {/* Calendar */}
      {view === "week" && renderWeekView()}
      {view === "list" && renderListView()}
      {view === "room" && renderRoomView()}
      {view === "day" && renderDayView()}

      {/* Detail Panel */}
      {selectedInstance && (
        <DetailPanel
          instance={selectedInstance}
          onClose={() => setSelectedInstance(null)}
        />
      )}

      {/* Print-only footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-silver text-center text-xs text-mist">
        Ballet Academy and Movement — Confidential
      </div>
    </div>
  );
}
