import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AddEntryForm, EditEntryRow } from "./entry-form";

export default async function TimesheetsPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  const now = new Date();
  const monthLabel = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const isLocked = now.getDate() > 26;

  // Get teacher_profile
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, employment_type")
    .eq("user_id", user.id)
    .single();

  const employmentType = teacherProfile?.employment_type ?? "w2";

  // Fetch productions for dropdown
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  const productions = (productionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Fetch the current timesheet (any status)
  const { data: timesheet } = teacherProfile
    ? await supabase
        .from("timesheets")
        .select("id, status, total_hours, submitted_at")
        .eq("teacher_id", teacherProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Fetch entries with new fields
  const { data: entries } = timesheet
    ? await supabase
        .from("timesheet_entries")
        .select(
          "id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes"
        )
        .eq("timesheet_id", timesheet.id)
        .order("date", { ascending: false })
    : { data: null };

  const totalHours = (entries ?? []).reduce(
    (sum, e) => sum + (e.total_hours ?? 0),
    0
  );
  const timesheetStatus = timesheet?.status ?? "draft";
  const isDraft = timesheetStatus === "draft";
  const canEdit = isDraft && !isLocked;

  const STATUS_BADGES: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    draft: {
      bg: "bg-lavender/10",
      text: "text-lavender-dark",
      label: "Draft — not yet submitted",
    },
    submitted: {
      bg: "bg-gold/10",
      text: "text-gold-dark",
      label: "Submitted — awaiting review",
    },
    approved: {
      bg: "bg-success/10",
      text: "text-success",
      label: "Approved",
    },
    rejected: {
      bg: "bg-error/10",
      text: "text-error",
      label: "Returned — needs changes",
    },
    exported: {
      bg: "bg-success/10",
      text: "text-success",
      label: "Exported to payroll",
    },
  };

  const badge = STATUS_BADGES[timesheetStatus];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            My Timesheets
          </h1>
          <p className="mt-1 text-sm text-slate">
            {monthLabel} — {totalHours.toFixed(1)} total hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          {badge && (entries?.length ?? 0) > 0 && (
            <span
              className={`inline-flex items-center rounded-full ${badge.bg} px-3 py-1 text-xs font-medium ${badge.text}`}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      {isLocked && isDraft && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 text-sm text-warning">
          The pay period is locked after the 26th. You can still review and
          submit your timesheet, but entries cannot be added or edited.
        </div>
      )}

      {/* Entries table */}
      {!entries || entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No timesheet entries for {monthLabel}. Add your first entry below.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cloud/50">
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Tags
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Hours
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium text-slate w-24">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-silver">
                {entries.map((entry) => (
                  <EditEntryRow
                    key={entry.id}
                    entry={entry}
                    locked={!canEdit}
                    employmentType={employmentType}
                    productions={productions}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-silver bg-cloud/30">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-medium text-charcoal"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-charcoal">
                    {totalHours.toFixed(1)}
                  </td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add entry (only in draft) */}
      {isDraft && (
        <AddEntryForm
          locked={isLocked}
          employmentType={employmentType}
          productions={productions}
        />
      )}

      {/* Submit flow */}
      {timesheet && isDraft && (entries?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-semibold text-charcoal">
                Ready to submit?
              </h3>
              <p className="text-sm text-slate mt-1">
                {entries?.length ?? 0}{" "}
                {(entries?.length ?? 0) === 1 ? "entry" : "entries"} ·{" "}
                {totalHours.toFixed(1)} hours total
              </p>
            </div>
            <a
              href="/teach/timesheets/summary"
              className="inline-flex items-center h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors"
            >
              Review &amp; Submit
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
