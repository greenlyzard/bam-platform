import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function calculateAge(dob: string): number {
  const birth = new Date(dob + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlisted: "bg-gold/10 text-gold-dark",
};

export default async function ClassRosterPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = createAdminClient();

  // Fetch enrolled students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      status,
      enrolled_at,
      student:students (
        id, first_name, last_name, avatar_url, current_level, date_of_birth
      )
    `)
    .eq("class_id", classId)
    .in("status", ["active", "trial"]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const students = (enrollments ?? [])
    .filter((e) => e.student)
    .map((e) => {
      const s = e.student as any;
      const isNew = e.enrolled_at && e.enrolled_at >= thirtyDaysAgoStr;
      return {
        id: s.id as string,
        firstName: s.first_name as string,
        lastName: s.last_name as string,
        avatarUrl: s.avatar_url as string | null,
        level: s.current_level as string | null,
        dob: s.date_of_birth as string | null,
        enrolledAt: e.enrolled_at as string | null,
        status: e.status as string,
        isNew,
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  // Check attendance for follow-up flags (missed last 2+ sessions)
  const studentIds = students.map((s) => s.id);
  const missedMap: Record<string, number> = {};

  if (studentIds.length > 0) {
    // Get the last 4 session dates for this class
    const { data: recentDates } = await supabase
      .from("attendance_records")
      .select("date")
      .eq("class_id", classId)
      .order("date", { ascending: false })
      .limit(100);

    const uniqueDates = [...new Set((recentDates ?? []).map((r) => r.date))].slice(0, 4);

    if (uniqueDates.length >= 2) {
      const lastTwoDates = uniqueDates.slice(0, 2);
      const { data: recentRecords } = await supabase
        .from("attendance_records")
        .select("student_id, date, status")
        .eq("class_id", classId)
        .in("date", lastTwoDates)
        .in("student_id", studentIds);

      // Count absences in last 2 sessions
      for (const sid of studentIds) {
        const records = (recentRecords ?? []).filter((r) => r.student_id === sid);
        const absentCount = records.filter((r) => r.status === "absent").length;
        const missingCount = lastTwoDates.length - records.length; // not recorded = absent
        missedMap[sid] = absentCount + missingCount;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate">{students.length} student{students.length !== 1 ? "s" : ""}</p>
        <Link
          href={`/teach/classes/${classId}/attendance`}
          className="shrink-0 inline-flex h-9 items-center rounded-lg bg-lavender px-4 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          Take Attendance
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No students enrolled in this class.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const initials = `${s.firstName[0]}${s.lastName[0]}`.toUpperCase();
            const needsFollowUp = (missedMap[s.id] ?? 0) >= 2;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border bg-white p-3 hover:shadow-sm transition-shadow ${needsFollowUp ? "border-warning/40" : "border-silver"}`}
              >
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender/10 text-sm font-semibold text-lavender-dark">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-charcoal truncate">
                      {s.firstName} {s.lastName}
                    </p>
                    {s.isNew && (
                      <span className="inline-flex items-center rounded-full bg-lavender/10 px-1.5 py-0.5 text-[10px] font-semibold text-lavender-dark">
                        NEW
                      </span>
                    )}
                    {needsFollowUp && (
                      <span className="inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        FOLLOW UP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate">
                    {s.level && <span>{s.level.replace(/_/g, " ")}</span>}
                    {s.dob && <span> · Age {calculateAge(s.dob)}</span>}
                    {s.enrolledAt && (
                      <span className="text-mist">
                        {" "}· Enrolled {new Date(s.enrolledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[s.status] ?? "bg-cloud text-slate"}`}>
                  {s.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
