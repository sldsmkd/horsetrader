import { test } from "node:test";
import assert from "node:assert/strict";

import { readCapabilities, CAP_QUERIES } from "./capabilities.ts";

/**
 * Capability mapping (Godolphin substrate — grand-masters/contracts.md, the Godolphin seam).
 *
 * The reliable half: qualitative `matchMedia` answers → a capability snapshot. This guards
 * the pure mapping against the two profiles measured on real hardware in F11
 * (godolphin-findings.md): iPhone reads coarse / hover-none / 5 touch; the dev desktop reads
 * fine / hover / 0 touch. If a later "tidy" flips a query or inverts `noHover`, this fails.
 *
 * Layout/`matchMedia` don't exist under `node --test`, so we feed `readCapabilities` a fake
 * matcher — exactly the seam that split the pure mapping from the live wiring.
 */

/** A matcher backed by a set of queries the device answers `true`. */
const matcher = (truthy: Set<string>) => (q: string) => truthy.has(q);

test("iPhone profile — coarse, no hover, multi-touch (F11)", () => {
  const match = matcher(new Set([CAP_QUERIES.pointerCoarse, CAP_QUERIES.anyCoarse]));
  const caps = readCapabilities(match, 5);
  assert.equal(caps.pointer, "coarse");
  assert.equal(caps.anyCoarse, true);
  assert.equal(caps.hover, false);
  assert.equal(caps.noHover, true, "a phone answers no hover-capable input");
  assert.equal(caps.touchPoints, 5);
});

test("desktop profile — fine, hover, no touch (F11, the identity config)", () => {
  const match = matcher(new Set([CAP_QUERIES.hover, CAP_QUERIES.anyHover]));
  const caps = readCapabilities(match, 0);
  assert.equal(caps.pointer, "fine");
  assert.equal(caps.anyCoarse, false);
  assert.equal(caps.hover, true);
  assert.equal(caps.noHover, false);
  assert.equal(caps.touchPoints, 0);
});

test("hybrid — touch laptop reports both, caught by anyCoarse not primary pointer", () => {
  // Mouse-primary (so `pointer: fine`) but a touchscreen present (`any-pointer: coarse`).
  const match = matcher(new Set([CAP_QUERIES.anyCoarse, CAP_QUERIES.hover, CAP_QUERIES.anyHover]));
  const caps = readCapabilities(match, 10);
  assert.equal(caps.pointer, "fine", "primary pointer is the mouse");
  assert.equal(caps.anyCoarse, true, "but touch is available — touch sizing still applies");
  assert.equal(caps.noHover, false);
});
