import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClassMetricsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = createAdminClient();

  // Fetch class capacity
  const { data: cls } = await supabase
    .from("classes")
    .select("max_enrollment, max_students")
    .eq("id", classId)
    .single();
  const capacity = cls?.max_enrollment ?? cls?.max_students ?? 0;

  // Fetch enrollment count
  const { count: enrolledCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .in("status", ["active", "trial"]);

  const enrolled = enrolledCount ?? 0;
  const capacityPct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;

  // Fetch all attendance records for this class
  const { data: allRecords } = await supabase
    .from("attendance_records")
    .select("date, status, student_id")
    .eq("class_id", classId)
    .order("date", { ascending: false });

  const records = allRecords ?? [];

  // Group by date
  const byDate: Record<string, { present: number; total: number }> = {};
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = { present: 0, total: 0 };
    byDate[r.date].total++;
    if (r.status === "present" || r.status === "late") byDate[r.date].present++;
  }

  const sessionDates = Object.keys(byDate).sort().reverse();
  const totalSessions = sessionDates.length;

  // Average attendance rate
  let avgAttendance = 0;
  if (totalSessions > 0) {
    const rates = sessionDates.map((d) => byDate[d].total > 0 ? (byDate[d].present / byDate[d].total) * 100 : 0);
    avgAttendance = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }

  // Last 8 sessions for bar chart
  const last8 = sessionDates.slice(0, 8).reverse();
  const last8Data = last8.map((d) => ({
    date: d,
    rate: byDate[d].total > 0 ? Math.round((byDate[d].present / byDate[d].total) * 100) : 0,
    present: byDate[d].present,
    total: byDate[d].total,
  }));
  const maxRate = 100;

  // Students who missed last 2+ sessions
  const lastTwoDates = sessionDates.slice(0, 2);
  const missedStudents: Set<string> = new Set();
  if (lastTwoDates.length >= 2) {
    const studentIds = [...new Set(records.map((r) => r.student_id))];
    for (const sid of studentIds) {
      const recentRecords = records.filter(
        (r) => r.student_id === sid && lastTwoDates.includes(r.date)
      );
      const absentCount = recentRecords.filter((r) => r.status === "absent").length;
      const missingCount = lastTwoDates.length - recentRecords.length;
      if (absentCount + missingCount >= 2) missedStudents.add(sid);
    }
  }

  // New students this month
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { count: newStudentCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .in("status", ["active", "trial"])
    .gte("enrolled_at", thirtyDaysAgo.toISOString().split("T")[0]);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Avg Attendance" value={`${avgAttendance}%`} />
        <StatCard label="Enrolled / Capacity" value={`${enrolled}/${capacity}`} />
        <StatCard label="Sessions Tracked" value={totalSessions.toString()} />
        <StatCard label="New This Month" value={(newStudentCount ?? 0).toString()} />
      </div>

      {/* Capacity Bar */}
      {capacity > 0 && (
        <div className="rounded-xl border border-silver bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-charcoal">Capacity</p>
            <p className="text-sm text-slate">{capacityPct}%</p>
          </div>
          <div className="h-3 rounded-full bg-cloud overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                capacityPct >= 90 ? "bg-error" : capacityPct >= 70 ? "bg-warning" : "bg-success"
              }`}
              style={{ width: `${Math.min(capacityPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Attendance Trend */}
      {last8Data.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-4">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Attendance Trend (Last 8 Sessions)</h3>
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {last8Data.map((d) => {
              const h = maxRate > 0 ? (d.rate / maxRate) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-mist">{d.rate}%</span>
                  <div
                    className={`w-full rounded-t ${
                      d.rate >= 80 ? "bg-success" : d.rate >= 60 ? "bg-warning" : "bg-error"
                    }`}
                    style={{ height: `${h}%`, minHeight: 2 }}
                  />
                  <span className="text-[9px] text-mist">
                    {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up Needed */}
      {missedStudents.size > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <h3 className="text-sm font-semibold text-charcoal mb-1">Follow-up Needed</h3>
          <p className="text-xs text-slate">
            {missedStudents.size} student{missedStudents.size !== 1 ? "s" : ""} missed the last 2+ sessions.
            Check the Roster tab for details.
          </p>
        </div>
      )}

      {/* Empty state */}
      {totalSessions === 0 && (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No attendance data yet. Take attendance to start tracking metrics.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className="text-2xl font-heading font-semibold text-charcoal">{value}</p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}
