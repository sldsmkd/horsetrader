import type { Capabilities } from "./capabilities.ts";
import { deviceForm } from "./deviceForm.ts";

export type TimelineChromePresentation = "full" | "filmstrip-only" | "minimap-only";

/**
 * Godolphin policy: a touch-first portrait phone has no useful precision minimap; a
 * landscape phone has no height to spend on the filmstrip.
 */
export function timelineChromePresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): TimelineChromePresentation {
  switch (deviceForm(caps, viewportWidth, viewportHeight)) {
    case "phone-portrait":
      return "filmstrip-only";
    case "phone-landscape":
      return "minimap-only";
    case "spacious":
      return "full";
  }
}
