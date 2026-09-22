/** A small permanent community card, pinned to the timeline's live today tick. */

import "./card.css";
import "./belowCard.css";
import "./socialCard.css";

import { h } from "../h.ts";
import { SOCIAL_LINKS } from "./socialLinks.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

function socialMark(brand: (typeof SOCIAL_LINKS)[number]["brand"]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "social-card__mark");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", brand === "discord"
    ? "M20.3 4.4A19 19 0 0 0 15.5 3l-.2.4c1.7.5 2.5 1.2 2.5 1.2A16.5 16.5 0 0 0 12 3.5a16.5 16.5 0 0 0-5.8 1.1s.8-.7 2.6-1.2L8.5 3a19 19 0 0 0-4.8 1.4C.7 8.9-.1 13.3.3 17.7A19.4 19.4 0 0 0 6.2 21l.7-1.2c-1.3-.5-2-1.3-2-1.3l.5.3.3.2A13.7 13.7 0 0 0 12 20.4a13.7 13.7 0 0 0 6.3-1.4l.3-.2.5-.3s-.7.8-2 1.3l.7 1.2a19.4 19.4 0 0 0 5.9-3.3c.5-5.1-.8-9.5-3.4-13.3zM8.5 15.3c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2zm7 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2z"
    : "M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5z");
  svg.append(path);
  return svg;
}

export interface SocialCardProps {
  x: number;
}

export function socialCard({ x }: SocialCardProps): HTMLElement {
  const el = h(
    "aside",
    { class: "card card--below card--social", attr: { "aria-label": "Horsetrader community" } },
    h("div", { class: "card__stem" }),
    h(
      "div",
      { class: "card__body" },
      h("span", { class: "social-card__eyebrow" }, "Horsetrader"),
      h("span", { class: "social-card__title" }, "Find us"),
      h(
        "nav",
        { class: "social-card__links", attr: { "aria-label": "Horsetrader social links" } },
        ...SOCIAL_LINKS.map(({ brand, label, href }) => h(
          "a",
          {
            class: `social-card__link social-card__link--${brand}`,
            attr: { href, target: "_blank", rel: "noopener noreferrer", "aria-label": label },
          },
          socialMark(brand),
          h("span", { class: "social-card__link-label" }, label),
        )),
      ),
    ),
  );
  el.style.left = `${x}px`;
  return el;
}
