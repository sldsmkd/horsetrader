// Prebake the landing-screen data into the app: everything the shell can paint/preload from
// parse time alone, before app.js fetches the ~1MB bundle and folds (12-billion-yen-incident —
// "get the horse out of the gate"). Two things, both derived from the baked events.json:
//
//   BAKED_EXTENT    — the PROXY timeline span (earliest→latest shown event start, UTC date), so
//                     the scaffold can lay out the timeline + minimap immediately. The real fold
//                     re-buckets in the view timezone, so a one-day edge difference is invisible.
//   BAKED_SCENARIOS — the scenario launch schedule ({ start, image }, sorted), so the scaffold can
//                     PRELOAD today's splash art (the big wallpaper) before it's needed. `image`
//                     mirrors the runtime (`art ?? image`, the full splash — select/scenario.ts).
//
// Run in the `types` stage (after bake, output committed).

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const eventsPath = resolve(here, "../../static/json/events.json");
const outPath = resolve(here, "../js/src/core/bundle/landing.gen.ts");

const { events } = JSON.parse(await readFile(eventsPath, "utf8"));

// Proxy timeline span — earliest→latest shown event start (opt-out only; missing = shown).
let start = null;
let end = null;
for (const ev of events) {
  if (ev.visible === false) continue;
  const day = ev.start.slice(0, 10);
  if (start === null || day < start) start = day;
  if (end === null || day > end) end = day;
}
if (start === null) throw new Error("gen-landing: no shown events — cannot prebake a timeline span");

// Scenario launch schedule, sorted by start — the same set + image the runtime displays.
const scenarios = events
  .filter((ev) => ev.type === "scenario" && (ev.art !== null || ev.image !== null))
  .map((ev) => ({ start: ev.start.slice(0, 10), image: ev.art ?? ev.image }))
  .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

const ts = `/* eslint-disable */
/**
 * Generated from the baked events.json by \`npm run gen:landing\`.
 * DO NOT EDIT BY HAND — re-run generation after a re-bake.
 *
 * Prebaked landing-screen data: the PROXY timeline span and the scenario launch schedule, so the
 * shell can lay out + preload the landing view before the bundle folds. The real layout corrects
 * the span; this only has to be a proxy.
 */
import type { CalendarDate } from "../projection/dates.ts";

export const BAKED_EXTENT: { readonly start: CalendarDate; readonly end: CalendarDate } = {
  start: ${JSON.stringify(start)} as CalendarDate,
  end: ${JSON.stringify(end)} as CalendarDate,
};

export const BAKED_SCENARIOS: readonly { readonly start: CalendarDate; readonly image: string }[] = [
${scenarios.map((s) => `  { start: ${JSON.stringify(s.start)} as CalendarDate, image: ${JSON.stringify(s.image)} },`).join("\n")}
];
`;

await writeFile(outPath, ts);
console.log(`gen-landing: extent ${start} -> ${end}, ${scenarios.length} scenarios -> ${outPath}`);
