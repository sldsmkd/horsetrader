import { test } from "node:test";
import assert from "node:assert/strict";

import { eventStream } from "./events.ts";
import { cal } from "../dates.ts";
import type { EventsBundle, TraineeBannerRecord } from "../../bundle/events.gen.ts";

/** A trainee banner is the lightest record carrying rewards — enough to drive the stream. */
function banner(key: string, end: string, rewards?: TraineeBannerRecord["rewards"]): TraineeBannerRecord {
  return {
    type: "trainee",
    contents: [],
    image: "",
    start: end,
    end,
    predicted: false,
    rushable: false,
    key,
    ...(rewards ? { rewards } : {}),
  };
}

/** A banner with a distinct start and end — needed to observe rush moving the payout. */
function span(key: string, start: string, end: string, rewards?: TraineeBannerRecord["rewards"]): TraineeBannerRecord {
  return { ...banner(key, end, rewards), start };
}

function bundle(...events: EventsBundle["events"]): EventsBundle {
  return { events };
}

test("rewards land on the event end as one delta vector", () => {
  const b = bundle(
    banner("banner-1", "2026-06-10", { free_carats: 720, trainee_tickets: 2 }),
  );
  const out = eventStream(b, cal("2026-06-01"));
  assert.deepEqual(out, [
    { date: "2026-06-10", source: "banner-1", deltas: { free_carats: 720, trainee_tickets: 2 } },
  ]);
});

test("timestamped rewards land on the event end date in the selected timezone", () => {
  const b = bundle(
    banner("banner-1", "2026-06-10T22:00:00+00:00", { free_carats: 720 }),
  );
  assert.deepEqual(eventStream(b, cal("2026-06-01"), "UTC"), [
    { date: "2026-06-10", source: "banner-1", deltas: { free_carats: 720 } },
  ]);
  assert.deepEqual(eventStream(b, cal("2026-06-01"), "Australia/Sydney"), [
    { date: "2026-06-11", source: "banner-1", deltas: { free_carats: 720 } },
  ]);
});

test("only events landing strictly after the snapshot date are emitted", () => {
  const b = bundle(
    banner("before", "2026-05-30", { free_carats: 100 }),
    banner("on-snapshot", "2026-06-01", { free_carats: 100 }),
    banner("after", "2026-06-02", { free_carats: 100 }),
  );
  const out = eventStream(b, cal("2026-06-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-06-02"]);
});

test("events without rewards emit nothing", () => {
  const b = bundle(banner("no-rewards", "2026-06-10"));
  assert.deepEqual(eventStream(b, cal("2026-06-01")), []);
});

test("the events channel ignores generators (own channel) — its nested value is skipped", () => {
  const b = bundle(
    banner("gen-only", "2026-06-10", { generator: { free_carats: 564, repeat: 10 } }),
  );
  assert.deepEqual(eventStream(b, cal("2026-06-01")), []);
});

test("flat rewards alongside a generator keep the flat deltas and drop only the generator", () => {
  const b = bundle(
    banner("mixed", "2026-06-10", { free_carats: 50, generator: { free_carats: 564, repeat: 10 } }),
  );
  assert.deepEqual(eventStream(b, cal("2026-06-01")), [
    { date: "2026-06-10", source: "mixed", deltas: { free_carats: 50 } },
  ]);
});

test("a rushed event's discrete payout is pulled forward to its start", () => {
  const b = bundle(span("ev", "2026-06-05", "2026-06-15", { free_carats: 100 }));
  // Not rushed → lands on end; rushed → lands on start, same deltas.
  assert.deepEqual(eventStream(b, cal("2026-06-01")), [
    { date: "2026-06-15", source: "ev", deltas: { free_carats: 100 } },
  ]);
  assert.deepEqual(eventStream(b, cal("2026-06-01"), "UTC", new Set(["ev"])), [
    { date: "2026-06-05", source: "ev", deltas: { free_carats: 100 } },
  ]);
});

test("rushing an event whose start precedes the snapshot drops it (already banked), end notwithstanding", () => {
  const b = bundle(span("ev", "2026-05-28", "2026-06-15", { free_carats: 100 }));
  // End is after the snapshot, so unrushed it emits; rushed, its start is on/before → dropped.
  assert.deepEqual(eventStream(b, cal("2026-06-01")).map((e) => e.date), ["2026-06-15"]);
  assert.deepEqual(eventStream(b, cal("2026-06-01"), "UTC", new Set(["ev"])), []);
});

test("only the listed keys are rushed; an unlisted event still lands on its end", () => {
  const b = bundle(
    span("rushed", "2026-06-05", "2026-06-15", { free_carats: 100 }),
    span("kept", "2026-06-06", "2026-06-16", { free_carats: 200 }),
  );
  assert.deepEqual(eventStream(b, cal("2026-06-01"), "UTC", new Set(["rushed"])), [
    { date: "2026-06-05", source: "rushed", deltas: { free_carats: 100 } },
    { date: "2026-06-16", source: "kept", deltas: { free_carats: 200 } },
  ]);
});
