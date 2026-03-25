"use client";

import { useState } from "react";
import Link from "next/link";
import { SimpleSelect } from "@/components/ui/select";
import { markEntriesAsPaid } from "../actions";

/** Wraps SimpleSelect with a hidden input for native form submission */
function FormSelect({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SimpleSelect
        value={value}
        onValueChange={(val) => setValue(val === "__all__" ? "" : val)}
        options={[{ value: "__all__", label: placeholder }, ...options]}
        placeholder={placeholder}
      />
    </>
  );
}

interface TeacherPayroll {
  id: string;
  name: string;
  email: string;
  employmentType: string;
  rates: { class: number; private: number; rehearsal: number; admin: number } | null;
  hours: {
    class: number;
    private: number;
    rehearsal: number;
    admin: number;
    other: number;
    total: number;
  };
  totalOwed: number;
  entries: {
    id: string;
    date: string;
    entry_type: string;
    total_hours: number;
    description: string | null;
    sub_for: string | null;
    production_id: string | null;
    production_name: string | null;
    event_tag: string | null;
    notes: string | null;
    timesheet_status: string;
  }[];
  hasMissingRates: boolean;
}

interface PayrollReportProps {
  dateFrom: string;
  dateTo: string;
  w2Teachers: TeacherPayroll[];
  contractorTeachers: TeacherPayroll[];
  totalW2Owed: number;
  total1099Owed: number;
  totalHours: number;
  missingRatesCount: number;
  teacherList: { id: string; name: string }[];
  productions: { id: string; name: string }[];
  filterTeacher: string;
  filterProduction: string;
  filterEmpType: string;
  filterStatus: string;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  class_lead: "Class",
  class_assistant: "Class (Asst)",
  private: "Private",
  rehearsal: "Rehearsal",
  admin: "Admin",
  performance_event: "Performance",
  competition: "Competition",
  training: "Training",
  substitute: "Substitute",
  bonus: "Other",
};

const STATUS_BORDER: Record<string, string> = {
  approved: "border-l-4 border-l-success",
  submitted: "border-l-4 border-l-warning",
  draft: "border-l-4 border-l-warning",
  rejected: "border-l-4 border-l-error",
  exported: "border-l-4 border-l-success",
};

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function buildFilterUrl(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  return `/admin/timesheets/payroll?${search.toString()}`;
}

