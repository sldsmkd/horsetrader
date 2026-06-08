import { test } from "node:test";
import assert from "node:assert/strict";

import { hashAccountId, verifySupporter } from "./supporters.ts";
import type { SupporterRegistry } from "./supporters.ts";

// Frozen cross-language fixture: sha256("540903147493"), the exact key
// scripts/supporters.py writes. If this drifts, client lookups silently miss.
const FISH_KEY = "089b21c77e4965b462c7af3edc306c222298d8b6547d575b9b3290bbe28dd7ff";
const REGISTRY: SupporterRegistry = { [FISH_KEY]: "FishPineApl" };

test("hash matches the Python writer and ignores ID grouping", async () => {
  assert.equal(await hashAccountId("540903147493"), FISH_KEY);
  assert.equal(await hashAccountId("540 903 147 493"), FISH_KEY);
  assert.equal(await hashAccountId("540-903-147-493"), FISH_KEY);
});

test("a non-12-digit ID can never match", async () => {
  assert.equal(await hashAccountId("123"), null);
  assert.equal(await verifySupporter(REGISTRY, "123", "FishPineApl"), false);
});

test("supporter needs BOTH the hashed ID and the exact username", async () => {
  assert.equal(await verifySupporter(REGISTRY, "540-903-147-493", "FishPineApl"), true);
  assert.equal(await verifySupporter(REGISTRY, "540903147493", " FishPineApl "), true); // trimmed
  assert.equal(await verifySupporter(REGISTRY, "540903147493", "fishpineapl"), false); // case-sensitive
  assert.equal(await verifySupporter(REGISTRY, "719408445989", "FishPineApl"), false); // wrong id
});

test("empty registry means nobody is a supporter", async () => {
  assert.equal(await verifySupporter({}, "540903147493", "FishPineApl"), false);
});
