const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

interface ClassCardProps {
  classData: {
    id: string;
    name: string;
    style: string;
    level: string;
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    room: string | null;
  };
  studentName?: string;
  status?: string;
}

export function ClassCard({ classData, studentName, status }: ClassCardProps) {
  const style = classData.style ?? "ballet";

  return (
    <div className="rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Style badge */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              styleColors[style] ?? "bg-cloud text-slate"
            }`}
          >
            {style.replace("_", " ")}
          </span>

          {/* Class name */}
          <h3 className="mt-1.5 font-semibold text-charcoal truncate">
            {classData.name}
          </h3>

          {/* Schedule */}
          {classData.day_of_week !== null && classData.start_time && (
            <p className="mt-1 text-sm text-slate">
              {dayNames[classData.day_of_week]}s{" "}
              {formatTime(classData.start_time)}
              {classData.end_time && ` – ${formatTime(classData.end_time)}`}
            </p>
          )}

          {/* Room */}
          {classData.room && (
            <p className="text-xs text-mist mt-0.5">{classData.room}</p>
          )}

          {/* Student name if provided */}
          {studentName && (
            <p className="mt-2 text-xs text-slate">
              Enrolled: <span className="font-medium">{studentName}</span>
            </p>
          )}
        </div>

        {/* Status indicator */}
        {status && (
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              status === "active"
                ? "bg-success/10 text-success"
                : status === "trial"
                  ? "bg-warning/10 text-warning"
                  : status === "waitlist"
                    ? "bg-info/10 text-info"
                    : "bg-cloud text-slate"
            }`}
          >
            {status === "active"
              ? "Enrolled"
              : status === "trial"
                ? "Trial"
                : status === "waitlist"
                  ? "Waitlisted"
                  : status}
          </span>
        )}
      </div>
    </div>
  );
}
