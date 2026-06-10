import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";

export type IdentityOverlayState = "closed" | "identity" | "oshi" | "playstyle" | "playstyle-oshi";

export interface PlayStyleMachineState {
  overlay: IdentityOverlayState;
  stagedPlayStyle: PlayStyleKey | null;
  stagedPlayStyleSettings: PlayStyleSettings | null;
}

export type PlayStyleMachineEvent =
  | { type: "toggle-identity" }
  | { type: "open-oshi" }
  | { type: "close-oshi" }
  | { type: "preview-playstyle"; key: PlayStyleKey }
  | { type: "stage-settings"; settings: PlayStyleSettings }
  | { type: "discard-playstyle" }
  | { type: "commit-playstyle" }
  | { type: "close-all" };

export const PLAY_STYLE_MACHINE_INITIAL: PlayStyleMachineState = {
  overlay: "closed",
  stagedPlayStyle: null,
  stagedPlayStyleSettings: null,
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
        stagedPlayStyleSettings: null,
      };
    case "open-oshi":
      return {
        overlay: state.overlay === "playstyle" || state.overlay === "playstyle-oshi" ? "playstyle-oshi" : "oshi",
        stagedPlayStyle: state.stagedPlayStyle,
        stagedPlayStyleSettings: state.stagedPlayStyleSettings,
      };
    case "close-oshi":
      return {
        overlay: state.overlay === "playstyle-oshi" ? "playstyle" : "identity",
        stagedPlayStyle: state.stagedPlayStyle,
        stagedPlayStyleSettings: state.stagedPlayStyleSettings,
      };
    case "discard-playstyle":
    case "commit-playstyle":
      return { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null };
    case "close-all":
      return PLAY_STYLE_MACHINE_INITIAL;
    case "stage-settings":
      return { ...state, stagedPlayStyleSettings: event.settings };
    case "preview-playstyle": {
      if ((state.overlay === "playstyle" || state.overlay === "playstyle-oshi") && event.key === savedPlayStyle) {
        return previewedPlayStyle(state, savedPlayStyle) === savedPlayStyle
          ? { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null }
          : { overlay: "playstyle", stagedPlayStyle: null, stagedPlayStyleSettings: null };
      }
      return {
        overlay: "playstyle",
        stagedPlayStyle: event.key === savedPlayStyle ? null : event.key,
        stagedPlayStyleSettings: null,
      };
    }
  }
}
