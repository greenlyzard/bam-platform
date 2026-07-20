import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveAnchorDay,
  nextAnchorDate,
  proratedFirstDrawCents,
  computeFirstDrawProration,
  type MeetingCounter,
  type ProrationSource,
} from "./proration.ts";

// ── effectiveAnchorDay (§4.1 clamp) ──────────────────────────────────────────────────

test("effectiveAnchorDay: 15 is always 15; 31 clamps to month length; leap Feb", () => {
  assert.equal(effectiveAnchorDay(2026, 9, 15), 15); // Sept has 30 days
  assert.equal(effectiveAnchorDay(2026, 2, 31), 28); // 2026 not a leap year
  assert.equal(effectiveAnchorDay(2028, 2, 31), 29); // 2028 leap
  assert.equal(effectiveAnchorDay(2026, 4, 31), 30); // April has 30 days
});

// ── nextAnchorDate (§4.1 "on/after") ─────────────────────────────────────────────────

test("nextAnchorDate: start before anchor → same month's anchor", () => {
  assert.equal(nextAnchorDate("2026-09-03", 15), "2026-09-15");
});

test("nextAnchorDate: start after anchor → next month's anchor", () => {
  assert.equal(nextAnchorDate("2026-09-20", 15), "2026-10-15");
});

test("nextAnchorDate: December start rolls over to January", () => {
  assert.equal(nextAnchorDate("2026-12-20", 15), "2027-01-15");
});

test("nextAnchorDate: anchor 31 clamps into Feb (non-leap and leap)", () => {
  assert.equal(nextAnchorDate("2026-02-10", 31), "2026-02-28");
  assert.equal(nextAnchorDate("2028-02-10", 31), "2028-02-29");
});

test("nextAnchorDate: anchor 31, start past the clamped Feb anchor → March 31", () => {
  // Feb 2026 clamps to the 28th; a start on the 28th is ON the (clamped) anchor (see the
  // on-anchor test), but the 27th → the 28th; a March start with anchor 31 → March 31.
  assert.equal(nextAnchorDate("2026-02-27", 31), "2026-02-28");
  assert.equal(nextAnchorDate("2026-03-01", 31), "2026-03-31");
});

// REQUIRED (1): pin the start-ON-anchor semantics and document the choice.
//
// §4.1 says next_anchor_date is "the next occurrence of the anchor day ON/AFTER start_date". We read
// "on/after" as INCLUSIVE: a student starting exactly on the anchor day gets next_anchor = start, an
// EMPTY window [start, start), and therefore a first-draw recommendation of 0 — the recurring anchor
// engine charges the full month on that same day. The strictly-after alternative would prorate a
// whole extra month AND then draw again a month later (a double charge), so inclusive is correct.
test("nextAnchorDate: start exactly ON the anchor day returns the start date itself (inclusive)", () => {
  assert.equal(nextAnchorDate("2026-09-15", 15), "2026-09-15");
  // And the clamped-anchor variant: Feb 28 IS the effective anchor when anchorDay=31.
  assert.equal(nextAnchorDate("2026-02-28", 31), "2026-02-28");
});

// ── proratedFirstDrawCents (§4.1 formula, §4.3 bounds) ───────────────────────────────

test("prorate meeting: partial window is the meeting ratio, rounded", () => {
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 20000,
      deliverableMeetingsInWindow: 2,
      meetingsInAnchorCycle: 4,
    }),
    10000
  );
  // Rounding: 10000 * 1/3 = 3333.33 → 3333
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 10000,
      deliverableMeetingsInWindow: 1,
      meetingsInAnchorCycle: 3,
    }),
    3333
  );
});

test("prorate meeting: a full (or over-full) window charges the full month, never more (§4.3)", () => {
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 20000,
      deliverableMeetingsInWindow: 4,
      meetingsInAnchorCycle: 4,
    }),
    20000
  );
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 20000,
      deliverableMeetingsInWindow: 5, // more than a cycle → still clamped to full
      meetingsInAnchorCycle: 4,
    }),
    20000
  );
});

test("prorate meeting: zero deliverable meetings → 0", () => {
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 20000,
      deliverableMeetingsInWindow: 0,
      meetingsInAnchorCycle: 4,
    }),
    0
  );
});

test("prorate meeting: zero denominator → full month (cannot prorate, §4.3 edge)", () => {
  assert.equal(
    proratedFirstDrawCents({
      method: "meeting",
      fullMonthCents: 20000,
      deliverableMeetingsInWindow: 0,
      meetingsInAnchorCycle: 0,
    }),
    20000
  );
});

