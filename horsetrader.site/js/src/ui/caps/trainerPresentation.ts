import type { Capabilities } from "./capabilities.ts";
import { deviceForm } from "./deviceForm.ts";

export type TrainerPresentation = "rail" | "fullscreen";

/** Godolphin policy: touch phone fullscreen; tablet/desktop on the menubar rail. */
export function trainerPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): TrainerPresentation {
  return deviceForm(caps, viewportWidth, viewportHeight) === "spacious" ? "rail" : "fullscreen";
}
