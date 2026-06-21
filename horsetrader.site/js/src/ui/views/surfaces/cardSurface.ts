/**
 * The card detail surface — an art-forward peek at one trainee/support atom (the
 * vessel for the note layer to come, twinkle-monthly/step-1-card-surface.md). It
 * is **not** a stat browser: we bake only identity facets, so the surface shows
 * the art at size, the name + rarity, the kind-appropriate facets, the release
 * date, and — where the bake carries it — a quiet outbound "full stats" link to
 * the live db (deliberate good citizenship; the deep table is borrowed, best left
 * at its source).
 *
 * One surface, kind-branched: trainee vs support differ only in which record they
 * resolve and which facets read, so the branch lives in the `cardDetails`
 * view-model (select/cardDetail.ts) that normalises both into one render shape.
 * Pure view — it reads that shape and renders; it owns no state and reads nothing
 * back out of the DOM.
 */

import "./cardSurface.css";

import { h } from "../../h.ts";
import { formatDate } from "../../format.ts";
import { NOTE_MAX_LENGTH } from "../../../core/persistence/validate.ts";
import type { Bundle } from "../../bundle/access.ts";
import type { BannerKind } from "../../select/aboveLane.ts";
import { cardDetails, type AptitudeAxis, type Facet } from "../../select/cardDetail.ts";

export interface CardSurfaceOpts {
  bundle: Bundle;
  kind: BannerKind;
  id: string;
  /** The subject's current note ("" when none) — the surface's only mutable input. */
  note: string;
  /** Commit the note (normalised + persisted by the coordinator; "" clears). */
  onSetNote: (text: string) => void;
  onClose: () => void;
}

/** The note box — the trainer's *why* (Twinkle Monthly · The Interview). A plain
 *  textarea that reads as text and commits on blur; the value is normalised and
 *  rendered escaped by the coordinator/`h` (user data is never markup). Enter commits
 *  and drops focus (the same "I'm done" as the trainer name); Shift+Enter still inserts
 *  a newline — the note normaliser preserves them. */
function noteBox(note: string, onSetNote: (text: string) => void): HTMLElement {
  return h(
    "label",
    { class: "card-surface__note" },
    h("span", { class: "card-surface__note-label" }, "Note"),
    h("textarea", {
      class: "card-surface__note-input",
      attr: { placeholder: "Why this one?", maxlength: NOTE_MAX_LENGTH, rows: 4 },
      on: {
        blur: (e) => onSetNote((e.target as HTMLTextAreaElement).value),
        keydown: (e) => {
          const ke = e as KeyboardEvent;
          if (ke.key === "Enter" && !ke.shiftKey) {
            ke.preventDefault();
            (ke.target as HTMLTextAreaElement).blur();
          }
        },
      },
    }, note),
  );
}

function facetRow(facet: Facet): HTMLElement {
  return h(
    "div",
    { class: "card-surface__facet" },
    h("span", { class: "card-surface__facet-label" }, facet.label),
    h(
      "span",
      { class: "card-surface__facet-value" },
      facet.attribute
        ? h("img", {
            class: "card-surface__facet-pip",
            attr: { src: `/icons/old/${facet.attribute}.png`, alt: "", width: 18, height: 18, loading: "lazy" },
          })
        : null,
      facet.value,
    ),
  );
}

/** One aptitude axis — a labelled row of grade letters, each coloured by its
 *  `--ht-colour-aptitude-<rank>` token (carried on a `data-rank` for the CSS). */
function aptitudeAxis(axis: AptitudeAxis): HTMLElement {
  return h(
    "div",
    { class: "card-surface__apt-axis" },
    h("span", { class: "card-surface__apt-axis-label" }, axis.label),
    h(
      "div",
      { class: "card-surface__apt-grades" },
      ...axis.grades.map((grade) =>
        h(
          "div",
          { class: "card-surface__apt-cell" },
          h("span", { class: "card-surface__apt-slot" }, grade.slot),
          h("span", { class: "card-surface__apt-rank", attr: { "data-rank": grade.rank } }, grade.rank.toUpperCase()),
        ),
      ),
    ),
  );
}

export function cardSurface(opts: CardSurfaceOpts): HTMLElement {
  const card = cardDetails(opts.bundle, opts.kind, opts.id);

  return h(
    "section",
    { class: `card-surface card-surface--${card.rarityTier}` },

    // Top — the art hero beside its identity column (name, tagline, facets).
    h(
      "div",
      { class: "card-surface__top" },

      // Art hero — the reason the surface earns its space.
      h(
        "div",
        { class: "card-surface__art" },
        card.art
          ? h("img", { class: "card-surface__art-img", attr: { src: card.art, alt: "", loading: "lazy" } })
          : h("div", { class: "card-surface__art-img card-surface__art-img--empty", attr: { "aria-hidden": "true" } }),
      ),

      // Identity column — name + rarity, the flavour tagline, then the facets.
      h(
        "div",
        { class: "card-surface__intro" },

        h(
          "header",
          { class: "card-surface__head" },
          h("h2", { class: "card-surface__name" }, card.name),
          card.rarity ? h("span", { class: `card-surface__rarity card-surface__rarity--${card.rarityTier}` }, card.rarity) : null,
          card.tagline ? h("p", { class: "card-surface__tagline" }, card.tagline) : null,
        ),

        // Facets — the kind-appropriate identity lines + bio vitals + release.
        h(
          "dl",
          { class: "card-surface__facets" },
          ...card.facets.map(facetRow),
          ...card.bio.map(facetRow),
          facetRow({ label: "Released", value: formatDate(card.release) }),
        ),
      ),
    ),

    // Aptitudes — trainee only; the borrowed stat table stops at the door, but the
    // base grades are identity enough to show (coloured by the palette tokens).
    card.aptitudes
      ? h("div", { class: "card-surface__aptitudes" }, ...card.aptitudes.map(aptitudeAxis))
      : null,

    // The note — the trainer's voice on this subject.
    noteBox(opts.note, opts.onSetNote),

    // The outbound deep-link — only when the bake carries a source URL.
    card.source
      ? h(
          "a",
          {
            class: "card-surface__link",
            attr: { href: card.source, target: "_blank", rel: "noopener noreferrer" },
          },
          "View on GameTora ↗",
        )
      : null,

    h(
      "button",
      { class: "card-surface__close", attr: { type: "button" }, on: { click: opts.onClose } },
      "Close",
    ),
  );
}
