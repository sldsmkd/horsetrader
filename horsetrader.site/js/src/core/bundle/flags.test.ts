import { test } from "node:test";
import assert from "node:assert/strict";

import { isVisible, isRushable } from "./flags.ts";
import type { EventsBundle } from "./events.gen.ts";

type EventRecord = EventsBundle["events"][number];

/** A minimal CM event with the given optional flags merged in (the flags aren't
 *  all in the generated type yet, so build structurally — the readers' job). */
function ev(flags: { visible?: boolean; rushable?: boolean }): EventRecord {
  return { type: "cm", name: "CM", start: "2026-01-01", end: "2026-01-05", predicted: false, key: "cm-x", ...flags } as EventRecord;
}

test("isVisible is opt-out: absent and true show, only explicit false hides", () => {
  assert.equal(isVisible(ev({})), true); // absent → visible
  assert.equal(isVisible(ev({ visible: true })), true);
  assert.equal(isVisible(ev({ visible: false })), false); // the only hidden case
});

test("isRushable is opt-in: absent and false are not rushable, only explicit true is", () => {
  assert.equal(isRushable(ev({})), false); // absent → not rushable
  assert.equal(isRushable(ev({ rushable: false })), false);
  assert.equal(isRushable(ev({ rushable: true })), true); // the only rushable case
});
