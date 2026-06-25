import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Camera-measurement invariant (C-B6, grand-masters/contracts.md — Byerley).
 *
 * World content is camera-`scale(z)`-transformed, so any measurement feeding *content-space*
 * layout must use transform-independent dimensions (`offsetWidth`/`offsetHeight`), never
 * `getBoundingClientRect` — the rect is the camera-scaled screen box, and the measurement
 * window's `scale(1)` write is not reliably flushed before the read on iOS Safari, so the
 * packer read z-scaled widths and under-spaced the cards on a zoomed-out portrait viewport
 * (Godolphin F10).
 *
 * This guards the packer (the enforced site). `culling.arm` is the documented, contained
 * exception (it measures position, not size — see contracts.md C-B6); it is intentionally
 * out of scope here.
 */
const app = readFileSync(fileURLToPath(new URL("./app.ts", import.meta.url)), "utf8");

test("the packer measures world geometry with offset*, not getBoundingClientRect", () => {
  // Positive: the lanes read layout dimensions.
  assert.match(app, /\.offsetWidth\b/, "packer must measure width via offsetWidth (C-B6)");
  assert.match(app, /\.offsetHeight\b/, "packer must measure height via offsetHeight (C-B6)");
  // Negative: no transform-tainted rect dimension feeds a collision box.
  assert.doesNotMatch(
    app,
    /getBoundingClientRect\(\)\.(width|height|left|right|top|bottom)/,
    "packer must not read a camera-scaled rect dimension for layout (C-B6)",
  );
});
