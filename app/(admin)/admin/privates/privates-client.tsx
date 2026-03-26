"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cancelPrivateSession, updatePrivateSessionStatus } from "./actions";

interface PrivateSessionRow {
  id: string;
  session_type: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  studio: string | null;
  student_ids: string[];
  primary_teacher_id: string | null;
  status: string;
  billing_status: string;
  billing_model: string | null;
  is_recurring: boolean;
  session_rate: number | null;
}

interface BillingRow {
  id: string;
  student_id: string;
  split_percentage: number;
  amount_owed: number;
  market_value: number | null;
  studio_contribution: number;
  billing_status: string;
  payment_method: string | null;
  paid_at: string | null;
}

interface SessionDetail {
  session_notes: string | null;
  parent_visible_notes: string | null;
  co_teacher_ids: string[] | null;
  recurrence_rule: string | null;
}

function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_BADGE: Record<string, string> = {
  solo: "bg-lavender/10 text-lavender-dark",
  duet: "bg-info/10 text-info",
  group: "bg-gold/10 text-gold-dark",
  pilates: "bg-success/10 text-success",
  hybrid: "bg-cloud text-slate",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-info/10 text-info",
  confirmed: "bg-success/10 text-success",
  completed: "bg-cloud text-charcoal",
  cancelled: "bg-error/10 text-error",
};

const BILLING_BADGE: Record<string, string> = {
  pending: "bg-gold/10 text-gold-dark",
  billed: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  waived: "bg-cloud text-charcoal",
};

const SESSION_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "solo", label: "Solo" },
  { value: "duet", label: "Duet" },
  { value: "group", label: "Group" },
  { value: "pilates", label: "Pilates" },
  { value: "hybrid", label: "Hybrid" },
];

