import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The camera-meets-display seam (Darley, Grand Masters Part 2, deliverable #4).
 *
 * The rail's screen-fixed extent is ONE physical quantity: the band CSS paints and the
 * derail/capture boundary the gesture math measures must originate from the same resolved
 * measure (`--timeline-rail-height`, glass-u). The DOM resolution itself can't run under
 * `node --test` (no layout), so this is the structural guard that survives a later "tidy":
 * it fails if either side is folded back into a convenient px constant, drifting the
 * visual rail and the gesture boundary into two unit systems.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("rail extent has a single CSS source measured in glass-u", () => {
  const css = read("../timeline.css");
  // The one source of truth: defined once, in glass-u, not a raw px literal.
  assert.match(
    css,
    /--timeline-rail-height:\s*calc\([^;]*var\(--glass-u\)[^;]*\);/,
    "--timeline-rail-height must be defined in glass-u (calc(... var(--glass-u) ...))",
  );
  // The painted band reads the source, with no hardcoded px fallback to drift to.
  assert.match(css, /height:\s*var\(--timeline-rail-height\);/);
});

test("the gesture layer reads the rail through the bridge, not a px constant", () => {
  const timeline = read("../timeline.ts");
  const constants = read("./constants.ts");
  // JS resolves the SAME custom property via the glass-u→px bridge.
  assert.match(timeline, /resolveLengthPx\([^)]*var\(--timeline-rail-height\)[^)]*\)/);
  // And no side has reintroduced a rail-extent px constant for a tidy to fold back into.
  assert.doesNotMatch(timeline, /TRACK_RAIL_VISUAL_PX/);
  assert.doesNotMatch(constants, /TRACK_RAIL_VISUAL_PX/);
});
