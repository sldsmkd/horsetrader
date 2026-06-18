import { h } from "../h.ts";
import { overlay, suspendOverlay } from "./overlay.ts";
import { identitySurface } from "./identitySurface.ts";
import { oshiSelector } from "./oshiSelector.ts";
import { clubSelector } from "./clubSelector.ts";
import { playStyleSurface } from "./playStyleSurface.ts";
import { previewedPlayStyle } from "../identity/playStyleMachine.ts";
import { playStyleSettingsForPreset } from "../../core/playstyle/index.ts";
import type { PlayStyleMachineState } from "../identity/playStyleMachine.ts";
import type { IdentityController } from "../identity/controller.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";
import type { UiStrings } from "../strings.ts";

export function buildTrainerCard(
  identity: IdentityController,
  strings: UiStrings,
  opts: { suspended?: boolean; previewPlayStyleKey?: PlayStyleKey },
  on: {
    onOshiSelect: () => void;
    onClubSelect: () => void;
    onPlayStylePreview: (key: PlayStyleKey) => void;
    onClose: () => void;
  },
): HTMLElement {
  const oshi = identity.currentOshi();
  const card = overlay({
    title: "Trainer Card",
    placement: "left",
    body: identitySurface({
      trainerName: identity.trainerName(),
      oshiName: oshi.name,
      oshiPortrait: oshi.portrait,
      club: identity.club(),
      playStyleKey: opts.previewPlayStyleKey ?? identity.savedPlayStyleKey(),
      savedPlayStyleKey: identity.savedPlayStyleKey(),
      playStyleStrings: strings.playStyle,
      onTrainerNameChange: (name) => identity.setTrainerName(name),
      onOshiSelect: on.onOshiSelect,
      onClubSelect: on.onClubSelect,
      onPlayStylePreview: on.onPlayStylePreview,
    }),
    onClose: on.onClose,
  });
  if (opts.suspended) suspendOverlay(card);
  return card;
}

export function buildOshiSelectorOverlay(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  const selectedOshi = identity.currentOshi();
  return overlay({
    title: "Oshi Selector",
    placement: "center",
    body: oshiSelector({
      selectedId: selectedOshi.id,
      selected: selectedOshi,
      search: identity.oshiSearch(),
      onCommit: (oshi) => identity.setOshiId(oshi.id),
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
}

export function buildClubSelectorOverlay(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  return overlay({
    title: "Club",
    placement: "center",
    body: clubSelector({
      club: identity.club(),
      onCommit: (club) => identity.setClub(club.name, club.rank),
      onLeave: () => identity.leaveClub(),
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
}

export function buildPlayStyleOverlay(
  identity: IdentityController,
  strings: UiStrings,
  state: PlayStyleMachineState,
  opts: { suspended?: boolean },
  on: {
    onOshiSelect: () => void;
    onClubSelect: () => void;
    onPlayStylePreview: (key: PlayStyleKey) => void;
    onTrainerClose: () => void;
    onDiscard: () => void;
    onSettingsChange: (settings: PlayStyleSettings) => void;
    onApply: (key: PlayStyleKey, settings: PlayStyleSettings) => void;
  },
): HTMLElement {
  const savedPlayStyleKey = identity.savedPlayStyleKey();
  const savedPlayStyleSettings = identity.savedPlayStyleSettings();
  const playStyleKey = previewedPlayStyle(state, savedPlayStyleKey);
  // Staged edits win. Otherwise: Custom seeds from whatever's currently applied
  // (it's "your settings, now editable" — no canonical defaults), as does viewing
  // your own saved style; previewing a *different* preset shows that preset's
  // defaults.
  const playStyleSettings =
    state.stagedPlayStyleSettings ??
    (playStyleKey === "custom" || playStyleKey === savedPlayStyleKey
      ? savedPlayStyleSettings
      : playStyleSettingsForPreset(playStyleKey));

  const playStyleCard = overlay({
    title: strings.playStyle.title,
    body: playStyleSurface({
      playStyleKey,
      savedPlayStyleKey,
      settings: playStyleSettings,
      savedSettings: savedPlayStyleSettings,
      strings: strings.playStyle,
      onSettingsChange: on.onSettingsChange,
      onApply: on.onApply,
    }),
    onClose: on.onDiscard,
  });
  playStyleCard.classList.add("overlay--playstyle");

  const identityCard = buildTrainerCard(
    identity,
    strings,
    { previewPlayStyleKey: playStyleKey, ...(opts.suspended ? { suspended: true } : {}) },
    { onOshiSelect: on.onOshiSelect, onClubSelect: on.onClubSelect, onPlayStylePreview: on.onPlayStylePreview, onClose: on.onTrainerClose },
  );

  requestAnimationFrame(() => {
    const height = identityCard.getBoundingClientRect().height;
    if (height > 0) playStyleCard.style.height = `${height}px`;
  });

  return h(
    "div",
    { class: "overlay-book" },
    identityCard,
    opts.suspended ? suspendOverlay(playStyleCard) : playStyleCard,
  );
}
