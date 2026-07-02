import type { Capabilities } from "./capabilities.ts";

export type ScenarioPresentation = "visible" | "hidden";

/** Godolphin policy: ambient scenario wallpaper is too noisy on a touch phone. */
export function scenarioPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): ScenarioPresentation {
  const touchFirst = caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0;
  const phoneExtent = Math.min(viewportWidth, viewportHeight) <= 600;
  return touchFirst && phoneExtent ? "hidden" : "visible";
}
