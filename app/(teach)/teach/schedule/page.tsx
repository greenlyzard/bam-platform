import { requireRole } from "@/lib/auth/guards";
import {
  getClassSessions,
  CLASS_TYPE_COLORS,
  CLASS_TYPE_BG,
} from "@/lib/schedule/queries";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function getMonday(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function TeacherSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireRole("teacher", "admin", "super_admin");
  const params = await searchParams;

  const monday = getMonday(params.week);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  // Fetch all sessions for the week, then filter to this teacher
  const allSessions = await getClassSessions({
    startDate: toISODate(monday),
    endDate: toISODate(saturday),
  });

  const mySessions = allSessions.filter(
    (s) =>
      s.lead_teacher_id === user.id ||
      s.substitute_teacher_id === user.id ||
      (s.assistant_teacher_ids ?? []).includes(user.id)
  );

  // Group by day (Mon-Sat)
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toISODate(d));
  }

  const byDay: Record<string, typeof mySessions> = {};
  for (const day of days) {
    byDay[day] = mySessions.filter((s) => s.session_date === day);
  }

  // Week navigation
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const thisMonday = getMonday();

  const totalSessions = mySessions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          My Schedule
        </h1>
        <p className="mt-1 text-sm text-slate">
          Week of {formatWeekLabel(monday)} &middot; {totalSessions} session
          {totalSessions !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <a
          href={`/teach/schedule?week=${toISODate(prevMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          &larr; Previous
        </a>
        <a
          href={`/teach/schedule?week=${toISODate(thisMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-lavender hover:bg-lavender/10 transition-colors"
        >
          This Week
        </a>
        <a
          href={`/teach/schedule?week=${toISODate(nextMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          Next &rarr;
        </a>
      </div>

      {/* Sessions by day */}
      {days.map((day) => {
        const daySessions = byDay[day];
        return (
          <section key={day}>
            <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
              {formatDayHeader(day)}
            </h2>
            {daySessions.length > 0 ? (
              <div className="space-y-3">
                {daySessions.map((session) => {
                  const borderColor =
                    CLASS_TYPE_BG[session.classType ?? "regular"] ?? "#9C8BBF";
                  const badgeClasses =
                    CLASS_TYPE_COLORS[session.classType ?? "regular"] ??
                    "bg-cloud text-slate";
                  const isSubbing =
                    session.substitute_teacher_id === user.id;
                  const isAssistant =
                    (session.assistant_teacher_ids ?? []).includes(user.id) &&
                    session.lead_teacher_id !== user.id;

                  return (
                    <a
                      key={session.id}
                      href={`/teach/schedule/${session.id}`}
                      className="block rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow"
                      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
                            >
                              {(session.classType ?? "regular").replace(
                                /_/g,
                                " "
                              )}
                            </span>
                            {session.is_cancelled && (
                              <span className="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                                Cancelled
                              </span>
                            )}
                            {session.needs_coverage && !session.is_cancelled && (
                              <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                Needs Coverage
                              </span>
                            )}
                            {isSubbing && (
                              <span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                                Subbing
                              </span>
                            )}
                            {isAssistant && (
                              <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                                Assisting
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-charcoal truncate">
                            {session.className ?? "Untitled Session"}
                          </h3>
                          <p className="text-sm text-slate mt-0.5">
                            {formatTime(session.start_time)} &ndash;{" "}
                            {formatTime(session.end_time)}
                            {session.room && (
                              <span className="text-mist">
                                {" "}
                                &middot; {session.room}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-charcoal">
                            {session.enrollmentCount ?? 0}
                          </p>
                          <p className="text-xs text-mist">students</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-6 text-center">
                <p className="text-sm text-mist">No sessions scheduled</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
