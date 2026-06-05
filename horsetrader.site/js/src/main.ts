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
import type { EventsBundle } from "./core/bundle/events.gen.ts";
import type { Academy } from "./core/bundle/academy.gen.ts";

async function bootstrap(): Promise<void> {
  // Both baked bundles — upstream-validated, so a plain cast (trust the bake).
  const [events, academy] = (await Promise.all([
    fetch("/json/events.json").then((r) => r.json()),
    fetch("/json/academy.json").then((r) => r.json()),
  ])) as [EventsBundle, Academy];
  const timeZone = defaultTimeZone();
  const now = todayInTimeZone(timeZone);

  const coordinator = createCoordinator({ bundle: events, now, timeZone });
  mountApp(coordinator, createBundle(events, academy, timeZone), now);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to load — see the console.";
});
