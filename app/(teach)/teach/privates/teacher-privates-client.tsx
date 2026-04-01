"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPrivateSession, declinePrivateSession } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  tenant_id: string;
  session_type: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  studio: string | null;
  student_ids: string[];
  co_teacher_ids: string[] | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  status: string;
  session_notes: string | null;
  parent_visible_notes: string | null;
  booking_source: string | null;
  availability_slot_id: string | null;
}

interface Props {
  sessions: Session[];
  studentMap: Record<string, string>;
  teacherId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(t: string): string {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === "00" ? `${display}${suffix}` : `${display}:${mm}${suffix}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${days[d.getDay()]} ${month} ${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function groupSessions(sessions: Session[]) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const thirtyOut = new Date(todayStart);
  thirtyOut.setDate(thirtyOut.getDate() + 30);

  const today: Session[] = [];
  const thisWeek: Session[] = [];
  const upcoming: Session[] = [];
  const past: Session[] = [];

  for (const s of sessions) {
    const d = new Date(s.session_date + "T00:00:00");
    const ds = startOfDay(d);
    if (ds.getTime() === todayStart.getTime()) today.push(s);
    else if (ds > todayStart && ds < weekEnd) thisWeek.push(s);
    else if (ds >= weekEnd && ds <= thirtyOut) upcoming.push(s);
    else if (ds < todayStart) past.push(s);
    else upcoming.push(s); // beyond 30 days still goes to upcoming
  }

  return { today, thisWeek, upcoming, past };
}

const TYPE_COLORS: Record<string, string> = {
  solo: "bg-lavender/20 text-dark-lavender",
  duet: "bg-blue-100 text-blue-700",
  group: "bg-amber-100 text-amber-700",
  pilates: "bg-emerald-100 text-emerald-700",
  hybrid: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-orange-100 text-orange-600",
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  studentMap,
}: {
  session: Session;
  studentMap: Record<string, string>;
}) {
  const studentNames = (session.student_ids ?? []).map(
    (id) => studentMap[id] || "Unknown"
  );
  const typeKey = (session.session_type || "solo").toLowerCase();
  const typeColor = TYPE_COLORS[typeKey] || "bg-gray-100 text-gray-600";
  const statusColor = STATUS_COLORS[session.status] || "bg-gray-100 text-gray-600";

  return (
    <div className="rounded-lg border border-silver/60 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}>
              {session.session_type || "solo"}
            </span>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
              {session.status}
            </span>
            {session.is_recurring && (
              <span className="text-xs text-gray-400" title="Recurring session">
                &#x21BB;
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-charcoal truncate">
            {studentNames.length > 0 ? studentNames.join(", ") : "No students"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(session.session_date)} &middot;{" "}
            {formatTime(session.start_time)}&ndash;{formatTime(session.end_time)}
            {session.duration_minutes ? ` (${session.duration_minutes}m)` : ""}
          </p>
        </div>
        {session.studio && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {session.studio}
          </span>
        )}
      </div>
      {/* Confirm/Decline for parent-booked sessions */}
      {session.booking_source === "parent" && session.status === "scheduled" && (
        <ParentBookingActions sessionId={session.id} />
      )}
    </div>
  );
}

function ParentBookingActions({ sessionId }: { sessionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      await confirmPrivateSession(fd);
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      await declinePrivateSession(fd);
      setDeclining(false);
    });
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-silver/50">
      <span className="text-xs text-gold-dark font-medium mr-auto">Parent booking — awaiting your confirmation</span>
      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="h-7 rounded-md bg-success hover:bg-success/90 text-white text-xs font-semibold px-3 disabled:opacity-50"
      >
        Confirm
      </button>
      {!declining ? (
        <button
          onClick={() => setDeclining(true)}
          disabled={isPending}
          className="h-7 rounded-md border border-error/30 text-error text-xs font-medium px-3 disabled:opacity-50"
        >
          Decline
        </button>
      ) : (
        <span className="flex items-center gap-1">
          <span className="text-xs text-slate">Decline?</span>
          <button onClick={handleDecline} disabled={isPending} className="text-xs text-error font-semibold disabled:opacity-50">Yes</button>
          <button onClick={() => setDeclining(false)} className="text-xs text-slate">No</button>
        </span>
      )}
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  studentMap,
}: {
  title: string;
  sessions: Session[];
  studentMap: Record<string, string>;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wide">
          {title}
        </h2>
        <span className="inline-flex items-center justify-center rounded-full bg-lavender/20 text-dark-lavender text-xs font-medium px-2 py-0.5">
          {sessions.length}
        </span>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No sessions</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} studentMap={studentMap} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function TeacherPrivatesClient({ sessions, studentMap, teacherId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const searchParams = useSearchParams();
  const { today, thisWeek, upcoming, past } = groupSessions(sessions);

  // Derive tenantId from first session (teacher always belongs to one tenant)
  const tenantId = sessions[0]?.tenant_id ?? "";

  useEffect(() => {
    if (searchParams.get("book") === "1") setShowForm(true);
  }, [searchParams]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-charcoal" style={{ fontFamily: "var(--font-heading, 'Cormorant Garamond', serif)" }}>
          My Privates
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-dark-lavender transition-colors"
        >
          + New Private
        </button>
      </div>

      <SessionGroup title="Today" sessions={today} studentMap={studentMap} />
      <SessionGroup title="This Week" sessions={thisWeek} studentMap={studentMap} />
      <SessionGroup title="Upcoming" sessions={upcoming} studentMap={studentMap} />
      <SessionGroup title="Past" sessions={past} studentMap={studentMap} />

      {showForm && tenantId && (
        <PrivateSessionFormLazy
          tenantId={tenantId}
          defaultTeacherId={teacherId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// Lazy-load the form to keep initial bundle small
function PrivateSessionFormLazy(props: {
  tenantId: string;
  defaultTeacherId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Dynamic import would be ideal, but for simplicity import directly
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrivateSessionForm } = require("@/components/admin/private-session-form");
  return <PrivateSessionForm {...props} />;
}
