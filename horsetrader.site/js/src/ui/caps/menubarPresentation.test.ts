import assert from "node:assert/strict";
import test from "node:test";

import { menubarPresentation } from "./menubarPresentation.ts";
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

test("touch landscape phone removes the menubar", () => {
  assert.equal(menubarPresentation(phone, 699, 390), "hidden");
});

test("portrait phone and landscape tablet retain the menubar", () => {
  assert.equal(menubarPresentation(phone, 390, 699), "visible");
  assert.equal(menubarPresentation(phone, 1180, 820), "visible");
});

test("a short fine-pointer window retains the menubar", () => {
  assert.equal(
    menubarPresentation({ ...phone, pointer: "fine", noHover: false, touchPoints: 0 }, 699, 390),
    "visible",
  );
});
