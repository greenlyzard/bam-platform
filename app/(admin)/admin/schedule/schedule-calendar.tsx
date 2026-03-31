"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleInstance } from "@/lib/schedule/types";
import { getLevelColor } from "@/lib/schedule/types";
import { SimpleSelect } from "@/components/ui/select";

// ── Helpers ───────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
}

function shiftWeek(weekStart: string, direction: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + direction * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getThisWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
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
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
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

// ── Types ─────────────────────────────────────────────────────

interface ScheduleCalendarProps {
  instances: ScheduleInstance[];
  teachers: Array<{ id: string; name: string }>;
  rooms: Array<{ id: string; name: string }>;
  levels: string[];
  weekStart: string;
  isRecurring?: boolean;
  closures?: Array<{ closed_date: string; reason: string }>;
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
}: {
  instance: ScheduleInstance;
  compact?: boolean;
  onClick?: () => void;
  visibleFields?: Set<string>;
}) {
  const isCancelled = instance.status === "cancelled";
  const isPrivate = instance.event_type === "private_lesson";
  const levelColor = isCancelled ? "#B0ADB5" : isPrivate ? "#A855F7" : getLevelColor(instance.classLevel);
  const showField = (key: string) => !visibleFields || visibleFields.has(key);

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
        <>
          {showField("teacher") && instance.teacherName && (
            <div className="mt-0.5 text-mist">{instance.teacherName}</div>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-mist">
            {showField("room") && instance.roomName && <span>{instance.roomName}</span>}
            {showField("enrollment") && instance.maxStudents != null && (
              <span className="print:hidden">
                {instance.enrolledCount ?? 0}/{instance.maxStudents}
              </span>
            )}
          </div>
          {showField("level") && instance.classLevel && (
            <span
              className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${levelColor}30`,
                color: levelColor,
              }}
            >
              {instance.classLevel}
            </span>
          )}
          {showField("classType") && instance.classStyle && (
            <span className="mt-1 ml-1 inline-block rounded-full bg-cloud px-1.5 py-0.5 text-[10px] font-medium text-slate">
              {instance.classStyle}
            </span>
          )}
        </>
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
                {instance.roomName ?? "Not assigned"}
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
  isRecurring,
  closures = [],
  initialFilters,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const [view, setView] = useState<"week" | "list" | "room">("week");
  const [showClosedClasses, setShowClosedClasses] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ScheduleInstance | null>(null);

  const [teacherFilter, setTeacherFilter] = useState(initialFilters.teacher);
  const [levelFilter, setLevelFilter] = useState(initialFilters.level);
  const [roomFilter, setRoomFilter] = useState(initialFilters.room);
  const [dayFilter, setDayFilter] = useState(initialFilters.day);

  // Mobile state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([getTodayStr()]));

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

  const visibleFields = useMemo(
    () => new Set(fields.filter((f) => f.visible).map((f) => f.key)),
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

  // Group instances by date
  const byDate: Record<string, ScheduleInstance[]> = {};
  for (const i of instances) {
    if (!byDate[i.event_date]) byDate[i.event_date] = [];
    byDate[i.event_date].push(i);
  }

  // Group instances by room
  const byRoom: Record<string, ScheduleInstance[]> = {};
  for (const i of instances) {
    const key = i.roomName ?? "Unassigned";
    if (!byRoom[key]) byRoom[key] = [];
    byRoom[key].push(i);
  }

  const today = getTodayStr();
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
  const roomOptions = [
    { value: "__all__", label: "All Rooms" },
    ...rooms.map((r) => ({ value: r.id, label: r.name })),
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
                        {inst.roomName && <span>{inst.roomName}</span>}
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

  const closedDateSet = new Set(closures.map((c) => c.closed_date));
  const closureReasonMap = new Map(closures.map((c) => [c.closed_date, c.reason]));

  const renderWeekView = () => (
    <>
      {/* Closure banner */}
      {closures.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-red-500">&#128683;</span>
            <div>
              <span className="text-sm font-medium text-red-700">
                Studio Closed: {closures[0].reason}
              </span>
              <span className="text-xs text-red-500 ml-2">
                {closures.map((c) =>
                  new Date(c.closed_date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                ).join(", ")}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowClosedClasses((v) => !v)}
            className="text-xs px-3 py-1 border border-red-200 rounded-full text-red-500 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            {showClosedClasses ? "Hide classes" : "Show classes"}
          </button>
        </div>
      )}

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
                  &#128683; {closureReasonMap.get(date) ?? "Closed"}
                </div>
              )}
              {isClosed && !showClosedClasses ? (
                <div className="text-center text-xs text-red-400 py-4">
                  Studio closed
                </div>
              ) : (
                <div className="space-y-1.5">
                  {daySessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-silver p-3 text-center text-xs text-mist print:hidden">
                      No sessions
                    </div>
                  ) : (
                    daySessions.map((inst) => (
                      <div key={inst.id} className={isClosed && inst.event_type !== "private_lesson" ? "opacity-40 pointer-events-none" : ""}>
                      <SessionCard
                        instance={inst}
                        onClick={() => setSelectedInstance(inst)}
                        visibleFields={visibleFields}
                      />
                      </div>
                    ))
                  )}
                </div>
              )}
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
                      {visibleFields.has("level") && (
                        <th className="px-4 py-2 text-left font-medium text-slate">Level</th>
                      )}
                      {visibleFields.has("teacher") && (
                        <th className="px-4 py-2 text-left font-medium text-slate">Teacher</th>
                      )}
                      {visibleFields.has("room") && (
                        <th className="px-4 py-2 text-left font-medium text-slate">Room</th>
                      )}
                      {visibleFields.has("enrollment") && (
                        <th className="px-4 py-2 text-right font-medium text-slate">Enrolled</th>
                      )}
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
                          {visibleFields.has("level") && (
                            <td className="px-4 py-2.5">
                              {inst.classLevel && (
                                <span
                                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ backgroundColor: `${levelColor}30`, color: levelColor }}
                                >
                                  {inst.classLevel}
                                </span>
                              )}
                            </td>
                          )}
                          {visibleFields.has("teacher") && (
                            <td className="px-4 py-2.5 text-slate">{inst.teacherName ?? "\u2013"}</td>
                          )}
                          {visibleFields.has("room") && (
                            <td className="px-4 py-2.5 text-slate">{inst.roomName ?? "\u2013"}</td>
                          )}
                          {visibleFields.has("enrollment") && (
                            <td className="px-4 py-2.5 text-right text-slate">
                              {inst.enrolledCount ?? 0}
                              {inst.maxStudents != null && `/${inst.maxStudents}`}
                            </td>
                          )}
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
                        {inst.roomName && <span>{inst.roomName}</span>}
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
    const roomNames = Object.keys(byRoom).sort();
    return (
      <div className={`grid gap-4 ${roomNames.length <= 3 ? `grid-cols-${roomNames.length}` : "grid-cols-3"}`}
        style={{ gridTemplateColumns: `repeat(${Math.min(roomNames.length, 4)}, minmax(0, 1fr))` }}
      >
        {roomNames.map((roomName) => (
          <div key={roomName} className="min-h-[200px] print:break-inside-avoid">
            <div className="mb-2 rounded-lg bg-lavender/10 border border-lavender/20 px-3 py-2 text-center">
              <div className="text-sm font-semibold text-lavender-dark">{roomName}</div>
              <div className="text-xs text-mist">{byRoom[roomName].length} sessions</div>
            </div>
            <div className="space-y-1.5">
              {byRoom[roomName]
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
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
        {roomNames.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
            No classes scheduled this week.
          </div>
        )}
      </div>
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
            {isRecurring && <span className="ml-2 text-xs text-mist italic">&middot; Showing recurring weekly schedule</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-silver bg-white">
            {(["week", "list", "room"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  view === v
                    ? "bg-lavender text-white"
                    : "text-slate hover:bg-cloud"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
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
                  <p className="text-xs font-semibold text-charcoal">Show / hide fields</p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {fields.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-cloud/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={field.visible}
                        onChange={() => toggleFieldVisible(field.key)}
                        className="h-3.5 w-3.5 rounded border-silver text-lavender focus:ring-lavender/30"
                      />
                      <span className="text-sm text-charcoal">{field.label}</span>
                    </label>
                  ))}
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

      {/* Calendar */}
      {view === "week" && renderWeekView()}
      {view === "list" && renderListView()}
      {view === "room" && renderRoomView()}

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
