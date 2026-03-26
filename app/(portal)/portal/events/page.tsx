import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getMyStudents } from "@/lib/queries/portal";
import { EventsClient } from "./events-client";

export default async function PortalEventsPage() {
  const user = await requireParent();
  const supabase = await createClient();

  // ── 1. Get family students & enrolled class IDs ──────────────
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Events
        </h1>
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-slate">No upcoming events.</p>
        </div>
      </div>
    );
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .in("student_id", studentIds)
    .in("status", ["active", "trial"]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];

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

      // Generate dates matching day_of_week for the next 60 days
      const cursor = new Date(today);
      // Advance to first matching day
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
          organizer: null, // resolved below
          organizerId: cls.teacher_id,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    }
  }

  // ── 4. Fetch private sessions for family students ───────────
  const { data: allPrivates } = await supabase
    .from("private_sessions")
    .select(
      "id, session_type, session_date, start_time, end_time, studio, student_ids, primary_teacher_id, status"
    )
    .gte("session_date", todayStr)
    .lte("session_date", futureStr)
    .in("status", ["scheduled"]);

  const privates = (allPrivates ?? []).filter((s) =>
    (s.student_ids ?? []).some((sid: string) => studentIds.includes(sid))
  );

  for (const ps of privates) {
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

  // ── 7. Check if family can book privates ────────────────────
  const { count } = await supabase
    .from("private_sessions")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled"]);
  const canBookPrivate = true; // all parents can navigate to booking

  return (
    <div className="space-y-6">
      <EventsClient events={events} canBookPrivate={canBookPrivate} portalMode="parent" />
    </div>
  );
}
