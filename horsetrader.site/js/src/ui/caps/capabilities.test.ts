import { test } from "node:test";
import assert from "node:assert/strict";

import { readCapabilities, glassPointer, CAP_QUERIES } from "./capabilities.ts";

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
  assert.equal(caps.reducedMotion, false);
  assert.equal(caps.contrast, "no-preference");
  assert.equal(caps.forcedColors, false);
  assert.equal(caps.reducedTransparency, false);
  assert.equal(glassPointer(caps), "coarse");
});

test("desktop profile — fine, hover, no touch (F11, the identity config)", () => {
  const match = matcher(
    new Set([
      CAP_QUERIES.hover,
      CAP_QUERIES.anyHover,
      CAP_QUERIES.reducedMotion,
      CAP_QUERIES.contrastMore,
      CAP_QUERIES.forcedColors,
      CAP_QUERIES.reducedTransparency,
    ]),
  );
  const caps = readCapabilities(match, 0);
  assert.equal(caps.pointer, "fine");
  assert.equal(caps.anyCoarse, false);
  assert.equal(caps.hover, true);
  assert.equal(caps.noHover, false);
  assert.equal(caps.touchPoints, 0);
  assert.equal(caps.reducedMotion, true);
  assert.equal(caps.contrast, "more");
  assert.equal(caps.forcedColors, true);
  assert.equal(caps.reducedTransparency, true);
  assert.equal(glassPointer(caps), "fine");
});

test("contrast preserves less and custom as distinct preferences", () => {
  assert.equal(readCapabilities(matcher(new Set([CAP_QUERIES.contrastLess])), 0).contrast, "less");
  assert.equal(readCapabilities(matcher(new Set([CAP_QUERIES.contrastCustom])), 0).contrast, "custom");
});

test("hybrid — touch laptop reports both, caught by anyCoarse not primary pointer", () => {
  // Mouse-primary (so `pointer: fine`) but a touchscreen present (`any-pointer: coarse`).
  const match = matcher(new Set([CAP_QUERIES.anyCoarse, CAP_QUERIES.hover, CAP_QUERIES.anyHover]));
  const caps = readCapabilities(match, 10);
  assert.equal(caps.pointer, "fine", "primary pointer is the mouse");
  assert.equal(caps.anyCoarse, true, "touch remains available as a separate capability");
  assert.equal(caps.noHover, false);
  assert.equal(glassPointer(caps), "fine", "a mouse-primary hybrid keeps fine glass targets");
});

test("iPad profile — coarse primary pointer selects coarse glass targets", () => {
  const match = matcher(new Set([CAP_QUERIES.pointerCoarse, CAP_QUERIES.anyCoarse]));
  const caps = readCapabilities(match, 5);
  assert.equal(caps.pointer, "coarse");
  assert.equal(caps.noHover, true);
  assert.equal(glassPointer(caps), "coarse");
});
