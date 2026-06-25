import type { Capabilities } from "./capabilities.ts";

export type TrainerPresentation = "rail" | "fullscreen";

/** Capability + extent policy: touch phone fullscreen; tablet/desktop on the menubar rail. */
export function trainerPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): TrainerPresentation {
  const touchFirst = caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0;
  const phoneExtent = Math.min(viewportWidth, viewportHeight) <= 600;
  return touchFirst && phoneExtent ? "fullscreen" : "rail";
}
