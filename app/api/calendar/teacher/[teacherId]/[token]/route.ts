import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MAP: Record<number, string> = {
  0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA",
};

function toIcsDate(dateStr: string, timeStr: string): string {
  // Convert "2026-03-30" + "16:00" to "20260330T160000"
  return dateStr.replace(/-/g, "") + "T" + timeStr.replace(/:/g, "") + "00";
}

function nextOccurrence(dayOfWeek: number, timeStr: string): string {
  const now = new Date();
  const today = now.getDay();
  let diff = dayOfWeek - today;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7; // next week if today
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  const d = next.toISOString().split("T")[0];
  return toIcsDate(d, timeStr);
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teacherId: string; token: string }> }
) {
  const { teacherId, token } = await params;
  const supabase = createAdminClient();

  // Validate token
  const { data: sub } = await supabase
    .from("calendar_subscriptions")
    .select("id")
    .eq("user_id", teacherId)
    .eq("subscription_token", token)
    .maybeSingle();

  if (!sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Update last_synced_at
  await supabase
    .from("calendar_subscriptions")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", sub.id);

  // Fetch teacher's classes
  const { data: ctRows } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", teacherId);

  const classIds = (ctRows ?? []).map((c) => c.class_id);

  let classes: any[] = [];
  const roomMap: Record<string, string> = {};

  if (classIds.length > 0) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, discipline, day_of_week, days_of_week, start_time, end_time, room_id, levels, start_date, end_date")
      .in("id", classIds)
      .eq("is_active", true);
    classes = data ?? [];

    const roomIds = [...new Set(classes.map((c) => c.room_id).filter(Boolean))];
    if (roomIds.length > 0) {
      const { data: rooms } = await supabase.from("rooms").select("id, name").in("id", roomIds);
      for (const r of rooms ?? []) roomMap[r.id] = r.name;
    }
  }

  // Fetch private sessions
  const { data: privates } = await supabase
    .from("private_sessions")
    .select("id, session_date, start_time, end_time, studio, status, session_notes")
    .eq("primary_teacher_id", teacherId)
    .neq("status", "cancelled");

  // Fetch studio name
  const { data: settings } = await supabase
    .from("studio_settings")
    .select("studio_name")
    .single();

  const studioName = settings?.studio_name ?? "Ballet Academy and Movement";

  // Build ICS
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcs(studioName)}//Schedule//EN`,
    `X-WR-CALNAME:${escapeIcs(studioName)} - My Schedule`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:America/Los_Angeles",
  ];

  // Recurring class events
  for (const c of classes) {
    if (!c.start_time || !c.end_time) continue;
    const days = c.days_of_week?.length ? c.days_of_week : c.day_of_week != null ? [c.day_of_week] : [];

    for (const dow of days) {
      const byDay = DAY_MAP[dow];
      if (!byDay) continue;

      const dtstart = nextOccurrence(dow, c.start_time);
      const dtend = nextOccurrence(dow, c.end_time);
      const room = c.room_id ? roomMap[c.room_id] ?? "" : "";
      const desc = [c.discipline, c.levels?.join(", ")].filter(Boolean).join(" - ");

      let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
      if (c.end_date) {
        rrule += `;UNTIL=${c.end_date.replace(/-/g, "")}T235959`;
      }

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${c.id}-${dow}@balletacademyandmovement.com`);
      lines.push(`DTSTART;TZID=America/Los_Angeles:${dtstart}`);
      lines.push(`DTEND;TZID=America/Los_Angeles:${dtend}`);
      lines.push(rrule);
      lines.push(`SUMMARY:${escapeIcs(c.name)}`);
      if (room) lines.push(`LOCATION:${escapeIcs(room)}`);
      if (desc) lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
      lines.push("END:VEVENT");
    }
  }

  // Private session events (non-recurring)
  for (const p of privates ?? []) {
    if (!p.session_date || !p.start_time || !p.end_time) continue;
    const dtstart = toIcsDate(p.session_date, p.start_time);
    const dtend = toIcsDate(p.session_date, p.end_time);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:private-${p.id}@balletacademyandmovement.com`);
    lines.push(`DTSTART;TZID=America/Los_Angeles:${dtstart}`);
    lines.push(`DTEND;TZID=America/Los_Angeles:${dtend}`);
    lines.push("SUMMARY:Private Lesson");
    if (p.studio) lines.push(`LOCATION:${escapeIcs(p.studio)}`);
    if (p.session_notes) lines.push(`DESCRIPTION:${escapeIcs(p.session_notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-schedule.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
