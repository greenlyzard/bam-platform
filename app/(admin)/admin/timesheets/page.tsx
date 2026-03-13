import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ReviewActions } from "./review-actions";
import { ExportCsvButton } from "./export-csv";

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

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("finance_admin", "admin", "super_admin");
  const supabase = await createClient();
  const params = await searchParams;
  const filterStatus = params.status || "submitted";

  // Fetch all timesheets with teacher info
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

  // Fetch entries for each timesheet (for CSV export data)
  const timesheetIds = allTimesheets.map((t) => t.id);
  const { data: allEntries } = timesheetIds.length > 0
    ? await supabase
        .from("timesheet_entries")
        .select("id, timesheet_id, date, entry_type, total_hours, description")
        .in("timesheet_id", timesheetIds)
        .order("date")
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
      teacher: [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || "Unknown",
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
        {csvRows.length > 0 && <ExportCsvButton rows={csvRows} />}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-cloud/50 p-1">
        {filterTabs.map((tab) => {
          const active = filterStatus === tab.key;
          return (
            <a
              key={tab.key}
              href={`/admin/timesheets?status=${tab.key}`}
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
                  const badge = STATUS_BADGES[ts.status] ?? STATUS_BADGES.draft;

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
                            <p className="text-xs text-mist">{tp.email}</p>
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
                          ? new Date(ts.submitted_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              }
                            )
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
    </div>
  );
}
