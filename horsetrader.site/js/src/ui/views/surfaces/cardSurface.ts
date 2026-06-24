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
import { img } from "../../image.ts";
import { formatDate, formatCharacterName } from "../../format.ts";
import { NOTE_MAX_LENGTH, normaliseNote } from "../../../core/persistence/validate.ts";
import type { Bundle } from "../../bundle/access.ts";
import type { BannerKind } from "../../select/aboveLane.ts";
import { cardDetails, type AptitudeAxis, type Facet } from "../../select/cardDetail.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";

export interface CardSurfaceOpts {
  bundle: Bundle;
  kind: BannerKind;
  id: string;
  /** Whether the subject is favourited as the surface opens — the staged baseline for the
   *  ★ toggle. The favourite lives here, not on the banner chip (the chip just reflects it). */
  favourited: boolean;
  /** The subject's note as the surface opens ("" when none) — the staged baseline. */
  note: string;
  /** Apply the staged edits (favourite + note) — called on Update; the surface then closes.
   *  This is the only write, so editing the card never touches the coordinator (and so never
   *  rebuilds the timeline) until the trainer deliberately commits. */
  onCommit: (next: { favourited: boolean; note: string }) => void;
  /** Discard the staged edits and close (Cancel, or a pristine Esc). */
  onCancel: () => void;
}

/** The favourite toggle — a large gold star in the surface's top-right corner: outline (☆)
 *  when not favourited, filled (★) when it is. It flips a *staged* flag (the chip on the
 *  timeline only learns the new state on Update), so its `onToggle` mutates the draft, not
 *  the coordinator. */
function favouriteToggle(favourited: boolean, onToggle: (on: boolean) => void): HTMLElement {
  return h(
    "button",
    {
      class: "card-surface__fav",
      attr: { type: "button", "aria-pressed": String(favourited), "aria-label": "Favourite" },
      on: {
        click: (ev) => {
          const btn = ev.currentTarget as HTMLButtonElement;
          const next = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", String(next));
          btn.textContent = next ? "★" : "☆";
          onToggle(next);
        },
      },
    },
    favourited ? "★" : "☆",
  );
}

/** The note input — the trainer's *why* (Twinkle Monthly · The Interview). A plain textarea
 *  that reads as text; the value is normalised on commit and rendered escaped by the
 *  coordinator/`h` (user data is never markup). It is a *staged* draft: there is no
 *  commit-on-blur — the surface's Update button is the only write — so Enter is an ordinary
 *  newline and leaving the field never persists. */
function noteInput(note: string): HTMLTextAreaElement {
  return h(
    "textarea",
    {
      class: "card-surface__note-input",
      attr: { placeholder: "Why this one?", maxlength: NOTE_MAX_LENGTH, rows: 4 },
    },
    note,
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

  // Staged draft — the favourite flag + the note input. Nothing here writes through; the
  // surface only mutates these locally and applies them on Update, so editing never hits
  // the coordinator (and so never refreshes the timeline) mid-interaction.
  let draftFav = opts.favourited;
  const note = noteInput(opts.note);
  // Pristine ⇒ no staged edits: Esc may back out, and the timeline may swap this card for
  // another (app.ts keys both on this guard via the dismiss button). Notes compare
  // normalised so trailing whitespace doesn't read as a pending edit.
  const pristine = (): boolean => draftFav === opts.favourited && normaliseNote(note.value) === opts.note;

  // The actions reflect the draft live (editing fires no re-render, so they update
  // themselves): with nothing staged the surface shows a lone "Close"; the first edit reveals
  // Update and turns that button into a "Cancel" (discard).
  const cancel = surfaceCancel({ class: "card-surface__cancel", onCancel: opts.onCancel, escSafe: pristine });
  const update = h(
    "button",
    {
      class: "card-surface__update",
      attr: { type: "button" },
      on: { click: () => opts.onCommit({ favourited: draftFav, note: note.value }) },
    },
    "Update",
  );
  const sync = (): void => {
    const clean = pristine();
    update.hidden = clean;
    cancel.textContent = clean ? "Close" : "Cancel";
  };
  sync(); // open pristine: a lone "Close", Update hidden until an edit

  return h(
    "section",
    // Note edits bubble `input` to the section, where one listener resyncs the buttons.
    { class: `card-surface card-surface--${card.rarityTier}`, on: { input: sync } },

    // The favourite — a gold star pinned to the surface's top-right corner.
    favouriteToggle(opts.favourited, (on) => {
      draftFav = on;
      sync();
    }),

    // Top — the art hero beside its identity column (name, tagline, facets).
    h(
      "div",
      { class: "card-surface__top" },

      // Art hero — the reason the surface earns its space.
      h(
        "div",
        { class: "card-surface__art" },
        card.art
          ? img(card.art, { class: "card-surface__art-img", loading: "lazy" })
          : h("div", { class: "card-surface__art-img card-surface__art-img--empty", attr: { "aria-hidden": "true" } }),
      ),

      // Identity column — name + rarity, the flavour tagline, then the facets.
      h(
        "div",
        { class: "card-surface__intro" },

        h(
          "header",
          { class: "card-surface__head" },
          h("h2", { class: "card-surface__name" }, formatCharacterName(card.name)),
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
    h(
      "label",
      { class: "card-surface__note" },
      h("span", { class: "card-surface__note-label" }, "Note"),
      note,
    ),

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

    surfaceActions(cancel, update),
  );
}
