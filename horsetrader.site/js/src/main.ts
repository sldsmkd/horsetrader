/**
 * Entry point: fetch the baked event bundle, build the headless coordinator
 * (which loads any saved plan and folds the projection from the snapshot, or
 * today, forward), and hand it to the app shell to mount the UI. The shell owns
 * all wiring; this file only does bootstrap + fail-soft. See core/engine and
 * ui/app.
 */

// Global shell + tokens; each view co-locates its own styles (ui/**/*.css).
import "../../css/palette.css";
import "../../css/typography.css";
import "../../css/controls.css";
import "../../css/base.css";
import "../../css/timelineSizing.css";

import { createCoordinator } from "./core/engine/index.ts";
import { defaultTimeZone, todayInTimeZone } from "./core/projection/dates.ts";
import { createBundle } from "./ui/bundle/access.ts";
import { mountApp } from "./ui/app.ts";
// UI copy is bundled, not fetched — it's app code, not baked data. (It used to be a
// hand-authored skeleton/json/strings.json fetched here; that split silently drifted
// from the playstyle key enums. See ui/strings.ts.)
import { UI_STRINGS } from "./ui/strings.ts";
import type { EventsBundle } from "./core/bundle/events.gen.ts";
import type { Academy } from "./core/bundle/academy.gen.ts";
import type { ConfigBundle } from "./core/bundle/config.gen.ts";
import type { BakeStats } from "./core/bundle/stats.gen.ts";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return (await response.json()) as T;
}

async function bootstrap(): Promise<void> {
  // The baked bundles — upstream-validated, so a plain cast (trust the bake).
  // stats.json is a side-channel: build-time vanity counters for the MANGOHORSE
  // HUD only, not planner data, so it never enters the coordinator or bundle.
  const [events, academy, config, bakeStats] = (await Promise.all([
    fetchJson<EventsBundle>("/json/events.json"),
    fetchJson<Academy>("/json/academy.json"),
    fetchJson<ConfigBundle>("/json/config.json"),
    fetchJson<BakeStats>("/json/stats.json"),
  ])) as [EventsBundle, Academy, ConfigBundle, BakeStats];
  const timeZone = defaultTimeZone();
  const now = todayInTimeZone(timeZone);

  const coordinator = createCoordinator({ bundle: events, config, now, timeZone });
  mountApp(coordinator, createBundle(events, academy, config, timeZone), now, UI_STRINGS, bakeStats);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to load — see the console.";
});
