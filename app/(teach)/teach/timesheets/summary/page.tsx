import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SubmitFromSummary } from "./submit-from-summary";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  class_lead: "Class (Lead)",
  class_assistant: "Class (Assistant)",
  private: "Private Lesson",
  rehearsal: "Rehearsal",
  performance_event: "Performance Event",
  competition: "Competition",
  training: "Training",
  admin: "Administrative",
  substitute: "Substitute",
  bonus: "Bonus",
};

export default async function TimesheetSummaryPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  const now = new Date();
  const monthLabel = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // Get teacher_profile
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!teacherProfile) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
        Teacher profile not found.
      </div>
    );
  }

  // Fetch timesheet
  const { data: timesheet } = await supabase
    .from("timesheets")
    .select("id, status, total_hours")
    .eq("teacher_id", teacherProfile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!timesheet || timesheet.status !== "draft") {
    return (
      <div className="space-y-6">
        <div>
          <a
            href="/teach/timesheets"
            className="text-sm text-lavender hover:text-lavender-dark"
          >
            &larr; Back to Timesheets
          </a>
          <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
            Timesheet Summary
          </h1>
        </div>
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          {timesheet
            ? "This timesheet has already been submitted."
            : "No timesheet found for the current period."}
        </div>
      </div>
    );
  }

  // Fetch entries grouped by type
  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select("id, date, entry_type, total_hours, description")
    .eq("timesheet_id", timesheet.id)
    .order("date", { ascending: true });

  const allEntries = entries ?? [];
  const totalHours = allEntries.reduce(
    (sum, e) => sum + (e.total_hours ?? 0),
    0
  );

  // Group by type
  const byType: Record<string, { count: number; hours: number }> = {};
  for (const e of allEntries) {
    if (!byType[e.entry_type]) {
      byType[e.entry_type] = { count: 0, hours: 0 };
    }
    byType[e.entry_type].count++;
    byType[e.entry_type].hours += e.total_hours ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/teach/timesheets"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Back to Timesheets
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Period Summary — {monthLabel}
        </h1>
        <p className="mt-1 text-sm text-slate">
          Review your entries before submitting.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {totalHours.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-slate">Total Hours</p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {allEntries.length}
          </p>
          <p className="mt-1 text-xs text-slate">Entries</p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {Object.keys(byType).length}
          </p>
          <p className="mt-1 text-xs text-slate">Categories</p>
        </div>
      </div>

      {/* Breakdown by type */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-silver bg-cloud/50">
          <h3 className="text-sm font-semibold text-charcoal">
            Hours by Category
          </h3>
        </div>
        <div className="divide-y divide-silver">
          {Object.entries(byType)
            .sort(([, a], [, b]) => b.hours - a.hours)
            .map(([type, data]) => (
              <div
                key={type}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-charcoal">
                    {ENTRY_TYPE_LABELS[type] ?? type}
                  </span>
                  <span className="ml-2 text-xs text-mist">
                    ({data.count} {data.count === 1 ? "entry" : "entries"})
                  </span>
                </div>
                <span className="text-sm font-semibold text-charcoal">
                  {data.hours.toFixed(1)}h
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* All entries */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-silver bg-cloud/50">
          <h3 className="text-sm font-semibold text-charcoal">All Entries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver">
                <th className="px-4 py-2 text-left font-medium text-slate">
                  Date
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate">
                  Type
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate">
                  Description
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver">
              {allEntries.map((e) => (
                <tr key={e.id} className="hover:bg-cloud/30 transition-colors">
                  <td className="px-4 py-2 text-charcoal">
                    {new Date(e.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate">
                    {ENTRY_TYPE_LABELS[e.entry_type] ?? e.entry_type}
                  </td>
                  <td className="px-4 py-2 text-charcoal">
                    {e.description ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-charcoal">
                    {e.total_hours?.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit */}
      <SubmitFromSummary
        timesheetId={timesheet.id}
        totalHours={totalHours}
        entryCount={allEntries.length}
      />
    </div>
  );
}
