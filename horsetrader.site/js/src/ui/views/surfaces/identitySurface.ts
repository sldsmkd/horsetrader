import "./identitySurface.css";

import { h } from "../../h.ts";
import { collapsePill } from "../collapsePill.ts";
import { playStylePresetGrid } from "./playStylePreset.ts";
import { clubRankIcon } from "./clubSelector.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import type { ClubIdentity } from "../../../core/identity/clubrank.ts";
import type { PlayStyleStrings } from "../../strings.ts";

export interface IdentitySurfaceOpts {
  trainerName: string;
  oshiName: string;
  oshiPortrait: string;
  club: ClubIdentity | null;
  playStyleKey: PlayStyleKey;
  savedPlayStyleKey: PlayStyleKey;
  playStyleStrings: PlayStyleStrings;
  /** The Unity cloud controls, slotted between club info and play style. Optional so the
   *  surface renders standalone (tests / future contexts) without a cloud shell. */
  cloud?: Node | undefined;
  onTrainerNameChange: (name: string) => void;
  onOshiSelect: () => void;
  onClubSelect: () => void;
  onPlayStylePreview: (key: PlayStyleKey) => void;
  /** Collapse/put-away affordance — the pill in the mast dismisses the card. */
  onClose?: (() => void) | undefined;
}

// Trainer name entry is clamped at the keystroke: at most 24 *grapheme clusters*
// (so a ZWJ emoji counts as one and never gets sliced mid-sequence), drawn from a
// safe set — letters, numbers, spaces, and emoji (pictographs + their modifiers,
// regional-indicator flag pairs, and the ZWJ/variation-selector joiners that
// compose them). Everything else — control chars, combining marks (zalgo), RTL
// overrides — is dropped, so a pasted name can't smuggle layout-breaking junk in.
const NAME_MAX_GRAPHEMES = 24;
const NAME_ALLOWED =
  /[\p{L}\p{N} \p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F]/gu;
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function graphemes(s: string): string[] {
  return graphemeSegmenter ? [...graphemeSegmenter.segment(s)].map((seg) => seg.segment) : [...s];
}

function sanitizeTrainerName(raw: string): string {
  const kept = (raw.normalize("NFC").match(NAME_ALLOWED) ?? []).join("");
  return graphemes(kept).slice(0, NAME_MAX_GRAPHEMES).join("");
}

// The Matikane stable names — Matikanetannhauser and Matikanefukukitaru — are the
// only oshi names long enough to overrun the portrait. They're a family prefix
// ("Matikane") run together with a given name; split them so the surface wraps at
// a real space (and the given name reads Ucfirst'd) instead of breaking mid-word.
function displayOshiName(name: string): string {
  const prefix = "Matikane";
  if (name.length <= prefix.length || !name.startsWith(prefix)) return name;
  const given = name.slice(prefix.length);
  return `${prefix} ${given[0]!.toUpperCase()}${given.slice(1)}`;
}

// The club row is a single click target that opens the club modal (name + rank),
// the same spawn pattern as the oshi portrait. In a club it shows the name with the
// rank badge as a trailing chip; with no club it reads a muted "No club" and still
// opens the modal (to join).
function clubRow(opts: IdentitySurfaceOpts): HTMLElement {
  const club = opts.club;
  const body = club
    ? [
        h("span", { class: "identity-surface__club-name" }, club.name),
        h("img", {
          class: "identity-surface__club-rank",
          attr: { src: clubRankIcon(club.rank), alt: club.rank, width: 28, height: 31 },
        }),
      ]
    : [h("span", { class: "identity-surface__club-name identity-surface__club-empty" }, "No club")];
  return h(
    "div",
    { class: "identity-surface__row" },
    h("span", { class: "identity-surface__label" }, "Club"),
    h(
      "button",
      {
        class: "identity-surface__value identity-surface__club",
        attr: { type: "button", "aria-label": club ? "Edit club" : "Join a club", title: club ? "Edit club" : "Join a club" },
        on: { click: opts.onClubSelect },
      },
      ...body,
    ),
  );
}

function editableTrainerName(opts: IdentitySurfaceOpts): HTMLElement {
  const input = h("input", {
    class: "identity-surface__name-input",
    attr: { type: "text", value: opts.trainerName, "aria-label": "Trainer name" },
  });
  // Clamp every keystroke (and paste) to the safe set + 16-grapheme cap. `maxlength`
  // can't do this — it counts UTF-16 units, so it would slice emoji mid-sequence.
  input.addEventListener("input", () => {
    const clean = sanitizeTrainerName(input.value);
    if (clean !== input.value) {
      input.value = clean;
      input.setSelectionRange(clean.length, clean.length);
    }
  });
  const commit = (): void => {
    const name = sanitizeTrainerName(input.value).trim() || "Trainer";
    input.value = name;
    if (name !== opts.trainerName) opts.onTrainerNameChange(name);
  };
  input.addEventListener("change", commit);
  input.addEventListener("blur", commit);
  // No pencil: the input edits in place, with a hover/focus highlight that reads
  // as editable the same way the club row does.
  input.title = "Edit trainer name";

  return input;
}

function playStyle(opts: IdentitySurfaceOpts): HTMLElement {
  return playStylePresetGrid({
    selectedKey: opts.playStyleKey,
    activeKey: opts.savedPlayStyleKey,
    strings: opts.playStyleStrings,
    onPreview: opts.onPlayStylePreview,
  });
}

export function identitySurface(opts: IdentitySurfaceOpts): HTMLElement {
  return h(
    "section",
    { class: "identity-surface" },
    // Mast: the trainer name promoted to the card title, with the put-away pill
    // trailing. Replaces the old window title bar.
    h(
      "div",
      { class: "identity-surface__mast" },
      h("div", { class: "identity-surface__title" }, editableTrainerName(opts)),
      opts.onClose ? collapsePill({ direction: "up", label: "Close trainer card", onClick: opts.onClose }) : null,
    ),
    h(
      "div",
      { class: "identity-surface__card" },
      h(
        "button",
        {
          class: "identity-surface__portrait",
          attr: { type: "button", "aria-label": "Choose oshi", title: "Choose oshi" },
          on: { click: opts.onOshiSelect },
        },
        h("img", { attr: { src: opts.oshiPortrait, alt: "", width: 256, height: 512 } }),
        h("span", { class: "identity-surface__portrait-edit", attr: { "aria-hidden": "true" } }, "✏️"),
        h("span", { class: "identity-surface__portrait-name" }, displayOshiName(opts.oshiName)),
      ),
      // Right panel: club + oshi up top, cloud save filling the space the name
      // used to occupy.
      h(
        "div",
        { class: "identity-surface__details" },
        h(
          "div",
          { class: "identity-surface__section" },
          clubRow(opts),
        ),
        opts.cloud &&
          h(
            "div",
            { class: "identity-surface__cloud" },
            h("span", { class: "identity-surface__label" }, "Cloud Save"),
            h(
              "p",
              { class: "identity-surface__cloud-note" },
              "Sign in to back up your plan and pick it up on any device.",
            ),
            opts.cloud,
          ),
      ),
    ),
    h(
      "div",
      { class: "identity-surface__playstyle" },
      h("span", { class: "identity-surface__label" }, "Play Style"),
      playStyle(opts),
    ),
  );
}
