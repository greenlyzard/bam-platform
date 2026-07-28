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
 * That zone now lives on `tenants.timezone` and is carried on `AuthUser` as
 * `timezone` (see lib/auth/guards.ts). On the SERVER, use tenantToday() /
 * tenantDateStr() / tenantPayPeriod() below and pass that zone in.
 *
 *   Client component  → toLocalDateStr()
 *   Server anything   → tenant* helpers, with an explicit zone
 *
 * Scope of the fix that introduced this file: client-side date DEFAULTS that
 * were persisting the wrong calendar day (attendance, timesheet entries,
 * private-session booking). Server-rendered dates, filters, pay-period
 * resolution, billing, and schedule generation were deliberately left alone.
 * The tenant* helpers below exist as of Phase A of
 * docs/TENANT_TIMEZONE_SPEC.md, but the ~99 call sites that still derive dates
 * in UTC have NOT been migrated to them yet — that is phases B through F.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * No server-only imports — safe to import from client components.
 */

/**
 * Fallback zone for the rare case where no tenant can be resolved (an
 * authenticated user with no row in `profile_roles`, so no tenant_id).
 *
 * Mirrors the `tenants.timezone` column default. It is a last resort, not a
 * platform default — anything that can resolve a real tenant must use that
 * tenant's zone. See docs/TENANT_TIMEZONE_SPEC.md §4.2.
 */
export const DEFAULT_TENANT_TIMEZONE = "America/Los_Angeles";

/**
 * Format a Date as a `YYYY-MM-DD` string in the runtime's local timezone.
 *
 * Unlike `toISOString().split("T")[0]`, this does not shift the calendar day
 * for users west of UTC. Defaults to now.
 */
export function toLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ───────────────────────── tenant-zone helpers ─────────────────────────── */

/**
 * Extract the year/month/day an instant falls on **in a given IANA zone**.
 *
 * The zone is always a parameter and is never read from a global or from the
 * runtime. A cron job iterating tenants resolves a different zone per tenant
 * inside one process, so there is nothing ambient to read.
 *
 * Note on the formatting: `Intl.DateTimeFormat` output is locale-shaped, not
 * ISO. 'en-US' formats as M/D/YYYY, 'en-GB' as D/M/YYYY, and some locales
 * append an era or use non-Latin digits. So this does NOT format-then-parse.
 * It reads the individual parts via `formatToParts` and assembles the string
 * itself, which is order- and separator-independent.
 *
 * Throws `RangeError` if `timeZone` is not a zone this runtime knows — a bad
 * value in `tenants.timezone` fails loudly rather than silently producing a
 * date in some other zone.
 */
function zonedParts(
  d: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const read = (type: "year" | "month" | "day"): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) {
      throw new Error(
        `Intl.DateTimeFormat returned no "${type}" part for timeZone "${timeZone}"`
      );
    }
    const n = Number(part.value);
    if (!Number.isInteger(n)) {
      throw new Error(
        `Intl.DateTimeFormat returned a non-numeric "${type}" ("${part.value}") for timeZone "${timeZone}"`
      );
    }
    return n;
  };

  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * Format an instant as `YYYY-MM-DD` as it reads **in the tenant's timezone**.
 *
 * This is the server-side counterpart to toLocalDateStr(). Correct regardless
 * of the runtime's own zone, so it produces the same answer on a Pacific
 * laptop and on a UTC Vercel lambda.
 *
 * @param d        the instant to convert
 * @param timeZone IANA identifier, e.g. from `AuthUser.timezone`
 */
export function tenantDateStr(d: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(d, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Today's calendar date as `YYYY-MM-DD` **in the tenant's timezone**.
 *
 * Use this anywhere the server needs "today" — dashboard filters, upcoming/past
 * bucketing, `end_date < today` comparisons. After 5pm Pacific the UTC date is
 * already tomorrow; this is not.
 */
export function tenantToday(timeZone: string): string {
  return tenantDateStr(new Date(), timeZone);
}

/**
 * The pay period (calendar month) that "now" falls in, **in the tenant's
 * timezone**.
 *
 * `month` is 1-12, matching how pay periods are stored — NOT the 0-11 that
 * `Date.getMonth()` returns.
 *
 * This exists because on the last day of a month, after 5pm Pacific, a UTC
 * runtime resolves the *next* month and files the entry to the wrong pay
 * period. That is a payroll correctness bug, not a display bug — see
 * docs/TENANT_TIMEZONE_SPEC.md §3.3.
 */
export function tenantPayPeriod(timeZone: string): {
  month: number;
  year: number;
} {
  const { year, month } = zonedParts(new Date(), timeZone);
  return { month, year };
}

/* ────────────────────────── date-window helper ─────────────────────────── */

/**
 * Does a dated record's `[start_date, end_date]` window cover the calendar day
 * `ymd`?
 *
 * Used by every week/day view that renders recurring classes, so a class only
 * appears on days it actually runs. Without it a calendar shows every class on
 * every week — last season's (ending 2026-06-15) and next season's (starting
 * 2026-08-15) side by side on today's grid.
 *
 * Both bounds are OPTIONAL and independent. A null `start_date` means no lower
 * bound; a null `end_date` means no upper bound. **Null must never mean "never
 * show"** — the 89 imported Fall 2026/27 classes had both columns null before
 * the backfill, and treating null as exclusive would have blanked the calendar.
 *
 * PLAIN STRING COMPARISON, DELIBERATELY. `start_date`/`end_date` are Postgres
 * `date` columns and PostgREST returns them as zero-padded `YYYY-MM-DD`
 * (verified against live rows, e.g. "2025-08-14") — exactly what
 * `toLocalDateStr` emits. Lexicographic order on that format IS chronological
 * order, so this needs no parsing.
 *
 * Do NOT "improve" this by parsing to Date. `new Date("2026-08-15")` parses as
 * UTC midnight, so for anyone west of UTC it becomes the 14th local — the exact
 * class of bug docs/TENANT_TIMEZONE_SPEC.md exists to eliminate. Pass `ymd` from
 * `toLocalDateStr(day)` (client) or `tenantDateStr(day, tz)` (server).
 *
 * @param record `{ start_date, end_date }` — either may be null
 * @param ymd    the calendar day under test, `YYYY-MM-DD`
 */
export function classRunsOn(
  record: { start_date: string | null; end_date: string | null },
  ymd: string
): boolean {
  return (
    (!record.start_date || record.start_date <= ymd) &&
    (!record.end_date || record.end_date >= ymd)
  );
}
