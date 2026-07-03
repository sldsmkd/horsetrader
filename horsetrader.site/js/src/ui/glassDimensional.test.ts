import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * C-B4 guard — glass resizes dimensionally, never by transform (contracts.md).
 *
 * In a parallel projection size IS dimension, so `transform: scale` / `zoom` on a glass
 * element lies about its own size; `scale` is the camera's privilege, world plane only.
 * This guard scans every stylesheet except the declared world-plane set (carried by the
 * camera's `scale(z)`, counter-scaled via `--zoom`) and the debug HUD.
 *
 * Deliberately NOT flagged:
 * - `scale` inside `@keyframes` — a transient entrance/exit animation is motion design,
 *   not dimension; the element's settled size stays honest (scenarioArt's pop).
 * - `grayscale(` (a filter), comments, and the `--zoom` custom property.
 */

const uiDir = fileURLToPath(new URL(".", import.meta.url));
const cssRoot = fileURLToPath(new URL("../../../css", import.meta.url));

/** World-plane + debug stylesheets, exempt by membership (C-B1), not by tolerance. */
const WORLD_PLANE_OR_DEBUG = new Set([
  "timeline.css", // the camera itself + world chrome counter-scaling
  "timelineSizing.css", // Golshi world geometry
  "card.css",
  "belowCard.css",
  "bannerGroup.css",
  "atomChip.css",
  "perfHud.css", // debug instrument, excluded since Byerley
]);

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".css"))
    .map((e) => join(e.parentPath, e.name));

/** Strip comments and @keyframes blocks so only live, steady-state declarations remain. */
function steadyStateCss(source: string): string {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove each @keyframes block by walking its braces (they nest one level).
  let out = "";
  let i = 0;
  while (i < noComments.length) {
    const at = noComments.indexOf("@keyframes", i);
    if (at === -1) {
      out += noComments.slice(i);
      break;
    }
    out += noComments.slice(i, at);
    let depth = 0;
    let j = noComments.indexOf("{", at);
    for (; j < noComments.length; j++) {
      if (noComments[j] === "{") depth++;
      if (noComments[j] === "}" && --depth === 0) break;
    }
    i = j + 1;
  }
  return out;
}

test("no steady-state scale/zoom on the glass plane (C-B4)", () => {
  const offenders: string[] = [];
  for (const file of [...cssFiles(cssRoot), ...cssFiles(uiDir)]) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    if (WORLD_PLANE_OR_DEBUG.has(name)) continue;
    const css = steadyStateCss(readFileSync(file, "utf8"));
    // scale(/scaleX(/scale3d( … but not grayscale( — a letter before "scale" exempts it.
    if (/(?<![a-z])scale[a-z0-9]*\(/i.test(css)) offenders.push(`${name}: scale()`);
    // The `zoom` property — but not the `--zoom` custom property or var(--zoom).
    if (/(?<![-a-z])zoom\s*:/i.test(css)) offenders.push(`${name}: zoom`);
  }
  assert.deepEqual(offenders, [], `glass plane must resize dimensionally, found: ${offenders.join(", ")}`);
});

test("the world-plane exemption list only names files that exist", () => {
  const present = new Set(
    [...cssFiles(cssRoot), ...cssFiles(uiDir)].map((f) => f.slice(f.lastIndexOf("/") + 1)),
  );
  for (const name of WORLD_PLANE_OR_DEBUG) {
    assert.ok(present.has(name), `stale exemption: ${name} no longer exists`);
  }
});