const BILLING_STATUS_OPTIONS = [
  { value: "all", label: "All Billing" },
  { value: "pending", label: "Pending" },
  { value: "billed", label: "Billed" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
];

export function PrivatesClient({
  sessions,
  teacherMap,
  studentMap,
  billingMap,
  teachers,
  stats,
}: {
  sessions: PrivateSessionRow[];
  teacherMap: Record<string, string>;
  studentMap: Record<string, string>;
  billingMap: Record<string, { pending: number; paid: number }>;
  teachers: { id: string; name: string }[];
  stats: { thisWeek: number; pendingBilling: number; thisMonth: number };
}) {
  const router = useRouter();
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterBilling, setFilterBilling] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedSession, setSelectedSession] = useState<PrivateSessionRow | null>(null);
  const [drawerBilling, setDrawerBilling] = useState<BillingRow[]>([]);
  const [drawerDetail, setDrawerDetail] = useState<SessionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  async function openSessionDrawer(session: PrivateSessionRow) {
    setSelectedSession(session);
    setDrawerLoading(true);
    setDrawerBilling([]);
    setDrawerDetail(null);

    try {
      const supabase = createClient();

      // Fetch billing rows for this session
      const { data: billingRows } = await supabase
        .from("private_session_billing")
        .select("id, student_id, split_percentage, amount_owed, market_value, studio_contribution, billing_status, payment_method, paid_at")
        .eq("session_id", session.id);

      setDrawerBilling(billingRows ?? []);

      // Fetch additional session details not in the list query
      const { data: detail } = await supabase
        .from("private_sessions")
        .select("session_notes, parent_visible_notes, co_teacher_ids, recurrence_rule")
        .eq("id", session.id)
        .single();

      setDrawerDetail(detail ?? null);
    } catch (err) {
      console.error("[privates:drawer] Failed to load details:", err);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedSession(null);
    setDrawerBilling([]);
    setDrawerDetail(null);
  }

  const teacherOptions = [
    { value: "all", label: "All Teachers" },
    ...teachers.map((t) => ({ value: t.id, label: t.name })),
  ];

  const filtered = sessions.filter((s) => {
    if (filterTeacher !== "all" && s.primary_teacher_id !== filterTeacher) return false;
    if (filterType !== "all" && s.session_type !== filterType) return false;
    if (filterBilling !== "all" && s.billing_status !== filterBilling) return false;
    if (dateFrom && s.session_date < dateFrom) return false;
    if (dateTo && s.session_date > dateTo) return false;
    return true;
  });

  function renderStudents(studentIds: string[]) {
    if (!studentIds || studentIds.length === 0) return <span className="text-slate">—</span>;
    const names = studentIds
      .map((id) => studentMap[id] || "Unknown")
      .slice(0, 3);
    const extra = studentIds.length - 3;
    return (
      <span>
        {names.join(", ")}
        {extra > 0 && <span className="text-slate ml-1">+{extra} more</span>}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Privates
          </h1>
          <p className="text-sm text-slate mt-1">
            Manage private lesson sessions and billing
          </p>
        </div>
        <Link
          href="/admin/privates/new"
          className="inline-flex items-center gap-2 rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          + New Private
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-sm text-slate">This Week</p>
          <p className="text-2xl font-semibold text-charcoal mt-1">
            {stats.thisWeek}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-sm text-slate">Pending Billing</p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              stats.pendingBilling > 0 ? "text-gold-dark" : "text-charcoal"
            }`}
          >
            {stats.pendingBilling}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-sm text-slate">This Month</p>
          <p className="text-2xl font-semibold text-charcoal mt-1">
            {stats.thisMonth}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <SimpleSelect
            value={filterTeacher}
            onValueChange={setFilterTeacher}
            options={teacherOptions}
            placeholder="All Teachers"
          />
        </div>
        <div className="w-40">
          <SimpleSelect
            value={filterType}
            onValueChange={setFilterType}
            options={SESSION_TYPE_OPTIONS}
            placeholder="All Types"
          />
        </div>
        <div className="w-40">
          <SimpleSelect
            value={filterBilling}
            onValueChange={setFilterBilling}
            options={BILLING_STATUS_OPTIONS}
            placeholder="All Billing"
          />
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
            />
          </div>
        </div>
      </div>

      {/* Session count */}
      <p className="text-sm text-slate">{filtered.length} sessions</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white py-16 text-center">
          <p className="text-slate">No private sessions found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cream/50">
                  <th className="text-left px-4 py-3 font-medium text-slate">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Studio</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Students</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Teacher</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate">Billing</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-silver/50 hover:bg-cream/30 transition-colors cursor-pointer"
                    onClick={() => openSessionDrawer(s)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(s.session_date)}
                      {s.is_recurring && (
                        <span className="ml-1 text-lavender" title="Recurring">
                          ↻
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-charcoal">
                      {formatTime(s.start_time)}
                      {s.end_time ? ` – ${formatTime(s.end_time)}` : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-charcoal">
                      {s.studio || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          TYPE_BADGE[s.session_type] || "bg-cloud text-slate"
                        }`}
                      >
                        {s.session_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-charcoal">
                      {renderStudents(s.student_ids)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-charcoal">
                      {s.primary_teacher_id
                        ? teacherMap[s.primary_teacher_id] || "Unknown"
                        : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-charcoal">
                      {s.duration_minutes} min
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_BADGE[s.status] || "bg-cloud text-slate"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          BILLING_BADGE[s.billing_status] || "bg-cloud text-slate"
                        }`}
                      >
                        {s.billing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Detail Drawer */}
      {selectedSession && (
        <SessionDetailDrawer
          session={selectedSession}
          billing={drawerBilling}
          detail={drawerDetail}
          loading={drawerLoading}
          teacherMap={teacherMap}
          studentMap={studentMap}
          onClose={closeDrawer}
          onStatusUpdate={async (status: string) => {
            const fd = new FormData();
            fd.set("session_id", selectedSession.id);
            fd.set("status", status);
            const result = await updatePrivateSessionStatus(fd);
            if (!result.error) {
              closeDrawer();
              router.refresh();
            }
          }}
          onCancel={async () => {
            const fd = new FormData();
            fd.set("session_id", selectedSession.id);
            const result = await cancelPrivateSession(fd);
            if (!result.error) {
              closeDrawer();
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionDetailDrawer
// ---------------------------------------------------------------------------

function SessionDetailDrawer({
  session,
  billing,
  detail,
  loading,
  teacherMap,
  studentMap,
  onClose,
  onStatusUpdate,
  onCancel,
}: {
  session: PrivateSessionRow;
  billing: BillingRow[];
  detail: SessionDetail | null;
  loading: boolean;
  teacherMap: Record<string, string>;
  studentMap: Record<string, string>;
  onClose: () => void;
  onStatusUpdate: (status: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const hasStudioContribution = billing.some((b) => b.studio_contribution > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                TYPE_BADGE[session.session_type] || "bg-cloud text-slate"
              }`}
            >
              {session.session_type}
            </span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                STATUS_BADGE[session.status] || "bg-cloud text-slate"
              }`}
            >
              {session.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate hover:text-charcoal transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Date / Time */}
            <div>
              <h3 className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                Date &amp; Time
              </h3>
              <p className="text-sm text-charcoal">
                {formatDate(session.session_date)}
              </p>
              <p className="text-sm text-charcoal">
                {formatTime(session.start_time)}
                {session.end_time ? ` \u2013 ${formatTime(session.end_time)}` : ""}
                {session.duration_minutes ? ` (${session.duration_minutes} min)` : ""}
              </p>
            </div>

            {/* Studio */}
            <div>
              <h3 className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                Studio
              </h3>
              <p className="text-sm text-charcoal">{session.studio || "\u2014"}</p>
            </div>

            {/* Teacher */}
            <div>
              <h3 className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                Teacher
              </h3>
              <p className="text-sm text-charcoal">
                {session.primary_teacher_id
                  ? teacherMap[session.primary_teacher_id] || "Unknown"
                  : "\u2014"}
              </p>
              {detail?.co_teacher_ids && detail.co_teacher_ids.length > 0 && (
                <p className="text-xs text-slate mt-0.5">
                  Co-teachers:{" "}
                  {detail.co_teacher_ids
                    .map((id) => teacherMap[id] || "Unknown")
                    .join(", ")}
                </p>
              )}
            </div>

            {/* Recurring */}
            {session.is_recurring && (
              <div>
                <span className="inline-block rounded-full bg-lavender/10 text-lavender-dark px-2 py-0.5 text-xs font-medium">
                  Recurring
                </span>
                {detail?.recurrence_rule && (
                  <span className="text-xs text-slate ml-2">
                    {detail.recurrence_rule}
                  </span>
                )}
              </div>
            )}

            {/* Students & Billing */}
            <div>
              <h3 className="text-xs font-medium text-slate uppercase tracking-wide mb-2">
                Students &amp; Billing
              </h3>
              {billing.length === 0 ? (
                <p className="text-sm text-slate">No billing records</p>
              ) : (
                <div className="space-y-3">
                  {billing.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border border-silver p-3 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-charcoal">
                          {studentMap[b.student_id] || "Unknown Student"}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            BILLING_BADGE[b.billing_status] || "bg-cloud text-slate"
                          }`}
                        >
                          {b.billing_status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate">
                        <span>Split: {b.split_percentage}%</span>
                        <span>Amount: ${b.amount_owed.toFixed(2)}</span>
                        {b.market_value != null && (
                          <span>Market value: ${b.market_value.toFixed(2)}</span>
                        )}
                        {b.studio_contribution > 0 && (
                          <span>Studio contribution: ${b.studio_contribution.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Studio Contribution Box */}
            {hasStudioContribution && (() => {
              const contrib = billing.find((b) => b.studio_contribution > 0)!;
              return (
                <div className="rounded-lg bg-lavender/10 border border-lavender/20 p-4">
                  <p className="text-sm font-medium text-lavender-dark mb-1">
                    Studio contributes to this session
                  </p>
                  <p className="text-xs text-slate">
                    Full value: ${contrib.market_value?.toFixed(2) ?? "\u2014"}
                    {" | "}Rate charged: ${contrib.amount_owed.toFixed(2)}
                    {" | "}BAM covers: ${contrib.studio_contribution.toFixed(2)}
                  </p>
                </div>
              );
            })()}

            {/* Notes */}
            {(detail?.session_notes || detail?.parent_visible_notes) && (
              <div>
                <h3 className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                  Notes
                </h3>
                {detail.session_notes && (
                  <div className="mb-2">
                    <p className="text-xs text-slate">Internal</p>
                    <p className="text-sm text-charcoal whitespace-pre-wrap">
                      {detail.session_notes}
                    </p>
                  </div>
                )}
                {detail.parent_visible_notes && (
                  <div>
                    <p className="text-xs text-slate">Parent-visible</p>
                    <p className="text-sm text-charcoal whitespace-pre-wrap">
                      {detail.parent_visible_notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {session.status !== "cancelled" && session.status !== "completed" && (
              <div className="border-t border-silver pt-4 flex items-center gap-3">
                <button
                  disabled={actionLoading}
                  onClick={async () => {
                    setActionLoading(true);
                    await onStatusUpdate("completed");
                    setActionLoading(false);
                  }}
                  className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  Mark Complete
                </button>
                {!confirming ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => setConfirming(true)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                  >
                    Cancel Session
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate">Are you sure?</span>
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        await onCancel();
                        setActionLoading(false);
                        setConfirming(false);
                      }}
                      className="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 transition-colors disabled:opacity-50"
                    >
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate hover:bg-cloud transition-colors"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
