import { requireTeacher } from "@/lib/auth/guards";
import { getMyClasses } from "@/lib/queries/teach";
import { AttendanceMarker } from "./attendance-marker";

export default async function AttendancePage() {
  await requireTeacher();
  const classes = await getMyClasses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-slate">
          Select a class and mark attendance for today or any date.
        </p>
      </div>

      <AttendanceMarker
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          day_of_week: c.day_of_week,
          start_time: c.start_time,
        }))}
      />
    </div>
  );
}
