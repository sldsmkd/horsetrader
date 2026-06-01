import { test } from "node:test";
import assert from "node:assert/strict";

import { eventStream } from "./events.ts";
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
    key,
    ...(rewards ? { rewards } : {}),
  };
}

function bundle(...events: EventsBundle["events"]): EventsBundle {
  return { events };
}

test("rewards land on the event end as one delta vector; bare carats become carats_free", () => {
  const b = bundle(
    banner("banner-1", "2026-06-10", { carats: 720, trainee_tickets: 2 }),
  );
  const out = eventStream(b, "2026-06-01");
  assert.deepEqual(out, [
    { date: "2026-06-10", source: "banner-1", deltas: { carats_free: 720, trainee_tickets: 2 } },
  ]);
});

test("only events landing strictly after the snapshot date are emitted", () => {
  const b = bundle(
    banner("before", "2026-05-30", { carats: 100 }),
    banner("on-snapshot", "2026-06-01", { carats: 100 }),
    banner("after", "2026-06-02", { carats: 100 }),
  );
  const out = eventStream(b, "2026-06-01");
  assert.deepEqual(out.map((e) => e.date), ["2026-06-02"]);
});

test("events without rewards emit nothing", () => {
  const b = bundle(banner("no-rewards", "2026-06-10"));
  assert.deepEqual(eventStream(b, "2026-06-01"), []);
});

test("the events channel ignores generators (own channel) — its nested value is skipped", () => {
  const b = bundle(
    banner("anchor", "2026-06-10", { generator: { carats: 564, repeat: 10 } }),
  );
  assert.deepEqual(eventStream(b, "2026-06-01"), []);
});

test("flat rewards alongside a generator keep the flat deltas and drop only the generator", () => {
  const b = bundle(
    banner("mixed", "2026-06-10", { carats: 50, generator: { carats: 564, repeat: 10 } }),
  );
  assert.deepEqual(eventStream(b, "2026-06-01"), [
    { date: "2026-06-10", source: "mixed", deltas: { carats_free: 50 } },
  ]);
});
