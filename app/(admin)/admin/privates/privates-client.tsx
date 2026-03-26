"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import Link from "next/link";

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
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterBilling, setFilterBilling] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
                    onClick={() => {
                      // TODO: open session detail
                    }}
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
    </div>
  );
}
