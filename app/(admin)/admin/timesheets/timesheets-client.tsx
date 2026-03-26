"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { SimpleSelect } from "@/components/ui/select";
import { bulkApproveTimesheets } from "./actions";
import {
  AdminAddEntryButton,
  AdminEditEntryButton,
  AdminDeleteEntryButton,
  QuickEntryBar,
} from "./admin-entry-drawer";
import {
  ReviewActions,
  EntryApproveButton,
  EntryFlagButton,
  EntryChangeLog,
} from "./approval-actions";
import { ExportCsvButton } from "./export-csv";

interface Teacher {
  id: string;
  name: string;
  employmentType: string;
}

interface Production {
  id: string;
  name: string;
}

interface TimesheetRow {
  id: string;
  status: string;
  totalHours: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionNotes: string | null;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  employmentType: string;
}

interface ChangeLogEntry {
  id: string;
  change_type: string;
  changed_by_name: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

interface EntryRow {
  id: string;
  timesheet_id: string;
  date: string;
  entry_type: string;
  total_hours: number;
  description: string | null;
  sub_for: string | null;
  production_id: string | null;
  production_name: string | null;
  event_tag: string | null;
  notes: string | null;
  status: string;
  flag_question: string | null;
  flag_response: string | null;
  flagged_at: string | null;
  approved_at: string | null;
  adjustment_note: string | null;
  changes: ChangeLogEntry[];
  class_id: string | null;
  schedule_instance_id: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface RecentEntryRow extends EntryRow {
  teacherId: string;
  teacherName: string;
  timesheetStatus: string;
}

interface PayPeriod {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
}

interface CsvRow {
  id: string;
  teacher: string;
  teacherLastName?: string;
  teacherFirstName?: string;
  email: string;
  employmentType?: string;
  date: string;
  type: string;
  hours: number;
  rate?: number | null;
  totalPay?: number | null;
  description: string;
  status: string;
  rateOverride?: boolean;
  notes?: string;
  productionTag?: string;
  isSubstitute?: boolean;
}

interface PrivateBillingSplit {
  id: string;
  studentId: string;
  studentName: string;
  splitAmount: number;
  billingStatus: "unbilled" | "pending" | "charged" | "waived" | "disputed";
  dateCardCharged: string | null;
  chargeReference: string | null;
  waiverReason: string | null;
  disputeNotes: string | null;
}

interface PrivateBillingRecord {
  id: string;
  timesheetEntryId: string;
  teacherName: string;
  date: string;
  totalHours: number;
  description: string | null;
  teacherConfirmed: boolean;
  adminConfirmed: boolean | null;
  adminEnteredCalendar: boolean;
  billingSplitConfirmed: boolean;
  splits: PrivateBillingSplit[];
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-cloud", text: "text-slate", label: "Draft" },
  submitted: { bg: "bg-gold/10", text: "text-gold-dark", label: "Submitted" },
  approved: { bg: "bg-success/10", text: "text-success", label: "Approved" },
  rejected: { bg: "bg-error/10", text: "text-error", label: "Returned" },
  exported: { bg: "bg-info/10", text: "text-info", label: "Exported" },
  flagged: { bg: "bg-warning/10", text: "text-warning", label: "Flagged" },
  adjusted: { bg: "bg-info/10", text: "text-info", label: "Adjusted" },
  paid: { bg: "bg-success/10", text: "text-success", label: "Paid" },
};

const ENTRY_TYPES_LIST = [
  { value: "class_lead", label: "Class" },
  { value: "private", label: "Private" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "admin", label: "Admin" },
  { value: "performance_event", label: "Performance" },
  { value: "competition", label: "Competition" },
  { value: "bonus", label: "Other" },
];

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function buildUrl(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  return `/admin/timesheets?${search.toString()}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

export function TimesheetsClient({
  view,
  filterStatus,
  payPeriods,
  filterPayPeriod,
  dateFrom,
  dateTo,
  filterTeacher,
  filterEmpType,
  filterEntryType,
  teachers,
  productions,
  timesheets,
  entries,
  recentEntries,
  counts,
  csvRows,
  entryTypeLabels,
  isTeacherOnly,
  isAdmin,
  billingRecords,
}: {
  view: string;
  filterStatus: string;
  payPeriods: PayPeriod[];
  filterPayPeriod: string;
  dateFrom: string;
  dateTo: string;
  filterTeacher: string;
  filterEmpType: string;
  filterEntryType: string;
  teachers: Teacher[];
  productions: Production[];
  timesheets: TimesheetRow[];
  entries: EntryRow[];
  recentEntries: RecentEntryRow[];
  counts: Record<string, number>;
  csvRows: CsvRow[];
  entryTypeLabels: Record<string, string>;
  isTeacherOnly: boolean;
  isAdmin: boolean;
  billingRecords?: PrivateBillingRecord[];
}) {
  const [quickMode, setQuickMode] = useState(false);
  const [stickyTeacher, setStickyTeacher] = useState("");
  const [sessionHours, setSessionHours] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  const visibleTimesheetIds = timesheets.map((ts) => ts.id);
  const allSelected = visibleTimesheetIds.length > 0 && visibleTimesheetIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTimesheetIds));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkApprove() {
    startBulkTransition(async () => {
      const fd = new FormData();
      fd.set("timesheetIds", JSON.stringify([...selectedIds]));
      await bulkApproveTimesheets(fd);
      setSelectedIds(new Set());
    });
  }

  const filterTabs = [
    { key: "submitted", label: "Submitted", count: counts.submitted ?? 0 },
    { key: "approved", label: "Approved", count: counts.approved ?? 0 },
    { key: "draft", label: "Drafts", count: counts.draft ?? 0 },
    { key: "all", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
  ];

  const viewTabs = [
    { key: "timesheets", label: "Timesheets" },
    { key: "entries", label: "All Entries" },
    { key: "billing", label: "Private Billing" },
  ];

  const hasFilters = filterTeacher || filterEmpType || filterEntryType ||
    dateFrom !== new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Timesheets
          </h1>
          <p className="mt-1 text-sm text-slate">
            Review, approve, or return teacher timesheets for payroll.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AdminAddEntryButton
            teachers={teachers}
            productions={productions}
            quickMode={quickMode}
            stickyTeacher={stickyTeacher}
            onEntryAdded={(hrs) => setSessionHours((p) => p + hrs)}
          />
          <Link
            href="/admin/timesheets/payroll"
            className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-sm font-medium text-charcoal px-4 transition-colors inline-flex items-center gap-1.5"
          >
            Payroll Report →
          </Link>
          {csvRows.length > 0 && <ExportCsvButton rows={csvRows} />}
        </div>
      </div>

      {/* Quick Entry Mode */}
      <QuickEntryBar
        quickMode={quickMode}
        setQuickMode={setQuickMode}
        stickyTeacher={stickyTeacher}
        setStickyTeacher={setStickyTeacher}
        sessionHours={sessionHours}
        teachers={teachers}
      />

      {/* View toggle */}
      <div className="flex gap-4 border-b border-silver">
        {viewTabs.map((tab) => (
          <a
            key={tab.key}
            href={buildUrl({
              view: tab.key,
              ...(tab.key === "timesheets" ? { status: filterStatus } : {}),
              ...(tab.key === "entries" ? { from: dateFrom, to: dateTo, teacher: filterTeacher, empType: filterEmpType, entryType: filterEntryType } : {}),
              ...(tab.key === "billing" ? { view: "billing" } : {}),
            })}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              view === tab.key
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {view === "timesheets" ? (
        <>
          {/* Status filter tabs */}
          <div className="flex gap-1 rounded-lg bg-cloud/50 p-1">
            {filterTabs.map((tab) => {
              const active = filterStatus === tab.key;
              return (
                <a
                  key={tab.key}
                  href={buildUrl({ status: tab.key, view: "timesheets" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-charcoal shadow-sm"
                      : "text-slate hover:text-charcoal"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-mist">{tab.count}</span>
                </a>
              );
            })}
          </div>

          {/* Pay period filter */}
          {payPeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-charcoal">Pay Period:</label>
              <SimpleSelect
                value={filterPayPeriod}
                onValueChange={(val) => {
                  window.location.href = buildUrl({
                    view: "timesheets",
                    status: filterStatus,
                    ...(val && val !== "__all__" ? { payPeriod: val } : {}),
                  });
                }}
                options={[
                  { value: "__all__", label: "All Pay Periods" },
                  ...payPeriods.map((pp) => ({
                    value: pp.id,
                    label: `${MONTHS[pp.periodMonth - 1]} ${pp.periodYear}`,
                  })),
                ]}
                placeholder="All Pay Periods"
              />
            </div>
          )}

          {/* Bulk approve bar */}
          {isAdmin && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-success/5 border border-success/20 px-4 py-3">
              <button
                onClick={handleBulkApprove}
                disabled={bulkPending}
                className="h-10 rounded-lg bg-success hover:bg-success/90 text-white font-semibold text-sm px-5 transition-colors disabled:opacity-50"
              >
                {bulkPending ? "Approving..." : `Approve ${selectedIds.size} Selected`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-slate hover:text-charcoal"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Timesheets table */}
          {timesheets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
              No timesheets with status &ldquo;{filterStatus}&rdquo;.
            </div>
          ) : (
            <div className="rounded-xl border border-silver bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver bg-cloud/50">
                      {isAdmin && (
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left font-medium text-slate">Teacher</th>
                      <th className="px-4 py-3 text-left font-medium text-slate">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-slate">Hours</th>
                      <th className="px-4 py-3 text-left font-medium text-slate">Submitted</th>
                      <th className="px-4 py-3 text-left font-medium text-slate">Notes</th>
                      {filterStatus === "submitted" && (
                        <th className="px-4 py-3 text-right font-medium text-slate w-40">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver">
                    {timesheets.map((ts) => {
                      const badge = STATUS_BADGES[ts.status] ?? STATUS_BADGES.draft;
                      const isExpanded = expandedId === ts.id;
                      const tsEntries = entries.filter((e) => e.timesheet_id === ts.id);
                      const colCount = (filterStatus === "submitted" ? 6 : 5) + (isAdmin ? 1 : 0);
                      return (
                        <Fragment key={ts.id}>
                          <tr
                            className="hover:bg-cloud/30 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                          >
                            {isAdmin && (
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(ts.id)}
                                  onChange={() => toggleOne(ts.id)}
                                  className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
                                />
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-mist shrink-0">{isExpanded ? "▼" : "▶"}</span>
                                <div>
                                  <span className="font-medium text-charcoal">{ts.teacherName}</span>
                                  {ts.teacherEmail && (
                                    <p className="text-xs text-mist">{ts.teacherEmail}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-charcoal">
                              {ts.totalHours.toFixed(1)}
                            </td>
                            <td className="px-4 py-3 text-slate">
                              {ts.submittedAt
                                ? new Date(ts.submittedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate max-w-[200px] truncate">
                              {ts.rejectionNotes ?? "—"}
                            </td>
                            {filterStatus === "submitted" && (
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <ReviewActions timesheetId={ts.id} />
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={colCount} className="bg-cloud/20 px-4 py-4">
                                {tsEntries.length === 0 ? (
                                  <p className="text-sm text-mist text-center py-4">No entries yet.</p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-silver/60">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate">Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate">Category</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate">Description</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate">Time</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate">Hours</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate">Status</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate w-32">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-silver/40">
                                      {tsEntries.map((e) => {
                                        const entryBadge = STATUS_BADGES[e.status] ?? STATUS_BADGES.draft;
                                        return (
                                          <tr key={e.id} className="hover:bg-cloud/30 transition-colors">
                                            <td className="px-3 py-2 text-charcoal whitespace-nowrap">
                                              {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                              })}
                                            </td>
                                            <td className="px-3 py-2 text-slate">
                                              {entryTypeLabels[e.entry_type] ?? e.entry_type}
                                            </td>
                                            <td className="px-3 py-2 text-charcoal max-w-[200px]">
                                              <div className="truncate">{e.description ?? "—"}</div>
                                              {e.flag_question && (
                                                <div className="mt-1 text-xs text-warning bg-warning/5 rounded px-2 py-1">
                                                  Q: {e.flag_question}
                                                  {e.flag_response && (
                                                    <div className="mt-0.5 text-charcoal">A: {e.flag_response}</div>
                                                  )}
                                                </div>
                                              )}
                                              {e.adjustment_note && (
                                                <div className="mt-1 text-xs text-info bg-info/5 rounded px-2 py-1">
                                                  Adjusted: {e.adjustment_note}
                                                </div>
                                              )}
                                              {e.changes.length > 0 && (
                                                <div className="mt-1">
                                                  <EntryChangeLog changes={e.changes} />
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-slate whitespace-nowrap text-xs">
                                              {e.start_time && e.end_time
                                                ? `${formatTime12h(e.start_time)} – ${formatTime12h(e.end_time)}`
                                                : e.start_time ? formatTime12h(e.start_time) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-charcoal">
                                              {e.total_hours?.toFixed(1)}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entryBadge.bg} ${entryBadge.text}`}>
                                                {entryBadge.label}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              <div className="flex justify-end gap-1 items-center">
                                                {(e.status === "submitted" || e.status === "flagged") && (
                                                  <>
                                                    <EntryApproveButton entryId={e.id} />
                                                    {e.status !== "flagged" && (
                                                      <EntryFlagButton
                                                        entryId={e.id}
                                                        teacherName={ts.teacherName}
                                                      />
                                                    )}
                                                  </>
                                                )}
                                                <AdminEditEntryButton
                                                  entry={{ ...e, teacher_id: ts.teacherId }}
                                                  teachers={teachers}
                                                  productions={productions}
                                                  isAdmin={isAdmin}
                                                />
                                                <AdminDeleteEntryButton entryId={e.id} />
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                                <div className="mt-3 flex items-center justify-between">
                                  <AdminAddEntryButton
                                    teachers={teachers}
                                    productions={productions}
                                    defaultTeacherId={ts.teacherId}
                                  />
                                  <span className="text-xs text-mist">
                                    {tsEntries.length} {tsEntries.length === 1 ? "entry" : "entries"} · {tsEntries.reduce((s, e) => s + (e.total_hours ?? 0), 0).toFixed(1)} hrs
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filter bar for entries view */}
          <div className="rounded-xl border border-silver bg-white p-4">
            <form className="flex flex-wrap gap-3 items-end">
              <input type="hidden" name="view" value="entries" />
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">From</label>
                <input
                  name="from"
                  type="date"
                  defaultValue={dateFrom}
                  className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">To</label>
                <input
                  name="to"
                  type="date"
                  defaultValue={dateTo}
                  className="h-9 rounded-lg border border-silver bg-white px-3 text-sm focus:border-lavender focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Teacher</label>
                <FormSelect
                  name="teacher"
                  defaultValue={filterTeacher}
                  options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                  placeholder="All Teachers"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Employment</label>
                <FormSelect
                  name="empType"
                  defaultValue={filterEmpType}
                  options={[
                    { value: "w2", label: "W-2" },
                    { value: "1099", label: "1099" },
                  ]}
                  placeholder="All"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Entry Type</label>
                <FormSelect
                  name="entryType"
                  defaultValue={filterEntryType}
                  options={ENTRY_TYPES_LIST}
                  placeholder="All"
                />
              </div>
              <button
                type="submit"
                className="h-9 rounded-lg bg-lavender text-white text-sm font-medium px-4 hover:bg-lavender-dark transition-colors"
              >
                Apply
              </button>
              {hasFilters && (
                <a
                  href="/admin/timesheets?view=entries"
                  className="h-9 rounded-lg border border-silver text-slate text-sm px-4 hover:bg-cloud transition-colors inline-flex items-center"
                >
                  Clear
                </a>
              )}
            </form>
          </div>

