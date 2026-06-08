import type { PlayStyleKey } from "../views/playStylePreset.ts";

export type IdentityOverlayState = "closed" | "identity" | "oshi" | "playstyle" | "playstyle-oshi";

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
        overlay: state.overlay === "closed" ? "identity" : "closed",
        stagedPlayStyle: null,
      };
    case "open-oshi":
      return {
        overlay: state.overlay === "playstyle" || state.overlay === "playstyle-oshi" ? "playstyle-oshi" : "oshi",
        stagedPlayStyle: state.stagedPlayStyle,
      };
    case "close-oshi":
      return {
        overlay: state.overlay === "playstyle-oshi" ? "playstyle" : "identity",
        stagedPlayStyle: state.stagedPlayStyle,
      };
    case "discard-playstyle":
    case "commit-playstyle":
      return { overlay: "identity", stagedPlayStyle: null };
    case "close-all":
      return PLAY_STYLE_MACHINE_INITIAL;
    case "preview-playstyle": {
      if (event.key === "custom") return state;
      if ((state.overlay === "playstyle" || state.overlay === "playstyle-oshi") && event.key === savedPlayStyle) {
        return previewedPlayStyle(state, savedPlayStyle) === savedPlayStyle
          ? { overlay: "identity", stagedPlayStyle: null }
          : { overlay: "playstyle", stagedPlayStyle: null };
      }
      return {
        overlay: "playstyle",
        stagedPlayStyle: event.key === savedPlayStyle ? null : event.key,
      };
    }
  }
}
