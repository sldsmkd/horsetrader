import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Containment invariant (C-B5, grand-masters/contracts.md — Byerley).
 *
 * Both planes clip to the viewport box so overflow can NEVER become a pan region: a modal
 * wider than the viewport is clipped, not allowed to turn the document into a pannable
 * canvas that drags the viewport-pinned chrome off-screen with no way home (Godolphin
 * F7/F9). `.surface-layer` needs its own clip because it is `position: fixed` and `clip` is
 * not a fixed containing block, so it escapes `#app`'s clip.
 *
 * Layout can't run under `node --test`, so this is the structural guard: it fails if any of
 * the three clip points is dropped in a later "tidy".
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("the world plane (html, #app) clips overflow to the viewport box", () => {
  const base = read("../../../../../css/base.css");
  // `html` and `#app` each carry `overflow: clip` (order-independent across the file).
  assert.match(base, /html\s*\{[^}]*overflow:\s*clip;[^}]*\}/s, "html must clip overflow (C-B5)");
  assert.match(base, /#app\s*\{[^}]*overflow:\s*clip;[^}]*\}/s, "#app must clip overflow (C-B5)");
});

test("the glass surface layer clips overflow (it escapes #app's clip — fixed)", () => {
  const css = read("./surface.css");
  assert.match(
    css,
    /\.surface-layer\s*\{[^}]*overflow:\s*clip;[^}]*\}/s,
    ".surface-layer must clip overflow separately — a fixed layer escapes #app's clip (C-B5)",
  );
});
