import { test } from "node:test";
import assert from "node:assert/strict";

import { dateStringInTimeZone, isSupportedTimeZone, todayInTimeZone } from "./dates.ts";

test("dateStringInTimeZone passes legacy date-only values through unchanged", () => {
  assert.equal(dateStringInTimeZone("2026-06-10", "Australia/Sydney"), "2026-06-10");
});

test("dateStringInTimeZone maps a baked instant onto the viewer's calendar date", () => {
  assert.equal(dateStringInTimeZone("2026-06-10T22:00:00+00:00", "UTC"), "2026-06-10");
  assert.equal(dateStringInTimeZone("2026-06-10T22:00:00+00:00", "Europe/London"), "2026-06-10");
  assert.equal(dateStringInTimeZone("2026-06-10T22:00:00+00:00", "Australia/Sydney"), "2026-06-11");
});

test("todayInTimeZone uses the selected calendar, not UTC-today blindly", () => {
  const instant = new Date("2026-06-10T22:30:00+00:00");
  assert.equal(todayInTimeZone("UTC", instant), "2026-06-10");
  assert.equal(todayInTimeZone("Australia/Sydney", instant), "2026-06-11");
});

test("unsupported timezone identifiers are rejected", () => {
  assert.equal(isSupportedTimeZone("UTC"), true);
  assert.equal(isSupportedTimeZone("Not/A_Zone"), false);
});
