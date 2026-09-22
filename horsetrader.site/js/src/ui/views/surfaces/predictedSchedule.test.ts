import assert from "node:assert/strict";
import { test } from "node:test";

import { cal } from "../../../core/projection/dates.ts";
import { predictedSchedule } from "./predictedSchedule.ts";

test("the poster contains predicted releases that start in the next calendar month only", () => {
  const bundle = { all: () => [
    { key: "next", type: "story", title: "Next", start: cal("2026-10-03"), end: cal("2026-10-17"), predicted: true },
    { key: "mission", type: "mission", name: "Routine mission", start: cal("2026-10-03"), end: cal("2026-10-04"), predicted: true },
    { key: "confirmed", type: "story", title: "Confirmed", start: cal("2026-10-04"), end: cal("2026-10-18"), predicted: false },
    { key: "later", type: "story", title: "Later", start: cal("2026-11-03"), end: cal("2026-11-17"), predicted: true },
  ], character: () => ({ icon: "/fukukitaru.webp" }) } as never;
  const schedule = predictedSchedule(bundle, cal("2026-09-02"));
  assert.equal(schedule.month, "October");
  assert.equal(schedule.year, 2026);
  assert.equal(schedule.forecasterImage, "/fukukitaru.webp");
  assert.deepEqual(schedule.events.map((event) => event.key), ["next"]);
});
