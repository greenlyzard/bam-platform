import { requireParent } from "@/lib/auth/guards";
import { getMyEnrollments } from "@/lib/queries/portal";
import { ClassCard } from "@/components/bam/ClassCard";
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

export default async function SchedulePage() {
  await requireParent();
  const enrollments = await getMyEnrollments();

  // Group by day of week
  const byDay: Record<
    number,
    typeof enrollments
  > = {};

  for (const enrollment of enrollments) {
    const classRaw = enrollment.classes as unknown;
    const classData = (
      Array.isArray(classRaw) ? classRaw[0] : classRaw
    ) as {
      id: string;
      name: string;
      style: string;
      level: string;
      day_of_week: number | null;
      start_time: string | null;
      end_time: string | null;
      room: string | null;
    } | null;

    const day = classData?.day_of_week;
    if (day == null) continue;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(enrollment);
  }

  // Sort each day's classes by start_time
  for (const day of Object.keys(byDay)) {
    byDay[Number(day)].sort((a, b) => {
      const aRaw = a.classes as unknown;
      const aClass = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as { start_time: string | null } | null;
      const bRaw = b.classes as unknown;
      const bClass = (Array.isArray(bRaw) ? bRaw[0] : bRaw) as { start_time: string | null } | null;
      return (aClass?.start_time ?? "").localeCompare(bClass?.start_time ?? "");
    });
  }

  // Get sorted days (Monday first: 1,2,3,4,5,6,0)
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
          Weekly Schedule
        </h1>
        <p className="mt-1 text-sm text-slate">
          Your dancers&apos; enrolled classes by day.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No classes yet"
          description="Once your dancers are enrolled in classes, their weekly schedule will appear here."
          actionLabel="Browse Classes"
          actionHref="/portal/schedule"
        />
      ) : (
        <div className="space-y-6">
          {sortedDays.map((day) => (
            <section key={day}>
              <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
                {DAY_NAMES[day]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {byDay[day].map((enrollment) => {
                  const studentRaw = enrollment.students as unknown;
                  const student = (
                    Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
                  ) as {
                    id: string;
                    first_name: string;
                    last_name: string;
                  } | null;
                  const classRaw2 = enrollment.classes as unknown;
                  const classData = (
                    Array.isArray(classRaw2) ? classRaw2[0] : classRaw2
                  ) as {
                    id: string;
                    name: string;
                    style: string;
                    level: string;
                    day_of_week: number | null;
                    start_time: string | null;
                    end_time: string | null;
                    room: string | null;
                  } | null;

                  if (!classData) return null;

                  return (
                    <ClassCard
                      key={enrollment.id}
                      classData={classData}
                      studentName={
                        student
                          ? `${student.first_name} ${student.last_name}`
                          : undefined
                      }
                      status={enrollment.status}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
