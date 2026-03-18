import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AttendanceOverview } from "./attendance-overview";

export const metadata = { title: "Attendance — Admin" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; teacher?: string }>;
}) {
  await requireRole("admin", "super_admin");
  const supabase = await createClient();
  const params = await searchParams;

  // Default: current week (Mon–Sun)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const dateFrom =
    params.from || monday.toISOString().split("T")[0];
  const dateTo =
    params.to || sunday.toISOString().split("T")[0];

  // Get all classes with teachers
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, teacher_id, is_active")
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  // Get teacher names
  const teacherIds = [
    ...new Set((classes ?? []).map((c) => c.teacher_id).filter(Boolean)),
  ];
  const { data: teacherProfiles } = teacherIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds)
    : { data: [] };

  const teacherMap: Record<
    string,
    { first_name: string | null; last_name: string | null }
  > = {};
  for (const p of teacherProfiles ?? []) {
    teacherMap[p.id] = { first_name: p.first_name, last_name: p.last_name };
  }

  // Build session rows: for each class, check which dates in range match day_of_week
  const fromDate = new Date(dateFrom + "T12:00:00");
  const toDate = new Date(dateTo + "T12:00:00");

  interface SessionRow {
    classId: string;
    className: string;
    teacherId: string;
    teacherName: string;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    date: string;
  }

  const sessionRows: SessionRow[] = [];
  for (const c of classes ?? []) {
    if (c.day_of_week == null) continue;
    if (params.teacher && c.teacher_id !== params.teacher) continue;

    const teacher = c.teacher_id ? teacherMap[c.teacher_id] : null;
    const teacherName = teacher
      ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ")
      : "Unassigned";

    // Find all dates in range matching this day_of_week
    const d = new Date(fromDate);
    while (d <= toDate) {
      if (d.getDay() === c.day_of_week) {
        sessionRows.push({
          classId: c.id,
          className: c.name,
          teacherId: c.teacher_id ?? "",
          teacherName,
          dayOfWeek: c.day_of_week,
          startTime: c.start_time,
          endTime: c.end_time,
          date: d.toISOString().split("T")[0],
        });
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // Get attendance records for these class/date combos
  const classIds = [...new Set(sessionRows.map((s) => s.classId))];
  const { data: attendanceRecords } = classIds.length
    ? await supabase
        .from("attendance")
        .select("class_id, class_date, student_id, status")
        .in("class_id", classIds)
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo)
    : { data: [] };

  // Build attendance count map: classId:date → { present, total }
  const attendanceMap: Record<
    string,
    { present: number; total: number }
  > = {};
  for (const r of attendanceRecords ?? []) {
    const key = `${r.class_id}:${r.class_date}`;
    if (!attendanceMap[key]) attendanceMap[key] = { present: 0, total: 0 };
    attendanceMap[key].total++;
    if (r.status === "present" || r.status === "late") {
      attendanceMap[key].present++;
    }
  }

  // Get timesheet entries for these class/date combos to check Hours Logged
  const { data: timesheetEntries } = classIds.length
    ? await supabase
        .from("timesheet_entries")
        .select("class_id, date")
        .in("class_id", classIds)
        .gte("date", dateFrom)
        .lte("date", dateTo)
    : { data: [] };

  const timesheetMap = new Set<string>();
  for (const e of timesheetEntries ?? []) {
    if (e.class_id) {
      timesheetMap.add(`${e.class_id}:${e.date}`);
    }
  }

  // Build final rows
  const rows = sessionRows.map((s) => {
    const key = `${s.classId}:${s.date}`;
    const att = attendanceMap[key];
    const hoursLogged = timesheetMap.has(key);
    const attendanceTaken = !!att && att.total > 0;
    return {
      ...s,
      dayLabel: DAYS[s.dayOfWeek],
      attendanceTaken,
      presentCount: att?.present ?? 0,
      totalCount: att?.total ?? 0,
      hoursLogged,
    };
  });

  // Sort by date, then start_time
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });

  // Get unique teachers for filter
  const teachers = [...new Map(
    (classes ?? [])
      .filter((c) => c.teacher_id)
      .map((c) => {
        const t = teacherMap[c.teacher_id!];
        return [
          c.teacher_id!,
          {
            id: c.teacher_id!,
            name: t
              ? [t.first_name, t.last_name].filter(Boolean).join(" ")
              : "Unknown",
          },
        ] as const;
      })
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AttendanceOverview
      rows={rows}
      teachers={teachers}
      dateFrom={dateFrom}
      dateTo={dateTo}
      filterTeacher={params.teacher || ""}
    />
  );
}
