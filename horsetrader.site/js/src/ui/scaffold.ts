/**
 * The pre-fetch landing scaffold (12-billion-yen-incident: "get the horse out of the gate").
 *
 * Before app.js fetches the ~1MB bundle and folds, paint the real timeline + minimap *structure*
 * from data available at parse time alone: the prebaked proxy extent (landing.gen.ts) and a flat
 * 0-balance plan. The player sees the timeline frame, the minimap frets and a flat blue baseline
 * immediately instead of `Loading…`. We also preload today's scenario splash here, so the big
 * wallpaper is warm by the time the real app sets it. The real `mountApp` then replaces the whole
 * #app subtree when the bundle lands — the scaffold views are throwaway (no window/document
 * listeners, so they GC cleanly when detached). Fail-soft: a scaffold throw must never block boot.
 */
import { timeline } from "./views/timeline.ts";
import { minimap } from "./views/minimap.ts";
import { BAKED_EXTENT, BAKED_SCENARIOS } from "../core/bundle/landing.gen.ts";
import { daysBetween } from "../core/projection/dates.ts";
import type { CalendarDate } from "../core/projection/dates.ts";

// The runtime ramps to an upcoming scenario's art when it's within this many days (the displayed
// image flips early). Mirror it so the preload warms the image the app will actually show.
// (select/scenario.ts SCENARIO_INCOMING_RAMP_DAYS.)
const SCENARIO_INCOMING_RAMP_DAYS = 4;

/** The scenario splash the app will display at `now` — latest launch at/before today, or an
 *  upcoming one already inside its incoming ramp. Mirrors scenarioLookup's selection. */
function currentScenarioImage(now: CalendarDate): string | null {
  let active: (typeof BAKED_SCENARIOS)[number] | null = null;
  let upcoming: (typeof BAKED_SCENARIOS)[number] | null = null;
  for (const scenario of BAKED_SCENARIOS) {
    if (scenario.start > now) {
      upcoming = scenario;
      break;
    }
    active = scenario;
  }
  if (upcoming && daysBetween(now, upcoming.start) <= SCENARIO_INCOMING_RAMP_DAYS) return upcoming.image;
  return active?.image ?? null;
}

export function mountScaffold(now: CalendarDate, root: HTMLElement): void {
  // Warm today's scenario splash (the big wallpaper) before the app mounts it.
  const splash = currentScenarioImage(now);
  if (splash) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = splash;
    document.head.appendChild(link);
  }

  // Same construction + mount order as mountApp's world + minimap, so the swap to the real UI is
  // seamless (same extent, same axis). onSeek/onView are inert — the scaffold doesn't navigate.
  const tl = timeline({ onView: () => {} });
  const mini = minimap({ onSeek: () => {} });
  root.replaceChildren(tl.el, mini.el);

  const extent: readonly [CalendarDate, CalendarDate] = [BAKED_EXTENT.start, BAKED_EXTENT.end];
  tl.layout(extent, now); // axis + today marker over the proxy span
  tl.setCards([]); // empty world — the cards arrive with the fold
  mini.scaffold(extent, now); // frets + flat blue 0-balance line
}
