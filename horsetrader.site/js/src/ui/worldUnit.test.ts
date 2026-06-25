import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { timelineLengthGolshis, WORLD_GOLSHI_PX } from "./views/timeline/constants.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("Golshi is the single world interaction unit and cards derive from it", () => {
  const sizing = read("../../../css/timelineSizing.css");
  const chips = read("./views/widgets/atomChip.css");

  assert.match(sizing, /--world-golshi:\s*35px;/);
  assert.equal(WORLD_GOLSHI_PX, 35);
  assert.match(sizing, /--timeline-card-w:\s*calc\(8\s*\*\s*var\(--world-golshi\)\);/);
  assert.match(chips, /\.atom-chip\s*\{[^}]*height:\s*var\(--world-golshi\);[^}]*\}/s);
  assert.match(chips, /\.atom-chip--compact\s*\{[^}]*height:\s*var\(--world-golshi\);[^}]*\}/s);
});

test("timeline length converts its padded fixed-day canvas into Golshis", () => {
  assert.equal(timelineLengthGolshis(0), (6 * 120) / 35);
  assert.equal(timelineLengthGolshis(1369), 165_000 / 35);
});

test("compact below cards remain exactly half a full card (4g versus 8g)", () => {
  const css = read("./views/belowCard.css");
  assert.match(css, /\.card--compact\s*\{[^}]*width:\s*calc\(var\(--timeline-card-w\)\s*\/\s*2\);[^}]*\}/s);
});
