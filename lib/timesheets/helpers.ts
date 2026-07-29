import { createClient } from "@/lib/supabase/server";
import { tenantToday } from "@/lib/dates";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The submission deadline for a pay period: the 26th of the period's own month.
 *
 * Built as a string from the already-resolved year/month rather than via
 * `new Date(year, month - 1, 26).toISOString()`. Once the period is known this
 * is pure calendar arithmetic with no instant involved, so routing it through a
 * Date only reintroduces a runtime zone that can shift the day.
 */
export function payPeriodDeadline(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-26`;
}

/**
 * The teacher edit cutoff for a pay period: the 3rd of the FOLLOWING month.
 *
 * TODO(tenant-config): this constant belongs on the tenant, not in code. The
 * "3rd of the following month" rule is Ballet Academy and Movement's, taken
 * from the seeded 2026/27 season (supabase/migrations/20260728000004). A
 * white-label studio on a different cadence needs its own value, so this should
 * become a `tenants` column (e.g. `teacher_edit_cutoff_day` + a month offset)
 * read here instead of a literal. Until then every auto-created period inherits
 * BAM's calendar.
 *
 * Why this must be set at all: a period row inserted with a null cutoff falls
 * back to `submission_deadline` in computePeriodLock — the lock-after-the-26th
 * behaviour that 1da6896 exists to undo. Leaving it null silently reinstates
 * the old bug for any tenant whose periods are auto-created rather than seeded.
 *
 * Same string-arithmetic discipline as payPeriodDeadline: December rolls to
 * January of the next year by integer math, with no Date in the path.
 */
export function payPeriodEditCutoff(year: number, month: number): string {
  const cutoffYear = month === 12 ? year + 1 : year;
  const cutoffMonth = month === 12 ? 1 : month + 1;
  return `${cutoffYear}-${String(cutoffMonth).padStart(2, "0")}-03`;
}

/**
 * First and last calendar day of a pay period's month, as `YYYY-MM-DD`.
 *
 * The window the draft generator is called with from the timesheet page: it
 * drafts the period the teacher is looking at, and nothing outside it.
 *
 * Same string-arithmetic discipline as payPeriodDeadline — the last day is
 * found by taking day 0 of the FOLLOWING month through `Date.UTC`, which is
 * pure calendar arithmetic on a fixed zone, then reading back UTC components.
 * No toISOString, no local-zone Date: both would let the runtime's offset move
 * the boundary by a day, which is the failure docs/TENANT_TIMEZONE_SPEC.md
 * catalogues.
 */
export function payPeriodMonthRange(
  year: number,
  month: number
): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Add (or subtract) whole days to a `YYYY-MM-DD`, returning `YYYY-MM-DD`.
 *
 * Anchored at UTC midnight and read back with getUTC* accessors, so the result
 * is pure calendar arithmetic — month and year rollover included — with no
 * instant and no zone in the answer. Deliberately not `toISOString().slice(0,10)`:
 * that reintroduces a formatting path this codebase bans, and the manual
 * padding here makes the absence of a zone explicit rather than incidental.
 *
 * Returns the input unchanged if it is not a well-formed date, so a malformed
 * value fails at the query rather than becoming a silently shifted window.
 */
export function addDaysToYmd(ymd: string, days: number): string {
  const parsed = payPeriodForDate(ymd);
  if (!parsed) return ymd;

  const day = Number(ymd.slice(8, 10));
  const d = new Date(Date.UTC(parsed.year, parsed.month - 1, day + days));

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * The pay period a `YYYY-MM-DD` work date belongs to.
 *
 * NOT the period "now" falls in. An attendance record for August 31 entered on
 * September 2 belongs to the AUGUST period — the hours were worked in August
 * and are paid on August's run. Resolving from today would file them to
 * September, where the teacher's August timesheet will never show them.
 *
 * Takes no timezone, deliberately. `date` on `timesheet_entries` is a Postgres
 * `date` — a calendar day with no instant and no zone attached. It was already
 * resolved in the tenant's zone at the point it was captured (client-side
 * defaults via toLocalDateStr, or typed by the teacher). Converting it through
 * a Date here to "apply" a zone would shift it by a day, which is exactly the
 * failure docs/TENANT_TIMEZONE_SPEC.md catalogues. Pure string parsing is the
 * correct operation, not a shortcut around one.
 *
 * Returns null on anything that is not a well-formed `YYYY-MM-DD` with a real
 * month, so a malformed date surfaces as a refused write rather than a row
 * filed to year 0.
 */
export function payPeriodForDate(
  ymd: string
): { month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { month, year };
}

/**
 * Last-resort lock rule: locked after the 26th **of the tenant's calendar day**.
 *
 * This is now only reached when no `pay_periods` row exists for the current
 * month — see computePeriodLock below. It is not the studio's rule; it is what
 * the studio's rule used to be hardcoded to, kept so a tenant with no period row
 * yet does not fall open.
 *
 * The tenant-zone read matters: `new Date().getDate() > 26` on a UTC runtime
 * engages at 5pm Pacific on the 26th rather than at midnight, costing teachers
 * the last seven hours of the window. See docs/TENANT_TIMEZONE_SPEC.md §3.3.
 */
export function isPeriodLocked(timeZone: string): boolean {
  const day = Number(tenantToday(timeZone).slice(8, 10));
  return day > 26;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format a `YYYY-MM-DD` date column for display, e.g. "August 3, 2026".
 *
 * Pure string manipulation — no `Date` anywhere. `new Date("2026-08-03")`
 * parses as UTC midnight and renders as August 2 for anyone west of UTC, which
 * would print a cutoff a day earlier than the one actually being enforced.
 */
export function formatPeriodDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return ymd;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export interface PeriodLockState {
  /** Are teacher edits (add / update / delete) frozen? */
  locked: boolean;
  /** The date the freeze actually keys off — cutoff when set, else deadline. */
  lockDate: string | null;
  submissionDeadline: string | null;
  teacherEditCutoff: string | null;
  /**
   * Past the submission deadline but NOT past the edit cutoff. A real state:
   * the timesheet is late, and still editable. Distinct from both "on time" and
   * "locked", and the teacher needs to be told which one they are in.
   */
  lateButOpen: boolean;
  /** Which rule produced `locked` — for copy and for debugging. */
  basis: "teacher_edit_cutoff" | "submission_deadline" | "no_period_row";
  /** Tenant-local today, `YYYY-MM-DD`. */
  today: string;
}

/**
 * Decide whether teacher edits are frozen for a pay period.
 *
 * `submission_deadline` is a DUE DATE — the studio's "email your timesheet by
 * the 26th" rule — and was previously being enforced as a freeze. That left
 * work done on the 27th–31st of every month with nowhere to be recorded.
 * `teacher_edit_cutoff` is the field that means "no more edits", and it is the
 * one this reads when it is set.
 *
 *   cutoff set   → locked once tenant-local today is AFTER the cutoff
 *   cutoff null  → fall back to the deadline (previous behaviour), because a
 *                  historical period like March 2026 deliberately has no cutoff
 *                  and must not become permanently editable
 *   no period row → fall back to the hardcoded 26th
 *
 * Both bounds are INCLUSIVE: `today > cutoff`, not `>=`. A cutoff of the 3rd
 * means the 3rd is still workable — a cutoff date the teacher cannot use is not
 * the date they were told.
 *
 * Comparison is plain lexicographic string comparison. `submission_deadline`
 * and `teacher_edit_cutoff` are Postgres `date` columns, PostgREST returns them
 * zero-padded `YYYY-MM-DD`, and `today` comes from tenantToday() in the same
 * shape — so lexicographic order IS chronological order. Do not "fix" this by
 * parsing to Date; that reintroduces the UTC-midnight shift.
 */
export function computePeriodLock(
  period: {
    submission_deadline: string | null;
    teacher_edit_cutoff: string | null;
  } | null,
  today: string,
  timeZone: string
): PeriodLockState {
  if (!period) {
    return {
      locked: isPeriodLocked(timeZone),
      lockDate: null,
      submissionDeadline: null,
      teacherEditCutoff: null,
      lateButOpen: false,
      basis: "no_period_row",
      today,
    };
  }

  const cutoff = period.teacher_edit_cutoff;
  const deadline = period.submission_deadline;

  const lockDate = cutoff ?? deadline;
  const basis = cutoff ? "teacher_edit_cutoff" : "submission_deadline";

  // A period row with neither date set cannot be locked by date. Staying open is
  // the safe direction: the teacher can still file, and payroll review catches
  // late work. Falling closed would strand the hours with no way to enter them.
  const locked = lockDate ? today > lockDate : false;

  return {
    locked,
    lockDate,
    submissionDeadline: deadline,
    teacherEditCutoff: cutoff,
    lateButOpen: !locked && !!deadline && today > deadline,
    basis,
    today,
  };
}

/** The two date columns computePeriodLock decides from. */
async function fetchPeriodDates(
  supabase: SupabaseClient,
  tenantId: string,
  month: number,
  year: number
) {
  const { data } = await supabase
    .from("pay_periods")
    .select("submission_deadline, teacher_edit_cutoff")
    .eq("tenant_id", tenantId)
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  return data;
}

/**
 * Resolve the lock state of a GIVEN pay period, not today's.
 *
 * The variant every write goes through, and the only one — a `resolvePeriodLock`
 * that resolved TODAY's period used to sit here and was deleted with zero
 * callers, because for a write it answers the wrong question and its own doc
 * comment had to warn against it. "Is the current window open?" and "is the
 * period this row will land in open?" diverge for exactly the case the cutoff
 * exists to cover. On September 2 a teacher backdates an entry to August 31:
 * today's period is September (open — its cutoff is October 3), the entry files
 * to August (whose cutoff, September 3, is the one that governs it). Checking
 * September there waves through the edit the August cutoff forbids.
 *
 * Callers that genuinely want today's window — banners, the entry form's
 * enabled state — fetch the row and call computePeriodLock directly, as
 * /teach/timesheets does.
 *
 * Resolution against `today` is unchanged — a cutoff is a date the tenant's
 * calendar day is compared to. Only WHICH period's cutoff is read moves.
 *
 * **A missing period row is UNLOCKED here**, deliberately diverging from
 * `computePeriodLock(null, …)`, which falls back to the hardcoded 26th. That
 * fallback is right for today's period — a tenant with no row for the month
 * they are living in should not fall open — but wrong for an arbitrary one. An
 * entry whose period does not exist yet is about to CREATE that period
 * (getOrCreateTimesheet inserts it moments later, status `open`), and it cannot
 * be past a cutoff that did not exist when it was written. Locking on the
 * hardcoded 26th would make every entry dated into a not-yet-seeded month
 * unfilable after the 26th of the tenant's current month, which has nothing to
 * do with the period being written to. Reported as basis `no_period_row` so the
 * two cases stay distinguishable in logs.
 *
 * computePeriodLock's rules are untouched: it is still the only thing that
 * decides `locked` whenever there is a row to decide from.
 */
export async function resolvePeriodLockForPeriod(
  supabase: SupabaseClient,
  tenantId: string,
  timeZone: string,
  period: { month: number; year: number }
): Promise<PeriodLockState> {
  const today = tenantToday(timeZone);
  const row = await fetchPeriodDates(
    supabase,
    tenantId,
    period.month,
    period.year
  );

  if (!row) {
    return {
      locked: false,
      lockDate: null,
      submissionDeadline: null,
      teacherEditCutoff: null,
      lateButOpen: false,
      basis: "no_period_row",
      today,
    };
  }

  return computePeriodLock(row, today, timeZone);
}

/** A resolved lock, or the reason the work date could not be resolved to one. */
export type PeriodLockForWorkDate = PeriodLockState | { error: string };

/**
 * Resolve the lock governing a `YYYY-MM-DD` work date's own pay period.
 *
 * The form every write path wants: it pairs payPeriodForDate with
 * resolvePeriodLockForPeriod so the period a caller LOCKS against and the
 * period getOrCreateTimesheet FILES to are derived from the same date by the
 * same function. Splitting those two derivations is how the check drifted off
 * the write in the first place.
 *
 * A malformed date returns the same refusal getOrCreateTimesheet gives it, so a
 * bad date reads identically whichever guard reaches it first.
 */
export async function resolvePeriodLockForWorkDate(
  supabase: SupabaseClient,
  tenantId: string,
  timeZone: string,
  workDate: string
): Promise<PeriodLockForWorkDate> {
  const period = payPeriodForDate(workDate);
  if (!period) {
    return { error: "That date is not a valid calendar date." };
  }

  return resolvePeriodLockForPeriod(supabase, tenantId, timeZone, period);
}

/**
 * The message a teacher sees when an edit is refused. Names the date actually
 * being enforced instead of a hardcoded "the 26th", which for July 2026 was
 * wrong by eight days.
 */
export function periodLockMessage(lock: PeriodLockState): string {
  if (lock.lockDate) {
    return `This pay period closed to edits after ${formatPeriodDate(lock.lockDate)}.`;
  }
  return "This pay period is closed to edits.";
}

/**
 * A resolved timesheet, or the reason it could not be resolved.
 *
 * Discriminated rather than `Timesheet | null` because every failure here is
 * something the teacher can act on or report — a bad work date, a pay period
 * that could not be created, an RLS refusal. The previous null return collapsed
 * all of them into "Could not create timesheet." at the call site with the real
 * Postgres error only in the server log.
 */
export type TimesheetForPeriod =
  | { id: string; status: string }
  | { error: string };

/**
 * Get or create the draft timesheet a work date's hours belong on.
 *
 * THE ONE implementation. Three used to exist — this one, a copy in
 * app/(teach)/teach/timesheets/actions.ts, and a third in
 * app/(admin)/admin/timesheets/actions.ts — and they did not agree.
 *
 * The dangerous divergence was this function's own previous body: it looked up
 * a timesheet by `status in ('draft','rejected')` ordered by `created_at`, with
 * NO pay-period scope. So the attendance path attached new hours to whatever
 * draft the teacher last happened to have — for a teacher carrying an unfiled
 * March draft, an August class landed in March. Nothing surfaced the mistake:
 * /teach/timesheets scopes its query by `pay_period_id`, so those hours simply
 * were not on the page, in any period. That path is how most hours get logged
 * once the season starts.
 *
 * Two rules this now holds to:
 *
 *  1. Scope by pay period. `timesheets` is UNIQUE (tenant_id, teacher_id,
 *     pay_period_id), so tenant + teacher + period identifies exactly one row.
 *     Status is not a lookup key — an approved timesheet for August must not
 *     cause a second August timesheet, and a stale March draft must not absorb
 *     August's hours. The caller decides what to do about a non-draft status;
 *     that decision does not belong in the lookup.
 *
 *  2. Derive the period from `workDate`, never from today. See payPeriodForDate.
 *
 * Does NOT check the period lock — callers do, before they get here, so the
 * refusal message can name the date being enforced. Does NOT resolve or write
 * rates: a BEFORE INSERT/UPDATE trigger (trg_snapshot_timesheet_entry_rate)
 * snapshots amount_cents from the entry's own `date`.
 *
 * @param workDate the entry's `YYYY-MM-DD` work date — NOT today
 */
export async function getOrCreateTimesheet(
  supabase: SupabaseClient,
  teacherProfileId: string,
  tenantId: string,
  workDate: string
): Promise<TimesheetForPeriod> {
  const period = payPeriodForDate(workDate);
  if (!period) {
    console.error("[timesheets:getOrCreateTimesheet] bad work date:", workDate);
    return { error: "That date is not a valid calendar date." };
  }
  const { month, year } = period;

  // Tenant-scoped. The unique key on pay_periods is
  // (tenant_id, period_month, period_year) — without the tenant filter this
  // .maybeSingle() starts erroring the moment a second tenant exists, and would
  // hand back another studio's period before that.
  const { data: fetched, error: ppFetchErr } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (ppFetchErr) {
    console.error("[timesheets:payPeriodFetch]", ppFetchErr);
    return { error: `Pay period lookup failed: ${ppFetchErr.message}` };
  }

  let payPeriod = fetched;

  if (!payPeriod) {
    const { data: created, error: ppErr } = await supabase
      .from("pay_periods")
      .insert({
        tenant_id: tenantId,
        period_month: month,
        period_year: year,
        submission_deadline: payPeriodDeadline(year, month),
        teacher_edit_cutoff: payPeriodEditCutoff(year, month),
        status: "open",
      })
      .select("id")
      .single();

    if (ppErr) {
      console.error("[timesheets:createPayPeriod]", ppErr);
      return { error: `Could not create pay period: ${ppErr.message}` };
    }
    payPeriod = created;
  }

  if (!payPeriod) return { error: "Pay period could not be resolved." };

  const { data: existing, error: tsFetchErr } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("teacher_id", teacherProfileId)
    .eq("pay_period_id", payPeriod.id)
    .maybeSingle();

  if (tsFetchErr) {
    console.error("[timesheets:timesheetFetch]", tsFetchErr);
    return { error: `Timesheet lookup failed: ${tsFetchErr.message}` };
  }

  if (existing) return existing;

  const { data: newTs, error: tsError } = await supabase
    .from("timesheets")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherProfileId,
      pay_period_id: payPeriod.id,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (tsError) {
    console.error("[timesheets:createTimesheet]", tsError);
    return { error: `Could not create timesheet: ${tsError.message}` };
  }

  return newTs ?? { error: "Timesheet creation returned no data." };
}

/** Get the teacher context (profile id + tenant) for the current authenticated user */
export async function getTeacherContext(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // teacher_profiles VIEW uses `id` (= profiles.id), not `user_id`,
  // and has no `tenant_id` — get that from profile_roles
  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!tp) return null;

  // Array query — user may hold multiple active roles (e.g. super_admin + teacher)
  const { data: roles } = await supabase
    .from("profile_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const tenantId = roles?.[0]?.tenant_id;
  if (!tenantId) return null;

  return { id: tp.id, tenant_id: tenantId };
}

/** Compute decimal hours from HH:MM time strings */
export function computeHoursFromTimes(startTime: string, endTime: string): number | null {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;

  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMinutes <= 0) return null;

  return Math.round((diffMinutes / 60) * 100) / 100;
}
