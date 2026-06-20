import { h } from "../../h.ts";
import { surface } from "./surface.ts";
import { identitySurface } from "./identitySurface.ts";
import { oshiSelector } from "./oshiSelector.ts";
import { clubSelector } from "./clubSelector.ts";
import { playStyleSurface } from "./playStyleSurface.ts";
import { previewedPlayStyle } from "../../identity/playStyleMachine.ts";
import { playStyleSettingsForPreset } from "../../../core/playstyle/index.ts";
import type { PlayStyleMachineState } from "../../identity/playStyleMachine.ts";
import type { IdentityController } from "../../identity/controller.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../../core/playstyle/index.ts";
import type { UiStrings } from "../../strings.ts";

export function buildTrainerCard(
  identity: IdentityController,
  strings: UiStrings,
  opts: { previewPlayStyleKey?: PlayStyleKey; cloud?: Node | undefined },
  on: {
    onOshiSelect: () => void;
    onClubSelect: () => void;
    onPlayStylePreview: (key: PlayStyleKey) => void;
    onClose: () => void;
  },
): HTMLElement {
  const oshi = identity.currentOshi();
  const card = surface({
    title: "Trainer Card",
    placement: "left",
    headerless: true,
    body: identitySurface({
      trainerName: identity.trainerName(),
      oshiName: oshi.name,
      oshiPortrait: oshi.portrait,
      club: identity.club(),
      playStyleKey: opts.previewPlayStyleKey ?? identity.savedPlayStyleKey(),
      savedPlayStyleKey: identity.savedPlayStyleKey(),
      playStyleStrings: strings.playStyle,
      cloud: opts.cloud,
      onTrainerNameChange: (name) => identity.setTrainerName(name),
      onOshiSelect: on.onOshiSelect,
      onClubSelect: on.onClubSelect,
      onPlayStylePreview: on.onPlayStylePreview,
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
  return card;
}

export function buildOshiSelector(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  const selectedOshi = identity.currentOshi();
  return surface({
    title: "Oshi Selector",
    placement: "center",
    headerless: true,
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

export function buildClubSelector(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  return surface({
    title: "Club",
    placement: "center",
    headerless: true,
    body: clubSelector({
      club: identity.club(),
      onCommit: (club) => identity.setClub(club.name, club.rank),
      onLeave: () => identity.leaveClub(),
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
}

export function buildPlayStyle(
  identity: IdentityController,
  strings: UiStrings,
  state: PlayStyleMachineState,
  opts: { cloud?: Node | undefined },
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

  const playStyleCard = surface({
    title: strings.playStyle.presets[playStyleKey].name,
    headerless: true,
    body: playStyleSurface({
      playStyleKey,
      savedPlayStyleKey,
      settings: playStyleSettings,
      savedSettings: savedPlayStyleSettings,
      strings: strings.playStyle,
      onSettingsChange: on.onSettingsChange,
      onApply: on.onApply,
      onDismiss: on.onDiscard,
    }),
    onClose: on.onDiscard,
  });
  playStyleCard.classList.add("surface--playstyle");

  const identityCard = buildTrainerCard(
    identity,
    strings,
    { previewPlayStyleKey: playStyleKey, cloud: opts.cloud },
    { onOshiSelect: on.onOshiSelect, onClubSelect: on.onClubSelect, onPlayStylePreview: on.onPlayStylePreview, onClose: on.onTrainerClose },
  );

  requestAnimationFrame(() => {
    const height = identityCard.getBoundingClientRect().height;
    if (height > 0) playStyleCard.style.height = `${height}px`;
  });

  return h("div", { class: "surface-book" }, identityCard, playStyleCard);
}
