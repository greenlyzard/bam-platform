import { requireAdmin } from "@/lib/auth/guards";
import { getClassSessions, getApprovedTeachers } from "@/lib/schedule/queries";
import { ScheduleCalendar } from "./schedule-calendar";

function getWeekRange(weekParam?: string): { startDate: string; endDate: string; weekStart: string } {
  let monday: Date;

  if (weekParam) {
    monday = new Date(weekParam + "T00:00:00");
    // Adjust to Monday if not already
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday = new Date(now);
    monday.setDate(now.getDate() + diff);
  }

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    startDate: fmt(monday),
    endDate: fmt(saturday),
    weekStart: fmt(monday),
  };
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; teacher?: string; classType?: string; room?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const { startDate, endDate, weekStart } = getWeekRange(params.week);

  const [sessions, teachers] = await Promise.all([
    getClassSessions({
      startDate,
      endDate,
      classType: params.classType,
      teacherId: params.teacher,
      room: params.room,
    }),
    getApprovedTeachers(),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <ScheduleCalendar
          sessions={sessions}
          teachers={teachers}
          weekStart={weekStart}
          initialFilters={{
            teacher: params.teacher || "",
            classType: params.classType || "",
            room: params.room || "",
          }}
        />
      </div>
    </div>
  );
}
