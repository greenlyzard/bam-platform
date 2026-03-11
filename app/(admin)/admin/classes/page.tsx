import { requireAdmin } from "@/lib/auth/guards";
import { getAllClasses } from "@/lib/queries/admin";

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

export default async function ClassesPage() {
  await requireAdmin();
  const classes = await getAllClasses();

  const activeClasses = classes.filter((c) => c.is_active);
  const inactiveClasses = classes.filter((c) => !c.is_active);

  // Group active classes by day
  const byDay: Record<number, typeof activeClasses> = {};
  for (const cls of activeClasses) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Classes
          </h1>
          <p className="mt-1 text-sm text-slate">
            {activeClasses.length} active classes ·{" "}
            {inactiveClasses.length} inactive
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active Classes" value={activeClasses.length} />
        <StatCard
          label="Total Enrolled"
          value={activeClasses.reduce((s, c) => s + c.enrolledCount, 0)}
        />
        <StatCard
          label="At Capacity"
          value={
            activeClasses.filter((c) => c.enrolledCount >= c.max_students)
              .length
          }
        />
        <StatCard
          label="Open Spots"
          value={activeClasses.reduce(
            (s, c) => s + Math.max(0, c.max_students - c.enrolledCount),
            0
          )}
        />
      </div>

      {/* Classes by day */}
      {sortedDays.map((day) => (
        <section key={day}>
          <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
            {DAY_NAMES[day]}
          </h2>
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {byDay[day].map((cls) => {
              const isFull = cls.enrolledCount >= cls.max_students;
              return (
                <div key={cls.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
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
                      <h3 className="font-semibold text-charcoal truncate">
                        {cls.name}
                      </h3>
                      <p className="text-sm text-slate mt-0.5">
                        {cls.start_time && formatTime(cls.start_time)}
                        {cls.end_time && ` – ${formatTime(cls.end_time)}`}
                        {cls.room && (
                          <span className="text-mist"> · {cls.room}</span>
                        )}
                      </p>
                      {cls.teacherName && (
                        <p className="text-xs text-mist mt-0.5">
                          Taught by {cls.teacherName}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-lg font-heading font-semibold ${
                          isFull ? "text-error" : "text-charcoal"
                        }`}
                      >
                        {cls.enrolledCount}/{cls.max_students}
                      </p>
                      <p className="text-xs text-mist">
                        {isFull ? "Full" : "enrolled"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Inactive classes */}
      {inactiveClasses.length > 0 && (
        <section>
          <h2 className="text-base font-heading font-semibold text-mist mb-3">
            Inactive Classes ({inactiveClasses.length})
          </h2>
          <div className="rounded-xl border border-dashed border-silver bg-white/50 divide-y divide-silver">
            {inactiveClasses.map((cls) => (
              <div key={cls.id} className="px-4 py-3 opacity-60">
                <p className="font-medium text-charcoal">{cls.name}</p>
                <p className="text-xs text-mist">
                  {cls.style?.replace("_", " ")} ·{" "}
                  {cls.level?.replace("_", " ")}
                </p>
              </div>
            ))}
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