test("prorate none → full month; calendar_day uses the day ratio", () => {
  assert.equal(
    proratedFirstDrawCents({ method: "none", fullMonthCents: 20000 }),
    20000
  );
  assert.equal(
    proratedFirstDrawCents({
      method: "calendar_day",
      fullMonthCents: 30000,
      daysInWindow: 10,
      daysInCycle: 30,
    }),
    10000
  );
});

// ── computeFirstDrawProration with an injected counter ───────────────────────────────

/** A fake counter that returns a fixed number per exact [start,end) key and logs its source. */
function fakeCounter(
  source: ProrationSource,
  byRange: Record<string, number>,
  log: { source: ProrationSource; range: string }[]
): MeetingCounter {
  return {
    source,
    async countInRange(startYmd, endYmd) {
      const range = `${startYmd}..${endYmd}`;
      log.push({ source, range });
      return byRange[range] ?? 0;
    },
  };
}

test("computeFirstDrawProration: window/cycle counts drive the recommendation + blob", async () => {
  const log: { source: ProrationSource; range: string }[] = [];
  // Start 2026-09-01, anchor 15 → window [2026-09-01, 2026-09-15), cycle [2026-09-15, 2026-10-15).
  const counter = fakeCounter(
    "schedule_instances",
    { "2026-09-01..2026-09-15": 2, "2026-09-15..2026-10-15": 4 },
    log
  );
  const { recommendedCents, blob } = await computeFirstDrawProration(counter, {
    fullMonthCents: 20000,
    startDate: "2026-09-01",
    anchorDay: 15,
    method: "meeting",
  });
  assert.equal(recommendedCents, 10000); // 20000 * 2/4
  assert.equal(blob.next_anchor_date, "2026-09-15");
  assert.equal(blob.deliverable_meetings_in_window, 2);
  assert.equal(blob.meetings_in_cycle, 4);
  assert.equal(blob.source, "schedule_instances");
});

test("computeFirstDrawProration: start ON anchor → empty window → 0 (ties nextAnchorDate semantics)", async () => {
  const log: { source: ProrationSource; range: string }[] = [];
  // Start = anchor → window [2026-09-15, 2026-09-15) is empty; a real counter returns 0 for it.
  const counter = fakeCounter(
    "schedule_instances",
    { "2026-09-15..2026-09-15": 0, "2026-09-15..2026-10-15": 4 },
    log
  );
  const { recommendedCents, blob } = await computeFirstDrawProration(counter, {
    fullMonthCents: 20000,
    startDate: "2026-09-15",
    anchorDay: 15,
    method: "meeting",
  });
  assert.equal(blob.next_anchor_date, "2026-09-15");
  assert.equal(recommendedCents, 0);
});

// REQUIRED (2): the numerator and denominator MUST come from the same source — never mixed.
//
// This is structural: computeFirstDrawProration only ever calls the ONE `counter` passed in, so both
// counts share that counter's `source`. resolveMeetingCounter picks the source exactly once. These
// tests pin that guarantee: every countInRange call carries the same source, and the blob records it.
test("single-source: both window and cycle counts come from the one counter's source", async () => {
  const log: { source: ProrationSource; range: string }[] = [];
  const counter = fakeCounter(
    "schedule_instances",
    { "2026-09-01..2026-09-15": 1, "2026-09-15..2026-10-15": 4 },
    log
  );
  const { blob } = await computeFirstDrawProration(counter, {
    fullMonthCents: 20000,
    startDate: "2026-09-01",
    anchorDay: 15,
    method: "meeting",
  });

  // Exactly two counts happened — the window and the cycle — and BOTH used the same source.
  assert.equal(log.length, 2);
  assert.deepEqual(
    log.map((e) => e.source),
    ["schedule_instances", "schedule_instances"]
  );
  const sources = new Set(log.map((e) => e.source));
  assert.equal(sources.size, 1, "numerator and denominator must not mix sources");
  assert.equal(blob.source, "schedule_instances");
});

test("single-source: the fallback source is likewise applied to BOTH counts, never mixed", async () => {
  const log: { source: ProrationSource; range: string }[] = [];
  const counter = fakeCounter(
    "day_of_week_fallback",
    { "2026-09-01..2026-09-15": 2, "2026-09-15..2026-10-15": 4 },
    log
  );
  const { blob } = await computeFirstDrawProration(counter, {
    fullMonthCents: 20000,
    startDate: "2026-09-01",
    anchorDay: 15,
    method: "meeting",
  });
  assert.equal(new Set(log.map((e) => e.source)).size, 1);
  assert.equal(blob.source, "day_of_week_fallback");
  assert.deepEqual(
    log.map((e) => e.source),
    ["day_of_week_fallback", "day_of_week_fallback"]
  );
});
