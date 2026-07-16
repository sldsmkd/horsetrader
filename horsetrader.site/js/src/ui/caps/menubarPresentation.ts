import type { Capabilities } from "./capabilities.ts";
import { deviceForm } from "./deviceForm.ts";

export type MenubarPresentation = "visible" | "hidden";

/** Godolphin policy: landscape phone height belongs to the world, not the full menubar. */
export function menubarPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): MenubarPresentation {
  return deviceForm(caps, viewportWidth, viewportHeight) === "phone-landscape" ? "hidden" : "visible";
}
