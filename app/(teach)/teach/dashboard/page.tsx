import { requireTeacher } from "@/lib/auth/guards";
import {
  getTodaysClasses,
  getMyClasses,
  getMyStudentCount,
} from "@/lib/queries/teach";
import { EmptyState } from "@/components/bam/empty-state";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default async function TeachDashboardPage() {
  const user = await requireTeacher();
  const [todaysClasses, allClasses, studentCount] = await Promise.all([
    getTodaysClasses(),
    getMyClasses(),
    getMyStudentCount(),
  ]);

  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Good{" "}
          {today.getHours() < 12
            ? "morning"
            : today.getHours() < 17
              ? "afternoon"
              : "evening"}
          {user.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {dayName},{" "}
          {today.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Today&apos;s Classes" value={todaysClasses.length} />
        <StatCard label="Total Classes" value={allClasses.length} />
        <StatCard label="Total Students" value={studentCount} />
      </div>

      {/* Today's Classes */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Today&apos;s Schedule
        </h2>
        {todaysClasses.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No classes today"
            description={`You don't have any classes scheduled for ${dayName}. Enjoy your day off.`}
          />
        ) : (
          <div className="space-y-3">
            {todaysClasses.map((cls) => (
              <div
                key={cls.id}
                className="rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-charcoal">{cls.name}</h3>
                    <p className="text-sm text-slate mt-0.5">
                      {cls.start_time && formatTime(cls.start_time)}
                      {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                      {cls.room && (
                        <span className="text-mist"> · {cls.room}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/teach/attendance?class=${cls.id}`}
                      className="inline-flex h-9 items-center rounded-lg border border-silver px-3 text-xs font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors"
                    >
                      Mark Attendance
                    </a>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark">
                    {cls.style?.replace("_", " ")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                    {cls.level?.replace("_", " ")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                    max {cls.max_students}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/teach/attendance" icon="●" label="Attendance" />
          <QuickAction href="/teach/hours" icon="◷" label="Log Hours" />
          <QuickAction href="/teach/badges" icon="◆" label="Award Badge" />
          <QuickAction href="/teach/messages" icon="✉" label="Messages" />
        </div>
      </section>

      {/* Weekly Overview */}
      {allClasses.length > 0 && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Weekly Overview
          </h2>
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayClasses = allClasses.filter(
                (c) => c.day_of_week === day
              );
              if (dayClasses.length === 0) return null;
              return (
                <div key={day} className="px-4 py-3">
                  <h4 className="text-xs font-semibold text-mist uppercase tracking-wide mb-1">
                    {DAY_NAMES[day]}
                  </h4>
                  <div className="space-y-1">
                    {dayClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-charcoal font-medium">
                          {cls.name}
                        </span>
                        <span className="text-slate">
                          {cls.start_time && formatTime(cls.start_time)}
                          {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                        </span>
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
      <p className="text-2xl font-heading font-semibold text-charcoal">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-silver bg-white p-4 text-center hover:border-lavender hover:shadow-sm transition-all"
    >
      <span className="text-xl text-lavender">{icon}</span>
      <span className="text-xs font-medium text-charcoal">{label}</span>
    </a>
  );
}
