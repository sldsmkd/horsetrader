import type { Capabilities } from "./capabilities.ts";

export type TimelineChromePresentation = "full" | "filmstrip-only" | "minimap-only";

/** Godolphin policy: a touch-first portrait phone has no useful precision minimap. */
export function timelineChromePresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): TimelineChromePresentation {
  const touchFirst = caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0;
  const portraitPhone = viewportHeight > viewportWidth && viewportWidth <= 600;
  const landscapePhone = viewportWidth > viewportHeight && viewportHeight <= 600;
  if (touchFirst && portraitPhone) return "filmstrip-only";
  if (touchFirst && landscapePhone) return "minimap-only";
  return "full";
}
