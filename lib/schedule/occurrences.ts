// Pure, testable occurrence generation for a single class (task 19). No DB, no I/O.
// The DB layer (lib/schedule/generate.ts) fetches classes + closures and persists the output.
//
// Today every class is single-day (scalar `classes.day_of_week`); when the per-meeting
// `class_meetings` table ships, only the DB layer's input mapping changes — this core keeps its
// shape (one class-meeting → one weekly series).

export interface ClassForOccurrences {
  id: string;
  tenant_id: string;
  teacher_id: string | null;
  room_id: string | null;
  location_id: string | null;
  /** 0 = Sunday … 6 = Saturday (JS getUTCDay convention). */
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  /** 'YYYY-MM-DD' */
  start_date: string | null;
  /** 'YYYY-MM-DD'; null = open-ended (clamped to the window). */
  end_date: string | null;
}

/** Map of closed 'YYYY-MM-DD' → reason (studio-wide closures). Presence of a key = closed. */
export type ClosureMap = Record<string, string>;

export interface OccurrenceRow {
  /** `${class_id}:${event_date}` — the upsert key (schedule_instances.ical_uid is UNIQUE). */
  ical_uid: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string | null;
  room_id: string | null;
  location_id: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: "class";
  status: "scheduled" | "cancelled";
  cancellation_reason: string | null;
}

/** Parse 'YYYY-MM-DD' as a UTC date (day-of-week math free of local-TZ drift). */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const maxISO = (a: string, b: string) => (a >= b ? a : b);
const minISO = (a: string, b: string) => (a <= b ? a : b);

/**
 * Generate occurrence rows for one class within [windowStart, windowEnd] (inclusive ISO dates).
 *
 * Iterates `day_of_week` from `max(start_date, windowStart)` through
 * `min(end_date ?? windowEnd, windowEnd)`. A date on a studio closure → `status: 'cancelled'` with
 * the closure reason; otherwise `status: 'scheduled'`. Returns `[]` when the class has no
 * `day_of_week`/`start_date`, or the effective range is empty.
 */
export function generateOccurrencesForClass(
  cls: ClassForOccurrences,
  closures: ClosureMap,
  windowStart: string,
  windowEnd: string
): OccurrenceRow[] {
  if (cls.day_of_week == null || !cls.start_date) return [];

  const rangeStart = maxISO(cls.start_date, windowStart);
  const rangeEnd = minISO(cls.end_date ?? windowEnd, windowEnd);
  if (rangeStart > rangeEnd) return [];

  const rows: OccurrenceRow[] = [];
  const cursor = parseISODate(rangeStart);
  const end = parseISODate(rangeEnd);

  // Advance to the first matching weekday.
  while (cursor <= end && cursor.getUTCDay() !== cls.day_of_week) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  // Then step weekly.
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const eventDate = toISODate(cursor);
    const isClosed = Object.prototype.hasOwnProperty.call(closures, eventDate);
    rows.push({
      ical_uid: `${cls.id}:${eventDate}`,
      tenant_id: cls.tenant_id,
      class_id: cls.id,
      teacher_id: cls.teacher_id,
      room_id: cls.room_id,
      location_id: cls.location_id,
      event_date: eventDate,
      start_time: cls.start_time,
      end_time: cls.end_time,
      event_type: "class",
      status: isClosed ? "cancelled" : "scheduled",
      cancellation_reason: isClosed ? (closures[eventDate] || "Studio closure") : null,
    });
  }
  return rows;
}
