import { requireAdmin } from "@/lib/auth/guards";
import { getScheduleInstances } from "@/lib/calendar/queries";
import { getPendingApprovalTasks } from "@/lib/calendar/queries";
import { getUser } from "@/lib/auth/guards";
import { EVENT_TYPE_COLORS } from "@/lib/calendar/types";
import type { ScheduleInstanceWithDetails } from "@/lib/calendar/types";

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

function getEventBadge(
  event: ScheduleInstanceWithDetails
): { label: string; classes: string } {
  // Use level if available, otherwise event type
  const levelKey = event.level?.toLowerCase().replace(/\s+/g, "_");
  if (levelKey && EVENT_TYPE_COLORS[levelKey]) {
    return {
      label: event.level!.replace(/_/g, " "),
      classes: EVENT_TYPE_COLORS[levelKey],
    };
  }

  const typeColors = EVENT_TYPE_COLORS[event.event_type] ?? "bg-cloud text-slate";
  const typeLabels: Record<string, string> = {
    class: "Class",
    trial_class: "Trial",
    rehearsal: "Rehearsal",
    private_lesson: "Private",
    performance: "Performance",
    room_block: "Room Block",
    teacher_absence: "Absence",
    studio_closure: "Closure",
  };

  return {
    label: typeLabels[event.event_type] ?? event.event_type,
    classes: typeColors,
  };
}

const STATUS_BADGES: Record<string, string> = {
  cancelled: "bg-error/10 text-error",
  draft: "bg-cloud text-slate",
  pending_approval: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  published: "",
  notified: "",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdmin();
  const user = await getUser();

  const resolvedParams = await searchParams;
  const monday = getMonday(resolvedParams.week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 5); // Mon–Sat

  const [events, pendingTasks] = await Promise.all([
    getScheduleInstances({
      startDate: toISODate(monday),
      endDate: toISODate(sunday),
    }),
    user ? getPendingApprovalTasks(user.id) : Promise.resolve([]),
  ]);

  const pendingCount = pendingTasks.length;

  // Stats
  const classCount = events.filter(
    (e) => e.event_type === "class" || e.event_type === "trial_class"
  ).length;
  const rehearsalCount = events.filter(
    (e) => e.event_type === "rehearsal"
  ).length;
  const cancelledCount = events.filter(
    (e) => e.status === "cancelled"
  ).length;

  // Group by day (Mon–Sat)
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toISODate(d));
  }

  const byDay: Record<string, ScheduleInstanceWithDetails[]> = {};
  for (const day of days) {
    byDay[day] = events.filter((e) => e.event_date === day);
  }

  // Week navigation
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const thisMonday = getMonday();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-slate">
            Week of {formatWeekLabel(monday)} &middot; {events.length} events
          </p>
        </div>
      </div>

      {/* Pending approvals banner */}
      {pendingCount > 0 && (
        <div className="rounded-xl bg-lavender/10 border border-lavender/20 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-lavender-dark">
            {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}{" "}
            require your attention
          </p>
          <a
            href="/admin/schedule-change-requests"
            className="text-sm font-semibold text-lavender hover:text-lavender-dark transition-colors"
          >
            View requests
          </a>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Classes" value={classCount} />
        <StatCard label="Rehearsals" value={rehearsalCount} />
        <StatCard label="Cancelled" value={cancelledCount} />
        <StatCard label="Pending Approval" value={pendingCount} />
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <a
          href={`/admin/calendar?week=${toISODate(prevMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          &larr; Previous
        </a>
        <a
          href={`/admin/calendar?week=${toISODate(thisMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-lavender hover:bg-lavender/10 transition-colors"
        >
          This Week
        </a>
        <a
          href={`/admin/calendar?week=${toISODate(nextMonday)}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
        >
          Next &rarr;
        </a>
      </div>

      {/* Events by day */}
      {days.map((day) => {
        const dayEvents = byDay[day];
        return (
          <section key={day}>
            <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
              {formatDayHeader(day)}
            </h2>
            {dayEvents.length > 0 ? (
              <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
                {dayEvents.map((event) => {
                  const badge = getEventBadge(event);
                  const statusBadge = STATUS_BADGES[event.status];
                  return (
                    <div key={event.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                            {event.style && (
                              <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                                {event.style.replace(/_/g, " ")}
                              </span>
                            )}
                            {statusBadge && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}
                              >
                                {event.status.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-charcoal truncate">
                            {event.className ?? event.event_type.replace(/_/g, " ")}
                          </h3>
                          <p className="text-sm text-slate mt-0.5">
                            {formatTime(event.start_time)} &ndash;{" "}
                            {formatTime(event.end_time)}
                            {event.roomName && (
                              <span className="text-mist">
                                {" "}
                                &middot; {event.roomName}
                              </span>
                            )}
                          </p>
                          {(event.teacherName ||
                            event.substituteTeacherName) && (
                            <p className="text-xs text-mist mt-0.5">
                              {event.substituteTeacherName
                                ? `Sub: ${event.substituteTeacherName}`
                                : `Taught by ${event.teacherName}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-6 text-center">
                <p className="text-sm text-mist">No events scheduled</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className="text-2xl font-heading font-semibold text-charcoal">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}
