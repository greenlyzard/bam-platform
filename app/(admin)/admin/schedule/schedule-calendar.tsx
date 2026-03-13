"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ClassSession } from "@/lib/schedule/queries";
import { CLASS_TYPE_BG, CLASS_TYPE_COLORS } from "@/lib/schedule/queries";
import { cancelSession, setCancellationPayDecision, createPayDecisionTask } from "@/lib/schedule/actions";
import Link from "next/link";

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

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
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

function getMonthDates(weekStart: string): { dates: string[]; firstDayOffset: number; monthLabel: string } {
  const ref = new Date(weekStart + "T00:00:00");
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOffset = firstDay.getDay(); // 0=Sun

  const dates: string[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    dates.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
    );
  }

  const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { dates, firstDayOffset, monthLabel };
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
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

const CLASS_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "performance", label: "Performance" },
  { value: "competition", label: "Competition" },
  { value: "private", label: "Private" },
  { value: "workshop", label: "Workshop" },
  { value: "intensive", label: "Intensive" },
];

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-[#9C8BBF]/15 text-[#6B5A99]",
  completed: "bg-[#5A9E6F]/15 text-[#5A9E6F]",
  cancelled: "bg-[#C45B5B]/15 text-[#C45B5B]",
  rescheduled: "bg-[#D4A843]/15 text-[#D4A843]",
};

// ── Types ─────────────────────────────────────────────────────

interface ScheduleCalendarProps {
  sessions: ClassSession[];
  teachers: Array<{ id: string; name: string }>;
  weekStart: string;
  initialFilters: {
    teacher: string;
    classType: string;
    room: string;
  };
}

// ── Component ─────────────────────────────────────────────────

