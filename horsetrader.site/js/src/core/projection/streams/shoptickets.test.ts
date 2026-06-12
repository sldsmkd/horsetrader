import { test } from "node:test";
import assert from "node:assert/strict";

import { shopTicketsStream, shopTicketsSpecFromBundle } from "./shoptickets.ts";
import type { ShopTicketsSpec } from "./shoptickets.ts";
import { cal } from "../dates.ts";
import type { EventsBundle, HolidayRecord } from "../../bundle/events.gen.ts";

function spec(over: Partial<ShopTicketsSpec> = {}): ShopTicketsSpec {
  return {
    epoch: cal("2026-01-01"),
    horizon: cal("2026-04-30"),
    monthly: { trainee_tickets: 4, support_tickets: 4 },
    ...over,
  };
}

test("buys the bracket count of each scout-ticket type on the 1st of every month", () => {
  const out = shopTicketsStream(spec(), cal("2025-12-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source, e.deltas["trainee_tickets"], e.deltas["support_tickets"]]),
    [
      ["2026-01-01", "shop-tickets", 4, 4],
      ["2026-02-01", "shop-tickets", 4, 4],
      ["2026-03-01", "shop-tickets", 4, 4],
      ["2026-04-01", "shop-tickets", 4, 4],
    ],
  );
});

test("the `none` bracket (empty payload) emits nothing", () => {
  assert.deepEqual(shopTicketsStream(spec({ monthly: {} }), cal("2025-01-01")), []);
});

test("only month-starts strictly after `after` emit", () => {
  const out = shopTicketsStream(spec(), cal("2026-02-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-03-01", "2026-04-01"]);
});

function bundle(events: HolidayRecord[]): EventsBundle {
  return { events };
}

function holiday(key: string, start: string, end: string): HolidayRecord {
  return { type: "holiday", name: key, start, end, predicted: false, key };
}

test("shopTicketsSpecFromBundle maps each bracket to N of each ticket type, monthly", () => {
  const b = bundle([holiday("x", "2026-01-15", "2026-06-30")]);
  assert.deepEqual(shopTicketsSpecFromBundle(b, "cleats"), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    monthly: { trainee_tickets: 4, support_tickets: 4 },
  });
  assert.deepEqual(shopTicketsSpecFromBundle(b, "friendPoints")?.monthly, { trainee_tickets: 6, support_tickets: 6 });
  assert.deepEqual(shopTicketsSpecFromBundle(b, "rainbow")?.monthly, { trainee_tickets: 7, support_tickets: 7 });
});

test("the `none` bracket resolves to an empty payload (no phantom tickets)", () => {
  const b = bundle([holiday("x", "2026-01-15", "2026-06-30")]);
  assert.deepEqual(shopTicketsSpecFromBundle(b, "none")?.monthly, {});
});

test("shopTicketsSpecFromBundle buckets the bundle instants into the view timezone", () => {
  const b = bundle([holiday("x", "2026-01-15T22:00:00+00:00", "2026-06-30T22:00:00+00:00")]);
  const out = shopTicketsSpecFromBundle(b, "cleats", "Australia/Sydney");
  assert.equal(out?.epoch, "2026-01-16");
  assert.equal(out?.horizon, "2026-07-01");
});

test("shopTicketsSpecFromBundle returns null on an unknown level or an empty bundle", () => {
  assert.equal(shopTicketsSpecFromBundle(bundle([]), "cleats"), null);
  assert.equal(shopTicketsSpecFromBundle(bundle([holiday("x", "2026-01-01", "2026-01-02")]), "platinum"), null);
});
