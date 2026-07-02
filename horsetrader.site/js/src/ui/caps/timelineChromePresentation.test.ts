import assert from "node:assert/strict";
import test from "node:test";

import { timelineChromePresentation } from "./timelineChromePresentation.ts";
import type { Capabilities } from "./capabilities.ts";

const phone: Capabilities = {
  pointer: "coarse",
  anyCoarse: true,
  hover: false,
  noHover: true,
  touchPoints: 5,
  reducedMotion: false,
  contrast: "no-preference",
  forcedColors: false,
  reducedTransparency: false,
};

test("touch portrait phone drops the imprecise minimap", () => {
  assert.equal(timelineChromePresentation(phone, 390, 699), "filmstrip-only");
});

test("landscape phone keeps only its wide minimap", () => {
  assert.equal(timelineChromePresentation(phone, 699, 390), "minimap-only");
});

test("portrait tablet keeps the complete timeline chrome", () => {
  assert.equal(timelineChromePresentation(phone, 768, 1024), "full");
});

test("a narrow fine-pointer viewport keeps the complete timeline chrome", () => {
  assert.equal(
    timelineChromePresentation({ ...phone, pointer: "fine", noHover: false, touchPoints: 0 }, 390, 699),
    "full",
  );
});
