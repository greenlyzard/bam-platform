import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (!payPeriod) {
    const deadline = new Date(year, month - 1, 26);
    const { data: created } = await supabase
      .from("pay_periods")
      .insert({
        tenant_id: tenantId,
        period_month: month,
        period_year: year,
        submission_deadline: deadline.toISOString().split("T")[0],
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

  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  return tp;
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
