import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TeacherEventsClient } from "./events-client";

export default async function TeacherEventsPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // ── 1. Get teacher's assigned classes via class_teachers ────
  const { data: assignments } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", user.id);

  const classIds = [...new Set((assignments ?? []).map((a) => a.class_id))];

  // ── 2. Date range: today → 60 days ─────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 60);
  const futureStr = future.toISOString().split("T")[0];

  // ── 3. Generate class events from day_of_week templates ─────
  type EventItem = {
    id: string;
    type: "class" | "private" | "rehearsal";
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    organizer: string | null;
    organizerId: string | null;
  };

  const events: EventItem[] = [];

  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, day_of_week, start_time, end_time, room, teacher_id")
      .in("id", classIds)
      .eq("is_active", true);

    for (const cls of classes ?? []) {
      if (cls.day_of_week == null || !cls.start_time || !cls.end_time) continue;

      const cursor = new Date(today);
      while (cursor.getDay() !== cls.day_of_week) {
        cursor.setDate(cursor.getDate() + 1);
      }
      while (cursor <= future) {
        const dateStr = cursor.toISOString().split("T")[0];
        events.push({
          id: `class-${cls.id}-${dateStr}`,
          type: "class",
          title: cls.name,
          date: dateStr,
          startTime: cls.start_time,
          endTime: cls.end_time,
          location: cls.room,
          organizer: null,
          organizerId: cls.teacher_id,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    }
  }

  // ── 4. Fetch teacher's private sessions ─────────────────────
  const { data: privates } = await supabase
    .from("private_sessions")
    .select(
      "id, session_type, session_date, start_time, end_time, studio, primary_teacher_id, status"
    )
    .eq("primary_teacher_id", user.id)
    .gte("session_date", todayStr)
    .lte("session_date", futureStr)
    .in("status", ["scheduled"]);

  for (const ps of privates ?? []) {
    events.push({
      id: `private-${ps.id}`,
      type: "private",
      title: `${ps.session_type ?? "Private"} Private`,
      date: ps.session_date,
      startTime: ps.start_time,
      endTime: ps.end_time,
      location: ps.studio,
      organizer: null,
      organizerId: ps.primary_teacher_id,
    });
  }

  // ── 5. Resolve teacher names ────────────────────────────────
  const teacherIds = new Set<string>();
  for (const e of events) {
    if (e.organizerId) teacherIds.add(e.organizerId);
  }

  const teacherNames: Record<string, string> = {};
  if (teacherIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...teacherIds]);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  for (const e of events) {
    if (e.organizerId) {
      e.organizer = teacherNames[e.organizerId] ?? null;
    }
  }

  // ── 6. Sort by date, then startTime ─────────────────────────
  events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6">
      <TeacherEventsClient events={events} />
    </div>
  );
}
