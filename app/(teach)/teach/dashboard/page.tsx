import { requireTeacher } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  getTodaysClasses,
  getMyClasses,
  getMyStudentCount,
} from "@/lib/queries/teach";
import { EmptyState } from "@/components/bam/empty-state";
import Link from "next/link";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default async function TeachDashboardPage() {
  const user = await requireTeacher();
  const supabase = await createClient();
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const todayStr = today.toISOString().split("T")[0];
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  // Parallel fetch all dashboard data
  const [todaysClasses, allClasses, studentCount] = await Promise.all([
    getTodaysClasses(),
    getMyClasses(),
    getMyStudentCount(),
  ]);

  // Upcoming privates (next 7 days)
  let upcomingPrivates: any[] = [];
  let privatStudentMap: Record<string, string> = {};
  try {
    const { data: privates } = await supabase
      .from("private_sessions")
      .select("id, session_type, session_date, start_time, end_time, studio, student_ids, status, booking_source")
      .eq("primary_teacher_id", user.id)
      .gte("session_date", todayStr)
      .lte("session_date", weekEndStr)
      .neq("status", "cancelled")
      .order("session_date")
      .order("start_time");
    upcomingPrivates = privates ?? [];

    const sids = [...new Set(upcomingPrivates.flatMap((p: any) => p.student_ids ?? []))];
    if (sids.length > 0) {
      const { data: students } = await supabase.from("students").select("id, first_name").in("id", sids);
      for (const s of students ?? []) privatStudentMap[s.id] = s.first_name;
    }
  } catch {}

  // Pending evaluations (draft status for this teacher's classes)
  let pendingEvals: any[] = [];
  try {
    const classIds = allClasses.map((c: any) => c.id);
    if (classIds.length > 0) {
      const { data } = await supabase
        .from("student_evaluations")
        .select("id, student_id, class_id, status, students(first_name, last_name), classes(name)")
        .in("class_id", classIds)
        .eq("status", "draft")
        .limit(10);
      pendingEvals = (data ?? []).map((e: any) => ({
        id: e.id,
        studentName: e.students ? [e.students.first_name, e.students.last_name].filter(Boolean).join(" ") : "Unknown",
        className: e.classes?.name ?? "Unknown",
        classId: e.class_id,
      }));
    }
  } catch {}

  // Timesheet status
  let timesheetAlert: { type: "flagged" | "due" | "approved" | null; message: string } = { type: null, message: "" };
  try {
    const { data: ts } = await supabase
      .from("timesheets")
      .select("id, status, submitted_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (ts) {
      if (ts.status === "approved") {
        timesheetAlert = { type: "approved", message: "Your latest timesheet has been approved." };
      } else if (ts.status === "draft") {
        timesheetAlert = { type: "due", message: "Your timesheet is still in draft — submit before the deadline." };
      }
    }

    // Check for flagged entries
    if (ts) {
      const { count } = await supabase
        .from("timesheet_entries")
        .select("id", { count: "exact", head: true })
        .eq("timesheet_id", ts.id)
        .eq("status", "flagged");
      if (count && count > 0) {
        timesheetAlert = { type: "flagged", message: `Amanda has ${count} question${count > 1 ? "s" : ""} about your timesheet — please respond.` };
      }
    }
  } catch {}

  // Recent unread notifications
  let recentNotifs: any[] = [];
  try {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, created_at")
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(3);
    recentNotifs = data ?? [];
  } catch {}

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Good {today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"}
          {user.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate">{dayName}, {today.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
      </div>

      {/* Timesheet Alert */}
      {timesheetAlert.type && (
        <Link
          href="/teach/timesheets"
          className={`block rounded-xl p-3 text-sm font-medium ${
            timesheetAlert.type === "flagged" ? "bg-error/10 text-error border border-error/20" :
            timesheetAlert.type === "due" ? "bg-gold/10 text-gold-dark border border-gold/20" :
            "bg-success/10 text-success border border-success/20"
          }`}
        >
          {timesheetAlert.message}
        </Link>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today's Classes" value={todaysClasses.length} />
        <StatCard label="Privates This Week" value={upcomingPrivates.length} />
        <StatCard label="Pending Evals" value={pendingEvals.length} />
        <StatCard label="Total Students" value={studentCount} />
      </div>

      {/* Today's Schedule */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">Today&apos;s Schedule</h2>
        {todaysClasses.length === 0 ? (
          <EmptyState icon="▦" title="No classes today" description={`Enjoy your ${dayName}.`} />
        ) : (
          <div className="space-y-2">
            {todaysClasses.map((cls: any) => (
              <div key={cls.id} className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-charcoal">{cls.name}</h3>
                  <p className="text-sm text-slate mt-0.5">
                    {cls.start_time && formatTime(cls.start_time)}
                    {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                    {cls.room && <span className="text-mist"> · {cls.room}</span>}
                  </p>
                </div>
                <Link
                  href={`/teach/attendance?class=${cls.id}`}
                  className="h-9 rounded-lg border border-silver px-3 text-xs font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors inline-flex items-center"
                >
                  Attendance
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Privates */}
      {upcomingPrivates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">Upcoming Privates</h2>
            <Link href="/teach/privates" className="text-xs text-lavender hover:text-lavender-dark">View all →</Link>
          </div>
          <div className="space-y-2">
            {upcomingPrivates.slice(0, 5).map((p: any) => {
              const names = ((p.student_ids as string[]) ?? []).map((sid: string) => privatStudentMap[sid] ?? "Student").join(", ");
              const needsConfirm = p.booking_source === "parent" && p.status === "scheduled";
              return (
                <div key={p.id} className="rounded-xl border border-silver bg-white p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{names}</p>
                    <p className="text-xs text-slate">
                      {new Date(p.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {p.start_time && ` · ${formatTime(p.start_time)}`}
                      {p.studio && ` · ${p.studio}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      p.status === "confirmed" ? "bg-success/10 text-success" :
                      p.status === "scheduled" ? "bg-gold/10 text-gold-dark" :
                      "bg-cloud text-slate"
                    }`}>{p.status}</span>
                    {needsConfirm && (
                      <Link href="/teach/privates" className="h-7 rounded-md bg-success text-white text-xs font-semibold px-2 inline-flex items-center">
                        Confirm
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pending Evaluations */}
      {pendingEvals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">Pending Evaluations</h2>
            <Link href="/teach/evaluations" className="text-xs text-lavender hover:text-lavender-dark">View all →</Link>
          </div>
          <div className="space-y-2">
            {pendingEvals.slice(0, 5).map((ev: any) => (
              <div key={ev.id} className="rounded-xl border border-silver bg-white p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-charcoal">{ev.studentName}</p>
                  <p className="text-xs text-slate">{ev.className}</p>
                </div>
                <Link
                  href={`/teach/evaluations/${ev.classId}`}
                  className="text-xs text-lavender hover:text-lavender-dark font-medium"
                >
                  Start →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/teach/attendance" icon="●" label="Attendance" />
          <QuickAction href="/teach/hours" icon="◷" label="Log Hours" />
          <QuickAction href="/teach/privates" icon="◇" label="Privates" />
          <QuickAction href="/teach/privates?book=1" icon="+" label="Book Private" />
          <QuickAction href="/teach/schedule" icon="▦" label="My Calendar" />
          <QuickAction href="/teach/messages" icon="✉" label="Messages" />
        </div>
      </section>

      {/* Recent Notifications */}
      {recentNotifs.length > 0 && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">Recent Messages</h2>
          <div className="space-y-2">
            {recentNotifs.map((n: any) => (
              <div key={n.id} className="rounded-lg border border-silver/50 bg-white p-3">
                <p className="text-sm font-medium text-charcoal">{n.title}</p>
                {n.body && <p className="text-xs text-slate mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-mist mt-1">{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly Overview */}
      {allClasses.length > 0 && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">Weekly Overview</h2>
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayClasses = allClasses.filter((c: any) => c.day_of_week === day);
              if (dayClasses.length === 0) return null;
              return (
                <div key={day} className="px-4 py-3">
                  <h4 className="text-xs font-semibold text-mist uppercase tracking-wide mb-1">{DAY_NAMES[day]}</h4>
                  <div className="space-y-1">
                    {dayClasses.map((cls: any) => (
                      <div key={cls.id} className="flex items-center justify-between text-sm">
                        <span className="text-charcoal font-medium">{cls.name}</span>
                        <span className="text-slate">{cls.start_time && formatTime(cls.start_time)}{cls.end_time && ` – ${formatTime(cls.end_time)}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className="text-2xl font-heading font-semibold text-charcoal">{value}</p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 rounded-xl border border-silver bg-white p-4 text-center hover:border-lavender hover:shadow-sm transition-all">
      <span className="text-xl text-lavender">{icon}</span>
      <span className="text-xs font-medium text-charcoal">{label}</span>
    </Link>
  );
}
