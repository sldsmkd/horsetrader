/**
 * Entry point: fetch the baked event bundle, build the headless coordinator
 * (which loads any saved plan and folds the projection from the snapshot, or
 * today, forward), and hand it to the app shell to mount the UI. The shell owns
 * all wiring; this file only does bootstrap + fail-soft. See core/coordinator and
 * ui/app.
 */

// Global shell + tokens; each view co-locates its own styles (ui/**/*.css).
import "../../css/base.css";

import { createCoordinator } from "./core/coordinator/index.ts";
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

async function bootstrap(): Promise<void> {
  // The baked bundles — upstream-validated, so a plain cast (trust the bake).
  const [events, academy, config] = (await Promise.all([
    fetch("/json/events.json").then((r) => r.json()),
    fetch("/json/academy.json").then((r) => r.json()),
    fetch("/json/config.json").then((r) => r.json()),
  ])) as [EventsBundle, Academy, ConfigBundle];
  const timeZone = defaultTimeZone();
  const now = todayInTimeZone(timeZone);

  const coordinator = createCoordinator({
    bundle: events,
    config,
    gacha: { caratsPerPull: config.gacha.carats_per_pull, paidDailyPull: config.gacha.paid_daily_pull, sparkThreshold: config.gacha.spark_threshold },
    now,
    timeZone,
  });
  mountApp(coordinator, createBundle(events, academy, config, timeZone), now, UI_STRINGS);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to load — see the console.";
});
