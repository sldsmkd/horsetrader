import type { PlayStyleKey } from "../views/identitySurface.ts";

export type IdentityOverlayState = "closed" | "trainer" | "oshi" | "playstyle";

export interface PlayStyleMachineState {
  overlay: IdentityOverlayState;
  stagedPlayStyle: PlayStyleKey | null;
}

export type PlayStyleMachineEvent =
  | { type: "toggle-identity" }
  | { type: "open-oshi" }
  | { type: "close-oshi" }
  | { type: "preview-playstyle"; key: PlayStyleKey }
  | { type: "discard-playstyle" }
  | { type: "commit-playstyle" }
  | { type: "close-all" };

export const PLAY_STYLE_MACHINE_INITIAL: PlayStyleMachineState = {
  overlay: "closed",
  stagedPlayStyle: null,
};

export function previewedPlayStyle(state: PlayStyleMachineState, savedPlayStyle: PlayStyleKey): PlayStyleKey {
  return state.stagedPlayStyle ?? savedPlayStyle;
}

export function reducePlayStyleMachine(
  state: PlayStyleMachineState,
  event: PlayStyleMachineEvent,
  savedPlayStyle: PlayStyleKey,
): PlayStyleMachineState {
  switch (event.type) {
    case "toggle-identity":
      return {
        overlay: state.overlay === "closed" ? "trainer" : "closed",
        stagedPlayStyle: null,
      };
    case "open-oshi":
      return { overlay: "oshi", stagedPlayStyle: state.stagedPlayStyle };
    case "close-oshi":
    case "discard-playstyle":
    case "commit-playstyle":
      return { overlay: "trainer", stagedPlayStyle: null };
    case "close-all":
      return PLAY_STYLE_MACHINE_INITIAL;
    case "preview-playstyle": {
      if (event.key === "custom") return state;
      if (state.overlay === "playstyle" && event.key === savedPlayStyle) {
        return previewedPlayStyle(state, savedPlayStyle) === savedPlayStyle
          ? { overlay: "trainer", stagedPlayStyle: null }
          : { overlay: "playstyle", stagedPlayStyle: null };
      }
      return {
        overlay: "playstyle",
        stagedPlayStyle: event.key === savedPlayStyle ? null : event.key,
      };
    }
  }
}
