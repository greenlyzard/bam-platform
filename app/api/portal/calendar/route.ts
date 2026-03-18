import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function formatICSDate(date: string, time: string): string {
  const d = new Date(`${date}T${time}`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

/**
 * GET /api/portal/calendar?token=<user_id>
 * Returns an ICS feed of the user's enrolled classes for the next 90 days.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get students for this parent
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", token)
    .eq("active", true);

  if (!students?.length) {
    return new NextResponse(buildEmptyCalendar(), {
      headers: { "Content-Type": "text/calendar; charset=utf-8" },
    });
  }

  const studentIds = students.map((s) => s.id);
  const studentNames: Record<string, string> = {};
  for (const s of students) {
    studentNames[s.id] = `${s.first_name} ${s.last_name}`;
  }

  // Get active enrollments
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, class_id")
    .in("student_id", studentIds)
    .in("status", ["active", "trial"]);

  if (!enrollments?.length) {
    return new NextResponse(buildEmptyCalendar(), {
      headers: { "Content-Type": "text/calendar; charset=utf-8" },
    });
  }

  const classIds = [...new Set(enrollments.map((e) => e.class_id))];

  // Map class → students
  const classToStudents: Record<string, string[]> = {};
  for (const e of enrollments) {
    if (!classToStudents[e.class_id]) classToStudents[e.class_id] = [];
    classToStudents[e.class_id].push(e.student_id);
  }

  // Get schedule instances for next 90 days
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 90);
  const futureStr = future.toISOString().split("T")[0];

  const { data: instances } = await supabase
    .from("schedule_instances")
    .select("id, class_id, event_date, start_time, end_time, status, room_id, teacher_id, notes")
    .in("class_id", classIds)
    .gte("event_date", today)
    .lte("event_date", futureStr)
    .neq("status", "cancelled")
    .order("event_date")
    .order("start_time");

  // Get class names
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, room")
    .in("id", classIds);

  const classMap: Record<string, { name: string; room: string | null }> = {};
  for (const c of classes ?? []) {
    classMap[c.id] = { name: c.name, room: c.room };
  }

  // Get room names
  const roomIds = [...new Set((instances ?? []).map((i) => i.room_id).filter(Boolean) as string[])];
  const roomMap: Record<string, string> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds);
    for (const r of rooms ?? []) {
      roomMap[r.id] = r.name;
    }
  }

  // Build ICS
  const events = (instances ?? []).map((inst) => {
    const cls = classMap[inst.class_id];
    const studentList = (classToStudents[inst.class_id] ?? [])
      .map((sid) => studentNames[sid])
      .join(", ");
    const roomName = inst.room_id ? roomMap[inst.room_id] : cls?.room;

    return [
      "BEGIN:VEVENT",
      `UID:${inst.id}@balletacademyandmovement.com`,
      `DTSTART:${formatICSDate(inst.event_date, inst.start_time)}`,
      `DTEND:${formatICSDate(inst.event_date, inst.end_time)}`,
      `SUMMARY:${escapeICS(cls?.name ?? "Class")}`,
      `DESCRIPTION:${escapeICS(`Dancer(s): ${studentList}`)}`,
      roomName ? `LOCATION:${escapeICS(roomName + " - Ballet Academy and Movement")}` : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ballet Academy and Movement//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:BAM Schedule",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bam-schedule.ics"',
    },
  });
}

function buildEmptyCalendar(): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ballet Academy and Movement//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:BAM Schedule",
    "END:VCALENDAR",
  ].join("\r\n");
}
