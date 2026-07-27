/**
 * Local calendar-date helpers.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE USING toLocalDateStr ON THE SERVER.
 *
 * toLocalDateStr() returns the calendar date of the **runtime it executes in**.
 *
 *   In a CLIENT component  → the runtime is the user's browser, so this is the
 *                            user's real local date. This is correct, and it is
 *                            what this helper is for.
 *
 *   In a SERVER component  → the runtime is the Vercel Node process, which runs
 *   / server action /        in **UTC**. No TZ is configured in next.config.ts
 *   / API route / cron       or vercel.json. So this returns the UTC date, which
 *                            after ~5pm Pacific is already TOMORROW.
 *
 * Using this on the server does NOT fix a timezone bug — it relocates it. The
 * result is identical to `new Date().toISOString().split("T")[0]`, just spelled
 * differently, and it will read as fixed to the next person who looks.
 *
 * A correct server-side calendar date requires knowing the STUDIO's timezone.
 * As of 2026-07-26 no such column exists anywhere in the schema — not on
 * `tenants`, not on `studio_settings`, not on `studio_locations` (verified
 * against information_schema). Until a tenant timezone exists and is threaded
 * through, server-rendered dates cannot be made correct, and this helper must
 * not be used to imply otherwise.
 *
 * Scope of the fix that introduced this file: client-side date DEFAULTS that
 * were persisting the wrong calendar day (attendance, timesheet entries,
 * private-session booking). Server-rendered dates, filters, pay-period
 * resolution, billing, and schedule generation were deliberately left alone.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * No server-only imports — safe to import from client components.
 */

/**
 * Format a Date as a `YYYY-MM-DD` string in the runtime's local timezone.
 *
 * Unlike `toISOString().split("T")[0]`, this does not shift the calendar day
 * for users west of UTC. Defaults to now.
 */
export function toLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
