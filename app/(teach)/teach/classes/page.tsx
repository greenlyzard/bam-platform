import { requireTeacher } from "@/lib/auth/guards";
import { getMyClasses } from "@/lib/queries/teach";
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

const styleColors: Record<string, string> = {
  ballet: "bg-lavender/10 text-lavender-dark",
  pointe: "bg-gold/10 text-gold-dark",
  jazz: "bg-error/10 text-error",
  contemporary: "bg-info/10 text-info",
  musical_theatre: "bg-warning/10 text-warning",
  lyrical: "bg-success/10 text-success",
  creative_movement: "bg-lavender-light text-lavender-dark",
  pre_ballet: "bg-lavender-light text-lavender-dark",
};

export default async function MyClassesPage() {
  await requireTeacher();
  const classes = await getMyClasses();

  // Group by day
  const byDay: Record<number, typeof classes> = {};
  for (const cls of classes) {
    const day = cls.day_of_week;
    if (day == null) continue;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(cls);
  }

  const sortedDays = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => {
      const aKey = a === 0 ? 7 : a;
      const bKey = b === 0 ? 7 : b;
      return aKey - bKey;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          My Classes
        </h1>
        <p className="mt-1 text-sm text-slate">
          Your assigned classes, rosters, and details.
        </p>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No classes assigned"
          description="You don't have any classes assigned yet. Contact the studio admin."
        />
      ) : (
        <div className="space-y-6">
          {sortedDays.map((day) => (
            <section key={day}>
              <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
                {DAY_NAMES[day]}
              </h2>
              <div className="space-y-3">
                {byDay[day].map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              styleColors[cls.style] ?? "bg-cloud text-slate"
                            }`}
                          >
                            {cls.style?.replace("_", " ")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                            {cls.level?.replace("_", " ")}
                          </span>
                        </div>
                        <h3 className="font-semibold text-charcoal">
                          {cls.name}
                        </h3>
                        <p className="text-sm text-slate mt-0.5">
                          {cls.start_time && formatTime(cls.start_time)}
                          {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                          {cls.room && (
                            <span className="text-mist"> · {cls.room}</span>
                          )}
                        </p>
                        {cls.age_min != null && cls.age_max != null && (
                          <p className="text-xs text-mist mt-0.5">
                            Ages {cls.age_min}–{cls.age_max} · Max{" "}
                            {cls.max_students} students
                          </p>
                        )}
                      </div>
                      <a
                        href={`/teach/attendance?class=${cls.id}`}
                        className="shrink-0 inline-flex h-9 items-center rounded-lg border border-silver px-3 text-xs font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors"
                      >
                        Attendance
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
