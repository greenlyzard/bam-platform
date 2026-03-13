import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ReviewActions } from "./review-actions";
import { ExportCsvButton } from "./export-csv";
import {
  AdminAddEntryButton,
  AdminEditEntryButton,
  AdminDeleteEntryButton,
} from "./admin-entry-drawer";
import Link from "next/link";

const STATUS_BADGES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  draft: {
    bg: "bg-cloud",
    text: "text-slate",
    label: "Draft",
  },
  submitted: {
    bg: "bg-gold/10",
    text: "text-gold-dark",
    label: "Submitted",
  },
  approved: {
    bg: "bg-success/10",
    text: "text-success",
    label: "Approved",
  },
  rejected: {
    bg: "bg-error/10",
    text: "text-error",
    label: "Returned",
  },
  exported: {
    bg: "bg-info/10",
    text: "text-info",
    label: "Exported",
  },
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  class_lead: "Class",
  class_assistant: "Class (Asst)",
  private: "Private",
  rehearsal: "Rehearsal",
  performance_event: "Performance",
  competition: "Competition",
  training: "Training",
  admin: "Admin",
  substitute: "Substitute",
  bonus: "Other",
};

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  await requireRole("finance_admin", "admin", "super_admin");
  const supabase = await createClient();
  const params = await searchParams;
  const filterStatus = params.status || "submitted";
  const view = params.view || "timesheets";

  // Fetch all teachers for dropdown
  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, employment_type")
    .eq("is_active", true)
    .order("first_name");

  const teachers = (teacherProfiles ?? []).map((tp) => ({
    id: tp.id,
    name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
    employmentType: tp.employment_type,
  }));

  // Fetch productions
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  const productions = (productionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Fetch timesheets with teacher info
  let query = supabase
    .from("timesheets")
    .select(
      "id, status, total_hours, submitted_at, reviewed_at, rejection_notes, teacher_id, teacher_profiles(first_name, last_name, email)"
    )
    .order("submitted_at", { ascending: false });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: timesheets } = await query;
  const allTimesheets = timesheets ?? [];

  // Count by status for filter tabs
  const { data: allTs } = await supabase
    .from("timesheets")
    .select("status");

  const counts: Record<string, number> = {};
  for (const t of allTs ?? []) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  // Fetch entries for each timesheet
  const timesheetIds = allTimesheets.map((t) => t.id);
  const { data: allEntries } =
    timesheetIds.length > 0
      ? await supabase
          .from("timesheet_entries")
          .select(
            "id, timesheet_id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes"
          )
          .in("timesheet_id", timesheetIds)
          .order("date", { ascending: false })
      : { data: [] };

  // Build CSV data
  const csvRows = (allEntries ?? []).map((e) => {
    const ts = allTimesheets.find((t) => t.id === e.timesheet_id);
    const tp = ts?.teacher_profiles as unknown as {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
    return {
      teacher:
        [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || "Unknown",
      email: tp?.email ?? "",
      date: e.date,
      type: e.entry_type,
      hours: e.total_hours,
      description: e.description ?? "",
      status: ts?.status ?? "",
    };
  });

  const filterTabs = [
    { key: "submitted", label: "Submitted", count: counts.submitted ?? 0 },
    { key: "approved", label: "Approved", count: counts.approved ?? 0 },
    { key: "draft", label: "Drafts", count: counts.draft ?? 0 },
    { key: "all", label: "All", count: (allTs ?? []).length },
  ];

  // View toggle tabs
  const viewTabs = [
    { key: "timesheets", label: "Timesheets" },
    { key: "entries", label: "All Entries" },
  ];

  // For "entries" view, fetch all recent entries across all timesheets
  let recentEntries: typeof allEntries = [];
  if (view === "entries") {
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select(
        "id, timesheet_id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes, timesheets(teacher_id, status, teacher_profiles(first_name, last_name))"
      )
      .order("date", { ascending: false })
      .limit(100);
    recentEntries = entries as typeof allEntries;
  }

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

      {/* View toggle */}
      <div className="flex gap-4 border-b border-silver">
        {viewTabs.map((tab) => (
          <a
            key={tab.key}
            href={`/admin/timesheets?view=${tab.key}${tab.key === "timesheets" ? `&status=${filterStatus}` : ""}`}
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
          {/* Filter tabs */}
          <div className="flex gap-1 rounded-lg bg-cloud/50 p-1">
            {filterTabs.map((tab) => {
              const active = filterStatus === tab.key;
              return (
                <a
                  key={tab.key}
                  href={`/admin/timesheets?status=${tab.key}&view=timesheets`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-charcoal shadow-sm"
                      : "text-slate hover:text-charcoal"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-mist">
                    {tab.count}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Timesheets list */}
          {allTimesheets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
              No timesheets with status &ldquo;{filterStatus}&rdquo;.
            </div>
          ) : (
            <div className="rounded-xl border border-silver bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver bg-cloud/50">
                      <th className="px-4 py-3 text-left font-medium text-slate">
                        Teacher
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate">
                        Hours
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate">
                        Notes
                      </th>
                      {filterStatus === "submitted" && (
                        <th className="px-4 py-3 text-right font-medium text-slate w-40">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver">
                    {allTimesheets.map((ts) => {
                      const tp = ts.teacher_profiles as unknown as {
                        first_name: string | null;
                        last_name: string | null;
                        email: string | null;
                      } | null;
                      const name =
                        [tp?.first_name, tp?.last_name]
                          .filter(Boolean)
                          .join(" ") || "Unknown";
                      const badge =
                        STATUS_BADGES[ts.status] ?? STATUS_BADGES.draft;

                      return (
                        <tr
                          key={ts.id}
                          className="hover:bg-cloud/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium text-charcoal">
                                {name}
                              </span>
                              {tp?.email && (
                                <p className="text-xs text-mist">
                                  {tp.email}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-charcoal">
                            {(ts.total_hours ?? 0).toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-slate">
                            {ts.submitted_at
                              ? new Date(
                                  ts.submitted_at
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate max-w-[200px] truncate">
                            {ts.rejection_notes ?? "—"}
                          </td>
                          {filterStatus === "submitted" && (
                            <td className="px-4 py-3 text-right">
                              <ReviewActions timesheetId={ts.id} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* All Entries view */
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cloud/50">
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Tags
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver">
                {(recentEntries ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-mist"
                    >
                      No entries found.
                    </td>
                  </tr>
                ) : (
                  (recentEntries ?? []).map((e) => {
                    const ts = (e as Record<string, unknown>).timesheets as {
                      teacher_id: string;
                      status: string;
                      teacher_profiles: {
                        first_name: string | null;
                        last_name: string | null;
                      } | null;
                    } | null;
                    const teacherName = ts?.teacher_profiles
                      ? [
                          ts.teacher_profiles.first_name,
                          ts.teacher_profiles.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : "Unknown";

                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-cloud/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-charcoal whitespace-nowrap">
                          {new Date(
                            e.date + "T12:00:00"
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium text-charcoal">
                          {teacherName}
                        </td>
                        <td className="px-4 py-3 text-slate">
                          {ENTRY_TYPE_LABELS[e.entry_type] ?? e.entry_type}
                        </td>
                        <td className="px-4 py-3 text-charcoal max-w-[200px] truncate">
                          {e.description ?? "—"}
                          {e.sub_for && (
                            <span className="ml-1.5 text-xs text-mist">
                              (Sub: {e.sub_for})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-charcoal">
                          {e.total_hours?.toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          <EntryBadges
                            productionName={e.production_name}
                            eventTag={e.event_tag}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <AdminEditEntryButton
                              entry={{
                                ...e,
                                teacher_id: ts?.teacher_id,
                              }}
                              teachers={teachers}
                              productions={productions}
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
      )}
    </div>
  );
}

function EntryBadges({
  productionName,
  eventTag,
}: {
  productionName: string | null;
  eventTag: string | null;
}) {
  if (productionName) {
    const label =
      productionName.length > 24
        ? productionName.slice(0, 24) + "…"
        : productionName;
    return (
      <span className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-medium text-lavender-dark">
        {label}
      </span>
    );
  }
  if (eventTag) {
    const label =
      eventTag.length > 24 ? eventTag.slice(0, 24) + "…" : eventTag;
    return (
      <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-[10px] font-medium text-slate">
        {label}
      </span>
    );
  }
  return null;
}
