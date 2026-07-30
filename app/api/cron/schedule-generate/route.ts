import { NextResponse } from "next/server";
import { extendAllActiveClasses } from "@/lib/schedule/generate";

/**
 * Daily cron — extend the rolling occurrence window for every active class and reconcile closures
 * (task 19). Re-running generation flips FUTURE-row status both directions as closures are added or
 * removed; past rows are never touched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNSCHEDULED 2026-07-30 — the cron entry for this path was removed from
 * vercel.json (it ran "0 8 * * *"). The route is RETAINED and still callable by
 * hand; nothing here is disabled. It simply no longer fires on its own.
 *
 * Why: this TypeScript generator collides head-on with the SQL
 * `generate_occurrences` / `apply_closures` path that the specs are built
 * around (docs/OCCURRENCE_GENERATION.md, docs/STUDIO_CLOSURES.md). Four
 * distinct conflicts, any one of which is disqualifying:
 *
 *   1. It rewrites the snapshot. The upsert has no ignoreDuplicates, so every
 *      run UPDATEs nearly every future row — 971 of 986 on 2026-07-30 —
 *      re-deriving teacher_id / room_id / location_id / status from the live
 *      `classes` row. That destroys the "an occurrence records who was actually
 *      assigned" guarantee the SQL generator exists to provide.
 *   2. It republishes cancelled occurrences. occurrences.ts sets
 *      status: isClosed ? 'cancelled' : 'published' on every run, so anything
 *      `apply_closures` cancels is flipped back to published the next morning.
 *   3. It reads `studio_closures.closed_date` only. Once closures are ranges
 *      (`closed_through`), it honours day one and generates straight through
 *      the rest of the range.
 *   4. It prunes rows with a NULL ical_uid. The SQL generator never writes
 *      ical_uid, so every row it creates looks stale to this function's
 *      keep-set and would be DELETED. Generating the Fall season while this
 *      cron was still scheduled would have lost most of it at 08:00 UTC the
 *      next day — that is the specific reason it was unscheduled today rather
 *      than as part of the retirement work.
 *
 * Retiring this generator properly — deleting the route, lib/schedule/generate.ts
 * and lib/schedule/occurrences.ts, and resolving the two weekday encodings
 * (scalar classes.day_of_week, JS 0=Sun here vs. the days_of_week array, ISO
 * 1=Mon in SQL) — is a separate spec'd job. Do not re-add a cron entry for this
 * path until that spec says which generator survives; the two cannot both run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // Fails CLOSED when the secret is unset. This route previously used
  // `if (cronSecret) { ...check... }`, which silently leaves the endpoint open
  // on any deploy missing the variable. It generates AND PRUNES occurrences; an
  // unauthenticated caller must never reach it, and a missing config is a
  // reason to refuse rather than to skip the check.
  //
  // NOT an incident: CRON_SECRET IS set in Vercel Production and Preview
  // (verified 2026-07-30), so the endpoint was never actually unauthenticated.
  // This is defence in depth against a future environment missing the variable.
  if (!cronSecret) {
    console.error("[cron:schedule-generate] CRON_SECRET is not set — refusing");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await extendAllActiveClasses();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:schedule-generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
