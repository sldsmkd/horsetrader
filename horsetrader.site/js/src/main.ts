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
import "../../css/glass.css";
import "../../css/timelineSizing.css";

import { createCoordinator } from "./core/engine/index.ts";
import { defaultTimeZone, todayInTimeZone } from "./core/projection/dates.ts";
import { createBundle } from "./ui/bundle/access.ts";
import { mountApp } from "./ui/app.ts";
import { mountScaffold } from "./ui/scaffold.ts";
// UI copy is bundled, not fetched — it's app code, not baked data. (It used to be a
// hand-authored skeleton/json/strings.json fetched here; that split silently drifted
// from the playstyle key enums. See ui/strings.ts.)
import { UI_STRINGS } from "./ui/strings.ts";
import type { EventsBundle } from "./core/bundle/events.gen.ts";
import type { Academy } from "./core/bundle/academy.gen.ts";
import type { ConfigBundle } from "./core/bundle/config.gen.ts";
import type { BakeStats } from "./core/bundle/stats.gen.ts";
import type { ImagesBundle } from "./core/bundle/images.gen.ts";
import { initImages } from "./ui/image.ts";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return (await response.json()) as T;
}

async function bootstrap(): Promise<void> {
  const timeZone = defaultTimeZone();
  const now = todayInTimeZone(timeZone);

  // Paint the timeline + minimap structure from the prebaked proxy extent before any network —
  // a real frame instead of `Loading…`. Fail-soft: a scaffold hiccup must never block the boot.
  const root = document.getElementById("app");
  if (root) {
    try {
      mountScaffold(now, root);
    } catch (err) {
      console.warn("scaffold skipped:", err);
    }
  }

  // The baked bundles — upstream-validated, so a plain cast (trust the bake).
  // stats.json is a side-channel: build-time vanity counters for the MANGOHORSE
  // HUD only, not planner data, so it never enters the coordinator or bundle.
  const [events, academy, config, bakeStats, images] = (await Promise.all([
    fetchJson<EventsBundle>("/json/events.json"),
    fetchJson<Academy>("/json/academy.json"),
    fetchJson<ConfigBundle>("/json/config.json"),
    fetchJson<BakeStats>("/json/stats.json"),
    fetchJson<ImagesBundle>("/json/images.json"),
  ])) as [EventsBundle, Academy, ConfigBundle, BakeStats, ImagesBundle];

  // Prime the image broker so every <img> it builds carries baked width/height.
  initImages(images.dims);

  const coordinator = createCoordinator({ bundle: events, config, now, timeZone });
  mountApp(coordinator, createBundle(events, academy, config, timeZone), now, UI_STRINGS, bakeStats);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to load — see the console.";
});
