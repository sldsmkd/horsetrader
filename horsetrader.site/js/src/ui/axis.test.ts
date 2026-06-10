import { test } from "node:test";
import assert from "node:assert/strict";

import { createAxis } from "./axis.ts";
import { cal } from "../core/projection/dates.ts";

test("xForDate is true-to-date: origin is 0, days scale linearly, before-origin is negative", () => {
  const axis = createAxis({ origin: cal("2026-06-03"), pxPerDay: 10 });
  assert.equal(axis.xForDate(cal("2026-06-03")), 0); // the origin sits at content-x 0
  assert.equal(axis.xForDate(cal("2026-06-04")), 10); // one day on
  assert.equal(axis.xForDate(cal("2026-06-13")), 100); // ten days on
  assert.equal(axis.xForDate(cal("2026-06-01")), -20); // two days before the origin
});

test("xForDate counts real calendar gaps, not adjacency (month and year boundaries, UTC)", () => {
  const feb = createAxis({ origin: cal("2026-02-27"), pxPerDay: 10 });
  assert.equal(feb.xForDate(cal("2026-03-02")), 30); // 27→28→Mar1→Mar2 = 3 days (Feb 2026 = 28d)

  const nye = createAxis({ origin: cal("2025-12-31"), pxPerDay: 10 });
  assert.equal(nye.xForDate(cal("2026-01-02")), 20); // across the year boundary
});

test("dateForX snaps to the nearest day's tick — the cursor hit-test", () => {
  const axis = createAxis({ origin: cal("2026-06-03"), pxPerDay: 10 });
  assert.equal(axis.dateForX(0), "2026-06-03");
  assert.equal(axis.dateForX(20), "2026-06-05");
  assert.equal(axis.dateForX(4), "2026-06-03"); // 0.4 days → rounds back to the origin
  assert.equal(axis.dateForX(6), "2026-06-04"); // 0.6 days → rounds on to the next
  assert.equal(axis.dateForX(-6), "2026-06-02"); // negative x rounds the same way
});

test("dateForX uses JS half-tick rounding at exact 0.5-day boundaries", () => {
  const axis = createAxis({ origin: cal("2026-06-03"), pxPerDay: 10 });
  assert.equal(axis.dateForX(5), "2026-06-04");
  assert.equal(axis.dateForX(-5), "2026-06-03");
  assert.equal(axis.dateForX(-15), "2026-06-02");
});

test("date → x → date round-trips exactly", () => {
  const axis = createAxis({ origin: cal("2026-06-03"), pxPerDay: 17 });
  for (const date of ["2026-06-03", "2026-06-04", "2026-07-01", "2026-05-20", "2027-01-01"]) {
    assert.equal(axis.dateForX(axis.xForDate(cal(date))), date);
  }
});

test("pxPerDay is the zoom: the same date maps proportionally to the scale", () => {
  const tight = createAxis({ origin: cal("2026-06-03"), pxPerDay: 4 });
  const wide = createAxis({ origin: cal("2026-06-03"), pxPerDay: 40 });
  assert.equal(tight.xForDate(cal("2026-06-13")), 40);
  assert.equal(wide.xForDate(cal("2026-06-13")), 400); // 10× the zoom, 10× the x
});

test("non-integer pxPerDay still round-trips on exact tick multiples", () => {
  const axis = createAxis({ origin: cal("2026-06-03"), pxPerDay: 2.5 });
  assert.equal(axis.xForDate(cal("2026-06-07")), 10);
  assert.equal(axis.dateForX(10), "2026-06-07");
});
