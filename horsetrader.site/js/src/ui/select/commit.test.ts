import { test } from "node:test";
import assert from "node:assert/strict";

import { commitContext, reserve } from "./commit.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: ["t-spe", "t-suzuka"], image: "/i/tb.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-t", rewards: { pulls: 10 } },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb.webp", start: "2026-06-25", end: "2026-07-01", predicted: false, key: "banner-s" },
    // A mixed-rarity banner: a gold (SR) whose name sorts BEFORE the crystal (SSR).
    { type: "support", rushable: false, contents: ["s-sr", "s-spe"], image: "/i/sm.webp", start: "2026-07-10", end: "2026-07-16", predicted: false, key: "banner-mix" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null }, "char-suzuka": { name: "Silence Suzuka", quote: null, icon: null, portrait: null } },
  supports: {
    "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: "/img/s-spe.webp", art: null, aliases: [] },
    "s-sr": { character: "char-suzuka", display: "Aaa Support", type: "speed", rarity: "sr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] },
  },
  trainees: {
    "t-spe": { character: "char-spe", variant: null, rarity: 3, release: "2021", thumbnail: "/img/t-spe.webp", portrait: null, aliases: [] },
    "t-suzuka": { character: "char-suzuka", variant: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] },
  },
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

const BALANCE = { free_carats: 1500, paid_carats: 600, trainee_tickets: 2, support_tickets: 3 };

test("commit context: banner identity, kind-appropriate tickets, featured cards with art", () => {
  const ctx = commitContext(bundle(), "banner-t", { balanceAt: () => BALANCE, commitments: {} });

  assert.equal(ctx.kind, "trainee");
  assert.deepEqual([ctx.start, ctx.end], ["2026-06-10", "2026-06-16"]);
  assert.equal(ctx.freeCarats, 1500);
  assert.equal(ctx.paidCarats, 600);
  assert.equal(ctx.tickets, 2); // a trainee banner draws TRAINEE tickets, not support
  // Both 3★ (crystal) → alpha within the band: Silence Suzuka before Special Week.
  assert.deepEqual(ctx.atoms.map((a) => [a.name, a.image]), [
    ["Silence Suzuka", ""], // no thumbnail in the bake → empty, view shows a placeholder
    ["Special Week", "/img/t-spe.webp"],
  ]);
  assert.equal(ctx.committedPity, null);
  assert.equal(ctx.sparkThreshold, 200);
  assert.equal(ctx.caratsPerPull, 150);
});

test("commit context: a support banner draws support tickets and surfaces the commitment", () => {
  const ctx = commitContext(bundle(), "banner-s", { balanceAt: () => BALANCE, commitments: { "banner-s": 3 } });
  assert.equal(ctx.kind, "support");
  assert.equal(ctx.tickets, 3); // support tickets
  assert.equal(ctx.committedPity, 3);
});

test("commit context: featured cards lead with the rarity hero — crystal before gold, then alpha", () => {
  const ctx = commitContext(bundle(), "banner-mix", { balanceAt: () => BALANCE, commitments: {} });
  // SSR "Special Week" leads despite "Aaa Support" winning alphabetically — band beats alpha.
  assert.deepEqual(ctx.atoms.map((a) => [a.name, a.rarityTier]), [
    ["Special Week", "crystal"],
    ["Aaa Support", "gold"],
  ]);
});

test("reserve: zero pity touches nothing — the predicted balance passes through", () => {
  const ctx = commitContext(bundle(), "banner-t", { balanceAt: () => ({ free_carats: 100000, paid_carats: 5000, trainee_tickets: 300 }), commitments: {} });
  assert.deepEqual(reserve(ctx, 0), { freeCarats: 100000, paidCarats: 5000, tickets: 300 });
});

test("reserve: spends in order — tickets, then paid carats, then free carats", () => {
  // 300 tickets, 5000 paid, 100000 free; spark 200, 150 carats/pull.
  const ctx = commitContext(bundle(), "banner-t", { balanceAt: () => ({ free_carats: 100000, paid_carats: 5000, trainee_tickets: 300 }), commitments: {} });

  // 1 pity = 200 pulls: all 200 come from tickets (300 ≥ 200) → only tickets drop.
  assert.deepEqual(reserve(ctx, 1), { freeCarats: 100000, paidCarats: 5000, tickets: 100 });

  // 2 pity = 400 pulls: 300 tickets exhausted, 100 pulls left = 15,000 carats →
  // 5,000 paid drained first, then 10,000 off free.
  assert.deepEqual(reserve(ctx, 2), { freeCarats: 90000, paidCarats: 0, tickets: 0 });
});

test("reserve: overcommitment floors at 0 (no warning — deliberate per the dossier spec)", () => {
  const ctx = commitContext(bundle(), "banner-t", { balanceAt: () => BALANCE, commitments: {} });
  assert.deepEqual(reserve(ctx, 5), { freeCarats: 0, paidCarats: 0, tickets: 0 });
});
