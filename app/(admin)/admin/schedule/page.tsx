import { requireAdmin } from "@/lib/auth/guards";
import { getScheduleInstances, getClassesAsScheduleInstances, getApprovedTeachers, getRooms, getDistinctLevels } from "@/lib/schedule/queries";
import { ScheduleCalendar } from "./schedule-calendar";

function getWeekRange(weekParam?: string): { startDate: string; endDate: string; weekStart: string } {
  let monday: Date;

  if (weekParam) {
    monday = new Date(weekParam + "T00:00:00");
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
  searchParams: Promise<{
    week?: string;
    teacher?: string;
    level?: string;
    room?: string;
    day?: string;
  }>;
}) {
  const user = await requireAdmin();

  const params = await searchParams;
  const { startDate, endDate, weekStart } = getWeekRange(params.week);

  const filterParams = {
    startDate,
    endDate,
    teacherId: params.teacher,
    level: params.level,
    roomId: params.room,
    dayOfWeek: params.day,
    tenantId: user.tenantId ?? undefined,
  };

  const [sessionInstances, classInstances, teachers, rooms, levels] = await Promise.all([
    getScheduleInstances(filterParams),
    getClassesAsScheduleInstances(filterParams),
    getApprovedTeachers(),
    getRooms(),
    getDistinctLevels(),
  ]);

  // Use session instances if available, otherwise fall back to recurring classes
  const instances = sessionInstances.length > 0 ? sessionInstances : classInstances;
  const isRecurring = sessionInstances.length === 0;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <ScheduleCalendar
          instances={instances}
          teachers={teachers}
          rooms={rooms}
          levels={levels}
          weekStart={weekStart}
          isRecurring={isRecurring}
          initialFilters={{
            teacher: params.teacher || "",
            level: params.level || "",
            room: params.room || "",
            day: params.day || "",
          }}
        />
      </div>
    </div>
  );
}
