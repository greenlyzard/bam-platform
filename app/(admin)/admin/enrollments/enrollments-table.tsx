"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface EnrollmentRow {
  id: string;
  studentName: string;
  studentId: string | null;
  className: string;
  classId: string | null;
  enrolledAt: string | null;
  enrollmentType: string;
  status: string;
  amountPaidCents: number | null;
  hasStripePayment: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success",
  trial: "bg-info/10 text-info",
  waitlist: "bg-warning/10 text-warning",
  dropped: "bg-error/10 text-error",
  completed: "bg-mist/10 text-mist",
  pending_payment: "bg-warning/10 text-warning",
  suspended: "bg-error/10 text-error",
  cancelled: "bg-error/10 text-error",
};

const TYPE_COLORS: Record<string, string> = {
  paid: "bg-success/10 text-success",
  full: "bg-success/10 text-success",
  trial: "bg-info/10 text-info",
  comp: "bg-lavender/10 text-lavender-dark",
  staff: "bg-lavender/10 text-lavender-dark",
  audit: "bg-mist/10 text-mist",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

export function EnrollmentsTable({
  enrollments,
}: {
  enrollments: EnrollmentRow[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = enrollments;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.studentName.toLowerCase().includes(q) ||
          e.className.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => e.enrollmentType === typeFilter);
    }

    return result;
  }, [enrollments, search, statusFilter, typeFilter]);

  const statuses = useMemo(
    () => [...new Set(enrollments.map((e) => e.status))].sort(),
    [enrollments]
  );
  const types = useMemo(
    () => [...new Set(enrollments.map((e) => e.enrollmentType))].sort(),
    [enrollments]
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search students or classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none w-64"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <span className="flex items-center text-xs text-mist ml-auto">
          {filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-silver bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver bg-cloud/50">
              <th className="text-left px-4 py-3 font-medium text-slate">
                Student
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Class
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Enrolled
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Type
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Status
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate">
                Paid
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-sm text-mist"
                >
                  No enrollments found.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-silver/50 hover:bg-cloud/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {e.studentName}
                  </td>
                  <td className="px-4 py-3 text-slate">{e.className}</td>
                  <td className="px-4 py-3 text-slate">
                    {formatDate(e.enrolledAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        TYPE_COLORS[e.enrollmentType] ?? "bg-mist/10 text-mist"
                      }`}
                    >
                      {e.enrollmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[e.status] ?? "bg-mist/10 text-mist"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate">
                    {e.amountPaidCents
                      ? formatCurrency(e.amountPaidCents)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
