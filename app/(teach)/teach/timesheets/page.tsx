import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

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

export default async function TimesheetsPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // Get current month date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  // Fetch timesheet + entries for this teacher via teacher_profiles
  // First get the teacher_profile for this user
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  // Fetch the current month's timesheet
  const { data: timesheet } = teacherProfile
    ? await supabase
        .from("timesheets")
        .select("id, status, total_hours")
        .eq("teacher_id", teacherProfile.id)
        .single()
    : { data: null };

  // Fetch entries for current month
  const { data: entries } = timesheet
    ? await supabase
        .from("timesheet_entries")
        .select("id, date, entry_type, total_hours, description")
        .eq("timesheet_id", timesheet.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false })
    : { data: null };

  const totalHours = (entries ?? []).reduce((sum, e) => sum + (e.total_hours ?? 0), 0);
  const timesheetStatus = timesheet?.status ?? "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            My Timesheets
          </h1>
          <p className="mt-1 text-sm text-slate">
            {monthLabel} — {totalHours.toFixed(1)} total hours
          </p>
        </div>
        {timesheet && timesheetStatus === "draft" && entries && entries.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-lavender/10 px-3 py-1 text-xs font-medium text-lavender-dark">
            Draft — not yet submitted
          </span>
        )}
        {timesheetStatus === "submitted" && (
          <span className="inline-flex items-center rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-dark">
            Submitted — awaiting review
          </span>
        )}
        {timesheetStatus === "approved" && (
          <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            Approved
          </span>
        )}
      </div>

      {(!entries || entries.length === 0) ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No timesheet entries for {monthLabel}. Hours will appear here as they are logged.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cloud/50">
                  <th className="px-4 py-3 text-left font-medium text-slate">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-slate">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-cloud/30 transition-colors">
                    <td className="px-4 py-3 text-charcoal">
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-charcoal">
                      {entry.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal font-medium">
                      {entry.total_hours?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-silver bg-cloud/30">
                  <td colSpan={3} className="px-4 py-3 text-sm font-medium text-charcoal">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-charcoal">
                    {totalHours.toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
