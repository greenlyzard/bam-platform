// Shared schedule display formatting — reused across enrollment chat, catalog, etc.
// Consolidates the duplicated formatTime + weekday helpers.

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** `day_of_week` integer (0 = Sunday … 6 = Saturday) → weekday name; "" if out of range/absent. */
export function formatDayOfWeek(day: number | null | undefined): string {
  if (day == null || !Number.isInteger(day) || day < 0 || day > 6) return "";
  return WEEKDAYS[day];
}

/** "HH:MM[:SS]" 24-hour → "H:MM AM/PM" (seconds dropped); "" if absent/unparseable. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const parts = time.split(":");
  const hour = parseInt(parts[0], 10);
  if (Number.isNaN(hour)) return "";
  const minute = parts[1] ?? "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${ampm}`;
}

/** Combine a `day_of_week` int + a start time into "Wednesday 4:30 PM" (parts omitted if absent). */
export function formatDayTime(
  day: number | null | undefined,
  time: string | null | undefined,
): string {
  return [formatDayOfWeek(day), formatTime(time)].filter(Boolean).join(" ");
}
