/**
 * Entry point: fetch the baked event bundle, build the headless coordinator
 * (which loads any saved plan and folds the projection from the snapshot, or
 * today, forward), and hand it to the app shell to mount the UI. The shell owns
 * all wiring; this file only does bootstrap + fail-soft. See core/coordinator and
 * ui/app.
 */

import "../../css/styles.css";

import { createCoordinator } from "./core/coordinator/index.ts";
import { mountApp } from "./ui/app.ts";
import type { EventsBundle } from "./core/bundle/events.gen.ts";

async function bootstrap(): Promise<void> {
  const response = await fetch("/json/events.json");
  const bundle = (await response.json()) as EventsBundle; // upstream-validated bundle — plain cast
  const now = new Date().toISOString().slice(0, 10);

  const coordinator = createCoordinator({ bundle, now });
  mountApp(coordinator, now);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to load — see the console.";
});
