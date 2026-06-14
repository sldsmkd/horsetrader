import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";

export type IdentityOverlayState =
  | "closed"
  | "identity"
  | "oshi"
  | "club"
  | "playstyle"
  | "playstyle-oshi"
  | "playstyle-club";

export interface PlayStyleMachineState {
  overlay: IdentityOverlayState;
  stagedPlayStyle: PlayStyleKey | null;
  stagedPlayStyleSettings: PlayStyleSettings | null;
}

export type PlayStyleMachineEvent =
  | { type: "toggle-identity" }
  | { type: "open-oshi" }
  | { type: "close-oshi" }
  | { type: "open-club" }
  | { type: "close-club" }
  | { type: "preview-playstyle"; key: PlayStyleKey }
  | { type: "stage-settings"; settings: PlayStyleSettings }
  | { type: "discard-playstyle" }
  | { type: "commit-playstyle" }
  | { type: "commit-playstyle-stay" }
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
    case "open-club":
      return {
        overlay: state.overlay === "playstyle" || state.overlay === "playstyle-club" ? "playstyle-club" : "club",
        stagedPlayStyle: state.stagedPlayStyle,
        stagedPlayStyleSettings: state.stagedPlayStyleSettings,
      };
    case "close-club":
      return {
        overlay: state.overlay === "playstyle-club" ? "playstyle" : "identity",
        stagedPlayStyle: state.stagedPlayStyle,
        stagedPlayStyleSettings: state.stagedPlayStyleSettings,
      };
    case "discard-playstyle":
    case "commit-playstyle":
      return { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null };
    // Custom is a tweaker surface: committing clears the staging (the saved value
    // now IS the edit) but keeps the play-style page open so tuning can continue,
    // rather than collapsing back to the trainer card like a streamlined preset.
    case "commit-playstyle-stay":
      return { overlay: "playstyle", stagedPlayStyle: null, stagedPlayStyleSettings: null };
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
