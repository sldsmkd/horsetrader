import type { Capabilities } from "./capabilities.ts";
import { deviceForm } from "./deviceForm.ts";

export type ScenarioPresentation = "visible" | "hidden";

/** Godolphin policy: ambient scenario wallpaper is too noisy on a touch phone. */
export function scenarioPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): ScenarioPresentation {
  return deviceForm(caps, viewportWidth, viewportHeight) === "spacious" ? "visible" : "hidden";
}