export function PayrollReport({
  dateFrom,
  dateTo,
  w2Teachers,
  contractorTeachers,
  totalW2Owed,
  total1099Owed,
  totalHours,
  missingRatesCount,
  teacherList,
  productions,
  filterTeacher,
  filterProduction,
  filterEmpType,
  filterStatus,
}: PayrollReportProps) {
  const allTeachers = [...w2Teachers, ...contractorTeachers];
  const totalTeachers = allTeachers.filter((t) => t.entries.length > 0).length;

  function handleExportCsv() {
    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    // Summary sheet
    const summaryHeaders = [
      "Teacher",
      "Email",
      "Employment Type",
      "Class Hours",
      "Private Hours",
      "Rehearsal Hours",
      "Admin Hours",
      "Other Hours",
      "Total Hours",
      "Class Rate",
      "Private Rate",
      "Rehearsal Rate",
      "Admin Rate",
      "Total Owed",
    ];

    const summaryRows = allTeachers
      .filter((t) => t.entries.length > 0)
      .map((t) => [
        escape(t.name),
        escape(t.email),
        t.employmentType === "1099" ? "1099 Contractor" : "W-2 Employee",
        t.hours.class.toFixed(2),
        t.hours.private.toFixed(2),
        t.hours.rehearsal.toFixed(2),
        t.hours.admin.toFixed(2),
        t.hours.other.toFixed(2),
        t.hours.total.toFixed(2),
        t.rates?.class.toFixed(2) ?? "",
        t.rates?.private.toFixed(2) ?? "",
        t.rates?.rehearsal.toFixed(2) ?? "",
        t.rates?.admin.toFixed(2) ?? "",
        t.totalOwed.toFixed(2),
      ]);

    // Detail sheet
    const detailHeaders = [
      "Teacher",
      "Employment Type",
      "Date",
      "Category",
      "Hours",
      "Description",
      "Sub For",
      "Production",
      "Event Tag",
      "Notes",
      "Status",
    ];

    const detailRows = allTeachers.flatMap((t) =>
      t.entries.map((e) => [
        escape(t.name),
        t.employmentType === "1099" ? "1099" : "W-2",
        e.date,
        ENTRY_TYPE_LABELS[e.entry_type] ?? e.entry_type,
        e.total_hours.toFixed(2),
        escape(e.description ?? ""),
        escape(e.sub_for ?? ""),
        escape(e.production_name ?? ""),
        escape(e.event_tag ?? ""),
        escape(e.notes ?? ""),
        e.timesheet_status,
      ])
    );

    const csv = [
      "--- SUMMARY ---",
      summaryHeaders.join(","),
      ...summaryRows.map((r) => r.join(",")),
      "",
      "--- DETAIL ---",
      detailHeaders.join(","),
      ...detailRows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/timesheets"
              className="text-xs text-lavender hover:text-lavender-dark"
            >
              ← Timesheets
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
            Payroll Report
          </h1>
          <p className="mt-1 text-sm text-slate">
            {new Date(dateFrom + "T12:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            —{" "}
            {new Date(dateTo + "T12:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <MarkAsPaidButton dateFrom={dateFrom} dateTo={dateTo} />
          <button
            onClick={handleExportCsv}
            className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-sm font-medium text-charcoal px-4 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Missing Rates Warning */}
      {missingRatesCount > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 text-sm text-warning">
          ⚠️ {missingRatesCount} teacher{missingRatesCount !== 1 ? "s have" : " has"} no pay rates configured. Set rates in{" "}
          <Link
            href="/admin/settings/pay-rates"
            className="underline font-medium"
          >
            Settings → Pay Rates
          </Link>{" "}
          before running payroll.
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-silver bg-white p-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              From
            </label>
            <input
              name="from"
              type="date"
              defaultValue={dateFrom}
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              To
            </label>
            <input
              name="to"
              type="date"
              defaultValue={dateTo}
              className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Teacher
            </label>
            <FormSelect
              name="teacher"
              defaultValue={filterTeacher}
              options={teacherList.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="All Teachers"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Production
            </label>
            <FormSelect
              name="production"
              defaultValue={filterProduction}
              options={productions.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="All"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Employment Type
            </label>
            <FormSelect
              name="empType"
              defaultValue={filterEmpType}
              options={[
                { value: "w2", label: "W-2 Employees" },
                { value: "1099", label: "1099 Contractors" },
              ]}
              placeholder="All"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Status
            </label>
            <FormSelect
              name="status"
              defaultValue={filterStatus}
              options={[
                { value: "approved", label: "Approved Only" },
                { value: "pending", label: "Pending" },
              ]}
              placeholder="All"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-lavender text-white text-sm font-medium px-4 hover:bg-lavender-dark transition-colors"
          >
            Apply
          </button>
          <a
            href="/admin/timesheets/payroll"
            className="h-9 rounded-lg border border-silver text-slate text-sm font-medium px-4 hover:bg-cloud transition-colors inline-flex items-center"
          >
            Reset
          </a>
        </form>

        {/* Quick date range buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {[
            {
              label: "This Week",
              from: getWeekStart(0),
              to: getWeekEnd(0),
            },
            {
              label: "Last Week",
              from: getWeekStart(-1),
              to: getWeekEnd(-1),
            },
            {
              label: "This Month",
              from: getMonthStart(0),
              to: getMonthEnd(0),
            },
            {
              label: "Last Month",
              from: getMonthStart(-1),
              to: getMonthEnd(-1),
            },
          ].map((q) => (
            <a
              key={q.label}
              href={buildFilterUrl({
                from: q.from,
                to: q.to,
                teacher: filterTeacher,
                production: filterProduction,
                empType: filterEmpType,
                status: filterStatus,
              })}
              className="rounded-md border border-silver px-2.5 py-1 text-xs text-slate hover:bg-cloud transition-colors"
            >
              {q.label}
            </a>
          ))}
        </div>
      </div>

      {/* Section A — W-2 Employees */}
      {(!filterEmpType || filterEmpType === "w2") && (
        <PayrollSection
          title="W-2 Employees"
          teachers={w2Teachers}
          totalOwed={totalW2Owed}
        />
      )}

      {/* Section B — 1099 Contractors */}
      {(!filterEmpType || filterEmpType === "1099") && (
        <PayrollSection
          title="1099 Contractors"
          teachers={contractorTeachers}
          totalOwed={total1099Owed}
          note="1099 contractors are responsible for their own taxes. Payments over $600/year require a Form 1099-NEC."
        />
      )}

      {/* Summary Bar */}
      <div className="rounded-xl border border-silver bg-charcoal text-white p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <SummaryStat
            label="Total Teachers"
            value={`${totalTeachers} (W-2: ${w2Teachers.filter((t) => t.entries.length > 0).length}, 1099: ${contractorTeachers.filter((t) => t.entries.length > 0).length})`}
          />
          <SummaryStat
            label="Total Hours"
            value={totalHours.toFixed(1)}
          />
          <SummaryStat
            label="W-2 Owed"
            value={formatCurrency(totalW2Owed)}
          />
          <SummaryStat
            label="1099 Owed"
            value={formatCurrency(total1099Owed)}
          />
          <SummaryStat
            label="Combined Total"
            value={formatCurrency(totalW2Owed + total1099Owed)}
            highlight
          />
          {missingRatesCount > 0 && (
            <SummaryStat
              label="Missing Rates"
              value={`${missingRatesCount} ⚠️`}
              warning
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollSection({
  title,
  teachers,
  totalOwed,
  note,
}: {
  title: string;
  teachers: TeacherPayroll[];
  totalOwed: number;
  note?: string;
}) {
  const activeTeachers = teachers.filter((t) => t.entries.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          {title}
        </h2>
        <div className="text-sm text-slate">
          {activeTeachers.length} teacher{activeTeachers.length !== 1 ? "s" : ""}{" "}
          · {formatCurrency(totalOwed)}
        </div>
      </div>

      {note && (
        <p className="text-xs text-slate bg-cloud/50 rounded-lg px-3 py-2 italic">
          {note}
        </p>
      )}

      {activeTeachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
          No {title.toLowerCase()} with entries in this period.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cloud/50">
                  <th className="px-4 py-3 text-left font-medium text-slate w-8" />
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Class
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Private
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Rehearsal
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Other
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Total hrs
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Rate Info
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Total Owed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver">
                {activeTeachers.map((t) => (
                  <TeacherRow key={t.id} teacher={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherRow({ teacher }: { teacher: TeacherPayroll }) {
  const [expanded, setExpanded] = useState(false);

  const rateInfo = teacher.rates
    ? [
        teacher.rates.class > 0 ? `Class $${teacher.rates.class}` : null,
        teacher.rates.private > 0 ? `Private $${teacher.rates.private}` : null,
        teacher.rates.rehearsal > 0
          ? `Rehearsal $${teacher.rates.rehearsal}`
          : null,
        teacher.rates.admin > 0 ? `Admin $${teacher.rates.admin}` : null,
      ]
        .filter(Boolean)
        .join(" / ")
    : null;

  return (
    <>
      <tr
        className="hover:bg-cloud/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-slate text-xs">
          {expanded ? "▼" : "▶"}
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-charcoal">{teacher.name}</span>
        </td>
        <td className="px-4 py-3 text-right text-charcoal">
          {teacher.hours.class > 0 ? teacher.hours.class.toFixed(1) : "—"}
        </td>
        <td className="px-4 py-3 text-right text-charcoal">
          {teacher.hours.private > 0
            ? teacher.hours.private.toFixed(1)
            : "—"}
        </td>
        <td className="px-4 py-3 text-right text-charcoal">
          {teacher.hours.rehearsal > 0
            ? teacher.hours.rehearsal.toFixed(1)
            : "—"}
        </td>
        <td className="px-4 py-3 text-right text-charcoal">
          {teacher.hours.admin > 0 ? teacher.hours.admin.toFixed(1) : "—"}
        </td>
        <td className="px-4 py-3 text-right text-charcoal">
          {teacher.hours.other > 0 ? teacher.hours.other.toFixed(1) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-charcoal">
          {teacher.hours.total.toFixed(1)}
        </td>
        <td className="px-4 py-3 text-xs text-slate max-w-[180px] truncate">
          {rateInfo ?? (
            <span className="text-warning">
              — ⚠️
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-charcoal">
          {teacher.hasMissingRates ? (
            <span className="text-warning">⚠️ —</span>
          ) : (
            formatCurrency(teacher.totalOwed)
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="px-0 py-0">
            <div className="bg-cloud/20 px-8 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate">
                    <th className="pb-2 text-left font-medium">Date</th>
                    <th className="pb-2 text-left font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Hours</th>
                    <th className="pb-2 text-left font-medium">
                      Class/Student
                    </th>
                    <th className="pb-2 text-left font-medium">Sub For</th>
                    <th className="pb-2 text-left font-medium">Production</th>
                    <th className="pb-2 text-left font-medium">Event Tag</th>
                    <th className="pb-2 text-left font-medium">Notes</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teacher.entries
                    .sort(
                      (a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )
                    .map((e) => (
                      <tr
                        key={e.id}
                        className={`${STATUS_BORDER[e.timesheet_status] ?? ""}`}
                      >
                        <td className="py-1.5 pr-3 text-charcoal">
                          {new Date(e.date + "T12:00:00").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-charcoal">
                          {ENTRY_TYPE_LABELS[e.entry_type] ?? e.entry_type}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-charcoal font-medium">
                          {e.total_hours.toFixed(1)}
                        </td>
                        <td className="py-1.5 pr-3 text-charcoal max-w-[120px] truncate">
                          {e.description ?? "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-slate max-w-[100px] truncate">
                          {e.sub_for ?? "—"}
                        </td>
                        <td className="py-1.5 pr-3">
                          {e.production_name ? (
                            <span className="inline-flex items-center rounded-full bg-lavender/10 px-1.5 py-0.5 text-[9px] font-medium text-lavender-dark">
                              {e.production_name.length > 20
                                ? e.production_name.slice(0, 20) + "…"
                                : e.production_name}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 pr-3">
                          {e.event_tag ? (
                            <span className="inline-flex items-center rounded-full bg-cloud px-1.5 py-0.5 text-[9px] font-medium text-slate">
                              {e.event_tag.length > 20
                                ? e.event_tag.slice(0, 20) + "…"
                                : e.event_tag}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-slate max-w-[100px] truncate">
                          {e.notes ?? "—"}
                        </td>
                        <td className="py-1.5">
                          <StatusDot status={e.timesheet_status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: "bg-success",
    submitted: "bg-warning",
    draft: "bg-mist",
    rejected: "bg-error",
    exported: "bg-success",
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`w-2 h-2 rounded-full ${colors[status] ?? "bg-mist"}`}
      />
      <span className="text-slate capitalize">{status}</span>
    </span>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <div
        className={`text-sm font-semibold mt-0.5 ${
          highlight
            ? "text-gold"
            : warning
            ? "text-warning"
            : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MarkAsPaidButton({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState("");

  if (result) {
    return (
      <span className="h-10 inline-flex items-center text-sm text-success font-medium px-4">
        {result}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="h-10 rounded-lg bg-charcoal hover:bg-charcoal/90 text-white text-sm font-medium px-4 transition-colors"
      >
        Mark All as Paid
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate">Lock all approved entries?</span>
      <form
        action={async (fd) => {
          setLoading(true);
          const res = await markEntriesAsPaid(fd);
          setLoading(false);
          if (res?.error) setResult(res.error);
          else setResult(`${res.count} entries marked as paid`);
        }}
      >
        <input type="hidden" name="dateFrom" value={dateFrom} />
        <input type="hidden" name="dateTo" value={dateTo} />
        <button
          type="submit"
          disabled={loading}
          className="h-8 rounded-md bg-success hover:bg-success/90 text-white font-medium text-xs px-3 disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
      </form>
      <button
        onClick={() => setConfirming(false)}
        className="h-8 rounded-md border border-silver text-slate text-xs px-3"
      >
        Cancel
      </button>
    </div>
  );
}

// Date helpers
function getWeekStart(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 6 + offset * 7);
  return d.toISOString().split("T")[0];
}

function getMonthStart(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().split("T")[0];
}

function getMonthEnd(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1 + offset, 0);
  return d.toISOString().split("T")[0];
}
