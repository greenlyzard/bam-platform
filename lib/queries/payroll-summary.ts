import { createClient } from "@/lib/supabase/server";

export async function getPayrollSummary() {
  const supabase = await createClient();

  // Count pending approval timesheets
  const { count: pendingCount } = await supabase
    .from("timesheets")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");

  // Get current month's entries for hours and estimated payroll
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select("total_hours, status")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const totalHoursThisMonth = (entries ?? []).reduce(
    (sum, e) => sum + (e.total_hours ?? 0),
    0
  );

  const flaggedCount = (entries ?? []).filter(
    (e) => e.status === "flagged"
  ).length;

  // Rough estimate: approved hours * average rate ($30/hr default)
  const approvedHours = (entries ?? [])
    .filter((e) => e.status === "approved" || e.status === "paid")
    .reduce((sum, e) => sum + (e.total_hours ?? 0), 0);

  const estimatedPayroll = approvedHours * 30;

  return {
    pendingCount: pendingCount ?? 0,
    totalHoursThisMonth,
    estimatedPayroll,
    flaggedCount,
  };
}
