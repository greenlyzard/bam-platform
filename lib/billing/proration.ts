// First-draw proration for the enrollment approval flow (docs/BILLING_APPROVAL_AND_DRAW.md §4).
//
// The first draw covers [start_date, next_anchor_date): the gap before the recurring monthly cycle
// begins — payment in advance of delivery (§4.1). Meeting-based by default (§4.3), counting only
// DELIVERABLE meetings — schedule_instances rows with status='published' (§4.2); closure dates are
// 'cancelled' and excluded.
//
// Pure math (nextAnchorDate, proratedFirstDrawCents) is separated from the DB counter so the rules
// are unit-testable. computeFirstDrawProration takes a SINGLE MeetingCounter and threads it through
// BOTH the numerator (window) and denominator (cycle) counts — so a proration ratio can never mix a
// schedule_instances count with a day_of_week fallback count (§4.2). The source is chosen once, by
// resolveMeetingCounter, and recorded in the blob.
//
// Only the DB loader (resolveMeetingCounter) touches Supabase, and it takes the client as a required
// argument — this module has NO runtime import, so the test suite can import it directly.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProrationMethod = "meeting" | "calendar_day" | "none";
export type ProrationSource = "schedule_instances" | "day_of_week_fallback";

/** Stored on enrollment_charge_items.proration (§4.4) so the admin sees WHY the number is what it is. */
export interface ProrationBlob {
  method: ProrationMethod;
  source: ProrationSource;
  full_month_cents: number;
  meetings_in_cycle: number;
  deliverable_meetings_in_window: number;
  start_date: string; // 'YYYY-MM-DD'
  next_anchor_date: string; // 'YYYY-MM-DD'
}

export interface ProrationResult {
  recommendedCents: number;
  blob: ProrationBlob;
}

