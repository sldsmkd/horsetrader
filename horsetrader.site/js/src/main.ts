/**
 * Entry point: bootstrap the headless core. Fetch the baked event bundle, build
 * the coordinator (which loads any saved plan and folds the projection from the
 * snapshot, or today, forward), and expose it for inspection. No UI yet — this
 * only lands the engine in the build and proves it runs end to end. See
 * core/coordinator.
 */

import "../../css/styles.css";

import { createCoordinator } from "./core/coordinator/index.ts";
import type { EventsBundle } from "./core/bundle/events.gen.ts";

async function bootstrap(): Promise<void> {
  const response = await fetch("/json/events.json");
  const bundle = (await response.json()) as EventsBundle; // upstream-validated bundle — plain cast
  const now = new Date().toISOString().slice(0, 10);

  const coordinator = createCoordinator({ bundle, now });
  (globalThis as Record<string, unknown>)["horsetrader"] = coordinator;

  console.info("core bootstrapped —", coordinator.channels().length, "channels");
}

bootstrap().catch((err) => console.error("core bootstrap failed:", err));
