import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTimesheetDrafts } from "@/lib/timesheets/drafts";
import { tenantPayPeriod, tenantToday } from "@/lib/dates";
import { payPeriodMonthRange, addDaysToYmd } from "@/lib/timesheets/helpers";

/**
 * Nightly timesheet draft generation for every tenant.
 *
 * Runs at 08:30 UTC — half an hour after /api/cron/schedule-generate (08:00).
 * That ordering is the point, not a coincidence: the draft generator reads
 * `schedule_instances`, so it has to run AFTER the occurrence generator has
 * extended the rolling window, or the newest days produce nothing and only get
 * picked up a day late.
 *
 * Why a cron at all, when the timesheet page generates on load: the page only
 * covers teachers who visit it. A teacher who opens their timesheet once at
 * month end would otherwise find a month of hours appearing at the moment they
 * are least able to check them. The nightly pass keeps drafts arriving as the
 * work happens.
 *
 * Window is the current pay period's month start through today + 7 days. The
 * forward week is what makes the page-load call almost always a no-op: by the
 * time a teacher looks, the rows already exist. The generator is idempotent on
 * (teacher, schedule_instance_id), so the overlapping windows across nightly
 * runs create nothing twice, and an entry a teacher DELETED is never
 * regenerated — that guarantee lives in the function and nothing here works
 * around it.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // Fails CLOSED when the secret is unset. The older cron routes in this repo
  // use `if (cronSecret) { ...check... }`, which silently leaves the endpoint
  // open on any deploy missing the variable. This one creates payroll rows
  // across every tenant; an unauthenticated caller must never reach it, and a
  // missing config is a reason to refuse rather than to skip the check.
  if (!cronSecret) {
    console.error("[cron:timesheet-drafts] CRON_SECRET is not set — refusing");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // `tenants` has no is_active column — every row is a live tenant today.
    // Timezone comes back on the same read: the period boundary is a calendar
    // question and must be answered in the tenant's zone, not the runtime's
    // (Vercel is UTC, so a UTC-derived month rolls over ~5pm Pacific).
    const { data: tenants, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, slug, timezone");

    if (tenantErr) {
      console.error("[cron:timesheet-drafts] tenant fetch failed", tenantErr);
      return NextResponse.json({ error: "Tenant fetch failed" }, { status: 500 });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const tenant of tenants ?? []) {
      const period = tenantPayPeriod(tenant.timezone);
      const { from } = payPeriodMonthRange(period.year, period.month);
      const to = addDaysToYmd(tenantToday(tenant.timezone), 7);

      const result = await generateTimesheetDrafts(supabase, {
        tenantId: tenant.id,
        from,
        to,
        // Every teacher in the tenant.
        teacherId: null,
      });

      // One tenant's failure must not abort the others. Recorded per tenant so
      // a partial run is visible in the response rather than inferred from a
      // count that came back lower than expected.
      results.push({ tenant: tenant.slug, from, to, ...result });

      if ("error" in result) {
        console.error(`[cron:timesheet-drafts] ${tenant.slug}:`, result.error);
      } else {
        console.log(
          `[cron:timesheet-drafts] ${tenant.slug} ${from}..${to}:`,
          `created=${result.created}`,
          `skipped_locked=${result.skipped_locked}`,
          `skipped_existing=${result.skipped_existing}`,
          `skipped_no_teacher=${result.skipped_no_teacher}`
        );
      }
    }

    const failed = results.filter((r) => "error" in r).length;

    return NextResponse.json({
      ok: failed === 0,
      tenants: results.length,
      failed,
      results,
    });
  } catch (err) {
    console.error("[cron:timesheet-drafts]", err);
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 });
  }
}
