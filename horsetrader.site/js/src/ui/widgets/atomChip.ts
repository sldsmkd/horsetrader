import "./atomChip.css";

import { h } from "../h.ts";
import type { BannerAtom } from "../select/aboveLane.ts";

/** The persisted-favourite seam handed to atom chips: read whether an entity is
 *  favourited, and flip it. Keyed by ETL stable entity id. */
export interface FavouriteBinding {
  isFavourited: (entityId: string) => boolean;
  setFavourited: (entityId: string, on: boolean) => void;
}

function attributeIcon(attribute: string): HTMLElement {
  return h("img", {
    class: "atom-chip__attr",
    attr: { src: `/icons/old/${attribute}.png`, alt: attribute, width: 14, height: 14, loading: "lazy", decoding: "async" },
  });
}

/** A banner-content pill chip: rarity border grammar (crystal/gold), attribute icon
 *  (supports only), name, and a persisted favourite star (☆/★). */
export function atomChip(atom: BannerAtom, fav: FavouriteBinding): HTMLElement {
  const on = fav.isFavourited(atom.id);

  const star = h(
    "button",
    {
      class: "atom-chip__star",
      attr: { type: "button", "aria-label": "Favourite", "aria-pressed": String(on) },
      on: {
        pointerdown: (ev) => ev.stopPropagation(),
        dblclick: (ev) => ev.stopPropagation(),
        click: (ev) => {
          ev.stopPropagation();
          const btn = ev.currentTarget as HTMLButtonElement;
          const next = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", String(next));
          btn.textContent = next ? "★" : "☆";
          fav.setFavourited(atom.id, next);
        },
      },
    },
    on ? "★" : "☆",
  );

  return h(
    "li",
    { class: `atom-chip atom-chip--${atom.rarityTier}` },
    atom.attribute ? attributeIcon(atom.attribute) : null,
    h("span", { class: "atom-chip__name" }, atom.name),
    star,
  );
}
