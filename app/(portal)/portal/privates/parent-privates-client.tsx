"use client";
import { useState } from "react";

interface PrivateSession {
  id: string;
  session_type: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  studio: string | null;
  student_ids: string[];
  primary_teacher_id: string | null;
  status: string;
  booking_source: string | null;
  is_recurring: boolean;
  parent_visible_notes: string | null;
}

interface BillingRow {
  id: string;
  session_id: string;
  student_id: string;
  amount_owed: number | null;
  market_value: number | null;
  studio_contribution: number | null;
  teacher_contribution_note: string | null;
  billing_status: string;
  payment_method: string | null;
}

interface Props {
  sessions: PrivateSession[];
  billing: BillingRow[];
  teacherMap: Record<string, string>;
  studentMap: Record<string, string>;
  showContribution: boolean;
}

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${ampm}`;
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number | null) {
  return n == null ? "$0.00" : `$${n.toFixed(2)}`;
}

const TYPE_COLORS: Record<string, string> = {
  solo: "bg-lavender/10 text-lavender-dark",
  duet: "bg-info/10 text-info",
  group: "bg-gold/10 text-gold",
  pilates: "bg-success/10 text-success",
  hybrid: "bg-slate/10 text-slate",
};
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  cancelled: "bg-rose-100 text-rose-600",
};
const BILLING_COLORS: Record<string, string> = {
  pending: "bg-gold/10 text-gold",
  paid: "bg-success/10 text-success",
  deducted_from_pack: "bg-info/10 text-info",
  waived: "bg-cloud text-slate",
};

export function ParentPrivatesClient({ sessions, billing, teacherMap, studentMap, showContribution }: Props) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const today = new Date().toISOString().split("T")[0];
  const upcoming = sessions.filter((s) => s.session_date >= today && s.status !== "cancelled").sort((a, b) => a.session_date.localeCompare(b.session_date));
  const past = sessions.filter((s) => s.session_date < today || s.status === "cancelled").sort((a, b) => b.session_date.localeCompare(a.session_date));
  const displayed = tab === "upcoming" ? upcoming : past;

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-8 text-center">
        <p className="text-sm text-slate">No private sessions yet. Book your first private lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-lavender/10 text-lavender-dark" : "text-slate hover:bg-cloud hover:text-charcoal"
            }`}
          >
            {t === "upcoming" ? "Upcoming" : "Past"} ({t === "upcoming" ? upcoming.length : past.length})
          </button>
        ))}
      </div>
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-6 text-center">
          <p className="text-sm text-slate">{tab === "upcoming" ? "No upcoming private sessions." : "No past private sessions."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              billing={billing.filter((b) => b.session_id === session.id)}
              teacherMap={teacherMap}
              studentMap={studentMap}
              showContribution={showContribution}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, billing: billingRows, teacherMap, studentMap, showContribution }: {
  session: PrivateSession; billing: BillingRow[]; teacherMap: Record<string, string>;
  studentMap: Record<string, string>; showContribution: boolean;
}) {
  const studentNames = (session.student_ids ?? []).map((id) => studentMap[id] || "Student").join(", ");
  const teacherName = session.primary_teacher_id ? teacherMap[session.primary_teacher_id] || "Teacher" : null;
  const primaryBilling = billingRows[0] ?? null;
  const showBox = showContribution && primaryBilling && (primaryBilling.studio_contribution ?? 0) > 0;

  return (
    <div className="rounded-xl border border-silver bg-white p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[session.session_type] ?? "bg-cloud text-slate"}`}>
            {session.session_type}
          </span>
          {session.is_recurring && <span className="text-[10px] text-slate font-medium">Recurring</span>}
          {session.booking_source === "parent" && <span className="text-[10px] text-mist font-medium">You booked this</span>}
        </div>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[session.status] ?? "bg-cloud text-slate"}`}>
          {session.status}
        </span>
      </div>
      <div className="text-sm text-charcoal font-medium">
        {formatDate(session.session_date)}<span className="mx-1.5 text-mist">|</span>
        {formatTime(session.start_time)} &ndash; {formatTime(session.end_time)}
        {session.duration_minutes && <span className="ml-1 text-xs text-slate">({session.duration_minutes} min)</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate">
        {teacherName && <span>Teacher: {teacherName}</span>}
        {session.studio && <span>Studio: {session.studio}</span>}
        <span>Students: {studentNames}</span>
      </div>
      {session.parent_visible_notes && <p className="text-xs italic text-mist">{session.parent_visible_notes}</p>}
      {billingRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {billingRows.map((b) => (
            <span key={b.id} className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${BILLING_COLORS[b.billing_status] ?? "bg-cloud text-slate"}`}>
              {studentMap[b.student_id] || "Student"}: {b.billing_status.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
      {showBox && (
        <div className="mt-3 rounded-lg border border-lavender/20 bg-lavender/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-lavender-dark">Session Value Breakdown</p>
          <div className="flex justify-between text-xs text-slate">
            <span>Full session value:</span><span>{formatCurrency(primaryBilling.market_value)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate">
            <span>Your rate today:</span><span>{formatCurrency(primaryBilling.amount_owed)}</span>
          </div>
          <div className="border-t border-lavender/20 pt-1 flex justify-between text-xs font-medium text-lavender-dark">
            <span>BAM contribution:</span><span>{formatCurrency(primaryBilling.studio_contribution)}</span>
          </div>
          <p className="text-[10px] text-mist italic">
            {primaryBilling.teacher_contribution_note || `Our studio is investing in ${studentNames}'s growth.`}
          </p>
        </div>
      )}
    </div>
  );
}
