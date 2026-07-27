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
 * Is the current pay period locked to teacher edits?
 *
 * Locks after the 26th **of the tenant's calendar day**, not the runtime's. The
 * previous implementation used `new Date().getDate() > 26`, which on a UTC
 * runtime engages at 5pm Pacific on the 26th rather than at midnight — teachers
 * lost the last seven hours of their filing window.
 *
 * NOTE: this preserves the existing hardcoded-26 rule. It deliberately does not
 * read `pay_periods.submission_deadline`, `teacher_edit_cutoff`, or `status`.
 * `teacher_edit_cutoff` is null on every live row and `status` is `open` on
 * every live row (including a four-month-stale March period), so switching to
 * them would silently disable the lock. Changing the rule is a payroll policy
 * decision, not a timezone fix. See docs/TENANT_TIMEZONE_SPEC.md §3.3.
 */
export function isPeriodLocked(timeZone: string): boolean {
  const day = Number(tenantToday(timeZone).slice(8, 10));
  return day > 26;
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
