import assert from "node:assert/strict";
import test from "node:test";

import { deviceForm, PHONE_SHORT_EDGE_MAX_PX } from "./deviceForm.ts";
import type { Capabilities } from "./capabilities.ts";

const touchPhone: Capabilities = {
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

const desktop: Capabilities = {
  pointer: "fine",
  anyCoarse: false,
  hover: true,
  noHover: false,
  touchPoints: 0,
  reducedMotion: false,
  contrast: "no-preference",
  forcedColors: false,
  reducedTransparency: false,
};

// A touch laptop with a mouse as primary pointer: anyCoarse but not touch-first.
const mouseFirstHybrid: Capabilities = { ...desktop, anyCoarse: true, touchPoints: 10 };

test("touch phone classifies by orientation", () => {
  assert.equal(deviceForm(touchPhone, 390, 699), "phone-portrait");
  assert.equal(deviceForm(touchPhone, 699, 390), "phone-landscape");
});

test("square touch phone ties to portrait (deliberate resolution)", () => {
  assert.equal(deviceForm(touchPhone, 600, 600), "phone-portrait");
});

test("touch tablet extent is spacious in both orientations", () => {
  assert.equal(deviceForm(touchPhone, 768, 1024), "spacious");
  assert.equal(deviceForm(touchPhone, 1180, 820), "spacious");
});

test("fine-pointer desktop is spacious even in a phone-sized window", () => {
  assert.equal(deviceForm(desktop, 390, 699), "spacious");
  assert.equal(deviceForm(desktop, 2560, 1440), "spacious");
});

test("mouse-first hybrid keeps the spacious form at phone extent", () => {
  assert.equal(deviceForm(mouseFirstHybrid, 390, 699), "spacious");
});

test("the cutoff is the short edge, inclusive", () => {
  assert.equal(deviceForm(touchPhone, PHONE_SHORT_EDGE_MAX_PX, 900), "phone-portrait");
  assert.equal(deviceForm(touchPhone, PHONE_SHORT_EDGE_MAX_PX + 1, 900), "spacious");
});
