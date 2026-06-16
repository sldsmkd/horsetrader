import { test } from "node:test";
import assert from "node:assert/strict";

import { plannerRows } from "./planner.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/past.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/open.webp", start: "2026-05-28", end: "2026-06-04", predicted: false, key: "banner-open" },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/future.webp", start: "2026-06-20", end: "2026-06-26", predicted: true, key: "banner-future" },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/uncommitted.webp", start: "2026-06-30", end: "2026-07-06", predicted: false, key: "banner-uncommitted" },
    { type: "cm", name: "CM", start: "2026-06-22", end: "2026-06-26", predicted: false, key: "cm-1" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] } },
  trainees: { "t-spe": { character: "char-spe", variant: "Original", title: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] } },
  courses: {},
  races: {},
  racetracks: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

test("plannerRows: committed open-or-future banners only, sorted by start date", () => {
  const rows = plannerRows(bundle(), { "banner-past": 1, "banner-open": 2, "banner-future": 3, "banner-uncommitted": 0, "cm-1": 1 }, cal("2026-06-01"));

  assert.deepEqual(
    rows.map((row) => ({ key: row.key, kind: row.kind, date: row.date, predicted: row.predicted, pity: row.pity, atoms: row.atoms.map((atom) => atom.name) })),
    [
      { key: "banner-open", kind: "trainee", date: cal("2026-05-28"), predicted: false, pity: 2, atoms: ["Special Week"] },
      { key: "banner-future", kind: "support", date: cal("2026-06-20"), predicted: true, pity: 3, atoms: ["Special Week"] },
    ],
  );
});

test("plannerRows: unfundable mirrors the commit badge pressure state", () => {
  const [row] = plannerRows(
    bundle(),
    { "banner-future": 1 },
    cal("2026-06-01"),
    {
      balanceAt: () => ({ free_carats: 0, paid_carats: 0, support_tickets: 0 }),
      availableFor: () => undefined,
    },
  );

  assert.equal(row?.unfundable, true);
});
