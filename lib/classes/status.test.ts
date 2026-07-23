import { test } from "node:test";
import assert from "node:assert/strict";
import { isClassOpenForEnrollment } from "./status.ts";

const TODAY = "2026-07-23";

test("open-ended class (null end_date) is always open", () => {
  assert.equal(isClassOpenForEnrollment({ end_date: null }, TODAY), true);
});

test("end_date in the future is open", () => {
  assert.equal(isClassOpenForEnrollment({ end_date: "2026-12-05" }, TODAY), true);
});

test("end_date exactly today is open (inclusive, matches end_date.gte.today)", () => {
  assert.equal(isClassOpenForEnrollment({ end_date: TODAY }, TODAY), true);
});

test("end_date in the past is closed (the class has ended)", () => {
  assert.equal(isClassOpenForEnrollment({ end_date: "2026-06-15" }, TODAY), false);
  assert.equal(isClassOpenForEnrollment({ end_date: "2026-07-22" }, TODAY), false);
});