          {/* Entries table */}
          <div className="rounded-xl border border-silver bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-silver bg-cloud/50">
                    <th className="px-4 py-3 text-left font-medium text-slate">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-slate">Teacher</th>
                    <th className="px-4 py-3 text-left font-medium text-slate">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-slate">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-slate">Hours</th>
                    <th className="px-4 py-3 text-left font-medium text-slate">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-mist">
                        No entries found.
                      </td>
                    </tr>
                  ) : (
                    recentEntries.map((e) => {
                      const entryBadge = STATUS_BADGES[e.status] ?? STATUS_BADGES.draft;
                      return (
                        <tr key={e.id} className="hover:bg-cloud/30 transition-colors">
                          <td className="px-4 py-3 text-charcoal whitespace-nowrap">
                            {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 font-medium text-charcoal">
                            {e.teacherName}
                          </td>
                          <td className="px-4 py-3 text-slate">
                            {entryTypeLabels[e.entry_type] ?? e.entry_type}
                          </td>
                          <td className="px-4 py-3 text-charcoal max-w-[200px]">
                            <div className="truncate">{e.description ?? "—"}</div>
                            {e.flag_question && (
                              <div className="mt-1 text-xs text-warning bg-warning/5 rounded px-2 py-1">
                                Q: {e.flag_question}
                                {e.flag_response && (
                                  <div className="mt-0.5 text-charcoal">A: {e.flag_response}</div>
                                )}
                              </div>
                            )}
                            {e.adjustment_note && (
                              <div className="mt-1 text-xs text-info bg-info/5 rounded px-2 py-1">
                                Adjusted: {e.adjustment_note}
                              </div>
                            )}
                            {e.changes.length > 0 && (
                              <div className="mt-1">
                                <EntryChangeLog changes={e.changes} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-charcoal">
                            {e.total_hours?.toFixed(1)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entryBadge.bg} ${entryBadge.text}`}>
                              {entryBadge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1 items-center">
                              {(e.status === "submitted" || e.status === "flagged") && (
                                <>
                                  <EntryApproveButton entryId={e.id} />
                                  {e.status !== "flagged" && (
                                    <EntryFlagButton
                                      entryId={e.id}
                                      teacherName={e.teacherName}
                                    />
                                  )}
                                </>
                              )}
                              <AdminEditEntryButton
                                entry={{ ...e, teacher_id: e.teacherId }}
                                teachers={teachers}
                                productions={productions}
                                isAdmin={isAdmin}
                              />
                              <AdminDeleteEntryButton entryId={e.id} />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === "billing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-charcoal">Private Billing Tracker</h2>
            <span className="text-xs text-slate">Unresolved items block payroll export</span>
          </div>
          {!billingRecords || billingRecords.length === 0 ? (
            <p className="text-sm text-slate py-8 text-center">No private billing records found for this period.</p>
          ) : (
            <div className="space-y-3">
              {billingRecords.map((record) => {
                const allCharged = record.splits.every((s) => s.billingStatus === "charged" || s.billingStatus === "waived");
                const hasUnresolved = record.splits.some((s) => s.billingStatus === "unbilled" || s.billingStatus === "pending");
                return (
                  <div key={record.id} className={`border rounded-lg p-4 space-y-3 ${hasUnresolved ? "border-gold/50 bg-gold/5" : "border-silver bg-white"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-charcoal">{record.teacherName}</span>
                          <span className="text-xs text-slate">·</span>
                          <span className="text-xs text-slate">{record.date}</span>
                          <span className="text-xs text-slate">·</span>
                          <span className="text-xs text-slate">{record.totalHours}h</span>
                        </div>
                        {record.description && <p className="text-xs text-slate">{record.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {record.teacherConfirmed ? (
                          <span className="text-xs bg-green/10 text-green-dark px-2 py-0.5 rounded-full">Teacher confirmed</span>
                        ) : (
                          <span className="text-xs bg-cloud text-slate px-2 py-0.5 rounded-full">Awaiting teacher</span>
                        )}
                        {allCharged ? (
                          <span className="text-xs bg-green/10 text-green-dark px-2 py-0.5 rounded-full">Fully charged</span>
                        ) : hasUnresolved ? (
                          <span className="text-xs bg-gold/10 text-gold-dark px-2 py-0.5 rounded-full">Action needed</span>
                        ) : (
                          <span className="text-xs bg-cloud text-slate px-2 py-0.5 rounded-full">In progress</span>
                        )}
                      </div>
                    </div>
                    {record.splits.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate border-b border-silver">
                            <th className="pb-1 font-medium">Student</th>
                            <th className="pb-1 font-medium">Amount</th>
                            <th className="pb-1 font-medium">Status</th>
                            <th className="pb-1 font-medium">Date Charged</th>
                            <th className="pb-1 font-medium">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {record.splits.map((split) => (
                            <tr key={split.id} className="border-b border-silver/50 last:border-0">
                              <td className="py-1.5 text-charcoal">{split.studentName}</td>
                              <td className="py-1.5 text-charcoal">${split.splitAmount.toFixed(2)}</td>
                              <td className="py-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                  split.billingStatus === "charged" ? "bg-green/10 text-green-dark" :
                                  split.billingStatus === "waived" ? "bg-cloud text-slate" :
                                  split.billingStatus === "disputed" ? "bg-red/10 text-red-dark" :
                                  split.billingStatus === "pending" ? "bg-lavender/10 text-lavender-dark" :
                                  "bg-gold/10 text-gold-dark"
                                }`}>
                                  {split.billingStatus}
                                </span>
                              </td>
                              <td className="py-1.5 text-slate">{split.dateCardCharged ?? "—"}</td>
                              <td className="py-1.5 text-slate font-mono">{split.chargeReference ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
                        <input type="checkbox" checked={record.adminEnteredCalendar} readOnly className="rounded" />
                        Entered in calendar
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
                        <input type="checkbox" checked={record.billingSplitConfirmed} readOnly className="rounded" />
                        Split confirmed
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