// ── Pure date helpers (UTC; 'YYYY-MM-DD' in/out — no Date.now/new Date() on the request path) ──

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return { y, m, d };
}
function fmtYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** Number of days in month `m1to12` of year `y` (day 0 of next month = last day of this one). */
function daysInMonth(y: number, m1to12: number): number {
  return new Date(Date.UTC(y, m1to12, 0)).getUTCDate();
}
/** Whole days between two 'YYYY-MM-DD' dates (end − start), UTC. */
function dayDiff(startYmd: string, endYmd: string): number {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000
  );
}
/** The day after `ymd`, as 'YYYY-MM-DD'. */
function addDay(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return fmtYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** The anchor day clamped to a month's length (anchor 31 → 28/29 in Feb; 15 stays 15). §4.1. */
export function effectiveAnchorDay(y: number, m1to12: number, anchorDay: number): number {
  return Math.min(anchorDay, daysInMonth(y, m1to12));
}

/**
 * The next occurrence of the tenant anchor day ON/AFTER `startDate` (§4.1), clamped to month length.
 *
 * Start-on-anchor semantics (§4.1 "on/after" is INCLUSIVE of the start date): when `startDate`'s day
 * IS the (clamped) anchor day, this returns `startDate` itself. The proration window
 * [start, next_anchor) is then EMPTY → the first-draw recommendation is 0, which is correct: there is
 * no gap before the cycle begins, so the anchor draw engine charges the full month on that same day.
 * (If "on/after" were treated as strictly-after, a student starting on the anchor would be charged a
 * full prorated month AND then a full anchor draw a month later — a double charge. Hence inclusive.)
 */
export function nextAnchorDate(startDate: string, anchorDay: number): string {
  const { y, m, d } = parseYmd(startDate);
  const effThisMonth = effectiveAnchorDay(y, m, anchorDay);
  if (d <= effThisMonth) return fmtYmd(y, m, effThisMonth);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return fmtYmd(ny, nm, effectiveAnchorDay(ny, nm, anchorDay));
}

function clamp(cents: number, full: number): number {
  return Math.max(0, Math.min(cents, full));
}

/**
 * The first-draw recommendation in whole cents (§4.1 formula, §4.3 rounding/bounds).
 * - meeting:      round(full * deliverableMeetingsInWindow / meetingsInAnchorCycle)
 * - calendar_day: round(full * daysInWindow / daysInCycle)
 * - none:         full (no proration)
 * Applied in order: `none` short-circuits to full; denominator ≤ 0 → full (cannot prorate — safe
 * default, §4.3 edge); numerator ≥ denominator → full (window already covers a full cycle, no
 * discount, §4.3); numerator ≤ 0 → 0; otherwise the rounded ratio, clamped to [0, full].
 */
export function proratedFirstDrawCents(args: {
  method: ProrationMethod;
  fullMonthCents: number;
  deliverableMeetingsInWindow?: number;
  meetingsInAnchorCycle?: number;
  daysInWindow?: number;
  daysInCycle?: number;
}): number {
  const full = args.fullMonthCents;
  if (args.method === "none") return clamp(full, full);

  const num =
    args.method === "meeting"
      ? args.deliverableMeetingsInWindow ?? 0
      : args.daysInWindow ?? 0;
  const den =
    args.method === "meeting"
      ? args.meetingsInAnchorCycle ?? 0
      : args.daysInCycle ?? 0;

  if (den <= 0) return clamp(full, full); // cannot prorate → full (§4.3 edge)
  if (num >= den) return clamp(full, full); // full cycle covered → no discount (§4.3)
  if (num <= 0) return 0; // nothing deliverable in window → 0
  return clamp(Math.round((full * num) / den), full);
}

// ── Meeting counter abstraction (the single-source guarantee, §4.2) ──────────────────────────

/**
 * Counts deliverable meetings in a date range. A single instance is threaded through BOTH the window
 * and cycle counts in computeFirstDrawProration, so a ratio can NEVER mix a schedule_instances count
 * with a day_of_week fallback count. `source` is stamped into the blob for provenance.
 */
export interface MeetingCounter {
  source: ProrationSource;
  /** Deliverable meetings in [startYmd, endYmd) — half-open. */
  countInRange(startYmd: string, endYmd: string): Promise<number>;
}

/**
 * Compute the first-draw proration for one class using a pre-selected MeetingCounter. All meeting
 * I/O goes through `counter`, so this is unit-testable with a fake counter and the numerator and
 * denominator are guaranteed to share a source.
 *
 * meeting: numerator = deliverable meetings in [start, next_anchor); denominator = deliverable
 * meetings in one full cycle [next_anchor, cycle_end). calendar_day/none don't count meetings but
 * still record `counter.source` for provenance.
 */
export async function computeFirstDrawProration(
  counter: MeetingCounter,
  args: {
    fullMonthCents: number;
    startDate: string; // 'YYYY-MM-DD'
    anchorDay: number;
    method: ProrationMethod;
  }
): Promise<ProrationResult> {
  const nextAnchor = nextAnchorDate(args.startDate, args.anchorDay);
  const cycleEnd = nextAnchorDate(addDay(nextAnchor), args.anchorDay); // one full anchor cycle

  if (args.method !== "meeting") {
    const recommendedCents = proratedFirstDrawCents({
      method: args.method,
      fullMonthCents: args.fullMonthCents,
      daysInWindow: dayDiff(args.startDate, nextAnchor),
      daysInCycle: dayDiff(nextAnchor, cycleEnd),
    });
    return {
      recommendedCents,
      blob: {
        method: args.method,
        source: counter.source,
        full_month_cents: args.fullMonthCents,
        meetings_in_cycle: 0,
        deliverable_meetings_in_window: 0,
        start_date: args.startDate,
        next_anchor_date: nextAnchor,
      },
    };
  }

  // Both counts come from the SAME counter → numerator and denominator can never mix sources.
  const deliverableInWindow = await counter.countInRange(args.startDate, nextAnchor);
  const meetingsInCycle = await counter.countInRange(nextAnchor, cycleEnd);

  return {
    recommendedCents: proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: args.fullMonthCents,
      deliverableMeetingsInWindow: deliverableInWindow,
      meetingsInAnchorCycle: meetingsInCycle,
    }),
    blob: {
      method: "meeting",
      source: counter.source,
      full_month_cents: args.fullMonthCents,
      meetings_in_cycle: meetingsInCycle,
      deliverable_meetings_in_window: deliverableInWindow,
      start_date: args.startDate,
      next_anchor_date: nextAnchor,
    },
  };
}

