import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDayOfWeek, formatTime, formatDayTime } from "./schedule.ts";

test("formatDayOfWeek: 0=Sunday … 6=Saturday; out-of-range/absent → ''", () => {
  assert.equal(formatDayOfWeek(0), "Sunday");
  assert.equal(formatDayOfWeek(3), "Wednesday");
  assert.equal(formatDayOfWeek(6), "Saturday");
  assert.equal(formatDayOfWeek(7), "");
  assert.equal(formatDayOfWeek(-1), "");
  assert.equal(formatDayOfWeek(null), "");
  assert.equal(formatDayOfWeek(undefined), "");
});

test("formatTime: 24h (optional seconds) → 12h, seconds dropped", () => {
  assert.equal(formatTime("16:30:00"), "4:30 PM");
  assert.equal(formatTime("19:00:00"), "7:00 PM");
  assert.equal(formatTime("09:05"), "9:05 AM");
  assert.equal(formatTime("00:00:00"), "12:00 AM"); // midnight
  assert.equal(formatTime("12:00:00"), "12:00 PM"); // noon
  assert.equal(formatTime(""), "");
  assert.equal(formatTime(null), "");
  assert.equal(formatTime("nonsense"), "");
});

test("formatDayTime: combines day + time; omits missing parts", () => {
  assert.equal(formatDayTime(3, "16:30:00"), "Wednesday 4:30 PM");
  assert.equal(formatDayTime(null, "16:30:00"), "4:30 PM");
  assert.equal(formatDayTime(3, null), "Wednesday");
  assert.equal(formatDayTime(null, null), "");
});
