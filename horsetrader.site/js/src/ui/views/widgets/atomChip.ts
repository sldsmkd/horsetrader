import "./atomChip.css";

import { h } from "../../h.ts";
import type { BannerAtom, BannerKind } from "../../select/aboveLane.ts";

/** The persisted-favourite seam handed to atom chips: read whether an entity is
 *  favourited, and flip it. Keyed by ETL stable entity id. */
export interface FavouriteBinding {
  isFavourited: (entityId: string) => boolean;
  setFavourited: (entityId: string, on: boolean) => void;
}

/** Open an atom's card-detail surface (twinkle-monthly). Keyed by kind + stable id;
 *  refused while a modal is already up (app.ts guards it, like the commit seam). */
export interface InspectBinding {
  open: (kind: BannerKind, id: string) => void;
}

/** The support type badge — a full-height pip on the chip's right edge (trainees
 *  carry none). In compact mode it floats onto the portrait's top-right corner
 *  (the Gametora card grammar). Sized by CSS off the chip, not a fixed px. */
function attributeIcon(attribute: string, compact: boolean): HTMLElement {
  return h("img", {
    class: compact ? "atom-chip__attr atom-chip__attr--corner" : "atom-chip__attr",
    attr: { src: `/icons/old/${attribute}.png`, alt: attribute, loading: "lazy", decoding: "async" },
  });
}

/** A banner-content atom chip in the rarity border grammar (crystal/gold). The chip
 *  *is* a button: its pressed state (`aria-pressed`) is whether the atom is favourited,
 *  so the favourite reads straight off the control's posture — no separate star chrome.
 *  Clicking opens the atom's card surface, where the favourite is actually toggled. It
 *  opts into pointer handling and swallows `pointerdown` so the timeline doesn't steal
 *  the gesture as a pan (the in-timeline two-opt-in pattern). */
export function atomChip(
  atom: BannerAtom,
  kind: BannerKind,
  fav: FavouriteBinding,
  inspect: InspectBinding,
  compact = false,
): HTMLElement {
  const portrait = atom.image
    ? h("img", { class: "atom-chip__portrait", attr: { src: atom.image, alt: "", loading: "lazy", decoding: "async", draggable: false } })
    : null;

  // Compact (the Desk's pure-icon form) drops the name/subtitle column and floats the
  // type pip onto the portrait corner; full form bookends portrait — text — pip.
  const text = compact
    ? null
    : h(
        "span",
        { class: "atom-chip__text" },
        h("span", { class: "atom-chip__name" }, atom.name),
        h("span", { class: "atom-chip__subtitle" }, atom.subtitle),
      );

  const chip = h(
    "button",
    {
      class: `atom-chip atom-chip--${atom.rarityTier}${compact ? " atom-chip--compact" : ""}`,
      attr: { type: "button", "aria-pressed": String(fav.isFavourited(atom.id)), "aria-label": `Inspect ${atom.name}` },
      on: {
        pointerdown: (ev) => ev.stopPropagation(),
        dblclick: (ev) => ev.stopPropagation(),
        click: (ev) => {
          ev.stopPropagation();
          inspect.open(kind, atom.id);
        },
      },
    },
    portrait,
    text,
    atom.attribute ? attributeIcon(atom.attribute, compact) : null,
  );

  return h("li", { class: "atom-chip__slot" }, chip);
}