// ── DB-backed counter resolution (§4.2). Picks ONE source for the whole computation. ─────────────

/**
 * Choose the meeting counter for a class and return a single MeetingCounter used for both counts.
 *
 * Primary: `schedule_instances` (status='published') — the generator's materialized occurrences.
 * Fallback (§4.2, "until the generator lands" / classes beyond the generated horizon): count
 * `classes.day_of_week` occurrences in the window minus `studio_closures`. The decision is made ONCE
 * here — the returned counter's `source` is fixed — so downstream counts cannot mix sources.
 *
 * NOTE (known edge): if the generator ran but its rolling horizon does not yet cover a far-future
 * cycle window, the schedule_instances counter may undercount. First-draw windows are near-term and
 * the daily cron maintains ~120 days, so this is low-risk; revisit if future-dated enrollment grows.
 */
export async function resolveMeetingCounter(
  client: SupabaseClient,
  args: { classId: string; tenantId: string }
): Promise<MeetingCounter> {
  const { count: publishedCount } = await client
    .from("schedule_instances")
    .select("id", { count: "exact", head: true })
    .eq("class_id", args.classId)
    .eq("status", "published");

  if (publishedCount && publishedCount > 0) {
    return {
      source: "schedule_instances",
      async countInRange(startYmd, endYmd) {
        const { count } = await client
          .from("schedule_instances")
          .select("id", { count: "exact", head: true })
          .eq("class_id", args.classId)
          .eq("status", "published")
          .gte("event_date", startYmd)
          .lt("event_date", endYmd);
        return count ?? 0;
      },
    };
  }

  // Fallback: weekly day_of_week cadence minus tenant closures. Load both once, up front.
  const { data: cls } = await client
    .from("classes")
    .select("day_of_week")
    .eq("id", args.classId)
    .maybeSingle();
  const dayOfWeek = (cls?.day_of_week as number | null | undefined) ?? null;

  const { data: closureRows } = await client
    .from("studio_closures")
    .select("closed_date")
    .eq("tenant_id", args.tenantId);
  const closures = new Set((closureRows ?? []).map((r) => r.closed_date as string));

  return {
    source: "day_of_week_fallback",
    async countInRange(startYmd, endYmd) {
      if (dayOfWeek == null) return 0;
      let count = 0;
      const end = parseYmd(endYmd);
      const endMs = Date.UTC(end.y, end.m - 1, end.d);
      const s = parseYmd(startYmd);
      let cur = Date.UTC(s.y, s.m - 1, s.d);
      while (cur < endMs) {
        const dt = new Date(cur);
        if (dt.getUTCDay() === dayOfWeek) {
          const ymd = fmtYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
          if (!closures.has(ymd)) count++;
        }
        cur += 86_400_000;
      }
      return count;
    },
  };
}

/** Convenience for the webhook: resolve the counter (one source) then compute. */
export async function computeFirstDrawProrationFromDb(
  client: SupabaseClient,
  args: {
    classId: string;
    tenantId: string;
    fullMonthCents: number;
    startDate: string;
    anchorDay: number;
    method: ProrationMethod;
  }
): Promise<ProrationResult> {
  const counter = await resolveMeetingCounter(client, {
    classId: args.classId,
    tenantId: args.tenantId,
  });
  return computeFirstDrawProration(counter, {
    fullMonthCents: args.fullMonthCents,
    startDate: args.startDate,
    anchorDay: args.anchorDay,
    method: args.method,
  });
}
