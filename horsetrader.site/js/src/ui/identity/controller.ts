import { h } from "../h.ts";
import { createOshiIndex, DEFAULT_OSHI_ID, selectedOshiOption } from "../oshi/index.ts";
import { identitySurface } from "../views/identitySurface.ts";
import { DEFAULT_PLAY_STYLE } from "../views/identitySurface.ts";
import type { PlayStyleKey } from "../views/identitySurface.ts";
import { oshiSelector } from "../views/oshiSelector.ts";
import { overlay } from "../views/overlay.ts";
import type { Coordinator } from "../../core/coordinator/index.ts";
import type { Bundle } from "../bundle/access.ts";

export interface MenuIdentity {
  label: string;
  icon: string;
}

export interface IdentityController {
  menuIdentity(): MenuIdentity;
  savedPlayStyleKey(): PlayStyleKey;
  commitPlayStyleKey(key: PlayStyleKey): void;
  trainerCardOverlay(opts: {
    suspended?: boolean;
    previewPlayStyleKey?: PlayStyleKey;
    onOshiSelect: () => void;
    onPlayStylePreview: (key: PlayStyleKey) => void;
    onClose: () => void;
  }): HTMLElement;
  oshiSelectorOverlay(opts: { onClose: () => void }): HTMLElement;
}

export function createIdentityController(coord: Coordinator, bundle: Bundle): IdentityController {
  const oshiSearch = createOshiIndex(bundle);

  function identityConfig(): Record<string, unknown> {
    const config = coord.document().config;
    const identity = config?.["identity"];
    return typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  }

  function updateIdentity(patch: Record<string, unknown>): void {
    const config = coord.document().config ?? {};
    coord.update({ config: { ...config, identity: { ...identityConfig(), ...patch } } });
  }

  function trainerName(): string {
    const name = identityConfig()["trainerName"];
    return typeof name === "string" && name.trim() ? name : "Kris";
  }

  function oshiId(): string {
    const id = identityConfig()["oshiId"];
    return typeof id === "string" && id.trim() ? id : DEFAULT_OSHI_ID;
  }

  function playStyleKey(): PlayStyleKey {
    const key = identityConfig()["playStyleKey"];
    return key === "sweetie" || key === "casual" || key === "focused" || key === "dedicated" || key === "unhinged"
      ? key
      : DEFAULT_PLAY_STYLE;
  }

  function commitPlayStyleKey(key: PlayStyleKey): void {
    if (key !== "custom") updateIdentity({ playStyleKey: key });
  }

  function currentOshi() {
    return selectedOshiOption(bundle, oshiId());
  }

  return {
    menuIdentity() {
      const oshi = currentOshi();
      return { label: oshi.name, icon: oshi.icon };
    },

    savedPlayStyleKey: playStyleKey,
    commitPlayStyleKey,

    trainerCardOverlay(opts) {
      const oshi = currentOshi();
      const card = overlay({
        title: "Trainer Card",
        placement: "left",
        body: identitySurface({
          trainerName: trainerName(),
          oshiName: oshi.name,
          oshiPortrait: oshi.portrait,
          playStyleKey: opts.previewPlayStyleKey ?? playStyleKey(),
          onTrainerNameChange: (name) => updateIdentity({ trainerName: name }),
          onOshiSelect: opts.onOshiSelect,
          onPlayStylePreview: opts.onPlayStylePreview,
        }),
        onClose: opts.onClose,
      });
      if (opts.suspended) {
        card.classList.add("overlay--suspended");
        card.setAttribute("aria-hidden", "true");
        card.append(h("div", { class: "overlay__modal-shield", attr: { "aria-hidden": "true" } }));
      }
      return card;
    },

    oshiSelectorOverlay(opts) {
      const selectedOshi = currentOshi();
      return overlay({
        title: "Oshi Selector",
        placement: "center",
        body: oshiSelector({
          selectedId: selectedOshi.id,
          selected: selectedOshi,
          search: oshiSearch,
          onCommit: (oshi) => updateIdentity({ oshiId: oshi.id }),
          onClose: opts.onClose,
        }),
        onClose: opts.onClose,
      });
    },
  };
}
