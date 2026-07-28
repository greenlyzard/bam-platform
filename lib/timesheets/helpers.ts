import { createClient } from "@/lib/supabase/server";
import { tenantPayPeriod, tenantToday } from "@/lib/dates";
import { getTenantTimezone } from "@/lib/tenant/timezone";

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

/**
 * Fetch the current pay period and resolve its lock state.
 *
 * For server actions, which have no pre-fetched period row. The page fetches the
 * row itself and calls computePeriodLock directly rather than paying for this
 * query twice — both routes go through the same decision function so the page
 * and the action can never disagree about whether editing is allowed.
 *
 * Does NOT change which period resolves as current: same tenantPayPeriod() +
 * tenant/month/year lookup used by getOrCreateTimesheet.
 */
export async function resolvePeriodLock(
  supabase: SupabaseClient,
  tenantId: string,
  timeZone: string
): Promise<PeriodLockState> {
  const { month, year } = tenantPayPeriod(timeZone);

  const { data: period } = await supabase
    .from("pay_periods")
    .select("submission_deadline, teacher_edit_cutoff")
    .eq("tenant_id", tenantId)
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  return computePeriodLock(period, tenantToday(timeZone), timeZone);
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

/** Get or create a draft timesheet for a teacher in the current pay period */
export async function getOrCreateTimesheet(
  supabase: SupabaseClient,
  teacherProfileId: string,
  tenantId: string
) {
  const { data: existing } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("teacher_id", teacherProfileId)
    .in("status", ["draft", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // Pay period resolved in the TENANT's zone, not the runtime's. On a UTC
  // runtime, after 5pm Pacific on the last day of a month, `now.getMonth()`
  // returns the next month and the entry is filed to the wrong pay period.
  const timeZone = await getTenantTimezone(supabase, tenantId);
  const { month, year } = tenantPayPeriod(timeZone);

  let { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (!payPeriod) {
    const { data: created } = await supabase
      .from("pay_periods")
      .insert({
        tenant_id: tenantId,
        period_month: month,
        period_year: year,
        submission_deadline: payPeriodDeadline(year, month),
        status: "open",
      })
      .select("id")
      .single();
    payPeriod = created;
  }

  if (!payPeriod) return null;

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
    return null;
  }

  return newTs;
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
