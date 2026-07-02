import assert from "node:assert/strict";
import test from "node:test";

import { scenarioPresentation } from "./scenarioPresentation.ts";
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

test("scenario wallpaper is hidden in both phone orientations", () => {
  assert.equal(scenarioPresentation(phone, 390, 699), "hidden");
  assert.equal(scenarioPresentation(phone, 699, 390), "hidden");
});

test("touch tablet and fine-pointer phone-size window retain scenario wallpaper", () => {
  assert.equal(scenarioPresentation(phone, 768, 1024), "visible");
  assert.equal(
    scenarioPresentation({ ...phone, pointer: "fine", noHover: false, touchPoints: 0 }, 390, 699),
    "visible",
  );
});
