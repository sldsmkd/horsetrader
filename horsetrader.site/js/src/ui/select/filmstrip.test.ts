import { test } from "node:test";
import assert from "node:assert/strict";

import { focusIndex } from "./filmstrip.ts";
import type { FilmFrame } from "./filmstrip.ts";
import { cal } from "../../core/projection/dates.ts";

const frame = (date: string): FilmFrame => ({ date: cal(date), kind: "trainee", state: "bookmark", past: false, atom: null, group: date, band: "empty", heat: 0 });

const FRAMES = [frame("2027-01-01"), frame("2027-03-01"), frame("2027-06-01")];

test("focusIndex returns -1 for an empty strip", () => {
  assert.equal(focusIndex([], cal("2027-01-01")), -1);
});

test("focusIndex centres on the nearest frame in real time", () => {
  assert.equal(focusIndex(FRAMES, cal("2027-01-05")), 0);
  assert.equal(focusIndex(FRAMES, cal("2027-03-10")), 1);
  assert.equal(focusIndex(FRAMES, cal("2027-05-20")), 2);
});

test("focusIndex nearness is metric, not ordinal", () => {
  // Equidistant-in-sequence frames are NOT equidistant in time; the read-head
  // follows the calendar-nearest, so a view just past frame 0 stays on frame 0.
  assert.equal(focusIndex(FRAMES, cal("2027-01-25")), 0);
  assert.equal(focusIndex(FRAMES, cal("2027-02-15")), 1);
});

test("focusIndex clamps past the ends", () => {
  assert.equal(focusIndex(FRAMES, cal("2030-01-01")), 2);
  assert.equal(focusIndex(FRAMES, cal("2020-01-01")), 0);
});