export function ScheduleCalendar({
  sessions,
  teachers,
  weekStart,
  initialFilters,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reducedRate, setReducedRate] = useState("");
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [teacherFilter, setTeacherFilter] = useState(initialFilters.teacher);
  const [classTypeFilter, setClassTypeFilter] = useState(initialFilters.classType);
  const [roomFilter, setRoomFilter] = useState(initialFilters.room);

  const navigate = useCallback(
    (newWeek: string) => {
      const params = new URLSearchParams();
      params.set("week", newWeek);
      if (teacherFilter) params.set("teacher", teacherFilter);
      if (classTypeFilter) params.set("classType", classTypeFilter);
      if (roomFilter) params.set("room", roomFilter);
      router.push(`/admin/schedule?${params.toString()}`);
    },
    [router, teacherFilter, classTypeFilter, roomFilter]
  );

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    params.set("week", weekStart);
    if (teacherFilter) params.set("teacher", teacherFilter);
    if (classTypeFilter) params.set("classType", classTypeFilter);
    if (roomFilter) params.set("room", roomFilter);
    router.push(`/admin/schedule?${params.toString()}`);
  }, [router, weekStart, teacherFilter, classTypeFilter, roomFilter]);

  const clearFilters = useCallback(() => {
    setTeacherFilter("");
    setClassTypeFilter("");
    setRoomFilter("");
    router.push(`/admin/schedule?week=${weekStart}`);
  }, [router, weekStart]);

  // Group sessions by date
  const sessionsByDate: Record<string, ClassSession[]> = {};
  for (const s of sessions) {
    if (!sessionsByDate[s.session_date]) sessionsByDate[s.session_date] = [];
    sessionsByDate[s.session_date].push(s);
  }

  // ── Cancel flow ───────────────────────────────────────────

  const handleCancelSession = () => {
    if (!selectedSession || !cancelReason.trim()) return;
    startTransition(async () => {
      const result = await cancelSession(selectedSession.id, cancelReason.trim());
      if (result.success) {
        setShowCancelModal(false);
        setCancelReason("");
        setShowPayModal(true);
      }
    });
  };

  const handlePayDecision = (decision: string) => {
    if (!selectedSession) return;
    startTransition(async () => {
      if (decision === "decide_later") {
        await createPayDecisionTask(
          selectedSession.id,
          selectedSession.lead_teacher_id ?? ""
        );
      } else {
        const override = decision === "reduced" ? parseFloat(reducedRate) || undefined : undefined;
        await setCancellationPayDecision(selectedSession.id, decision, override);
      }
      setShowPayModal(false);
      setReducedRate("");
      setSelectedSession(null);
    });
  };

  // ── Render helpers ────────────────────────────────────────

  const renderSessionCell = (session: ClassSession) => {
    const borderColor = session.is_cancelled
      ? "#9E99A7"
      : CLASS_TYPE_BG[session.classType ?? "regular"] ?? "#9C8BBF";

    return (
      <button
        key={session.id}
        onClick={() => setSelectedSession(session)}
        className={`w-full text-left rounded-lg border-l-4 p-2 text-xs hover:shadow-sm cursor-pointer transition-shadow ${
          session.is_cancelled ? "bg-[#F0EDF3] opacity-60" : "bg-white"
        }`}
        style={{ borderLeftColor: borderColor }}
      >
        <div
          className={`font-semibold text-[#2D2A33] leading-tight ${
            session.is_cancelled ? "line-through" : ""
          }`}
        >
          {session.className ?? "Untitled"}
        </div>
        <div className="mt-0.5 text-[#5A5662]">
          {formatTime(session.start_time)}
          {session.room ? ` \u00B7 ${session.room}` : ""}
          {session.teacherInitials ? ` \u00B7 ${session.teacherInitials}` : ""}
        </div>
        {session.needs_coverage && !session.is_cancelled && (
          <span className="mt-1 inline-block rounded-full bg-[#D4A843]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#9B7A2E]">
            Needs Coverage
          </span>
        )}
      </button>
    );
  };

  const renderMonthPill = (session: ClassSession) => {
    const bgColor = session.is_cancelled
      ? "#F0EDF3"
      : `${CLASS_TYPE_BG[session.classType ?? "regular"] ?? "#9C8BBF"}22`;
    const textColor = session.is_cancelled
      ? "#9E99A7"
      : CLASS_TYPE_BG[session.classType ?? "regular"] ?? "#6B5A99";

    return (
      <button
        key={session.id}
        onClick={() => setSelectedSession(session)}
        className="w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-tight cursor-pointer hover:opacity-80 truncate"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <span className={session.is_cancelled ? "line-through" : ""}>
          {formatTime(session.start_time)} {session.className ?? ""}
        </span>
      </button>
    );
  };

  // ── Week View ─────────────────────────────────────────────

  const weekDates = getWeekDates(weekStart);

  const renderWeekView = () => (
    <div className="grid grid-cols-6 gap-3">
      {weekDates.map((date) => {
        const daySessions = sessionsByDate[date] ?? [];
        const isToday =
          date ===
          (() => {
            const n = new Date();
            return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
          })();

        return (
          <div key={date} className="min-h-[200px]">
            {/* Day header */}
            <div
              className={`mb-2 rounded-lg px-3 py-2 text-center ${
                isToday
                  ? "bg-[#9C8BBF] text-white"
                  : "bg-white border border-[#D4D1D8]"
              }`}
            >
              <div className={`text-xs font-medium ${isToday ? "text-white/80" : "text-[#9E99A7]"}`}>
                {getDayName(date)}
              </div>
              <div className={`text-sm font-semibold ${isToday ? "text-white" : "text-[#2D2A33]"}`}>
                {formatDateLabel(date)}
              </div>
            </div>

            {/* Sessions */}
            <div className="space-y-1.5">
              {daySessions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D4D1D8] p-3 text-center text-xs text-[#9E99A7]">
                  No sessions
                </div>
              ) : (
                daySessions.map(renderSessionCell)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Month View ────────────────────────────────────────────

  const renderMonthView = () => {
    const { dates, firstDayOffset, monthLabel } = getMonthDates(weekStart);
    const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Fill grid cells
    const cells: Array<{ date: string | null }> = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push({ date: null });
    for (const d of dates) cells.push({ date: d });
    // Pad to complete the last week row
    while (cells.length % 7 !== 0) cells.push({ date: null });

    return (
      <div>
        <div className="mb-3 text-center font-heading text-lg font-semibold text-[#2D2A33]">
          {monthLabel}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-xl border border-[#D4D1D8] bg-[#D4D1D8] overflow-hidden">
          {/* Day headers */}
          {dayHeaders.map((dh) => (
            <div
              key={dh}
              className="bg-[#F0EDF3] px-2 py-1.5 text-center text-xs font-medium text-[#5A5662]"
            >
              {dh}
            </div>
          ))}

          {/* Date cells */}
          {cells.map((cell, i) => {
            if (!cell.date) {
              return <div key={`empty-${i}`} className="min-h-[90px] bg-[#FAF8F3]" />;
            }

            const daySessions = sessionsByDate[cell.date] ?? [];
            const today = (() => {
              const n = new Date();
              return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
            })();
            const isToday = cell.date === today;

            return (
              <div
                key={cell.date}
                className={`min-h-[90px] bg-white p-1 ${isToday ? "ring-2 ring-inset ring-[#9C8BBF]" : ""}`}
              >
                <div
                  className={`mb-0.5 text-xs font-medium ${
                    isToday ? "text-[#9C8BBF]" : "text-[#5A5662]"
                  }`}
                >
                  {parseInt(cell.date.split("-")[2], 10)}
                </div>
                <div className="space-y-0.5">
                  {daySessions.slice(0, 3).map(renderMonthPill)}
                  {daySessions.length > 3 && (
                    <div className="px-1.5 text-[10px] text-[#9E99A7]">
                      +{daySessions.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Side Panel ────────────────────────────────────────────

  const renderSidePanel = () => {
    if (!selectedSession) return null;
    const s = selectedSession;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSelectedSession(null)}
        />

        {/* Panel */}
        <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col transition-transform">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#D4D1D8] p-5">
            <div className="flex-1 min-w-0">
              <h2 className="font-heading text-xl font-semibold text-[#2D2A33] leading-tight">
                {s.className ?? "Untitled Session"}
              </h2>
              <p className="mt-1 text-sm text-[#5A5662]">
                {formatFullDate(s.session_date)}
              </p>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9E99A7] hover:bg-[#F0EDF3] hover:text-[#2D2A33]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Time & Room */}
            <div className="rounded-xl border border-[#D4D1D8] bg-white p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Time</div>
                  <div className="mt-1 text-sm font-medium text-[#2D2A33]">
                    {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Room</div>
                  <div className="mt-1 text-sm font-medium text-[#2D2A33]">
                    {s.room ?? "Not assigned"}
                  </div>
                </div>
              </div>
            </div>

            {/* Teacher */}
            <div className="rounded-xl border border-[#D4D1D8] bg-white p-4">
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Lead Teacher</div>
              <div className="mt-1 text-sm font-medium text-[#2D2A33]">
                {s.teacherName ?? "Not assigned"}
              </div>
              {s.subTeacherName && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Substitute</div>
                  <div className="mt-1 text-sm font-medium text-[#D4A843]">{s.subTeacherName}</div>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Enrolled</div>
                <div className="mt-1 text-2xl font-semibold text-[#2D2A33]">{s.enrollmentCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Status</div>
                <div className="mt-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[s.status] ?? STATUS_STYLES.scheduled
                    }`}
                  >
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Badges */}
            {s.needs_coverage && !s.is_cancelled && (
              <div className="rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/30 p-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-[#D4A843] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium text-[#9B7A2E]">Needs Coverage</span>
              </div>
            )}

            {/* Session Notes */}
            {s.session_notes && (
              <div className="rounded-xl border border-[#D4D1D8] bg-white p-4">
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Session Notes</div>
                <p className="mt-1 text-sm text-[#5A5662] whitespace-pre-wrap">{s.session_notes}</p>
              </div>
            )}

            {/* Cancellation Reason */}
            {s.is_cancelled && s.cancellation_reason && (
              <div className="rounded-xl border border-[#C45B5B]/30 bg-[#C45B5B]/5 p-4">
                <div className="text-xs font-medium text-[#C45B5B] uppercase tracking-wide">Cancellation Reason</div>
                <p className="mt-1 text-sm text-[#5A5662]">{s.cancellation_reason}</p>
              </div>
            )}

            {/* Class Type */}
            <div className="rounded-xl border border-[#D4D1D8] bg-white p-4">
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Class Type</div>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    CLASS_TYPE_COLORS[s.classType ?? "regular"] ?? CLASS_TYPE_COLORS.regular
                  }`}
                >
                  {(s.classType ?? "regular").charAt(0).toUpperCase() + (s.classType ?? "regular").slice(1)}
                </span>
              </div>
            </div>

            {/* Attendance Lock */}
            {s.attendance_locked_at && (
              <div className="rounded-lg bg-[#5A9E6F]/10 border border-[#5A9E6F]/30 p-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-[#5A9E6F] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-[#5A9E6F]">Attendance Submitted</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-[#D4D1D8] p-5 space-y-3">
            {!s.is_cancelled && (
              <>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full rounded-lg border border-[#C45B5B] px-4 py-2.5 text-sm font-medium text-[#C45B5B] hover:bg-[#C45B5B]/5 transition-colors"
                >
                  Cancel Session
                </button>
                <button
                  onClick={() => {
                    /* Assign sub flow - link to substitute page */
                    router.push(`/admin/substitute-requests?session=${s.id}`);
                  }}
                  className="w-full rounded-lg border border-[#D4A843] px-4 py-2.5 text-sm font-medium text-[#9B7A2E] hover:bg-[#D4A843]/5 transition-colors"
                >
                  Assign Substitute
                </button>
              </>
            )}
            <Link
              href={`/admin/schedule/sessions/${s.id}`}
              className="block w-full rounded-lg bg-[#9C8BBF] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#6B5A99] transition-colors"
            >
              View Full Details
            </Link>
          </div>
        </div>
      </>
    );
  };

  // ── Cancel Modal ──────────────────────────────────────────

  const renderCancelModal = () => {
    if (!showCancelModal || !selectedSession) return null;

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 className="font-heading text-lg font-semibold text-[#2D2A33]">Cancel Session</h3>
          <p className="mt-1 text-sm text-[#5A5662]">
            Cancel <span className="font-medium">{selectedSession.className}</span> on{" "}
            {formatFullDate(selectedSession.session_date)}?
          </p>

          <div className="mt-4">
            <label className="block text-sm font-medium text-[#2D2A33]">Reason for cancellation</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-[#D4D1D8] px-3 py-2 text-sm text-[#2D2A33] placeholder-[#9E99A7] focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
              placeholder="e.g., Teacher illness, weather, facility issue..."
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowCancelModal(false);
                setCancelReason("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleCancelSession}
              disabled={!cancelReason.trim() || isPending}
              className="rounded-lg bg-[#C45B5B] px-4 py-2 text-sm font-medium text-white hover:bg-[#A84545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Pay Decision Modal ────────────────────────────────────

  const renderPayModal = () => {
    if (!showPayModal || !selectedSession) return null;

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 className="font-heading text-lg font-semibold text-[#2D2A33]">Pay Decision</h3>
          <p className="mt-1 text-sm text-[#5A5662]">
            Should <span className="font-medium">{selectedSession.teacherName ?? "the teacher"}</span> receive
            pay for this cancelled session?
          </p>

          <div className="mt-5 space-y-2">
            <button
              onClick={() => handlePayDecision("full")}
              disabled={isPending}
              className="w-full rounded-lg border border-[#5A9E6F] px-4 py-2.5 text-sm font-medium text-[#5A9E6F] hover:bg-[#5A9E6F]/5 disabled:opacity-50 transition-colors"
            >
              Pay Full
            </button>

            {/* Reduced rate */}
            <div className="rounded-lg border border-[#D4A843] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={reducedRate}
                  onChange={(e) => setReducedRate(e.target.value)}
                  placeholder="Rate $"
                  className="flex-1 rounded-lg border border-[#D4D1D8] px-3 py-2 text-sm text-[#2D2A33] placeholder-[#9E99A7] focus:border-[#D4A843] focus:outline-none focus:ring-1 focus:ring-[#D4A843]"
                />
                <button
                  onClick={() => handlePayDecision("reduced")}
                  disabled={!reducedRate || isPending}
                  className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-medium text-white hover:bg-[#9B7A2E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Pay Reduced
                </button>
              </div>
            </div>

            <button
              onClick={() => handlePayDecision("none")}
              disabled={isPending}
              className="w-full rounded-lg border border-[#C45B5B] px-4 py-2.5 text-sm font-medium text-[#C45B5B] hover:bg-[#C45B5B]/5 disabled:opacity-50 transition-colors"
            >
              No Pay
            </button>

            <button
              onClick={() => handlePayDecision("decide_later")}
              disabled={isPending}
              className="w-full rounded-lg border border-[#D4D1D8] px-4 py-2.5 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] disabled:opacity-50 transition-colors"
            >
              Decide Later
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────

  const hasActiveFilters = teacherFilter || classTypeFilter || roomFilter;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#2D2A33]">Schedule</h1>
          <p className="mt-1 text-sm text-[#5A5662]">{getWeekLabel(weekStart)}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-[#D4D1D8] bg-white">
            <button
              onClick={() => setView("week")}
              className={`rounded-l-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "week"
                  ? "bg-[#9C8BBF] text-white"
                  : "text-[#5A5662] hover:bg-[#F0EDF3]"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`rounded-r-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "month"
                  ? "bg-[#9C8BBF] text-white"
                  : "text-[#5A5662] hover:bg-[#F0EDF3]"
              }`}
            >
              Month
            </button>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(shiftWeek(weekStart, -1))}
              className="rounded-lg border border-[#D4D1D8] bg-white px-3 py-1.5 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => navigate(getThisWeekMonday())}
              className="rounded-lg border border-[#D4D1D8] bg-white px-3 py-1.5 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => navigate(shiftWeek(weekStart, 1))}
              className="rounded-lg border border-[#D4D1D8] bg-white px-3 py-1.5 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-xl border border-[#D4D1D8] bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Teacher filter */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-[#9E99A7] uppercase tracking-wide mb-1">Teacher</label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D4D1D8] px-3 py-2 text-sm text-[#2D2A33] bg-white focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Type filter */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-[#9E99A7] uppercase tracking-wide mb-1">Class Type</label>
            <select
              value={classTypeFilter}
              onChange={(e) => setClassTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D4D1D8] px-3 py-2 text-sm text-[#2D2A33] bg-white focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
            >
              <option value="">All Types</option>
              {CLASS_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* Room filter */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-[#9E99A7] uppercase tracking-wide mb-1">Room</label>
            <input
              type="text"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder="Any room"
              className="w-full rounded-lg border border-[#D4D1D8] px-3 py-2 text-sm text-[#2D2A33] placeholder-[#9E99A7] focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={applyFilters}
              className="rounded-lg bg-[#9C8BBF] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B5A99] transition-colors"
            >
              Apply
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#9E99A7] hover:text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session Count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#5A5662]">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} this week
        </p>
        {hasActiveFilters && (
          <span className="inline-block rounded-full bg-[#9C8BBF]/15 px-2.5 py-0.5 text-xs font-medium text-[#6B5A99]">
            Filtered
          </span>
        )}
      </div>

      {/* Calendar Grid */}
      {view === "week" ? renderWeekView() : renderMonthView()}

      {/* Side Panel */}
      {renderSidePanel()}

      {/* Cancel Modal */}
      {renderCancelModal()}

      {/* Pay Decision Modal */}
      {renderPayModal()}
    </div>
  );
}
