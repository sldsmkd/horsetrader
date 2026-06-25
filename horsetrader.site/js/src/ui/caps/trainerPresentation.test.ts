import assert from "node:assert/strict";
import test from "node:test";

import { trainerPresentation } from "./trainerPresentation.ts";
import type { Capabilities } from "./capabilities.ts";

const phone: Capabilities = {
  pointer: "coarse",
  anyCoarse: true,
  hover: false,
  noHover: true,
  touchPoints: 5,
};

test("touch phone is fullscreen in either physical orientation", () => {
  assert.equal(trainerPresentation(phone, 390, 699), "fullscreen");
  assert.equal(trainerPresentation(phone, 699, 390), "fullscreen");
});

test("touch tablet and fine-pointer desktop use the menubar rail", () => {
  assert.equal(trainerPresentation(phone, 768, 1024), "rail");
  assert.equal(
    trainerPresentation(
      { pointer: "fine", anyCoarse: false, hover: true, noHover: false, touchPoints: 0 },
      390,
      699,
    ),
    "rail",
  );
});
