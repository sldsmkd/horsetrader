import type { Capabilities } from "./capabilities.ts";

export type MenubarPresentation = "visible" | "hidden";

/** Godolphin policy: landscape phone height belongs to the world, not the full menubar. */
export function menubarPresentation(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): MenubarPresentation {
  const touchFirst = caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0;
  const landscapePhone = viewportWidth > viewportHeight && viewportHeight <= 600;
  return touchFirst && landscapePhone ? "hidden" : "visible";
}
